import os
import json
import logging
from typing import List, Union, Optional, Dict, Any
from langchain_community.vectorstores import PGVector
from backend.app.domain.query_router import route_query, QueryIntent
from backend.app.domain.retrieval_fusion import (
    RetrievedChunk,
    reciprocal_rank_fusion,
    chunks_to_context_string,
)
from backend.app.domain.sparse_retriever import sparse_search
from backend.app.utils.reranker import rerank_chunks
from langchain_core.vectorstores import VectorStore
from langchain_groq import ChatGroq
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError
from backend.app.core.config import settings
from backend.app.utils.connection_utils import (
    create_neo4j_driver,
    verify_neo4j_connection,
    resolve_neo4j_database,
    retry_on_connection_error,
)
from backend.app.utils.embedding_utils import get_embeddings

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: Union[PGVector, VectorStore], user_id: str = None):
        """
        Initialize HybridRetriever with user isolation support.
        
        Args:
            vector_store: PGVector store for semantic search
            user_id: User ID for data isolation (required for multi-user support)
        """
        if not user_id:
            raise ValueError("user_id is required for user isolation. All retrieval operations must be scoped to a user.")
        
        self.user_id = user_id
        self.vector_store = vector_store
        
        # Use GroqKeyManager for round-robin API key rotation
        from backend.app.utils.groq_key_manager import get_groq_manager
        try:
            self.groq_manager = get_groq_manager()
            # Get LLM instance (will use round-robin key selection)
            self.llm = self.groq_manager.get_llm()
        except RuntimeError:
            # Manager not initialized, fall back to direct initialization
            logger.warning("⚠️ GroqKeyManager not initialized, using single key fallback")
            self.groq_manager = None
            api_keys = settings.get_groq_api_keys()
            self.llm = ChatGroq(
                model_name="llama-3.3-70b-versatile",
                temperature=0,
                groq_api_key=api_keys[0] if api_keys else settings.GROQ_API_KEY
            )
        # Use configurable embedding provider (supports local, Voyage AI, Cohere, OpenAI, etc.)
        self.embeddings = get_embeddings()
        
        # --- NEO4J CONNECTION (Read-Only access for RAG) ---
        uri = settings.NEO4J_URI
        user = settings.NEO4J_USERNAME
        password = settings.NEO4J_PASSWORD
        self.database = resolve_neo4j_database(uri, os.getenv("NEO4J_DATABASE"))
        
        if uri and user and password:
            # Use connection utility with proper configuration
            self.driver = create_neo4j_driver(uri, user, password, database=self.database)
            if not self.driver:
                logger.error("❌ Neo4j driver creation failed in Retriever. Graph context will be empty.")
        else:
            logger.error("❌ Neo4j Credentials missing in Retriever. Graph context will be empty.")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def reload_graph(self):
        """
        Legacy method kept for compatibility. 
        With Neo4j, data is always live, so this is a no-op.
        """
        pass

    def retrieve(self, query: str, k_vectors: int = 20) -> str:
        """
        GraphRAG hybrid retrieval: intent routing → dense + sparse + graph → RRF → rerank.
        """
        routed = route_query(query, k_vectors)
        logger.info(f"Query intent: {routed.intent.value}, k={routed.k_vectors}")

        person_name = routed.person_name or self._extract_person_name(query)
        node_names = routed.node_names or self._extract_node_names(query)

        node_context = ""
        node_file_paths: set = set()
        if node_names and self.driver:
            node_context, node_file_paths = self._query_nodes_by_name(node_names)

        dense_chunks = self._dense_search(query, routed.k_vectors, node_file_paths)
        sparse_chunks = sparse_search(
            query, self.user_id, k=routed.k_vectors, file_filter=list(node_file_paths) or None
        )
        graph_chunks = self._graph_to_chunks(
            routed, person_name, node_names, node_context, node_file_paths, dense_chunks
        )

        fused = reciprocal_rank_fusion(
            {
                "dense": dense_chunks,
                "sparse": sparse_chunks,
                "graph": graph_chunks,
            },
            weights={
                "dense": routed.dense_weight,
                "sparse": routed.sparse_weight,
                "graph": routed.graph_weight,
            },
        )
        final_chunks = rerank_chunks(query, fused)
        code_context_str = chunks_to_context_string(final_chunks)

        graph_context = self._build_graph_context(
            routed, person_name, node_context, final_chunks, node_file_paths
        )

        logger.info(
            f"Retrieval fused: dense={len(dense_chunks)} sparse={len(sparse_chunks)} "
            f"graph={len(graph_chunks)} → final={len(final_chunks)}"
        )

        return json.dumps({
            "code_context": code_context_str,
            "graph_context": graph_context,
            "intent": routed.intent.value,
            "chunk_count": len(final_chunks),
        }, indent=2)

    def _dense_search(
        self, query: str, k: int, node_file_paths: set
    ) -> List[RetrievedChunk]:
        """Dense vector search → RetrievedChunk list."""
        chunks: List[RetrievedChunk] = []
        search_filter = {"user_id": self.user_id}
        try:
            if hasattr(self.vector_store, "similarity_search_with_score"):
                results = self.vector_store.similarity_search_with_score(
                    query, k=k * 2 if node_file_paths else k, filter=search_filter
                )
            else:
                docs = self.vector_store.similarity_search(
                    query, k=k * 2 if node_file_paths else k, filter=search_filter
                )
                results = [(doc, 0.5) for doc in docs]

            for doc, distance in results:
                meta = doc.metadata or {}
                fn = meta.get("file_name", meta.get("source", "unknown"))
                if node_file_paths and not any(
                    fp in fn or fn in fp for fp in node_file_paths
                ):
                    continue
                chunks.append(
                    RetrievedChunk(
                        chunk_id=self._metadata_to_node_id(meta) or fn,
                        content=doc.page_content,
                        metadata=meta,
                        file_name=fn,
                        source="dense",
                        raw_score=1.0 - float(distance) if distance else 0.5,
                    )
                )
                if len(chunks) >= k:
                    break

            if not chunks:
                chunks = self._dense_search_sql_fallback(query, k)
        except Exception as e:
            error_msg = str(e).lower()
            if "dimension" in error_msg or "vector" in error_msg:
                chunks.append(
                    RetrievedChunk(
                        chunk_id="error",
                        content=(
                            "⚠️ ERROR: Dimension mismatch detected. Run migrate_embeddings and re-ingest."
                        ),
                        source="dense",
                    )
                )
            else:
                logger.error(f"Dense search failed: {e}", exc_info=True)
                chunks = self._dense_search_sql_fallback(query, k)
        return chunks

    def _dense_search_sql_fallback(self, query: str, k: int) -> List[RetrievedChunk]:
        chunks: List[RetrievedChunk] = []
        try:
            from sqlalchemy import text
            from backend.app.models.user import engine

            query_embedding = self.embeddings.embed_query(query)
            embedding_str = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
            with engine.connect() as conn:
                sql_query = text(f"""
                    SELECT id, content, metadata, file_name, source,
                           1 - (embedding <=> CAST(:embedding AS vector)) as similarity
                    FROM {settings.POSTGRES_VECTOR_TABLE}
                    WHERE metadata->>'user_id' = :user_id
                    ORDER BY embedding <=> CAST(:embedding AS vector)
                    LIMIT :limit
                """)
                rows = conn.execute(
                    sql_query,
                    {"embedding": embedding_str, "user_id": self.user_id, "limit": k},
                ).fetchall()
                for row in rows:
                    rid, content, metadata, file_name, source, sim = row
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except Exception:
                            metadata = {}
                    fn = file_name or source or "unknown"
                    chunks.append(
                        RetrievedChunk(
                            chunk_id=str(rid),
                            content=content or "",
                            metadata=metadata or {},
                            file_name=fn,
                            source="dense",
                            raw_score=float(sim or 0),
                        )
                    )
        except Exception as e:
            logger.error(f"Dense SQL fallback failed: {e}")
        return chunks

    def _graph_to_chunks(
        self,
        routed,
        person_name: Optional[str],
        node_names: List[str],
        node_context: str,
        node_file_paths: set,
        dense_chunks: List[RetrievedChunk],
    ) -> List[RetrievedChunk]:
        """Convert graph lookup results into rankable chunks."""
        chunks: List[RetrievedChunk] = []
        if node_context:
            for fp in node_file_paths:
                chunks.append(
                    RetrievedChunk(
                        chunk_id=fp,
                        content=node_context[:8000],
                        file_name=fp,
                        source="graph",
                        metadata={"graph_type": "symbol_match"},
                    )
                )
            if not node_file_paths:
                chunks.append(
                    RetrievedChunk(
                        chunk_id="graph_symbol",
                        content=node_context[:8000],
                        source="graph",
                        metadata={"graph_type": "symbol_match"},
                    )
                )

        anchors = {c.file_name for c in dense_chunks if c.file_name}
        anchors.update(node_file_paths)

        if person_name and self.driver:
            pw = self._query_person_work(person_name)
            if pw and "No work found" not in pw:
                chunks.append(
                    RetrievedChunk(
                        chunk_id=f"person:{person_name}",
                        content=pw[:8000],
                        source="graph",
                        metadata={"graph_type": "person"},
                    )
                )

        limit = 50 if routed.intent in (QueryIntent.ARCHITECTURE, QueryIntent.CALL_FLOW) else 20
        if anchors and self.driver:
            expanded = self._expand_anchors_neo4j(list(anchors), limit=limit)
            if expanded and "No graph context" not in expanded:
                for fp in list(anchors)[:10]:
                    chunks.append(
                        RetrievedChunk(
                            chunk_id=f"graph:{fp}",
                            content=expanded[:6000],
                            file_name=fp,
                            source="graph",
                            metadata={"graph_type": "expansion"},
                        )
                    )
        elif routed.intent in (QueryIntent.ARCHITECTURE, QueryIntent.SEMANTIC) and self.driver:
            overview = self._get_project_overview_neo4j()
            if overview and "No structural" not in overview:
                chunks.append(
                    RetrievedChunk(
                        chunk_id="graph:overview",
                        content=overview[:8000],
                        source="graph",
                        metadata={"graph_type": "overview"},
                    )
                )
        return chunks[:15]

    def _build_graph_context(
        self,
        routed,
        person_name: Optional[str],
        node_context: str,
        final_chunks: List[RetrievedChunk],
        node_file_paths: set,
    ) -> str:
        """Dedicated graph narrative for LLM PART 2."""
        graph_parts = [c.content for c in final_chunks if c.source == "graph"]
        if graph_parts:
            return "\n\n".join(graph_parts[:5])

        anchors = {c.file_name for c in final_chunks if c.file_name}
        anchors.update(node_file_paths)

        if person_name and self.driver:
            ctx = self._query_person_work(person_name)
            if anchors:
                extra = self._expand_anchors_neo4j(list(anchors))
                if extra and "No graph context" not in extra:
                    ctx += "\n\n--- Related Files ---\n" + extra
            return ctx or "No graph context available."

        if node_context:
            ctx = node_context
            if anchors:
                extra = self._expand_anchors_neo4j(list(anchors), limit=50)
                if extra and "No graph context" not in extra:
                    ctx += "\n\n--- Related Files ---\n" + extra
            return ctx

        if anchors and self.driver:
            limit = 50 if routed.intent == QueryIntent.ARCHITECTURE else 20
            return self._expand_anchors_neo4j(list(anchors), limit=limit)

        if routed.intent in (QueryIntent.ARCHITECTURE, QueryIntent.SEMANTIC) and self.driver:
            return self._get_project_overview_neo4j()

        return "No graph context available."
    
    def _extract_node_names(self, query: str) -> List[str]:
        """
        Extract potential node/function names from query.
        Looks for quoted strings, function-like patterns, and specific identifiers.
        Returns list of potential node names.
        """
        import re
        node_names = []
        
        # Pattern 1: Quoted strings (e.g., "generate_vibevoice_tokenizer_files" or 'run_command')
        # This is the most reliable pattern - extract anything in quotes
        quoted_pattern = r'["\']([^"\']+)["\']'
        quoted_matches = re.findall(quoted_pattern, query)
        for match in quoted_matches:
            # Filter out very short matches and common words that aren't function names
            match_clean = match.strip()
            if len(match_clean) > 2:  # Allow shorter names (like "x", "y" for variables)
                # Skip if it's just common words
                common_words = {'the', 'selected', 'node', 'path', 'to', 'explain', 'about', 'more', 'this', 'that'}
                if match_clean.lower() not in common_words:
                    node_names.append(match_clean)
        
        # Pattern 2: After "selected node:" or "node:" patterns
        # Look for: "selected node: function_name" or "node: functionName"
        node_patterns = [
            r'(?:selected\s+)?node[\s:]+([a-zA-Z_][a-zA-Z0-9_]*)',
            r'(?:path\s+to\s+the\s+selected\s+node[\s:]+["\']?)([a-zA-Z_][a-zA-Z0-9_]*)',
        ]
        for pattern in node_patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            for match in matches:
                if len(match) > 2 and match.lower() not in ['the', 'selected', 'node', 'path', 'to', 'explain', 'about']:
                    node_names.append(match)
        
        # Pattern 3: Function-like identifiers at the end of query (common pattern)
        # Look for identifiers that look like function/class names (snake_case, camelCase, PascalCase)
        # This catches cases like "Explain run_command" or "What is generate_vibevoice_tokenizer_files"
        identifier_pattern = r'\b([a-zA-Z_][a-zA-Z0-9_]*(?:_[a-zA-Z0-9_]+)+)\b'  # snake_case with at least one underscore
        identifier_matches = re.findall(identifier_pattern, query)
        for match in identifier_matches:
            # Skip if it's a common phrase or too short
            if len(match) > 5 and match.lower() not in ['the', 'selected', 'node', 'path', 'to']:
                node_names.append(match)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_names = []
        for name in node_names:
            name_lower = name.lower()
            if name_lower not in seen:
                seen.add(name_lower)
                unique_names.append(name)
        
        return unique_names
    
    def _query_nodes_by_name(self, node_names: List[str]) -> tuple:
        """
        Query Neo4j directly for nodes matching the given names.
        Returns tuple of (graph_context_string, set_of_file_paths).
        """
        if not self.driver or not node_names:
            return "", set()
        
        file_paths = set()
        node_info_list = []
        relationships_list = []
        
        # Build Cypher query to find nodes by name (exact or partial match)
        # Search in both 'name' and 'id' fields, handling various formats
        # Node IDs can be: "file.py", "file.py::ClassName", "file.py::ClassName::methodName"
        # Note: Neo4j Cypher doesn't support // comments, so we use /* */ style
        query = """
        UNWIND $node_names AS search_name
        MATCH (n:CodeNode {user_id: $user_id})
        WHERE 
            toLower(n.name) = toLower(search_name) OR
            toLower(n.id) = toLower(search_name) OR
            toLower(n.id) ENDS WITH ('::' + toLower(search_name)) OR
            toLower(n.name) CONTAINS toLower(search_name) OR
            toLower(n.id) CONTAINS toLower(search_name) OR
            toLower(n.id) CONTAINS ('::' + toLower(search_name) + '::') OR
            toLower(n.id) ENDS WITH ('::' + toLower(search_name))
        OPTIONAL MATCH (n)-[r]-(m:CodeNode {user_id: $user_id})
        RETURN DISTINCT n, r, m, search_name
        ORDER BY 
            CASE 
                WHEN toLower(n.name) = toLower(search_name) THEN 1
                WHEN toLower(n.id) = toLower(search_name) THEN 2
                WHEN toLower(n.id) ENDS WITH ('::' + toLower(search_name)) THEN 3
                WHEN toLower(n.id) CONTAINS ('::' + toLower(search_name) + '::') THEN 4
                WHEN toLower(n.name) CONTAINS toLower(search_name) THEN 5
                ELSE 6
            END,
            n.commit_count DESC
        LIMIT 100
        """
        
        try:
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query, user_id=self.user_id, node_names=node_names)
                    # Fetch all records before session closes to avoid ResultConsumedError
                    return list(result)
            
            records = _execute_query()
            
            found_nodes = {}
            for record in records:
                n = record["n"]
                r = record["r"]
                m = record["m"]
                search_name = record["search_name"]
                
                node_id = n.get("id", "")
                node_name = n.get("name", node_id)
                node_type = n.get("type", "unknown")
                
                # Extract file path from node ID (format: "path/to/file.py::ClassName::methodName")
                if "::" in node_id:
                    file_path = node_id.split("::")[0]
                    file_paths.add(file_path)
                elif node_type == "file":
                    file_paths.add(node_id)
                
                # Store node info
                if node_id not in found_nodes:
                    found_nodes[node_id] = {
                        "id": node_id,
                        "name": node_name,
                        "type": node_type,
                        "last_author": n.get("last_author", ""),
                        "last_modified": n.get("last_modified", ""),
                        "commit_count": n.get("commit_count", 0),
                        "relationships": []
                    }
                
                # Track relationships
                if r and m:
                    rel_type = r.type
                    m_id = m.get("id", "unknown")
                    m_name = m.get("name", m.get("id", "unknown"))
                    m_type = m.get("type", "unknown")
                    found_nodes[node_id]["relationships"].append({
                        "type": rel_type,
                        "target_id": m_id,
                        "target_name": m_name,
                        "target_type": m_type
                    })
            
            # Format the results
            if found_nodes:
                result_parts = [f"=== NODES FOUND: {', '.join(node_names)} ==="]
                
                for node_id, node_data in list(found_nodes.items())[:20]:  # Limit to top 20
                    node_info = f"\n--- {node_data['name']} ({node_data['type']}) ---"
                    node_info += f"\n  ID: {node_data['id']}"
                    
                    if node_data.get('last_author'):
                        node_info += f"\n  Author: {node_data['last_author']}"
                    if node_data.get('last_modified'):
                        node_info += f"\n  Last Modified: {node_data['last_modified']}"
                    if node_data.get('commit_count', 0) > 0:
                        node_info += f"\n  Commits: {node_data['commit_count']}"
                    
                    if node_data['relationships']:
                        node_info += f"\n  Relationships ({len(node_data['relationships'])}):"
                        for rel in node_data['relationships'][:10]:  # Limit relationships per node
                            node_info += f"\n    --[{rel['type']}]--> {rel['target_name']} ({rel['target_type']})"
                    
                    node_info_list.append(node_info)
                
                result_parts.extend(node_info_list)
                
                if len(found_nodes) > 20:
                    result_parts.append(f"\n... and {len(found_nodes) - 20} more nodes")
                
                return "\n".join(result_parts), file_paths
            else:
                return f"No nodes found matching: {', '.join(node_names)}", file_paths
                
        except Exception as e:
            logger.error(f"Node name query failed: {e}", exc_info=True)
            # Don't return error message as context - just return empty and log
            # This allows the system to fall back to regular vector search
            return "", file_paths

    def _get_project_overview_neo4j(self) -> str:
        """
        When vector DB has no results (e.g. before ingestion or for new user), get high-level
        project structure from Neo4j so general/architecture questions can still be answered.
        Returns file-level nodes and key relationships for this user's graph.
        """
        if not self.driver:
            return "No graph context available (Neo4j disconnected)."
        query = """
        MATCH (n:CodeNode {user_id: $user_id})
        WHERE n.type = 'file' OR NOT n.id CONTAINS '::'
        WITH n
        ORDER BY n.id
        LIMIT 80
        OPTIONAL MATCH (n)-[r]-(m:CodeNode {user_id: $user_id})
        WHERE m.type = 'file' OR NOT m.id CONTAINS '::'
        WITH n, collect(DISTINCT {type: type(r), other: m.id})[..5] as rels
        RETURN n.id as id, n.name as name, n.type as type, rels
        """
        try:
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query, user_id=self.user_id)
                    return list(result)
            records = _execute()
            if not records:
                return "No structural relationships found in graph (repository may not be ingested yet)."
            parts = ["=== PROJECT STRUCTURE (from knowledge graph) ==="]
            for rec in records:
                nid = rec.get("id", "")
                name = rec.get("name", nid)
                ntype = rec.get("type", "file")
                rels = rec.get("rels") or []
                line = f"\n--- {name} ({ntype}) ---\n  ID: {nid}"
                if rels:
                    rstr = ", ".join(f"[{r.get('type', '?')}]-> {r.get('other', '?')}" for r in rels if r.get("other"))
                    if rstr:
                        line += f"\n  Relationships: {rstr}"
                parts.append(line)
            return "\n".join(parts)
        except Exception as e:
            logger.warning(f"Project overview query failed: {e}")
            return "No graph context available."
    
    def _extract_person_name(self, query: str) -> str:
        """
        Extract person name from query using simple heuristics and LLM.
        Returns empty string if no person detected.
        """
        query_lower = query.lower()
        
        # Common patterns for person queries
        person_patterns = [
            r"what (is|does|are) (.+?) (working on|doing|contributing)",
            r"who is (.+?)",
            r"(.+?) (is|are) (working on|doing|contributing)",
            r"show (me )?(what|work) (.+?) (is|are) (working on|doing)",
        ]
        
        import re
        for pattern in person_patterns:
            match = re.search(pattern, query_lower)
            if match:
                # Extract the person name (usually the first or second group)
                groups = match.groups()
                if len(groups) >= 2:
                    potential_name = groups[1] if groups[1] else groups[0]
                    # Clean up the name
                    potential_name = potential_name.strip()
                    # If it looks like a name (has capital letters or is a proper noun)
                    if len(potential_name) > 2 and not potential_name.startswith("the "):
                        return potential_name
        
        # Try LLM extraction for more complex cases
        try:
            prompt = f"""Extract the person's name from this query. Return ONLY the name, nothing else. If no person is mentioned, return "NONE".

Query: {query}

Person name:"""
            # Use round-robin manager with retry if available
            if hasattr(self, 'groq_manager') and self.groq_manager:
                def invoke_llm(llm):
                    return llm.invoke(prompt)
                response = self.groq_manager.call_with_retry(invoke_llm)
            else:
                response = self.llm.invoke(prompt)
            
            name = response.content.strip()
            if name and name.upper() != "NONE" and len(name) > 2:
                return name
        except Exception as e:
            logger.debug(f"LLM person extraction failed: {e}")
        
        return ""
    
    def _query_person_work(self, person_name: str) -> str:
        """
        Query Neo4j directly for what a person is working on.
        Searches in last_author, top_owner, and collaborators fields.
        """
        if not self.driver:
            return "Neo4j not available for person query."
        
        # Normalize person name (case-insensitive matching)
        person_lower = person_name.lower()
        
        # Cypher query to find all nodes where this person is involved
        query = """
        MATCH (n:CodeNode {user_id: $user_id})
        WHERE 
            toLower(n.last_author) CONTAINS $person_name OR
            toLower(n.top_owner) CONTAINS $person_name OR
            ANY(collab IN n.collaborators WHERE toLower(collab) CONTAINS $person_name)
        OPTIONAL MATCH (n)-[r]-(m:CodeNode {user_id: $user_id})
        RETURN n, r, m
        ORDER BY n.commit_count DESC
        LIMIT 50
        """
        
        person_work = []
        files_owned = []
        files_contributed = []
        relationships = []
        
        try:
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query, user_id=self.user_id, person_name=person_lower)
                    # Fetch all records before session closes to avoid ResultConsumedError
                    return list(result)
            
            records = _execute_query()
            
            for record in records:
                n = record["n"]
                r = record["r"]
                m = record["m"]
                
                node_id = n.get("id", "")
                node_name = n.get("name", node_id)
                node_type = n.get("type", "unknown")
                last_author = n.get("last_author", "")
                top_owner = n.get("top_owner", "")
                collaborators = n.get("collaborators", [])
                commit_count = n.get("commit_count", 0)
                last_modified = n.get("last_modified", "")
                
                # Determine relationship to person
                role = []
                if top_owner and person_lower in top_owner.lower():
                    role.append("PRIMARY OWNER")
                    files_owned.append({
                        "id": node_id,
                        "name": node_name,
                        "type": node_type,
                        "commits": commit_count,
                        "modified": last_modified
                    })
                elif last_author and person_lower in last_author.lower():
                    role.append("LAST AUTHOR")
                    files_contributed.append({
                        "id": node_id,
                        "name": node_name,
                        "type": node_type,
                        "commits": commit_count,
                        "modified": last_modified
                    })
                elif collaborators:
                    for collab in collaborators:
                        if person_lower in collab.lower():
                            role.append("COLLABORATOR")
                            if node_id not in [f["id"] for f in files_contributed]:
                                files_contributed.append({
                                    "id": node_id,
                                    "name": node_name,
                                    "type": node_type,
                                    "commits": commit_count,
                                    "modified": last_modified
                                })
                            break
                
                # Format node info
                role_str = ", ".join(role) if role else "INVOLVED"
                info = f"{node_name} ({node_type}) - {role_str}"
                if commit_count > 0:
                    info += f" - {commit_count} commits"
                if last_modified:
                    info += f" - Last modified: {last_modified}"
                person_work.append(info)
                
                # Track relationships
                if r and m:
                    rel_type = r.type
                    relationships.append(f"{node_id} --[{rel_type}]--> {m.get('id', 'unknown')}")
        
        except Exception as e:
            logger.error(f"Person query failed: {e}")
            return f"Error querying person work: {e}"
        
        # Format response
        if not person_work:
            return f"No work found for {person_name} in the codebase."
        
        result_parts = [f"=== {person_name.upper()}'S WORK ==="]
        
        if files_owned:
            result_parts.append(f"\n--- PRIMARY OWNERSHIP ({len(files_owned)} files) ---")
            for f in files_owned[:10]:  # Limit to top 10
                result_parts.append(f"  • {f['name']} ({f['type']}) - {f['commits']} commits - {f['modified']}")
            if len(files_owned) > 10:
                result_parts.append(f"  ... and {len(files_owned) - 10} more files")
        
        if files_contributed:
            result_parts.append(f"\n--- CONTRIBUTIONS ({len(files_contributed)} files) ---")
            for f in files_contributed[:10]:  # Limit to top 10
                result_parts.append(f"  • {f['name']} ({f['type']}) - {f['commits']} commits - {f['modified']}")
            if len(files_contributed) > 10:
                result_parts.append(f"  ... and {len(files_contributed) - 10} more files")
        
        if relationships:
            result_parts.append(f"\n--- RELATIONSHIPS ({len(relationships)} connections) ---")
            result_parts.extend(relationships[:20])  # Limit relationships
        
        return "\n".join(result_parts)

    def _expand_anchors_neo4j(self, file_anchors: List[str], limit: int = 20) -> str:
        """
        Queries Neo4j to find structural relationships & Git metadata 
        for the identified anchor files.
        
        Args:
            file_anchors: List of file paths to expand
            limit: Maximum number of relationships to return (default: 20, higher for architecture queries)
        """
        if not self.driver or not file_anchors:
            return "No graph context available (DB disconnected or no anchors)."

        # Cypher Query:
        # 1. Match nodes that START with the filename (File node + its Classes/Functions)
        # 2. Find incoming/outgoing relationships (r) to other nodes (m)
        # 3. Return the triple + metadata
        # For architecture queries with higher limit, we get more comprehensive context
        query = f"""
        UNWIND $anchors AS filename
        MATCH (n:CodeNode {{user_id: $user_id}}) 
        WHERE n.id STARTS WITH filename
        OPTIONAL MATCH (n)-[r]-(m:CodeNode {{user_id: $user_id}})
        RETURN n, r, m
        LIMIT {limit}
        """
        
        relevant_info = set()
        
        try:
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query, user_id=self.user_id, anchors=file_anchors)
                    # Fetch all records before session closes to avoid ResultConsumedError
                    return list(result)
            
            records = _execute_query()
            
            for record in records:
                n = record["n"]
                r = record["r"]
                m = record["m"]

                # 1. Format Node Metadata (Git Blame / Time Travel info)
                meta_str = ""
                if n.get("last_author"):
                    meta_str = f" [Author: {n.get('last_author')}, Mod: {n.get('last_modified')}]"
                
                # Add node type and name for better context
                node_type = n.get("type", "unknown")
                node_name = n.get("name", n.get("id", "unknown"))
                node_info = f"{node_name} ({node_type})"

                # 2. Format Relationship
                # If we found a relationship, format it: A -[REL]-> B
                if r and m:
                    rel_type = r.type
                    m_type = m.get("type", "unknown")
                    m_name = m.get("name", m.get("id", "unknown"))
                    # Direction check (simplified for context string)
                    # We just want to know A relates to B
                    info_str = f"{node_info} --[{rel_type}]--> {m_name} ({m_type}){meta_str}"
                    relevant_info.add(info_str)
                else:
                    # Isolated node (just file info)
                    relevant_info.add(f"Node: {node_info}{meta_str}")

        except Exception as e:
            logger.error(f"Neo4j Context Query Failed: {e}")
            return "Graph query failed."

        if not relevant_info:
            return "No structural relationships found in graph."
            
        return "\n".join(list(relevant_info))

    @staticmethod
    def _metadata_to_node_id(metadata: dict) -> Optional[str]:
        """Map pgvector chunk metadata to Neo4j CodeNode.id."""
        symbol_id = (metadata.get("symbol_id") or "").strip()
        if symbol_id:
            return symbol_id.replace("\\", "/")

        file_name = (metadata.get("file_name") or metadata.get("source") or "").strip()
        file_name = file_name.replace("\\", "/")
        if not file_name:
            return None

        symbol = (metadata.get("symbol_name") or "").strip()
        chunk_type = (metadata.get("chunk_type") or "").lower()
        if symbol and chunk_type in ("function", "class"):
            return f"{file_name}::{symbol}"
        return file_name

    @staticmethod
    def _distance_to_score(distance: float) -> float:
        """Map vector distance to UA-style score (0 = best match, 1 = worst)."""
        try:
            d = float(distance)
        except (TypeError, ValueError):
            return 0.5
        return round(min(1.0, max(0.0, d / 1.5)), 4)

    def find_seed_nodes(
        self,
        query: str,
        k: int = 15,
        layer_hint: Optional[str] = None,
    ) -> List["MatchedSeed"]:
        """
        Semantic seed selection for focused subgraph extraction.
        Uses pgvector similarity; returns ranked node ids with UA-compatible scores.
        """
        from backend.app.schemas.graph_subgraph import MatchedSeed

        q = (query or "").strip()
        if not q:
            return []

        search_filter = {"user_id": self.user_id}
        results: List[tuple] = []

        try:
            if hasattr(self.vector_store, "similarity_search_with_score"):
                results = self.vector_store.similarity_search_with_score(
                    q, k=k * 3, filter=search_filter
                )
            else:
                docs = self.vector_store.similarity_search(q, k=k * 3, filter=search_filter)
                results = [(doc, 0.5) for doc in docs]
        except Exception as e:
            logger.warning(f"find_seed_nodes vector search failed: {e}")
            return []

        best_by_node: dict[str, float] = {}
        for doc, distance in results:
            meta = doc.metadata or {}
            if layer_hint:
                from backend.app.domain.graph_bridge import infer_layer

                pseudo = {"id": meta.get("file_name") or meta.get("source") or "", "type": "file"}
                if infer_layer(pseudo) != layer_hint:
                    continue
            nid = self._metadata_to_node_id(meta)
            if not nid:
                continue
            score = self._distance_to_score(distance)
            if nid not in best_by_node or score < best_by_node[nid]:
                best_by_node[nid] = score

        ranked = sorted(best_by_node.items(), key=lambda x: x[1])[:k]
        return [MatchedSeed(nodeId=nid, score=sc) for nid, sc in ranked]

    def find_fused_seed_nodes(
        self,
        query: str,
        k: int = 15,
        layer_hint: Optional[str] = None,
    ) -> List["MatchedSeed"]:
        """RRF fusion of dense + sparse channels for subgraph seed selection."""
        from backend.app.schemas.graph_subgraph import MatchedSeed
        from backend.app.domain.graph_bridge import infer_layer

        routed = route_query(query, k)
        dense = self._dense_search(query, k * 2, set())
        sparse = sparse_search(query, self.user_id, k=k * 2)

        if layer_hint:
            def _layer_ok(ch: RetrievedChunk) -> bool:
                pseudo = {"id": ch.file_name or ch.metadata.get("file_name", ""), "type": "file"}
                return infer_layer(pseudo) == layer_hint
            dense = [c for c in dense if _layer_ok(c)]
            sparse = [c for c in sparse if _layer_ok(c)]

        fused = reciprocal_rank_fusion(
            {"dense": dense, "sparse": sparse, "graph": []},
            weights={"dense": routed.dense_weight, "sparse": routed.sparse_weight, "graph": 0},
        )
        fused = rerank_chunks(query, fused, final_k=k)

        out: List[MatchedSeed] = []
        for ch in fused:
            nid = self._metadata_to_node_id(ch.metadata) or ch.file_name
            if nid:
                out.append(MatchedSeed(nodeId=nid, score=ch.rrf_score or ch.raw_score))
        return out[:k]