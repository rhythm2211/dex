from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings
from backend.app.domain.hybrid_retriever import HybridRetriever

class RAGService:
    def __init__(self):
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vector_store = PineconeVectorStore(
            index_name=settings.PINECONE_INDEX_NAME,
            embedding=embeddings,
            pinecone_api_key=settings.PINECONE_API_KEY
        )
        self.retriever = HybridRetriever(vector_store)
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )

    def answer_query(self, query_text: str) -> dict:
        # 1. Hybrid Retrieval
        context = self.retriever.retrieve(query_text)
        
        # 2. Generative Synthesis
        prompt = ChatPromptTemplate.from_template(
            """
            You are a Senior Technical Architect. Answer the user's question based strictly on the context provided.
            
            Context:
            {context}
            
            Question: {question}
            
            Answer (Be technical, cite specific modules/functions if visible in graph):
            """
        )
        
        chain = prompt | self.llm
        response = chain.invoke({"context": context, "question": query_text})
        
        return {
            "answer": response.content,
            "context_used": context[:500] + "..." # Truncated for log clarity
        }