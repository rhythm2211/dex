import logging
import json
# Explicitly import pgvector before PGVector to ensure it's available
import pgvector  # Required for LangChain's PGVector implementation
from langchain_community.vectorstores import PGVector
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings
from backend.app.domain.hybrid_retriever import HybridRetriever
from backend.app.utils.embedding_utils import get_embeddings

logger = logging.getLogger("dex-core")

class RAGService:
    def __init__(self):
        # Validate required configuration
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY is required but not set. Please configure it in environment variables.")
        
        if not settings.POSTGRES_CONNECTION_STRING:
            raise ValueError("POSTGRES_CONNECTION_STRING is required but not set. Please configure database connection.")
        
        try:
            # Initialize Embeddings & Vector Store once
            # Use configurable embedding provider (supports local, Voyage AI, Cohere, OpenAI, etc.)
            self.embeddings = get_embeddings()
            
            # Initialize PGVector store
            self.vector_store = PGVector(
                connection_string=settings.POSTGRES_CONNECTION_STRING,
                embedding_function=self.embeddings,
                collection_name=settings.POSTGRES_VECTOR_TABLE,
                use_jsonb=True  # Use JSONB for metadata
            )
            
            # Initialize Retriever (loads graph into memory)
            self.retriever = HybridRetriever(self.vector_store)
            
            self.llm = ChatGroq(
                model_name="llama-3.3-70b-versatile",
                temperature=0,
                groq_api_key=settings.GROQ_API_KEY
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
        # [UPDATED] Enhanced for architecture questions and better context synthesis
        prompt = ChatPromptTemplate.from_template(
            """You are a Senior Software Architect and Team Lead reviewing a codebase. Your expertise includes system design, code architecture, component relationships, and team dynamics.
            
            I have retrieved two types of context for you:
            
            === PART 1: SOURCE CODE (Implementation Details) ===
            {code_context}
            
            === PART 2: KNOWLEDGE GRAPH (Architecture, Dependencies & Team Context) ===
            {graph_context}
            
            USER QUESTION: {question}

            INSTRUCTIONS:
            - **ARCHITECTURE QUESTIONS:** If the question asks about architecture, system design, or overall structure:
              - Use PART 2 (Knowledge Graph) as the PRIMARY source - it contains structural relationships, dependencies, and component hierarchy
              - Identify major components, modules, and their relationships from PART 2
              - Use PART 1 (Source Code) to provide implementation details and examples
              - Explain how components connect, what they depend on, and their roles in the system
              - If PART 2 shows relationships (e.g., "A --[IMPORTS]--> B"), explain what this means architecturally
              - Describe the overall system structure, data flow, and component interactions
            
            - **IMPLEMENTATION QUESTIONS:** If the question asks about how something works:
              - Use PART 1 to explain *how* the specific logic works with code examples
              - Use PART 2 to explain *where* these components fit (imports, dependencies, relationships)
            
            - **COMPONENT/CODE QUESTIONS:** If asking about specific nodes, files, or paths:
              - Combine information from both PART 1 and PART 2
              - PART 2 shows the structural context (what depends on it, what it depends on)
              - PART 1 shows the actual implementation
            
            - **CRITICAL METADATA:** Always check PART 2 for:
              - 'Owner' and 'Risk Score' metadata
              - If an 'Owner' is listed, mention them (e.g., "This module is primarily maintained by Alice")
              - If 'Risk Score' is high (>0.7), warn about stability/bus factor issues
            
            - **PERSON QUERIES:** If the question is about what a person is working on:
              - Focus on PART 2 which contains detailed information about their contributions
              - List the specific files, modules, or components they own or contribute to
              - Mention their role (PRIMARY OWNER, LAST AUTHOR, or COLLABORATOR) for each item
              - Include commit counts and last modified dates when available
              - Summarize their main areas of work and responsibilities
              - If PART 2 shows "No work found", say so clearly instead of making up information
            
            - **SYNTHESIS:** 
              - Synthesize all technical and social context into a coherent, comprehensive answer
              - Do not mention "Part 1" or "Part 2" in your final answer
              - If you don't have enough information, say so clearly rather than speculating
              - For architecture questions, provide a high-level overview first, then dive into details
            
            Provide a technical, well-structured, markdown-formatted response with clear sections."""
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