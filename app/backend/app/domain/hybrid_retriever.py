import os
import json
import logging
from typing import List
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError
from backend.app.core.config import settings
from backend.app.utils.connection_utils import create_neo4j_driver, verify_neo4j_connection, retry_on_connection_error

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: PineconeVectorStore):
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
        
        if uri and user and password:
            # Use connection utility with proper configuration
            self.driver = create_neo4j_driver(uri, user, password)
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

    def retrieve(self, query: str, k_vectors: int = 5) -> str:
        """
        SaaS Logic - Anchored Traversal:
        1. Find the code (Vector Search)
        2. Find the context (Graph Lookup via Neo4j)
        """
        # Step 1: Semantic Search (Pinecone)
        try:
            docs = self.vector_store.similarity_search(query, k=k_vectors)
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
            return "Error retrieving documents."

        if not docs:
            return "No relevant code found."

        # Step 2: Extract Anchors (File Names)
        anchors = set()
        code_context = []
        
        for doc in docs:
            # Metadata 'file_name' is added during ingestion
            filename = doc.metadata.get('file_name')
            if filename:
                anchors.add(filename)
            
            code_context.append(f"--- SNIPPET ({filename}) ---\n{doc.page_content}")

        # Step 3: Expand Anchors via Graph (Neo4j)
        # We find relationships for these specific files
        graph_context = self._expand_anchors_neo4j(list(anchors))

        # Step 4: Fuse Contexts
        return json.dumps({
            "code_context": "\n\n".join(code_context),
            "graph_context": graph_context
        }, indent=2)

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
                with self.driver.session() as session:
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