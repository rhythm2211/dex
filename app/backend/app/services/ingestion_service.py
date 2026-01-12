import os
from typing import List
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from backend.app.core.config import settings
from backend.app.domain.semantic_splitter import SemanticSplitter
from backend.app.domain.graph_engine import GraphEngine

class IngestionService:
    def __init__(self):
        self.splitter = SemanticSplitter()
        self.graph_engine = GraphEngine()
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    def process_repository(self, repo_path: str):
        loader = DirectoryLoader(repo_path, glob="**/*.py", loader_cls=TextLoader)
        raw_docs = loader.load()
        
        chunks = self.splitter.process_documents(raw_docs)
        
        chunk_texts = [doc.page_content for doc in chunks]
        self.graph_engine.extract_and_build(chunk_texts[:20]) # Limit for prototype speed
        self.graph_engine.save_graph("backend/data/repo_graph.json")
        
        PineconeVectorStore.from_documents(
            chunks,
            self.embeddings,
            index_name=settings.PINECONE_INDEX_NAME,
            pinecone_api_key=settings.PINECONE_API_KEY
        )
        
        return {
            "chunks_processed": len(chunks),
            "graph_nodes": self.graph_engine.graph.number_of_nodes(),
            "graph_edges": self.graph_engine.graph.number_of_edges()
        }