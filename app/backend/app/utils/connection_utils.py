"""
Connection utilities with retry logic and error handling for external services.
Prevents connection reset errors by implementing proper retry strategies.
"""
import time
import logging
from functools import wraps
from typing import Callable, Any, Optional
import socket
from urllib.parse import urlparse, urlunparse
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError

logger = logging.getLogger("dex-core")

def _neo4j_hostname_from_uri(uri: str) -> Optional[str]:
    parsed = urlparse(uri)
    return parsed.hostname if parsed.scheme and parsed.hostname else None


def _preflight_neo4j_dns(uri: str) -> None:
    """
    Fail fast with an actionable message when the Aura hostname does not resolve.
    Railway/Neon IPv4 tricks do not apply here — Neo4j Aura TLS requires the real hostname.
    """
    host = _neo4j_hostname_from_uri(uri)
    if not host:
        return
    try:
        socket.inet_aton(host)
        return  # already an IPv4 literal
    except OSError:
        pass
    try:
        socket.getaddrinfo(host, 7687, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise ConnectionError(
            f"Neo4j hostname '{host}' does not resolve ({e}). "
            "This usually means the Aura instance was deleted, paused, or NEO4J_URI on Railway is outdated. "
            "Open https://console.neo4j.io → your instance → Connect → copy a fresh "
            "neo4j+s://… URI and update NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD."
        ) from e


def _normalize_neo4j_uri(uri: str, default_port: int = 7687) -> str:
    """
    Ensure the Neo4j URI includes an explicit port.

    Some environments/drivers behave poorly when the port is omitted and will
    attempt DNS resolution for a combined host:port string.
    """
    parsed = urlparse(uri)
    # If it doesn't parse as a normal URI, don't try to change it.
    if not parsed.scheme or not parsed.hostname:
        return uri
    if parsed.port is not None:
        return uri
    # Rebuild netloc as <hostname>:<port> (preserve userinfo if present).
    if parsed.username:
        userinfo = parsed.username
        if parsed.password:
            userinfo = f"{userinfo}:{parsed.password}"
        netloc = f"{userinfo}@{parsed.hostname}:{default_port}"
    else:
        netloc = f"{parsed.hostname}:{default_port}"
    return urlunparse(parsed._replace(netloc=netloc))


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


def create_neo4j_driver(uri: str, user: str, password: str, database: str = "neo4j", **kwargs) -> Optional[Any]:
    """
    Create a Neo4j driver with proper connection configuration.
    Optimized for Neo4j Aura cloud instances.
    
    Args:
        uri: Neo4j connection URI
        user: Username
        password: Password
        database: Database name (default: "neo4j")
        **kwargs: Additional driver configuration
        
    Returns:
        Neo4j driver instance or None if connection fails
    """
    try:
        uri = _normalize_neo4j_uri(uri)
        _preflight_neo4j_dns(uri)

        # Check URI scheme to determine encryption settings
        # URI schemes like 'neo4j+s://' or 'bolt+s://' already indicate encryption
        # Only set 'encrypted' for 'neo4j://' or 'bolt://' schemes
        uri_lower = uri.lower()
        use_encrypted_param = uri_lower.startswith(('neo4j://', 'bolt://'))
        is_aura = 'databases.neo4j.io' in uri_lower or 'neo4j.io' in uri_lower
        
        # For Neo4j Aura, use longer timeouts and try bolt+s:// if neo4j+s:// fails
        if is_aura:
            connection_timeout = kwargs.get("connection_timeout", 60)  # 60 seconds for Aura
            connection_acquisition_timeout = kwargs.get("connection_acquisition_timeout", 120)  # 2 minutes for Aura
        else:
            connection_timeout = kwargs.get("connection_timeout", 30)
            connection_acquisition_timeout = kwargs.get("connection_acquisition_timeout", 60)
        
        # Optimized connection pool for Railway Hobby Plan + Free Tier Databases
        # Neo4j Aura Free: 50 connections max
        # With connection pooling: ~1 connection per active session
        # Default: 30 connections (safe for 20-25 sessions, leaves 20-25 headroom)
        # For aggressive: 35-40 connections (risky, at limit)
        import os
        default_pool_size = int(os.getenv("NEO4J_POOL_SIZE", "30"))  # Conservative for free tier
        max_pool_size = kwargs.get("max_connection_pool_size", default_pool_size)
        
        # Configure connection with timeouts and retry settings
        config = {
            "connection_timeout": connection_timeout,
            "max_connection_lifetime": kwargs.get("max_connection_lifetime", 3600),  # 1 hour
            "max_connection_pool_size": max_pool_size,  # Configurable pool size
            "connection_acquisition_timeout": connection_acquisition_timeout,
            **kwargs
        }
        
        # Only set encrypted parameter for non-encrypted URI schemes
        if use_encrypted_param:
            config["encrypted"] = True
        
        # Try creating driver with original URI first
        driver = None
        try:
            driver = GraphDatabase.driver(uri, auth=(user, password), **config)
            
            # Verify connection works with database name specified
            with driver.session(database=database) as session:
                result = session.run("RETURN 1")
                result.consume()  # Consume the result to ensure query executed
            
            logger.info("✅ Neo4j driver created and verified")
            return driver
        except Exception as e:
            error_msg = str(e).lower()
            # If neo4j+s:// fails for Aura, try bolt+s://
            if is_aura and uri_lower.startswith('neo4j+s://'):
                logger.warning(f"neo4j+s:// connection failed, trying bolt+s://: {e}")
                bolt_uri = uri.replace('neo4j+s://', 'bolt+s://')
                try:
                    driver = GraphDatabase.driver(bolt_uri, auth=(user, password), **config)
                    with driver.session(database=database) as session:
                        result = session.run("RETURN 1")
                        result.consume()
                    logger.info("✅ Neo4j driver created with bolt+s:// and verified")
                    return driver
                except Exception as e2:
                    logger.error(f"❌ Both neo4j+s:// and bolt+s:// failed: {e2}")
                    if driver:
                        driver.close()
                    raise e2
            # Routing failures often mean a non-routing URI was used (neo4j:// on single instance)
            if "routing" in error_msg and uri_lower.startswith('neo4j://'):
                logger.warning(f"neo4j:// routing failed, trying bolt://: {e}")
                bolt_uri = uri.replace('neo4j://', 'bolt://')
                try:
                    driver = GraphDatabase.driver(bolt_uri, auth=(user, password), **config)
                    with driver.session(database=database) as session:
                        result = session.run("RETURN 1")
                        result.consume()
                    logger.info("✅ Neo4j driver created with bolt:// and verified")
                    return driver
                except Exception as e2:
                    logger.error(f"❌ Both neo4j:// and bolt:// failed: {e2}")
                    if driver:
                        driver.close()
                    raise e2
            if "routing" in error_msg and uri_lower.startswith('neo4j+s://'):
                logger.warning(f"neo4j+s:// routing failed, trying bolt+s://: {e}")
                bolt_uri = uri.replace('neo4j+s://', 'bolt+s://')
                try:
                    driver = GraphDatabase.driver(bolt_uri, auth=(user, password), **config)
                    with driver.session(database=database) as session:
                        result = session.run("RETURN 1")
                        result.consume()
                    logger.info("✅ Neo4j driver created with bolt+s:// and verified")
                    return driver
                except Exception as e2:
                    logger.error(f"❌ Both neo4j+s:// and bolt+s:// failed: {e2}")
                    if driver:
                        driver.close()
                    raise e2
            else:
                if driver:
                    driver.close()
                raise e
        
    except ConnectionError as e:
        logger.error(f"❌ Neo4j configuration error: {e}")
        return None
    except Exception as e:
        err = str(e).lower()
        if "name or service not known" in err or "failed to dns resolve" in err:
            host = _neo4j_hostname_from_uri(uri) or "unknown"
            logger.error(
                "❌ Neo4j DNS lookup failed for %s. Update NEO4J_URI in Railway from "
                "https://console.neo4j.io (instance may be paused or deleted). Original: %s",
                host,
                e,
            )
        else:
            logger.error(f"❌ Failed to create Neo4j driver: {e}")
        return None


def verify_neo4j_connection(driver, database: str = "neo4j") -> bool:
    """
    Verify that a Neo4j driver connection is still alive.
    
    Args:
        driver: Neo4j driver instance
        database: Database name (default: "neo4j")
        
    Returns:
        True if connection is alive, False otherwise
    """
    if not driver:
        return False
    
    try:
        with driver.session(database=database) as session:
            result = session.run("RETURN 1")
            result.consume()  # Consume the result to ensure query executed
        return True
    except Exception as e:
        logger.warning(f"Neo4j connection verification failed: {e}")
        return False
