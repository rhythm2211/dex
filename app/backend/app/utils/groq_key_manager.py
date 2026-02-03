"""
Round-robin Groq API key manager to avoid 429 rate limit errors.
Supports multiple API keys with automatic rotation and error handling.
"""
import logging
import threading
import time
from typing import List, Optional
from langchain_groq import ChatGroq

logger = logging.getLogger("dex-core")


class GroqKeyManager:
    """
    Thread-safe round-robin manager for multiple Groq API keys.
    Automatically rotates keys on 429 errors and distributes load evenly.
    """
    
    def __init__(self, api_keys: List[str], model_name: str = "llama-3.3-70b-versatile", temperature: float = 0):
        """
        Initialize the Groq key manager.
        
        Args:
            api_keys: List of Groq API keys to rotate through
            model_name: Groq model name to use
            temperature: Temperature setting for the model
        """
        if not api_keys:
            raise ValueError("At least one Groq API key is required")
        
        # Filter out empty keys
        self.api_keys = [key.strip() for key in api_keys if key and key.strip()]
        
        if not self.api_keys:
            raise ValueError("No valid Groq API keys provided")
        
        self.model_name = model_name
        self.temperature = temperature
        
        # Thread-safe index for round-robin
        self._current_index = 0
        self._lock = threading.Lock()
        
        # Track failed keys (429 errors) with cooldown period
        self._failed_keys: dict[str, float] = {}  # key -> timestamp when it failed
        self._cooldown_seconds = 60  # Wait 60 seconds before retrying a failed key
        
        # Statistics
        self._total_requests = 0
        self._key_usage = {key: 0 for key in self.api_keys}
        self._key_errors = {key: 0 for key in self.api_keys}
        
        logger.info(f"✅ Initialized GroqKeyManager with {len(self.api_keys)} API key(s)")
    
    def get_next_key(self) -> str:
        """
        Get the next API key in round-robin fashion.
        Skips keys that are in cooldown period.
        
        Returns:
            A valid API key to use
        """
        with self._lock:
            # Filter out keys in cooldown
            available_keys = [
                key for key in self.api_keys
                if key not in self._failed_keys or 
                (time.time() - self._failed_keys[key]) > self._cooldown_seconds
            ]
            
            if not available_keys:
                # All keys are in cooldown, reset and use any key
                logger.warning("⚠️ All keys in cooldown, resetting and using first available key")
                self._failed_keys.clear()
                available_keys = self.api_keys
            
            # Round-robin selection
            key = available_keys[self._current_index % len(available_keys)]
            self._current_index = (self._current_index + 1) % len(available_keys)
            
            self._total_requests += 1
            self._key_usage[key] = self._key_usage.get(key, 0) + 1
            
            return key
    
    def mark_key_failed(self, key: str, error: Exception):
        """
        Mark a key as failed (e.g., 429 rate limit error).
        The key will be skipped for the cooldown period.
        
        Args:
            key: The API key that failed
            error: The exception that occurred
        """
        with self._lock:
            self._failed_keys[key] = time.time()
            self._key_errors[key] = self._key_errors.get(key, 0) + 1
            
            error_msg = str(error)
            if "429" in error_msg or "rate limit" in error_msg.lower():
                logger.warning(f"⚠️ Rate limit (429) on key {key[:10]}... - marking for cooldown")
            else:
                logger.warning(f"⚠️ Error on key {key[:10]}... - {error_msg[:100]}")
    
    def get_llm(self, retry_on_error: bool = True) -> ChatGroq:
        """
        Get a ChatGroq instance with the next available API key.
        
        Args:
            retry_on_error: If True, will automatically retry with next key on 429 errors
            
        Returns:
            ChatGroq instance configured with an API key
        """
        key = self.get_next_key()
        return ChatGroq(
            model_name=self.model_name,
            temperature=self.temperature,
            groq_api_key=key
        )
    
    def call_with_retry(self, func, *args, **kwargs):
        """
        Call a function that uses Groq API with automatic retry on 429 errors.
        
        Args:
            func: Function to call (should accept llm as first argument or keyword)
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func
        
        Returns:
            Result of func call
        
        Raises:
            Exception: If all keys fail or non-429 error occurs
        """
        max_retries = len(self.api_keys) * 2  # Try each key at least twice
        last_error = None
        keys_tried = set()
        
        for attempt in range(max_retries):
            try:
                llm = self.get_llm()
                key = llm.groq_api_key
                
                # Call the function with the LLM
                if 'llm' in kwargs:
                    kwargs['llm'] = llm
                elif args:
                    # If first arg is expected to be llm, replace it
                    args = (llm,) + args[1:]
                else:
                    kwargs['llm'] = llm
                
                result = func(*args, **kwargs)
                
                # Success - remove from failed keys if it was there
                with self._lock:
                    if key in self._failed_keys:
                        del self._failed_keys[key]
                
                return result
                
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                
                # Check if it's a rate limit error
                is_rate_limit = (
                    "429" in str(e) or
                    "rate limit" in error_msg or
                    "too many requests" in error_msg
                )
                
                if is_rate_limit:
                    self.mark_key_failed(key, e)
                    keys_tried.add(key)
                    
                    # If we've tried all keys, wait a bit before retrying
                    if len(keys_tried) >= len(self.api_keys):
                        wait_time = min(5, attempt * 0.5)  # Exponential backoff, max 5 seconds
                        logger.info(f"⏳ All keys rate limited, waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                        keys_tried.clear()  # Reset and try again
                else:
                    # Non-rate-limit error - don't retry, just raise
                    logger.error(f"❌ Non-rate-limit error with Groq API: {e}")
                    raise
        
        # All retries exhausted
        logger.error(f"❌ All Groq API keys exhausted after {max_retries} attempts")
        raise RuntimeError(f"Failed to call Groq API after {max_retries} attempts. Last error: {last_error}")
    
    def get_stats(self) -> dict:
        """
        Get usage statistics for all keys.
        
        Returns:
            Dictionary with usage statistics
        """
        with self._lock:
            return {
                "total_keys": len(self.api_keys),
                "total_requests": self._total_requests,
                "keys_in_cooldown": len(self._failed_keys),
                "key_usage": self._key_usage.copy(),
                "key_errors": self._key_errors.copy(),
                "failed_keys": list(self._failed_keys.keys())
            }


# Global instance (will be initialized in config)
_groq_manager: Optional[GroqKeyManager] = None
_manager_lock = threading.Lock()


def get_groq_manager() -> GroqKeyManager:
    """
    Get the global GroqKeyManager instance.
    Must be initialized via initialize_groq_manager() first.
    
    Returns:
        Global GroqKeyManager instance
    
    Raises:
        RuntimeError: If manager not initialized
    """
    global _groq_manager
    if _groq_manager is None:
        raise RuntimeError("GroqKeyManager not initialized. Call initialize_groq_manager() first.")
    return _groq_manager


def initialize_groq_manager(api_keys: List[str], model_name: str = "llama-3.3-70b-versatile", temperature: float = 0):
    """
    Initialize the global GroqKeyManager instance.
    Should be called once at application startup.
    
    Args:
        api_keys: List of Groq API keys (can be single key or multiple)
        model_name: Groq model name
        temperature: Temperature setting
    """
    global _groq_manager
    with _manager_lock:
        if _groq_manager is None:
            _groq_manager = GroqKeyManager(api_keys, model_name, temperature)
            logger.info(f"✅ Global GroqKeyManager initialized with {len(api_keys)} key(s)")
        else:
            logger.warning("⚠️ GroqKeyManager already initialized, skipping")


def get_groq_llm() -> ChatGroq:
    """
    Convenience function to get a ChatGroq instance with round-robin key selection.
    
    Returns:
        ChatGroq instance with next available API key
    """
    return get_groq_manager().get_llm()
