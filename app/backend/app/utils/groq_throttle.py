"""
Groq API Request Throttling
Manages rate limits to prevent API errors and ensure smooth user experience.
"""
import time
import logging
from collections import deque
from threading import Lock
from typing import Optional

logger = logging.getLogger("dex-core")

class GroqThrottle:
    """
    Thread-safe rate limiter for Groq API requests.
    Tracks requests per minute (RPM) and tokens per minute (TPM).
    """
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(GroqThrottle, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        with self._lock:
            if self._initialized:
                return
            
            import os
            # Default limits (adjust based on your Groq tier)
            # Free tier: ~30 RPM, Paid tier: higher
            self.rpm_limit = int(os.getenv("GROQ_RPM_LIMIT", "30"))
            self.tpm_limit = int(os.getenv("GROQ_TPM_LIMIT", "30000"))  # Tokens per minute
            
            # Track request timestamps
            self.request_times = deque()
            self.token_usage = deque()  # (timestamp, tokens)
            
            self._initialized = True
            logger.info(f"GroqThrottle initialized: RPM={self.rpm_limit}, TPM={self.tpm_limit}")
    
    def wait_if_needed(self, estimated_tokens: int = 1000) -> float:
        """
        Wait if necessary to respect rate limits.
        Returns the wait time in seconds.
        
        Args:
            estimated_tokens: Estimated tokens for this request
            
        Returns:
            Wait time in seconds (0 if no wait needed)
        """
        current_time = time.time()
        wait_time = 0.0
        
        with self._lock:
            # Clean old entries (older than 1 minute)
            one_minute_ago = current_time - 60
            
            # Clean request times
            while self.request_times and self.request_times[0] < one_minute_ago:
                self.request_times.popleft()
            
            # Clean token usage
            while self.token_usage and self.token_usage[0][0] < one_minute_ago:
                self.token_usage.popleft()
            
            # Check RPM limit
            if len(self.request_times) >= self.rpm_limit:
                # Calculate wait time until oldest request expires
                oldest_request = self.request_times[0]
                wait_time = max(wait_time, 60 - (current_time - oldest_request) + 0.1)
            
            # Check TPM limit
            current_tpm = sum(tokens for _, tokens in self.token_usage)
            if current_tpm + estimated_tokens > self.tpm_limit:
                # Calculate wait time until tokens free up
                if self.token_usage:
                    oldest_token_time = self.token_usage[0][0]
                    wait_time = max(wait_time, 60 - (current_time - oldest_token_time) + 0.1)
            
            # Record this request
            if wait_time == 0:
                self.request_times.append(current_time)
                self.token_usage.append((current_time, estimated_tokens))
        
        # Wait outside the lock to avoid blocking other threads
        if wait_time > 0:
            logger.debug(f"Groq rate limit: waiting {wait_time:.2f}s")
            time.sleep(wait_time)
            # Record after waiting
            with self._lock:
                self.request_times.append(time.time())
                self.token_usage.append((time.time(), estimated_tokens))
        
        return wait_time
    
    def get_stats(self) -> dict:
        """Get current rate limit statistics."""
        current_time = time.time()
        one_minute_ago = current_time - 60
        
        with self._lock:
            # Clean old entries
            while self.request_times and self.request_times[0] < one_minute_ago:
                self.request_times.popleft()
            while self.token_usage and self.token_usage[0][0] < one_minute_ago:
                self.token_usage.popleft()
            
            current_rpm = len(self.request_times)
            current_tpm = sum(tokens for _, tokens in self.token_usage)
            
            return {
                "rpm_used": current_rpm,
                "rpm_limit": self.rpm_limit,
                "tpm_used": current_tpm,
                "tpm_limit": self.tpm_limit,
                "rpm_remaining": max(0, self.rpm_limit - current_rpm),
                "tpm_remaining": max(0, self.tpm_limit - current_tpm)
            }

# Global singleton instance
groq_throttle = GroqThrottle()
