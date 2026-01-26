import logging
import json
# Explicitly import pgvector before PGVector to ensure it's available
import pgvector  # Required for LangChain's PGVector implementation
from langchain_community.vectorstores import PGVector
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings
from backend.app.domain.hybrid_retriever import HybridRetriever
from backend.app.utils.groq_client import MultiKeyChatGroq

logger = logging.getLogger("dex-core")

class RAGService:
    def __init__(self, user_id: str = None, repository_id: str = None):
        """
        Initialize RAG service with user and repository context for multi-tenant isolation.
        """
        # Store user and repository context
        self.user_id = user_id
        self.repository_id = repository_id
        
        # Validate required configuration
        import os
        groq_keys = os.getenv("GROQ_API_KEYS", os.getenv("GROQ_API_KEY", ""))
        if not groq_keys:
            raise ValueError("GROQ_API_KEY or GROQ_API_KEYS is required but not set. Please configure it in environment variables.")
        
        if not settings.POSTGRES_CONNECTION_STRING:
            raise ValueError("POSTGRES_CONNECTION_STRING is required but not set. Please configure database connection.")
        
        try:
            # Initialize Embeddings & Vector Store once
            self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            
            # Initialize PGVector store
            self.vector_store = PGVector(
                connection_string=settings.POSTGRES_CONNECTION_STRING,
                embedding_function=self.embeddings,
                collection_name=settings.POSTGRES_VECTOR_TABLE,
                use_jsonb=True  # Use JSONB for metadata
            )
            
            # Initialize Retriever (loads graph into memory) with user/repository context
            self.retriever = HybridRetriever(self.vector_store, user_id=user_id, repository_id=repository_id)
            
            # Use MultiKeyChatGroq for automatic key management
            self.llm = MultiKeyChatGroq(
                model_name="llama-3.3-70b-versatile",
                temperature=0
            )
        except Exception as e:
            logger.error(f"Failed to initialize RAGService components: {e}")
            raise RuntimeError(f"RAGService initialization failed: {str(e)}") from e

    def reload_knowledge_base(self):
        """
        Public method to refresh memory after ingestion.
        """
        logger.info("🔄 Refreshing RAG knowledge base...")
        self.retriever.reload_graph()
        logger.info("✅ Knowledge base refreshed.")
    
    def answer_query(self, query_text: str, user_id: str = None, repository_id: str = None) -> dict:
        """
        Answer a query using hybrid RAG retrieval.
        Now supports user_id and repository_id filtering for multi-tenant isolation.
        """
        # Use provided user_id/repository_id or fall back to instance defaults
        effective_user_id = user_id or self.user_id
        effective_repository_id = repository_id or self.repository_id
        
        # 1. Hybrid Retrieval
        # Returns a JSON string with separated contexts
        retrieval_result = self.retriever.retrieve(query_text, user_id=effective_user_id, repository_id=effective_repository_id)
        
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
        # [UPDATED] Added specific instructions for Social/Risk data and Person queries
        prompt = ChatPromptTemplate.from_template(
            """You are a Senior Software Architect and Team Lead reviewing a codebase.
            
            I have retrieved two types of context for you:
            
            === PART 1: SOURCE CODE (Implementation) ===
            {code_context}
            
            === PART 2: KNOWLEDGE GRAPH (Architecture & Team Context) ===
            {graph_context}
            
            USER QUESTION: {question}

            INSTRUCTIONS:
            - Use PART 1 to explain *how* the specific logic works.
            - Use PART 2 to explain *where* these components fit (imports, dependencies).
            - **CRITICAL:** Look at PART 2 for 'Owner' and 'Risk Score' metadata. 
              - If an 'Owner' is listed, mention them (e.g., "This module is primarily maintained by Alice").
              - If 'Risk Score' is high (>0.7), warn the user about stability issues.
            - **PERSON QUERIES:** If the question is about what a person is working on:
              - Focus on PART 2 which contains detailed information about their contributions
              - List the specific files, modules, or components they own or contribute to
              - Mention their role (PRIMARY OWNER, LAST AUTHOR, or COLLABORATOR) for each item
              - Include commit counts and last modified dates when available
              - Summarize their main areas of work and responsibilities
              - If PART 2 shows "No work found", say so clearly instead of making up information
            - Synthesize all technical and social context into a coherent answer.
            - Do not mention "Part 1" or "Part 2" in your final answer.
            - If you don't have enough information, say so clearly rather than speculating.
            
            Provide a technical, markdown-formatted response."""
        )
        
        # 5. Execution (rate limiting is handled automatically by MultiKeyChatGroq)
        # Note: The multi-key system handles rate limiting and failover automatically
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