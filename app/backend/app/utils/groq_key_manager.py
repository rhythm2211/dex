"""
Groq Multi-Key Manager
Manages multiple Groq API keys with load balancing, failover, and rate limit tracking.
"""
import time
import logging
from collections import deque
from threading import Lock
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("dex-core")


class KeyStatus(Enum):
    """Status of an API key"""
    ACTIVE = "active"
    RATE_LIMITED = "rate_limited"
    FAILED = "failed"
    EXHAUSTED = "exhausted"


@dataclass
class GroqKeyInfo:
    """Information about a Groq API key"""
    key: str
    status: KeyStatus = KeyStatus.ACTIVE
    request_times: deque = field(default_factory=deque)
    token_usage: deque = field(default_factory=deque)  # (timestamp, tokens)
    failure_count: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    total_requests: int = 0
    total_tokens: int = 0
    
    # Rate limits (per key, can be different for different tiers)
    rpm_limit: int = 30
    tpm_limit: int = 30000
    
    # Retry settings
    max_failures: int = 3
    failure_cooldown: float = 60.0  # seconds before retrying a failed key


class GroqKeyManager:
    """
    Manages multiple Groq API keys with:
    - Load balancing across keys
    - Rate limit tracking per key
    - Automatic failover on errors
    - Token exhaustion prevention
    - Health monitoring
    """
    _instance = None
    _lock = Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(GroqKeyManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        with self._lock:
            if self._initialized:
                return
            
            import os
            # Get API keys from environment (comma-separated or space-separated)
            keys_str = os.getenv("GROQ_API_KEYS", os.getenv("GROQ_API_KEY", ""))
            
            # Parse keys (support comma or space separation)
            if keys_str:
                keys = [k.strip() for k in keys_str.replace(",", " ").split() if k.strip()]
            else:
                keys = []
            
            # Default limits (can be overridden per key via env vars)
            default_rpm = int(os.getenv("GROQ_RPM_LIMIT", "30"))
            default_tpm = int(os.getenv("GROQ_TPM_LIMIT", "30000"))
            
            # Initialize key info
            self.keys: List[GroqKeyInfo] = []
            for i, key in enumerate(keys):
                # Allow per-key limits via env vars: GROQ_KEY_0_RPM, GROQ_KEY_1_RPM, etc.
                key_rpm = int(os.getenv(f"GROQ_KEY_{i}_RPM", str(default_rpm)))
                key_tpm = int(os.getenv(f"GROQ_KEY_{i}_TPM", str(default_tpm)))
                
                key_info = GroqKeyInfo(
                    key=key,
                    rpm_limit=key_rpm,
                    tpm_limit=key_tpm
                )
                self.keys.append(key_info)
                logger.info(f"Registered Groq API key {i+1}/{len(keys)} (RPM: {key_rpm}, TPM: {key_tpm})")
            
            if not self.keys:
                logger.warning("⚠️ No Groq API keys configured! Set GROQ_API_KEYS environment variable.")
            
            # Round-robin index for load balancing
            self._round_robin_index = 0
            
            self._initialized = True
            logger.info(f"GroqKeyManager initialized with {len(self.keys)} key(s)")
    
    def get_available_key(self, estimated_tokens: int = 1000) -> Optional[Tuple[str, float]]:
        """
        Get an available API key that can handle the request.
        Returns (key, wait_time) or None if no keys available.
        
        Strategy:
        1. Try round-robin for load balancing
        2. Check if key is available (not rate limited, not failed)
        3. Check if key has capacity (RPM and TPM)
        4. If no key available, wait and retry
        """
        if not self.keys:
            return None
        
        current_time = time.time()
        wait_times = []
        
        # Clean old entries for all keys
        for key_info in self.keys:
            self._clean_old_entries(key_info, current_time)
        
        # Try round-robin first, then check all keys
        start_index = self._round_robin_index
        checked_keys = []
        
        for _ in range(len(self.keys)):
            key_info = self.keys[self._round_robin_index]
            self._round_robin_index = (self._round_robin_index + 1) % len(self.keys)
            
            if key_info in checked_keys:
                continue
            checked_keys.append(key_info)
            
            # Check if key is available
            availability = self._check_key_availability(key_info, estimated_tokens, current_time)
            
            if availability["available"]:
                # Key is available, update round-robin for next time
                return (key_info.key, availability["wait_time"])
            else:
                wait_times.append(availability["wait_time"])
        
        # No key available immediately, return the minimum wait time
        if wait_times:
            min_wait = min(wait_times)
            if min_wait < 60:  # Reasonable wait time
                return (self.keys[0].key, min_wait)  # Return first key with wait
        
        # All keys exhausted or failed
        logger.warning("⚠️ All Groq API keys are unavailable or exhausted")
        return None
    
    def _check_key_availability(self, key_info: GroqKeyInfo, estimated_tokens: int, current_time: float) -> Dict:
        """
        Check if a key is available and calculate wait time if needed.
        Returns dict with 'available' (bool) and 'wait_time' (float).
        """
        wait_time = 0.0
        
        # Check if key is in failed state (with cooldown)
        if key_info.status == KeyStatus.FAILED:
            if key_info.last_failure_time:
                time_since_failure = current_time - key_info.last_failure_time
                if time_since_failure < key_info.failure_cooldown:
                    wait_time = key_info.failure_cooldown - time_since_failure
                    return {"available": False, "wait_time": wait_time}
                else:
                    # Cooldown expired, try reactivating
                    key_info.status = KeyStatus.ACTIVE
                    key_info.failure_count = 0
                    logger.info(f"🔄 Reactivating key after cooldown period")
        
        # Check RPM limit
        if len(key_info.request_times) >= key_info.rpm_limit:
            oldest_request = key_info.request_times[0]
            wait_time = max(wait_time, 60 - (current_time - oldest_request) + 0.1)
        
        # Check TPM limit
        current_tpm = sum(tokens for _, tokens in key_info.token_usage)
        if current_tpm + estimated_tokens > key_info.tpm_limit:
            if key_info.token_usage:
                oldest_token_time = key_info.token_usage[0][0]
                wait_time = max(wait_time, 60 - (current_time - oldest_token_time) + 0.1)
        
        available = wait_time == 0.0
        return {"available": available, "wait_time": wait_time}
    
    def _clean_old_entries(self, key_info: GroqKeyInfo, current_time: float):
        """Clean old entries from request and token tracking"""
        one_minute_ago = current_time - 60
        
        # Clean request times
        while key_info.request_times and key_info.request_times[0] < one_minute_ago:
            key_info.request_times.popleft()
        
        # Clean token usage
        while key_info.token_usage and key_info.token_usage[0][0] < one_minute_ago:
            key_info.token_usage.popleft()
    
    def record_request(self, key: str, tokens_used: int = 0, success: bool = True, error: Optional[str] = None):
        """
        Record a request for a key.
        
        Args:
            key: The API key used
            tokens_used: Number of tokens consumed
            success: Whether the request succeeded
            error: Error message if failed
        """
        current_time = time.time()
        
        # Find the key info
        key_info = None
        for k in self.keys:
            if k.key == key:
                key_info = k
                break
        
        if not key_info:
            logger.warning(f"⚠️ Attempted to record request for unknown key")
            return
        
        with self._lock:
            if success:
                key_info.status = KeyStatus.ACTIVE
                key_info.last_success_time = current_time
                key_info.failure_count = 0
                key_info.total_requests += 1
                key_info.total_tokens += tokens_used
                
                # Record request time and tokens
                key_info.request_times.append(current_time)
                key_info.token_usage.append((current_time, tokens_used))
            else:
                key_info.failure_count += 1
                key_info.last_failure_time = current_time
                
                # Check error type
                if error:
                    error_lower = error.lower()
                    if "rate limit" in error_lower or "429" in error:
                        key_info.status = KeyStatus.RATE_LIMITED
                        logger.warning(f"⚠️ Key rate limited: {error}")
                    elif "quota" in error_lower or "exhausted" in error_lower:
                        key_info.status = KeyStatus.EXHAUSTED
                        logger.warning(f"⚠️ Key exhausted: {error}")
                    else:
                        key_info.status = KeyStatus.FAILED
                        logger.warning(f"⚠️ Key failed: {error}")
                
                # Mark as failed if too many failures
                if key_info.failure_count >= key_info.max_failures:
                    key_info.status = KeyStatus.FAILED
                    logger.error(f"❌ Key marked as failed after {key_info.failure_count} failures")
    
    def get_stats(self) -> Dict:
        """Get statistics for all keys"""
        current_time = time.time()
        stats = {
            "total_keys": len(self.keys),
            "active_keys": 0,
            "rate_limited_keys": 0,
            "failed_keys": 0,
            "exhausted_keys": 0,
            "keys": []
        }
        
        for i, key_info in enumerate(self.keys):
            self._clean_old_entries(key_info, current_time)
            
            # Count statuses
            if key_info.status == KeyStatus.ACTIVE:
                stats["active_keys"] += 1
            elif key_info.status == KeyStatus.RATE_LIMITED:
                stats["rate_limited_keys"] += 1
            elif key_info.status == KeyStatus.FAILED:
                stats["failed_keys"] += 1
            elif key_info.status == KeyStatus.EXHAUSTED:
                stats["exhausted_keys"] += 1
            
            current_rpm = len(key_info.request_times)
            current_tpm = sum(tokens for _, tokens in key_info.token_usage)
            
            stats["keys"].append({
                "index": i,
                "status": key_info.status.value,
                "rpm_used": current_rpm,
                "rpm_limit": key_info.rpm_limit,
                "tpm_used": current_tpm,
                "tpm_limit": key_info.tpm_limit,
                "rpm_remaining": max(0, key_info.rpm_limit - current_rpm),
                "tpm_remaining": max(0, key_info.tpm_limit - current_tpm),
                "total_requests": key_info.total_requests,
                "total_tokens": key_info.total_tokens,
                "failure_count": key_info.failure_count,
                "last_success": key_info.last_success_time,
                "last_failure": key_info.last_failure_time
            })
        
        return stats
    
    def reset_key(self, key: str):
        """Manually reset a key's status (for recovery)"""
        for key_info in self.keys:
            if key_info.key == key:
                key_info.status = KeyStatus.ACTIVE
                key_info.failure_count = 0
                key_info.last_failure_time = None
                logger.info(f"🔄 Reset key status to ACTIVE")
                return
        logger.warning(f"⚠️ Key not found for reset")


# Global singleton instance
groq_key_manager = GroqKeyManager()
