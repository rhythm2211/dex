"""
Connection utilities with retry logic and error handling for external services.
Prevents connection reset errors by implementing proper retry strategies.
"""
import time
import logging
from functools import wraps
from typing import Callable, Any, Optional
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError

logger = logging.getLogger("dex-core")


def retry_on_connection_error(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (ConnectionError, OSError, ServiceUnavailable, TransientError)
):
    """
    Decorator to retry a function on connection errors.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries in seconds
        backoff: Multiplier for delay after each retry
        exceptions: Tuple of exceptions to catch and retry on
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            retries = 0
            current_delay = delay
            
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    retries += 1
                    if retries >= max_retries:
                        logger.error(f"{func.__name__} failed after {max_retries} retries: {e}")
                        raise
                    
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.warning(
                            f"{func.__name__} connection reset (attempt {retries}/{max_retries}). "
                            f"Retrying in {current_delay:.1f}s..."
                        )
                    else:
                        logger.warning(
                            f"{func.__name__} connection error (attempt {retries}/{max_retries}): {e}. "
                            f"Retrying in {current_delay:.1f}s..."
                        )
                    
                    time.sleep(current_delay)
                    current_delay *= backoff
            
            raise RuntimeError(f"{func.__name__} failed after {max_retries} retries")
        
        return wrapper
    return decorator


def create_neo4j_driver(uri: str, user: str, password: str, **kwargs) -> Optional[Any]:
    """
    Create a Neo4j driver with proper connection configuration.
    
    Args:
        uri: Neo4j connection URI
        user: Username
        password: Password
        **kwargs: Additional driver configuration
        
    Returns:
        Neo4j driver instance or None if connection fails
    """
    try:
        # Check URI scheme to determine encryption settings
        # URI schemes like 'neo4j+s://' or 'bolt+s://' already indicate encryption
        # Only set 'encrypted' for 'neo4j://' or 'bolt://' schemes
        uri_lower = uri.lower()
        use_encrypted_param = uri_lower.startswith(('neo4j://', 'bolt://'))
        
        # Configure connection with timeouts and retry settings
        config = {
            "connection_timeout": kwargs.get("connection_timeout", 30),  # 30 seconds
            "max_connection_lifetime": kwargs.get("max_connection_lifetime", 3600),  # 1 hour
            "max_connection_pool_size": kwargs.get("max_connection_pool_size", 50),
            "connection_acquisition_timeout": kwargs.get("connection_acquisition_timeout", 60),  # 60 seconds
            **kwargs
        }
        
        # Only set encrypted parameter for non-encrypted URI schemes
        if use_encrypted_param:
            config["encrypted"] = True
        
        driver = GraphDatabase.driver(uri, auth=(user, password), **config)
        
        # Verify connection works
        with driver.session() as session:
            session.run("RETURN 1")
        
        logger.info("✅ Neo4j driver created and verified")
        return driver
        
    except Exception as e:
        logger.error(f"❌ Failed to create Neo4j driver: {e}")
        return None


def verify_neo4j_connection(driver) -> bool:
    """
    Verify that a Neo4j driver connection is still alive.
    
    Args:
        driver: Neo4j driver instance
        
    Returns:
        True if connection is alive, False otherwise
    """
    if not driver:
        return False
    
    try:
        with driver.session() as session:
            result = session.run("RETURN 1")
            result.consume()  # Consume the result to ensure query executed
        return True
    except Exception as e:
        logger.warning(f"Neo4j connection verification failed: {e}")
        return False
