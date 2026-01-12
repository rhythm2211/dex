import numpy as np
from typing import List
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from sklearn.metrics.pairwise import cosine_similarity

class SemanticSplitter:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.embedding_model = HuggingFaceEmbeddings(model_name=model_name)
        self.similarity_threshold = 0.75 

    def split_text(self, text: str) -> List[str]:
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 10]
        if not sentences:
            return []

        embeddings = self.embedding_model.embed_documents(sentences)
        
        chunks = []
        current_chunk = [sentences[0]]
        
        for i in range(1, len(sentences)):
            sim = cosine_similarity([embeddings[i-1]], [embeddings[i]])[0][0]
            
            if sim >= self.similarity_threshold:
                current_chunk.append(sentences[i])
            else:
                chunks.append(". ".join(current_chunk) + ".")
                current_chunk = [sentences[i]]
        
        if current_chunk:
            chunks.append(". ".join(current_chunk) + ".")
            
        return chunks

    def process_documents(self, documents: List[Document]) -> List[Document]:
        processed_docs = []
        for doc in documents:
            semantic_chunks = self.split_text(doc.page_content)
            for chunk in semantic_chunks:
                processed_docs.append(Document(
                    page_content=chunk,
                    metadata=doc.metadata
                ))
        return processed_docs