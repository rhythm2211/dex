import os
import json
import logging
from typing import List, Union
from langchain_community.vectorstores import PGVector
from langchain_core.vectorstores import VectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError
from backend.app.core.config import settings
from backend.app.utils.connection_utils import create_neo4j_driver, verify_neo4j_connection, retry_on_connection_error

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: Union[PGVector, VectorStore]):
        self.vector_store = vector_store
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
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

    def retrieve(self, query: str, k_vectors: int = 10) -> str:
        """
        Enhanced Hybrid Retrieval with Person Query Detection:
        1. Detect if query is about a person/author
        2. Find the code (Vector Search)
        3. Find the context (Graph Lookup via Neo4j)
        4. If person query, also search Neo4j directly for author/owner info
        """
        # Step 0: Detect Person Query
        person_name = self._extract_person_name(query)
        
        # Step 1: Semantic Search (PGVector) - increase k for better coverage
        code_context = []
        anchors = set()
        
        try:
            docs = self.vector_store.similarity_search(query, k=k_vectors)
            for doc in docs:
                filename = doc.metadata.get('file_name')
                if filename:
                    anchors.add(filename)
                code_context.append(f"--- SNIPPET ({filename}) ---\n{doc.page_content}")
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            # Continue even if vector search fails, we might have person query

        # Step 2: Graph Context - Two paths:
        #   a) If person query: Direct Neo4j search for person's work
        #   b) Otherwise: Expand file anchors
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
        elif anchors:
            # Standard query: Expand file anchors
            graph_context = self._expand_anchors_neo4j(list(anchors))
        else:
            graph_context = "No graph context available."

        # Step 3: Fuse Contexts
        return json.dumps({
            "code_context": "\n\n".join(code_context) if code_context else "No relevant code snippets found.",
            "graph_context": graph_context
        }, indent=2)
    
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

    def _expand_anchors_neo4j(self, file_anchors: List[str]) -> str:
        """
        Queries Neo4j to find structural relationships & Git metadata 
        for the identified anchor files.
        """
        if not self.driver or not file_anchors:
            return "No graph context available (DB disconnected or no anchors)."

        # Cypher Query:
        # 1. Match nodes that START with the filename (File node + its Classes/Functions)
        # 2. Find incoming/outgoing relationships (r) to other nodes (m)
        # 3. Return the triple + metadata
        query = """
        UNWIND $anchors AS filename
        MATCH (n:CodeNode) 
        WHERE n.id STARTS WITH filename
        OPTIONAL MATCH (n)-[r]-(m:CodeNode)
        RETURN n, r, m
        LIMIT 20
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

                # 2. Format Relationship
                # If we found a relationship, format it: A -[REL]-> B
                if r and m:
                    rel_type = r.type
                    # Direction check (simplified for context string)
                    # We just want to know A relates to B
                    info_str = f"{n['id']} --[{rel_type}]--> {m['id']}{meta_str}"
                    relevant_info.add(info_str)
                else:
                    # Isolated node (just file info)
                    relevant_info.add(f"Node: {n['id']}{meta_str}")

        except Exception as e:
            logger.error(f"Neo4j Context Query Failed: {e}")
            return "Graph query failed."

        if not relevant_info:
            return "No structural relationships found in graph."
            
        return "\n".join(list(relevant_info))