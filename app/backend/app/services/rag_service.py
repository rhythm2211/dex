import logging
import json
import time
# Explicitly import pgvector before PGVector to ensure it's available
import pgvector  # Required for LangChain's PGVector implementation
from langchain_community.vectorstores import PGVector
from langchain_core.prompts import ChatPromptTemplate
from backend.app.core.config import settings
from backend.app.domain.hybrid_retriever import HybridRetriever
from backend.app.utils.embedding_utils import get_embeddings
from backend.app.utils.llm_utils import get_llm
from backend.app.utils.citation_verifier import verify_citations, check_symbols_in_context
from backend.app.utils.query_telemetry import QueryTelemetry, QueryTimer, log_query_event

logger = logging.getLogger("dex-core")

class RAGService:
    def __init__(self, user_id: str = None):
        """
        Initialize RAGService with user isolation support.
        
        Args:
            user_id: User ID for data isolation (required for multi-user support)
        """
        if not user_id:
            raise ValueError("user_id is required for user isolation. All RAG operations must be scoped to a user.")
        
        self.user_id = user_id
        
        # Validate required configuration
        api_keys = settings.get_groq_api_keys()
        if not api_keys:
            raise ValueError("GROQ_API_KEY or GROQ_API_KEYS is required but not set. Please configure it in environment variables.")
        
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
            
            # Initialize Retriever (loads graph into memory) with user_id
            self.retriever = HybridRetriever(self.vector_store, user_id=self.user_id)
            
            # Pluggable LLM (groq, openai, anthropic, ollama)
            try:
                self.llm = get_llm()
            except Exception as e:
                logger.warning(f"LLM provider fallback to groq: {e}")
                from langchain_groq import ChatGroq
                api_keys = settings.get_groq_api_keys()
                self.llm = ChatGroq(
                    model_name=settings.LLM_MODEL_NAME,
                    temperature=0,
                    groq_api_key=api_keys[0] if api_keys else settings.GROQ_API_KEY,
                )
            self.groq_manager = None
            try:
                from backend.app.utils.groq_key_manager import get_groq_manager
                if (settings.LLM_PROVIDER or "groq").lower() == "groq":
                    self.groq_manager = get_groq_manager()
            except RuntimeError:
                pass
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
        timer = QueryTimer()
        intent = "semantic"
        chunk_count = 0

        try:
            retrieval_result = self.retriever.retrieve(query_text)
        except Exception as e:
            logger.error(f"Retrieval failed completely: {e}", exc_info=True)
            return {
                "answer": f"I encountered an error while searching the codebase: {str(e)}. Please check the logs for more details.",
                "context_used": ""
            }
        timer.mark_retrieval_done()

        try:
            data = json.loads(retrieval_result)
            code_context = data.get("code_context", "")
            graph_context = data.get("graph_context", "")
            intent = data.get("intent", "semantic")
            chunk_count = data.get("chunk_count", 0)
        except json.JSONDecodeError:
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
        
        # 5. Execution with round-robin API key rotation
        try:
            # Use GroqKeyManager for automatic retry on 429 errors
            if hasattr(self, 'groq_manager') and self.groq_manager:
                # Use round-robin manager with automatic retry
                def invoke_chain(llm):
                    chain_with_llm = prompt | llm
                    return chain_with_llm.invoke({
                        "code_context": code_context, 
                        "graph_context": graph_context, 
                        "question": query_text
                    })
                
                response = self.groq_manager.call_with_retry(invoke_chain)
            else:
                # Fallback to direct chain invocation
                chain = prompt | self.llm
                response = chain.invoke({
                    "code_context": code_context, 
                    "graph_context": graph_context, 
                    "question": query_text
                })
            
            answer_text = response.content
            timer.mark_llm_done()

            cite_result = verify_citations(answer_text, code_context, graph_context)
            ungrounded = check_symbols_in_context(answer_text, code_context, graph_context)

            if not cite_result.passed and cite_result.citations_failed:
                retry_prompt = ChatPromptTemplate.from_template(
                    """You previously answered without verifiable citations. Re-answer using ONLY the context below.
                    Every file reference MUST appear in the context. If unsure, say you don't know.

                    CODE CONTEXT:
                    {code_context}

                    GRAPH CONTEXT:
                    {graph_context}

                    QUESTION: {question}

                    Answer with markdown and cite files using `path:line` format."""
                )
                try:
                    if self.groq_manager:
                        def invoke_retry(llm):
                            return (retry_prompt | llm).invoke({
                                "code_context": code_context[:8000],
                                "graph_context": graph_context[:8000],
                                "question": query_text,
                            })
                        retry_resp = self.groq_manager.call_with_retry(invoke_retry)
                    else:
                        retry_resp = (retry_prompt | self.llm).invoke({
                            "code_context": code_context[:8000],
                            "graph_context": graph_context[:8000],
                            "question": query_text,
                        })
                    answer_text = retry_resp.content
                    cite_result = verify_citations(answer_text, code_context, graph_context)
                except Exception as e:
                    logger.debug(f"Citation retry skipped: {e}")

            log_query_event(QueryTelemetry(
                user_id=self.user_id,
                query=query_text[:500],
                intent=intent,
                final_chunk_count=chunk_count,
                citation_passed=cite_result.passed,
                latency_ms=timer.total_ms,
                retrieval_ms=timer.retrieval_ms,
                llm_ms=timer.llm_ms,
                extra={
                    "citations_verified": len(cite_result.citations_verified),
                    "citations_failed": len(cite_result.citations_failed),
                    "ungrounded_symbols": ungrounded[:5],
                },
            ))

            return {
                "answer": answer_text,
                "context_used": f"**Code Sources:**\n{code_context[:500]}...\n\n**Graph Connections:**\n{graph_context[:500]}...",
                "intent": intent,
                "citation_verified": cite_result.passed,
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