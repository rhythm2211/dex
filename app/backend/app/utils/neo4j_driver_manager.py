"""
Singleton Neo4j Driver Manager
Shares a single Neo4j driver across all users to optimize connection pooling.
Neo4j drivers are thread-safe and designed to be shared.
"""
import os
import logging
from typing import Optional
from neo4j import GraphDatabase
from backend.app.utils.connection_utils import create_neo4j_driver, verify_neo4j_connection

logger = logging.getLogger("dex-core")

class Neo4jDriverManager:
    """
    Singleton manager for Neo4j driver.
    Shares a single driver instance across all users to optimize connection pooling.
    """
    _instance = None
    _driver = None
    _database = "neo4j"
    _class_lock = None  # Class-level lock for singleton initialization
    
    def __new__(cls):
        import threading
        # Initialize class lock on first access
        if cls._class_lock is None:
            cls._class_lock = threading.Lock()
        
        if cls._instance is None:
            with cls._class_lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = super(Neo4jDriverManager, cls).__new__(cls)
                    cls._instance._lock = threading.Lock()  # Instance-level lock
        return cls._instance
    
    def get_driver(self):
        """
        Get or create the shared Neo4j driver.
        Thread-safe and optimized for connection pooling.
        """
        if self._driver is None:
            with self._lock:
                # Double-check locking pattern
                if self._driver is None:
                    uri = os.getenv("NEO4J_URI")
                    user = os.getenv("NEO4J_USERNAME")
                    password = os.getenv("NEO4J_PASSWORD")
                    self._database = os.getenv("NEO4J_DATABASE", "neo4j")
                    
                    if not uri or not user or not password:
                        logger.error("❌ Neo4j credentials missing. Cannot create driver.")
                        return None
                    
                    # Create driver with optimized connection pool settings
                    # For single Neo4j instance, we want a reasonable pool size
                    # 50 connections shared across all users is optimal
                    self._driver = create_neo4j_driver(
                        uri, 
                        user, 
                        password, 
                        database=self._database,
                        max_connection_pool_size=50,  # Shared pool for all users
                        connection_timeout=30,
                        connection_acquisition_timeout=60
                    )
                    
                    if self._driver:
                        # Driver is created and verified in create_neo4j_driver()
                        # No need to verify again here to avoid blocking initialization
                        logger.info("✅ Shared Neo4j driver created (verified during creation)")
                    else:
                        logger.error("❌ Failed to create shared Neo4j driver")
        
        return self._driver
    
    def get_database(self):
        """Get the database name."""
        return self._database
    
    def close(self):
        """Close the driver (typically on application shutdown)."""
        if self._driver:
            try:
                self._driver.close()
                logger.info("✅ Shared Neo4j driver closed")
            except Exception as e:
                logger.error(f"Error closing Neo4j driver: {e}")
            finally:
                self._driver = None
    
    def verify_connection(self) -> bool:
        """Verify the driver connection is still active."""
        if not self._driver:
            return False
        return verify_neo4j_connection(self._driver, database=self._database)

# Global singleton instance
neo4j_driver_manager = Neo4jDriverManager()
