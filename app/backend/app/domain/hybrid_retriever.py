import os
import json
import networkx as nx
import logging
from typing import List, Dict, Set
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: PineconeVectorStore, graph_path: str = None):
        self.vector_store = vector_store
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Path Resolution
        if graph_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            graph_path = os.path.join(base_dir, "backend", "data", "repo_graph.json")
        
        self.graph_path = graph_path
        self.graph = nx.DiGraph()
        
        # Load Graph immediately on init
        self._load_graph()

    def reload_graph(self):
        """Forces a reload of the graph from disk (called after ingestion)."""
        logger.info("🔄 Reloading HybridRetriever Graph...")
        self.graph = nx.DiGraph()
        self._load_graph()

    def _load_graph(self):
        """Loads the JSON graph into a NetworkX object."""
        try:
            if not os.path.exists(self.graph_path):
                logger.warning("Graph file not found. Retriever starting empty.")
                return
            
            with open(self.graph_path, 'r') as f:
                data = json.load(f)
            
            # Reconstruct Graph from Frontend-friendly JSON
            # We treat the 'id' as the unique node identifier
            for node in data.get("nodes", []):
                self.graph.add_node(node['id'], **node)
                
            for link in data.get("links", []):
                self.graph.add_edge(link['source'], link['target'], relation=link.get('relation', 'related'))
                
            logger.info(f"Graph loaded: {self.graph.number_of_nodes()} nodes")
            
        except Exception as e:
            logger.error(f"Failed to load graph: {e}")

    def retrieve(self, query: str, k_vectors: int = 5) -> str:
        """
        SaaS Logic - Anchored Traversal:
        1. Find the code (Vector Search)
        2. Find the context (Graph Lookup of those files)
        """
        # Step 1: Semantic Search
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
            # We assume IngestionService added 'file_name' to metadata
            filename = doc.metadata.get('file_name')
            if filename:
                anchors.add(filename)
            
            code_context.append(f"--- SNIPPET ({filename}) ---\n{doc.page_content}")

        # Step 3: Expand Anchors via Graph
        # We look for nodes that START with the filename (e.g. "app/main.py::User")
        graph_context = self._expand_anchors(list(anchors))

        # Step 4: Fuse Contexts
        return json.dumps({
            "code_context": "\n\n".join(code_context),
            "graph_context": graph_context
        }, indent=2)

    def _expand_anchors(self, file_anchors: List[str]) -> str:
        """
        Finds structural relationships AND Metadata (Git info) for the specific files.
        """
        relevant_info = set()
        
        for filename in file_anchors:
            # 1. Find nodes belonging to this file
            related_nodes = [
                n for n in self.graph.nodes() 
                if str(n) == filename or str(n).startswith(f"{filename}::")
            ]
            
            for node in related_nodes:
                # Get Node Metadata (The Git info we just added)
                node_data = self.graph.nodes[node]
                meta_str = ""
                if "last_author" in node_data:
                    meta_str = f" [Authored by: {node_data.get('last_author')}, Last Mod: {node_data.get('last_modified')}]"

                # Get Incoming Edges (Who calls/imports this?)
                in_edges = self.graph.in_edges(node, data=True)
                for u, v, data in in_edges:
                    rel = data.get('relation', 'related')
                    relevant_info.add(f"{u} --[{rel}]--> {v}{meta_str}")
                
                # Get Outgoing Edges (What does this inherit/define?)
                out_edges = self.graph.out_edges(node, data=True)
                for u, v, data in out_edges:
                    rel = data.get('relation', 'related')
                    relevant_info.add(f"{u} --[{rel}]--> {v}") # Usually don't need metadata on target for outgoing

        if not relevant_info:
            return "No structural relationships found."
            
        return "\n".join(list(relevant_info)[:20]) # Limit to avoid context overflow