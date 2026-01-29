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
        try:
            retrieval_result = self.retriever.retrieve(query_text)
        except Exception as e:
            logger.error(f"Retrieval failed completely: {e}", exc_info=True)
            return {
                "answer": f"I encountered an error while searching the codebase: {str(e)}. Please check the logs for more details.",
                "context_used": ""
            }
        
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
        # Check for dimension mismatch error
        if code_context and "⚠️ ERROR: Dimension mismatch" in code_context:
            return {
                "answer": (
                    "⚠️ **Dimension Mismatch Detected**\n\n"
                    "The database contains embeddings with a different dimension than the current embedding model. "
                    "This happens when you switch embedding providers (e.g., from 768-dim to 1024-dim).\n\n"
                    "**To fix this:**\n"
                    "1. Run the migration script to update the database schema:\n"
                    "   ```bash\n"
                    "   cd app/backend\n"
                    "   python -m backend.app.scripts.migrate_embeddings\n"
                    "   ```\n"
                    "2. Re-ingest your repository to generate new embeddings with the correct dimensions.\n\n"
                    "**Note:** The migration will delete existing embeddings, so re-ingestion is required."
                ),
                "context_used": ""
            }
        
        # Check if we have meaningful context (either code or graph)
        # Be more lenient - check for actual content, not just absence of error messages
        has_code_context = (
            code_context and 
            len(code_context.strip()) > 0 and
            "No relevant code snippets found" not in code_context and 
            "⚠️ ERROR" not in code_context
        )
        has_graph_context = (
            graph_context and 
            len(graph_context.strip()) > 0 and
            "No graph context" not in graph_context and 
            "Graph query failed" not in graph_context and 
            "Error querying" not in graph_context and
            "No structural relationships found" not in graph_context
        )
        
        # Log what we found for debugging
        logger.info(f"Query: '{query_text[:100]}...' | Code context: {bool(has_code_context)} ({len(code_context) if code_context else 0} chars) | Graph context: {bool(has_graph_context)} ({len(graph_context) if graph_context else 0} chars)")
        if code_context:
            logger.debug(f"Code context preview: {code_context[:200]}...")
        if graph_context:
            logger.debug(f"Graph context preview: {graph_context[:200]}...")
        
        # Only fail if we have neither code nor graph context
        if not has_code_context and not has_graph_context:
            logger.warning(f"No context found for query: {query_text[:100]}")
            logger.warning(f"Code context was: {code_context[:100] if code_context else 'None'}...")
            logger.warning(f"Graph context was: {graph_context[:100] if graph_context else 'None'}...")
            
            # Provide helpful diagnostic message
            diagnostic_msg = (
                "I couldn't find enough context in the codebase to answer that.\n\n"
                "**Possible reasons:**\n"
                "1. The repository hasn't been ingested yet - please run ingestion first\n"
                "2. The database might be empty - check if vectors exist in the database\n"
                "3. There might be a dimension mismatch - run the migration script if you recently changed embedding providers\n"
                "4. Your query might be too specific - try a more general query\n\n"
                "**To diagnose:**\n"
                "- Check backend logs for detailed error messages\n"
                "- Verify the database has vectors: run `python app/check_vectors.py`\n"
                "- Ensure ingestion completed successfully"
            )
            
            return {
                "answer": diagnostic_msg,
                "context_used": ""
            }
        
        # If we only have graph context (no code), still proceed but note it
        if not has_code_context and has_graph_context:
            code_context = "No specific code snippets found, but structural information is available from the knowledge graph."
        
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
        try:
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
        except Exception as e:
            error_str = str(e)
            logger.error(f"LLM generation failed: {e}", exc_info=True)
            
            # Check for specific API errors
            if "401" in error_str or "Invalid API Key" in error_str or "invalid_api_key" in error_str:
                error_message = (
                    "⚠️ **API Key Error**\n\n"
                    "The Groq API key is invalid or expired. Please:\n\n"
                    "1. Check your `.env` file in the `app/` directory\n"
                    "2. Verify the `GROQ_API_KEY` value is correct\n"
                    "3. Get a new API key from: https://console.groq.com/keys\n"
                    "4. Restart the backend server after updating the key\n\n"
                    "**Note:** The API key should start with `gsk_`"
                )
            elif "429" in error_str or "rate limit" in error_str.lower():
                error_message = (
                    "⚠️ **Rate Limit Exceeded**\n\n"
                    "You've exceeded the Groq API rate limit. Please wait a moment and try again.\n\n"
                    "If this persists, consider:\n"
                    "- Upgrading your Groq plan\n"
                    "- Using a different LLM provider\n"
                )
            elif "500" in error_str or "503" in error_str:
                error_message = (
                    "⚠️ **Service Unavailable**\n\n"
                    "The Groq API service is temporarily unavailable. Please try again in a few moments."
                )
            else:
                error_message = (
                    f"⚠️ **AI Generation Error**\n\n"
                    f"An error occurred while generating the response:\n\n"
                    f"```\n{error_str[:500]}\n```\n\n"
                    f"Please check the backend logs for more details."
                )
            
            return {
                "answer": error_message,
                "context_used": ""
            }