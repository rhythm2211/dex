"""
Groq Client Wrapper
Provides a ChatGroq-like interface that automatically manages multiple API keys.
"""
import logging
import time
from typing import Optional, Any
from langchain_groq import ChatGroq
from backend.app.utils.groq_key_manager import groq_key_manager

logger = logging.getLogger("dex-core")


class MultiKeyChatGroq:
    """
    Wrapper around ChatGroq that automatically manages multiple API keys.
    Handles key rotation, failover, and rate limiting.
    """
    
    def __init__(self, model_name: str = "llama-3.3-70b-versatile", temperature: float = 0):
        """
        Initialize MultiKeyChatGroq.
        
        Args:
            model_name: Groq model name
            temperature: Model temperature
        """
        self.model_name = model_name
        self.temperature = temperature
        self._clients: dict[str, ChatGroq] = {}  # Cache clients per key
        
        if not groq_key_manager.keys:
            raise ValueError("No Groq API keys configured. Set GROQ_API_KEYS environment variable.")
    
    def _get_client(self, api_key: str) -> ChatGroq:
        """Get or create a ChatGroq client for a specific key"""
        if api_key not in self._clients:
            self._clients[api_key] = ChatGroq(
                model_name=self.model_name,
                temperature=self.temperature,
                groq_api_key=api_key
            )
        return self._clients[api_key]
    
    def invoke(self, input: Any, **kwargs) -> Any:
        """
        Invoke the LLM with automatic key management.
        Retries with different keys on failure.
        """
        max_retries = len(groq_key_manager.keys)  # Try all keys
        last_error = None
        
        # Estimate tokens (rough estimate)
        if isinstance(input, str):
            estimated_tokens = len(input.split()) * 1.3
        elif hasattr(input, 'content'):
            estimated_tokens = len(str(input.content).split()) * 1.3
        else:
            estimated_tokens = 1000  # Default estimate
        
        for attempt in range(max_retries):
            # Get available key
            key_result = groq_key_manager.get_available_key(estimated_tokens)
            
            if key_result is None:
                error_msg = "No available Groq API keys"
                logger.error(f"❌ {error_msg}")
                raise RuntimeError(error_msg)
            
            api_key, wait_time = key_result
            
            # Wait if needed
            if wait_time > 0:
                logger.debug(f"⏳ Waiting {wait_time:.2f}s for key availability")
                time.sleep(wait_time)
            
            try:
                # Get client and invoke
                client = self._get_client(api_key)
                response = client.invoke(input, **kwargs)
                
                # Record success
                # Estimate tokens from response
                if hasattr(response, 'content'):
                    response_tokens = len(str(response.content).split()) * 1.3
                else:
                    response_tokens = estimated_tokens
                
                groq_key_manager.record_request(
                    key=api_key,
                    tokens_used=int(estimated_tokens + response_tokens),
                    success=True
                )
                
                return response
                
            except Exception as e:
                error_str = str(e)
                last_error = e
                
                # Record failure
                groq_key_manager.record_request(
                    key=api_key,
                    tokens_used=estimated_tokens,
                    success=False,
                    error=error_str
                )
                
                # Check if it's a rate limit error
                error_lower = error_str.lower()
                if "rate limit" in error_lower or "429" in error_str:
                    logger.warning(f"⚠️ Rate limit hit on key {attempt + 1}, trying next key...")
                    continue
                elif "quota" in error_lower or "exhausted" in error_lower:
                    logger.warning(f"⚠️ Quota exhausted on key {attempt + 1}, trying next key...")
                    continue
                else:
                    # Other errors - might be transient, try next key
                    logger.warning(f"⚠️ Error on key {attempt + 1}: {error_str[:100]}, trying next key...")
                    continue
        
        # All keys failed
        logger.error(f"❌ All Groq API keys failed after {max_retries} attempts")
        if last_error:
            raise RuntimeError(f"All Groq API keys failed. Last error: {last_error}") from last_error
        else:
            raise RuntimeError("All Groq API keys failed")
    
    def __call__(self, *args, **kwargs):
        """Make the object callable like ChatGroq"""
        return self.invoke(*args, **kwargs)
