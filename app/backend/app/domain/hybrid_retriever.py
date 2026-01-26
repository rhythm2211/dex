import os
import json
import logging
from typing import List, Union
from langchain_community.vectorstores import PGVector
from langchain_core.vectorstores import VectorStore
from langchain_groq import ChatGroq
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError
from backend.app.core.config import settings
from backend.app.utils.connection_utils import create_neo4j_driver, verify_neo4j_connection, retry_on_connection_error
from backend.app.utils.embedding_utils import get_embeddings

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: Union[PGVector, VectorStore]):
        self.vector_store = vector_store
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        # Use configurable embedding provider (supports local, Voyage AI, Cohere, OpenAI, etc.)
        self.embeddings = get_embeddings()
        
        # --- NEO4J CONNECTION (Read-Only access for RAG) ---
        uri = settings.NEO4J_URI
        user = settings.NEO4J_USERNAME
        password = settings.NEO4J_PASSWORD
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        
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
        Enhanced Hybrid Retrieval with Person Query Detection, Node Name Detection, and Adaptive Retrieval:
        1. Detect if query is about a person/author
        2. Detect if query mentions a specific node/function name (search Neo4j directly first)
        3. Detect if query is about architecture (increase k for better coverage)
        4. Find the code (Vector Search)
        5. Find the context (Graph Lookup via Neo4j)
        6. If person query, also search Neo4j directly for author/owner info
        """
        # Step 0: Detect Person Query
        person_name = self._extract_person_name(query)
        
        # Step 0.25: Detect and extract specific node/function names from query
        node_names = self._extract_node_names(query)
        
        # Step 0.5: Detect Architecture Query - increase k for better coverage
        query_lower = query.lower()
        architecture_keywords = ['architecture', 'architect', 'structure', 'design', 'system', 'component', 
                                'module', 'dependency', 'relationship', 'overview', 'explain the', 'how does',
                                'path to', 'selected node']
        is_architecture_query = any(keyword in query_lower for keyword in architecture_keywords)
        
        # Step 0.6: Detect General/Repository-level queries
        general_keywords = ['what is', 'what does', 'about this', 'repo about', 'repository about', 
                           'what is this', 'explain this', 'describe this', 'overview']
        is_general_query = any(keyword in query_lower for keyword in general_keywords)
        
        # Increase k for architecture queries to get more comprehensive context
        if is_architecture_query:
            k_vectors = max(k_vectors, 30)  # Get more context for architecture questions
            logger.info(f"Architecture query detected, increasing k to {k_vectors}")
        
        # Increase k for general queries to find README, docs, etc.
        if is_general_query:
            k_vectors = max(k_vectors, 40)  # Get even more context for general questions
            logger.info(f"General/repository query detected, increasing k to {k_vectors}")
        
        # Step 0.75: If we found specific node names, search Neo4j directly first
        node_context = ""
        node_file_paths = set()
        if node_names and self.driver:
            logger.info(f"Detected node/function names in query: {node_names}")
            node_context, node_file_paths = self._query_nodes_by_name(node_names)
            if node_file_paths:
                logger.info(f"Found {len(node_file_paths)} files containing these nodes: {list(node_file_paths)[:5]}")
        
        # Step 1: Semantic Search (PGVector) - adaptive k based on query type
        # If we found specific files from node search, prioritize those in vector search
        code_context = []
        anchors = set()
        
        # Add file paths from node search to anchors
        anchors.update(node_file_paths)
        
        try:
            # If we have specific file paths, try to search within those files first
            if node_file_paths:
                # Search with higher k to get more context from the specific files
                docs = self.vector_store.similarity_search(query, k=k_vectors * 2)
                # Prioritize docs from the files we found
                prioritized_docs = []
                other_docs = []
                for doc in docs:
                    filename = doc.metadata.get('file_name', '')
                    if any(file_path in filename or filename in file_path for file_path in node_file_paths):
                        prioritized_docs.append(doc)
                        anchors.add(filename)
                    else:
                        other_docs.append(doc)
                        if filename:
                            anchors.add(filename)
                # Combine: prioritized first, then others
                docs = prioritized_docs + other_docs[:k_vectors]
            else:
                docs = self.vector_store.similarity_search(query, k=k_vectors)
                for doc in docs:
                    filename = doc.metadata.get('file_name')
                    if filename:
                        anchors.add(filename)
            
            for doc in docs:
                filename = doc.metadata.get('file_name', 'unknown')
                code_context.append(f"--- SNIPPET ({filename}) ---\n{doc.page_content}")
        except Exception as e:
            error_msg = str(e).lower()
            # Check for dimension mismatch errors
            if "dimension" in error_msg or "vector" in error_msg:
                logger.error(f"❌ Vector search failed due to dimension mismatch: {e}")
                logger.error("❌ This usually means the database has embeddings with different dimensions than the current model.")
                logger.error("❌ Solution: Run the migration script to update the database schema, then re-ingest the repository.")
                # Return a helpful error message in the context
                code_context.append(
                    "⚠️ ERROR: Dimension mismatch detected. The database embeddings have a different dimension "
                    "than the current embedding model. Please run the migration script and re-ingest the repository."
                )
            else:
                logger.error(f"Vector search failed: {e}")
                # Continue even if vector search fails, we might have person query or node query

        # Step 2: Graph Context - Multiple paths:
        #   a) If person query: Direct Neo4j search for person's work
        #   b) If node names found: Use node context from direct search
        #   c) Otherwise: Expand file anchors
        graph_context = ""
        
        if person_name and self.driver:
            # Person query: Search Neo4j directly for this person's contributions
            logger.info(f"Detected person query for: {person_name}")
            graph_context = self._query_person_work(person_name)
            
            # Also expand any file anchors we found
            if anchors:
                anchor_context = self._expand_anchors_neo4j(list(anchors))
                if anchor_context and "No graph context" not in anchor_context:
                    graph_context += "\n\n--- Related Files ---\n" + anchor_context
        elif node_context:
            # Node query: Use the direct node search results
            graph_context = node_context
            # Also expand file anchors for additional context
            if anchors:
                anchor_context = self._expand_anchors_neo4j(list(anchors), limit=50)
                if anchor_context and "No graph context" not in anchor_context:
                    graph_context += "\n\n--- Related Files ---\n" + anchor_context
        elif anchors:
            # Standard query: Expand file anchors
            # For architecture queries, get more comprehensive graph context
            if is_architecture_query:
                graph_context = self._expand_anchors_neo4j(list(anchors), limit=50)
            else:
                graph_context = self._expand_anchors_neo4j(list(anchors))
        else:
            graph_context = "No graph context available."

        # Step 3: Fuse Contexts
        return json.dumps({
            "code_context": "\n\n".join(code_context) if code_context else "No relevant code snippets found.",
            "graph_context": graph_context
        }, indent=2)
    
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
        MATCH (n:CodeNode)
        WHERE 
            toLower(n.name) = toLower(search_name) OR
            toLower(n.id) = toLower(search_name) OR
            toLower(n.id) ENDS WITH ('::' + toLower(search_name)) OR
            toLower(n.name) CONTAINS toLower(search_name) OR
            toLower(n.id) CONTAINS toLower(search_name) OR
            toLower(n.id) CONTAINS ('::' + toLower(search_name) + '::') OR
            toLower(n.id) ENDS WITH ('::' + toLower(search_name))
        OPTIONAL MATCH (n)-[r]-(m:CodeNode)
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
                    return session.run(query, node_names=node_names)
            
            result = _execute_query()
            
            found_nodes = {}
            for record in result:
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
        MATCH (n:CodeNode)
        WHERE 
            toLower(n.last_author) CONTAINS $person_name OR
            toLower(n.top_owner) CONTAINS $person_name OR
            ANY(collab IN n.collaborators WHERE toLower(collab) CONTAINS $person_name)
        OPTIONAL MATCH (n)-[r]-(m:CodeNode)
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
                    return session.run(query, person_name=person_lower)
            
            result = _execute_query()
            
            for record in result:
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
        MATCH (n:CodeNode) 
        WHERE n.id STARTS WITH filename
        OPTIONAL MATCH (n)-[r]-(m:CodeNode)
        RETURN n, r, m
        LIMIT {limit}
        """
        
        relevant_info = set()
        
        try:
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    return session.run(query, anchors=file_anchors)
            
            result = _execute_query()
            
            for record in result:
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