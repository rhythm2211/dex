import logging
import json
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings
from backend.app.domain.hybrid_retriever import HybridRetriever

logger = logging.getLogger("dex-core")

class RAGService:
    def __init__(self):
        # Initialize Embeddings & Vector Store once
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.vector_store = PineconeVectorStore(
            index_name=settings.PINECONE_INDEX_NAME,
            embedding=self.embeddings,
            pinecone_api_key=settings.PINECONE_API_KEY
        )
        
        # Initialize Retriever (loads graph into memory)
        self.retriever = HybridRetriever(self.vector_store)
        
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )

    def reload_knowledge_base(self):
        """
        Public method to refresh memory after ingestion.
        """
        logger.info("🔄 Refreshing RAG knowledge base...")
        self.retriever.reload_graph()
        logger.info("✅ Knowledge base refreshed.")
    
    def answer_query(self, query_text: str) -> dict:
        # 1. Hybrid Retrieval
        # Returns a JSON string with separated contexts
        retrieval_result = self.retriever.retrieve(query_text)
        
        # 2. Parse Contexts
        try:
            data = json.loads(retrieval_result)
            code_context = data.get("code_context", "")
            graph_context = data.get("graph_context", "")
        except json.JSONDecodeError:
            # Fallback if something goes wrong
            code_context = retrieval_result
            graph_context = "Graph context unavailable."
        
        # 3. Validation
        if not code_context or "No relevant code" in code_context:
            return {
                "answer": "I couldn't find enough context in the codebase to answer that. Please ensure the repository is ingested and your query is specific.",
                "context_used": ""
            }
        
        # 4. Deep Tech Prompt (The "Architect" Persona)
        prompt = ChatPromptTemplate.from_template(
            """You are a Senior Software Architect reviewing a codebase.
            
            I have retrieved two types of context for you:
            
            === PART 1: SOURCE CODE (Implementation) ===
            {code_context}
            
            === PART 2: KNOWLEDGE GRAPH (Architecture) ===
            {graph_context}
            
            USER QUESTION: {question}

            INSTRUCTIONS:
            - Use PART 1 to explain *how* the specific logic works.
            - Use PART 2 to explain *where* these components fit (imports, dependencies, hierarchy).
            - Synthesize both into a coherent answer.
            - Do not mention "Part 1" or "Part 2" in your final answer, just use the information.
            
            Provide a technical, markdown-formatted response."""
        )
        
        # 5. Execution
        chain = prompt | self.llm
        response = chain.invoke({
            "code_context": code_context, 
            "graph_context": graph_context, 
            "question": query_text
        })
        
        return {
            "answer": response.content,
            "context_used": f"**Code Sources:**\n{code_context[:500]}...\n\n**Graph Connections:**\n{graph_context[:500]}..."
        }