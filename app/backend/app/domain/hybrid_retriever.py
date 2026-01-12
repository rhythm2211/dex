import networkx as nx
import logging
from typing import List, Dict
from langchain_core.documents import Document
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class HybridRetriever:
    def __init__(self, vector_store: PineconeVectorStore, graph_path: str = "backend/data/repo_graph.json"):
        self.vector_store = vector_store
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Load Knowledge Graph
        try:
            with open(graph_path, 'r') as f:
                import json
                data = json.load(f)
                self.graph = nx.node_link_graph(data)
        except FileNotFoundError:
            logger.warning("Knowledge Graph not found. Initializing empty graph.")
            self.graph = nx.DiGraph()

    def retrieve(self, query: str, k_vectors: int = 5, k_graph: int = 3) -> str:
        """
        Orchestrates the Dual-Path retrieval and fuses the context.
        """
        # Path A: Vector Search (Semantic)
        logger.info(f"Executing Vector Search for: '{query}'")
        vector_docs = self.vector_store.similarity_search(query, k=k_vectors)
        vector_context = "\n".join([d.page_content for d in vector_docs])

        # Path B: Graph Search (Structural)
        logger.info(f"Executing Graph Search for: '{query}'")
        graph_context = self._query_graph(query, max_hops=1, max_results=k_graph)

        # Fusion
        combined_context = (
            f"--- VECTOR CONTEXT ---\n{vector_context}\n\n"
            f"--- KNOWLEDGE GRAPH CONTEXT ---\n{graph_context}"
        )
        return combined_context

    def _query_graph(self, query: str, max_hops: int, max_results: int) -> str:
        """
        Extracts entities from query -> Finds them in Graph -> Traverses edges.
        """
        entities = self._extract_entities(query)
        context_triples = []

        for entity in entities:
            if entity in self.graph:
                # Get neighbors (Concept expansion)
                edges = list(self.graph.edges(entity, data=True))[:max_results]
                for u, v, data in edges:
                    relation = data.get('relation', 'related_to')
                    context_triples.append(f"{u} -> [{relation}] -> {v}")
        
        if not context_triples:
            return "No relevant graph connections found."
            
        return "\n".join(context_triples)

    def _extract_entities(self, query: str) -> List[str]:
        """
        Uses LLM to identify potential graph nodes from the natural language query.
        """
        prompt = PromptTemplate.from_template(
            "Extract the key technical entities (functions, classes, modules, concepts) from this query: '{query}'. "
            "Return a comma-separated list ONLY."
        )
        chain = prompt | self.llm
        response = chain.invoke({"query": query})
        return [e.strip() for e in response.content.split(",")]