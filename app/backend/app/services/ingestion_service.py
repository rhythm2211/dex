import os
import shutil
import logging
import tempfile
import json
import threading
import re
import time
from datetime import datetime, timedelta
from collections import Counter
from typing import Dict, Optional

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:11", "message": "ingestion_service.py started importing", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:12", "message": "About to import git", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from git import Repo, RemoteProgress
    from git.exc import GitCommandError
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:13", "message": "git imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:13", "message": "git import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:14", "message": "About to import langchain", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from langchain_community.document_loaders import DirectoryLoader, TextLoader
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:15", "message": "langchain imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:15", "message": "langchain import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# Explicitly import pgvector before PGVector to ensure it's available
# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:16", "message": "About to import pgvector", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    import pgvector  # Required for LangChain's PGVector implementation
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:17", "message": "pgvector imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:17", "message": "pgvector import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:18", "message": "About to import PGVector", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from langchain_community.vectorstores import PGVector
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:19", "message": "PGVector imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:19", "message": "PGVector import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:20", "message": "About to import psycopg", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    import psycopg
    from psycopg.conninfo import make_conninfo
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:21", "message": "psycopg imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:21", "message": "psycopg import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:22", "message": "About to import settings", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.core.config import settings
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:23", "message": "settings imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:23", "message": "settings import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:24", "message": "About to import GraphEngine", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.domain.graph_engine import GraphEngine
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:25", "message": "GraphEngine imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:25", "message": "GraphEngine import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# #region agent log
try:
    with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
        f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:26", "message": "About to import get_embeddings", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
except: pass
# #endregion
try:
    from backend.app.utils.embedding_utils import get_embeddings
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:27", "message": "get_embeddings imported successfully", "data": {}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
except Exception as e:
    # #region agent log
    try:
        with open(r"c:\Users\RHYTHM\Desktop\dex\.cursor\debug.log", "a", encoding="utf-8") as f:
            f.write(json.dumps({"sessionId": "debug-session", "runId": "startup-1", "hypothesisId": "B", "location": "ingestion_service.py:27", "message": "get_embeddings import failed", "data": {"error": str(e), "errorType": type(e).__name__}, "timestamp": int(time.time() * 1000)}) + "\n")
    except: pass
    # #endregion
    raise

# Setup Logging first
logger = logging.getLogger("dex-core")

# Try to import tree-sitter for multi-language parsing (use different name to avoid conflict)
try:
    import tree_sitter
    from tree_sitter import Language as TreeSitterLanguage, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False
    TreeSitterLanguage = None
    Parser = None

class IngestionService:
    def _init_language_splitters(self):
        """Initialize language-specific text splitters for better code chunking."""
        # Map file extensions to language strings (RecursiveCharacterTextSplitter.from_language uses strings)
        language_map = {
            '.py': 'python',
            '.js': 'js',
            '.jsx': 'js',
            '.mjs': 'js',
            '.cjs': 'js',
            '.ts': 'ts',
            '.tsx': 'ts',
            '.d.ts': 'ts',
            '.java': 'java',
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            '.scala': 'scala',
            '.cpp': 'cpp',
            '.cc': 'cpp',
            '.cxx': 'cpp',
            '.c': 'cpp',
            '.h': 'cpp',
            '.hpp': 'cpp',
            '.hxx': 'cpp',
            '.hh': 'cpp',
            '.cs': 'csharp',
            '.csx': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.rake': 'ruby',
            '.rbw': 'ruby',
            '.php': 'php',
            '.phtml': 'php',
            '.php3': 'php',
            '.php4': 'php',
            '.php5': 'php',
            '.swift': 'swift',
            '.m': 'objc',
            '.mm': 'objc',
            '.r': 'r',
            '.R': 'r',
            '.lua': 'lua',
            '.pl': 'perl',
            '.pm': 'perl',
            '.t': 'perl',
            '.sh': 'bash',
            '.bash': 'bash',
            '.zsh': 'bash',
            '.fish': 'bash',
            '.ksh': 'bash',
            '.sql': 'sql',
            '.html': 'html',
            '.htm': 'html',
            '.xhtml': 'html',
            '.css': 'css',
            '.scss': 'css',
            '.sass': 'css',
            '.less': 'css',
            '.styl': 'css',
            '.md': 'markdown',
            '.markdown': 'markdown',
            '.mdown': 'markdown',
            '.mkdn': 'markdown',
        }
        
        # Create splitters for each language
        for ext, lang in language_map.items():
            try:
                self.splitters[ext] = RecursiveCharacterTextSplitter.from_language(
                    language=lang,
                    chunk_size=1000,
                    chunk_overlap=100
                )
            except Exception as e:
                logger.debug(f"Could not create splitter for {ext}: {e}")
                # Fallback to generic splitter
                self.splitters[ext] = RecursiveCharacterTextSplitter(
                    chunk_size=1000,
                    chunk_overlap=100
                )
        
        # Default splitter for unknown languages
        self.default_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
    
    def _get_splitter_for_file(self, file_path: str) -> RecursiveCharacterTextSplitter:
        """Get the appropriate text splitter for a file based on its extension."""
        ext = os.path.splitext(file_path)[1].lower()
        return self.splitters.get(ext, self.default_splitter)
    
    def __init__(self, user_id: str = None):
        """
        Initialize IngestionService with user isolation support.
        
        Args:
            user_id: User ID for data isolation (required for multi-user support)
        """
        if not user_id:
            raise ValueError("user_id is required for user isolation. All ingestion operations must be scoped to a user.")
        
        self.user_id = user_id
        
        # Create language-specific splitters for better chunking
        self.splitters: Dict[str, RecursiveCharacterTextSplitter] = {}
        self._init_language_splitters()
        
        # Initialize the Neo4j-backed Graph Engine with user_id
        self.graph_engine = GraphEngine(user_id=self.user_id)
        # Use configurable embedding provider (supports local, Voyage AI, Cohere, OpenAI, etc.)
        self.embeddings = get_embeddings()
        
        # Paths - scoped by user_id for complete isolation
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.data_dir = os.path.join(base_dir, "backend", "data", self.user_id)
        os.makedirs(self.data_dir, exist_ok=True)
        
        # We still keep history locally for the timeline slider (it's small & sequential) - per user
        self.history_path = os.path.join(self.data_dir, "repo_history.json") 

        # SME / Feature mapping caches for graph enrichment
        self._expert_map: Dict[str, list] = {}
        self._feature_mappings: Dict[str, dict] = {}

        # Internal status for polling
        self._status = {"state": "idle", "progress": 0, "step": "Ready"}
        
        # Cancellation flag
        self._cancelled = False
        
        # Progress callback for git clone
        self._clone_progress = None

    def get_current_status(self):
        return self._status

    def cancel(self):
        """Cancel the current ingestion process."""
        self._cancelled = True
        logger.info("Ingestion cancellation requested")
        self._update_status("cancelled", self._status.get("progress", 0), "Cancellation requested...")

    def _check_cancelled(self):
        """Check if cancellation was requested and raise if so."""
        if self._cancelled:
            logger.info("Ingestion cancelled by user")
            self._update_status("cancelled", self._status.get("progress", 0), "Cancelled")
            raise RuntimeError("Ingestion cancelled by user")

    def _update_status(self, state: str, progress: int, step: str):
        self._status = {"state": state, "progress": progress, "step": step}
        logger.info(f"Ingestion Status: [{progress}%] {step}")
    
    class _CloneProgress(RemoteProgress):
        """Progress callback for git clone operations with progress tracking"""
        def __init__(self, status_callback, ingestion_service):
            super().__init__()
            self.status_callback = status_callback
            self.ingestion_service = ingestion_service
            self.last_update = 0
            self.last_progress_time = None
            self.progress_result = None  # Reference to clone_result dict
            
        def update(self, op_code, cur_count, max_count=None, message=''):
            # Check for cancellation
            if self.ingestion_service._cancelled:
                raise RuntimeError("Clone operation cancelled by user")
            
            # Update progress tracking
            current_time = datetime.now()
            if max_count and max_count > 0:
                progress_pct = int((cur_count / max_count) * 10)  # 0-10% of total 15% progress
                if progress_pct != self.last_update:
                    self.status_callback("running", 15 + progress_pct, 
                                       f"Cloning... ({cur_count}/{max_count} objects)" if max_count else "Cloning...")
                    self.last_update = progress_pct
                    self.last_progress_time = current_time
                    
                    # Update progress timestamp in clone_result if available
                    if self.progress_result is not None:
                        self.progress_result["last_progress"] = current_time
            else:
                # Even without max_count, update timestamp to show activity
                self.last_progress_time = current_time
                if self.progress_result is not None:
                    self.progress_result["last_progress"] = current_time

    def _wipe_knowledge_base(self):
        """
        Atomic Wipe: Clears Vector DB (PostgreSQL/pgvector) AND Graph DB (Neo4j) for current user only.
        """
        # 1. Clear PostgreSQL vector table - only for current user
        try:
            conninfo = make_conninfo(
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                dbname=settings.POSTGRES_DB
            )
            # OPTIMIZED: Use connection pool
            from backend.app.models.user import engine
            from sqlalchemy import text
            with engine.begin() as conn:
                # Use SQLAlchemy text() for parameterized queries
                result = conn.execute(
                    text(f"DELETE FROM {settings.POSTGRES_VECTOR_TABLE} WHERE metadata->>'user_id' = :user_id"),
                    {"user_id": self.user_id}
                )
                deleted_count = result.rowcount
            logger.info(f"PostgreSQL vector table: deleted {deleted_count} vectors for user {self.user_id}.")
        except Exception as e:
            logger.error(f"PostgreSQL vector table wipe failed: {e}")

        # 2. Clear Neo4j - only for current user (already scoped in GraphEngine.wipe_graph)
        try:
            self.graph_engine.wipe_graph()
            logger.info(f"Neo4j database wiped for user {self.user_id}.")
        except Exception as e:
            logger.error(f"Neo4j wipe failed: {e}")

    def _get_file_blame(self, repo_path: str, relative_file_path: str):
        """
        Runs 'git blame' to map every line number to an author and email.
        Returns: { 1: {"author": "Alice", "email": "alice@example.com"}, ... }
        Used to determine Function-Level Ownership with email.
        """
        try:
            repo = Repo(repo_path)
            blame_map = {}
            
            # Use porcelain for easy parsing
            # '--line-porcelain' outputs full commit info for every line
            val = repo.git.blame('--line-porcelain', relative_file_path)
            
            current_author = "Unknown"
            current_email = "unknown@unknown.com"
            current_line = 0
            
            for line in val.splitlines():
                if line.startswith("author "):
                    current_author = line[7:] # Remove "author "
                elif line.startswith("author-mail "):
                    # Extract email from "author-mail <email@example.com>"
                    email_part = line[12:].strip()
                    if email_part.startswith("<") and email_part.endswith(">"):
                        current_email = email_part[1:-1]
                elif line.startswith("\t"):
                    # This is the actual code line (starts with tab in porcelain)
                    current_line += 1
                    blame_map[current_line] = {
                        "author": current_author,
                        "email": current_email
                    }
                        
            return blame_map
            
        except Exception as e:
            # If file is new/uncommitted or binary, blame might fail.
            # logger.warning(f"Blame failed for {relative_file_path}: {e}")
            return {}
    
    def _calculate_churn_score(self, repo_path: str, relative_file_path: str) -> float:
        """
        Calculate churn_score (0.0-1.0) based on git log frequency.
        Formula: Uses git log --format=format: --name-only to count file changes.
        Higher frequency = higher churn = more risky.
        """
        try:
            repo = Repo(repo_path)
            # Get all commits that touched this file
            commits = list(repo.iter_commits(all=True, paths=[relative_file_path], max_count=1000))
            
            if not commits:
                return 0.0
            
            # Count unique commits per time period
            # More recent activity = higher churn
            now = datetime.now()
            six_months_ago = now - timedelta(days=180)
            one_year_ago = now - timedelta(days=365)
            
            recent_commits = 0
            total_commits = len(commits)
            
            for commit in commits:
                commit_date = datetime.fromtimestamp(commit.committed_date)
                if commit_date >= six_months_ago:
                    recent_commits += 1
            
            # Churn score: combination of total commits and recent activity
            # Normalize: 0.0 (no changes) to 1.0 (very frequent changes)
            # Heuristic: >= 20 commits in 6 months OR >= 50 total commits = high churn
            if total_commits >= 50:
                churn = min(1.0, 0.7 + (recent_commits / 20.0) * 0.3)
            else:
                churn = min(1.0, (recent_commits / 20.0) * 0.7 + (total_commits / 50.0) * 0.3)
            
            return round(churn, 3)
            
        except Exception as e:
            logger.debug(f"Churn calculation failed for {relative_file_path}: {e}")
            return 0.0
    
    def _is_test_file(self, file_path: str) -> bool:
        """
        Detect if a file is a test file based on common naming patterns.
        """
        filename = os.path.basename(file_path).lower()
        dir_path = os.path.dirname(file_path).lower()
        
        # Common test file patterns
        test_patterns = [
            # Python
            filename.startswith('test_') or filename.endswith('_test.py'),
            # JavaScript/TypeScript
            filename.endswith('.test.') or filename.endswith('.spec.') or 
            '__tests__' in dir_path or '__test__' in dir_path,
            # Java
            'test.java' in filename or 'tests.java' in filename,
            # Go
            filename.endswith('_test.go'),
            # Rust
            filename.endswith('_test.rs'),
            # General
            'test' in dir_path and ('test' in dir_path.split(os.sep) or 'tests' in dir_path.split(os.sep)),
        ]
        
        return any(test_patterns)
    
    def _calculate_owner_confidence(self, blame_map: dict) -> tuple:
        """
        Calculate owner email and confidence from blame map.
        Returns: (owner_email, owner_confidence) where confidence is 0.0-1.0
        """
        if not blame_map:
            return ("unknown@unknown.com", 0.0)
        
        # Count lines by email
        email_counts = Counter()
        for line_data in blame_map.values():
            if isinstance(line_data, dict):
                email = line_data.get("email", "unknown@unknown.com")
            else:
                # Fallback for old format
                email = "unknown@unknown.com"
            email_counts[email] += 1
        
        total_lines = len(blame_map)
        if total_lines == 0:
            return ("unknown@unknown.com", 0.0)
        
        # Get top owner
        top_email, top_count = email_counts.most_common(1)[0]
        confidence = round(top_count / total_lines, 3)
        
        return (top_email, confidence)

    def _identify_node_role(self, file_path: str) -> str:
        """
        Identify the role/category of a node based on its file path.
        Returns: 'infrastructure', 'api', 'frontend', 'backend', 'test', or 'code'
        """
        file_path_lower = file_path.lower()
        filename = os.path.basename(file_path_lower)
        
        # Infrastructure files
        infrastructure_files = [
            "dockerfile", "docker-compose.yml", "docker-compose.yaml",
            "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
            "requirements.txt", "requirements-dev.txt", "pyproject.toml", "setup.py",
            "pom.xml", "build.gradle", "build.gradle.kts",
            "go.mod", "go.sum",
            "terraform.tf", "terraform.tfvars", ".terraform.lock.hcl",
            "kubernetes.yaml", "k8s.yaml", "deployment.yaml",
            "compose.yml", "compose.yaml",
            ".env", ".env.example", ".env.local"
        ]
        
        if filename in infrastructure_files or any(filename.endswith(ext) for ext in ['.tf', '.tfvars']):
            return "infrastructure"
        
        # Test files
        if self._is_test_file(file_path):
            return "test"
        
        # API/Backend routes
        if any(pattern in file_path_lower for pattern in ['/api/', '/routes/', '/endpoints/', '/controllers/', '/handlers/']):
            return "api"
        
        # Frontend files
        if any(pattern in file_path_lower for pattern in ['/frontend/', '/client/', '/src/app/', '/components/', '/pages/', '/views/']):
            return "frontend"
        
        # Backend files
        if any(pattern in file_path_lower for pattern in ['/backend/', '/server/', '/app/', '/services/', '/models/']):
            return "backend"
        
        # Default to code
        return "code"

    def _analyze_git_history(self, repo_path: str):
        """
        Extracts commit history from ALL branches (main + features).
        Calculates 'Bus Factor' risk by tracking author dominance per file.
        """
        timeline = []
        file_stats = {}
        seen_commits = set()  # CRITICAL: Deduplication set

        # Rolling window cutoff for volatility (last 6 months)
        six_months_ago = datetime.now() - timedelta(days=180)
        
        try:
            repo = Repo(repo_path)
            
            # 1. Identify all refs to scan (Local + Remote)
            # We filter for 'origin/' to capture remote branches even if not checked out locally
            all_refs = [r.name for r in repo.references if 'origin/' in r.name or r.name in ['main', 'master', 'HEAD']]
            
            # Dedup ref names and sort so 'main' is processed first (optimization)
            branches = sorted(list(set(all_refs)), key=lambda x: 0 if 'main' in x or 'master' in x else 1)
            
            logger.info(f"Analyzing history across refs: {len(branches)} found")
            logger.info(f"🔄 Starting commit analysis across {len(branches)} branches...")

            total_branches = len(branches)
            for branch_idx, branch in enumerate(branches):
                # Check for cancellation every branch
                if self._cancelled:
                    logger.info("Cancellation detected during git history analysis")
                    raise RuntimeError("Ingestion cancelled by user")
                
                try:
                    # Log branch progress for all branches (more frequent logging)
                    logger.info(f"Processing branch {branch_idx + 1}/{total_branches}: {branch}")
                    
                    commit_count = 0
                    new_commits = 0
                    branch_start_time = time.time()
                    # Limit per branch to prevent timeouts on massive repos
                    # 100 commits per branch is usually enough to capture active dev
                    for commit in repo.iter_commits(branch, max_count=100):
                        # Check cancellation every 10 commits (more frequent)
                        if commit_count % 10 == 0:
                            if self._cancelled:
                                raise RuntimeError("Ingestion cancelled by user")
                            # Log progress every 10 commits for better visibility
                            if commit_count > 0 and commit_count % 10 == 0:
                                logger.debug(f"  Branch '{branch}': Processed {commit_count} commits...")
                        commit_count += 1
                        
                        if commit.hexsha in seen_commits:
                            continue # Skip if we already processed this via another branch
                        
                        seen_commits.add(commit.hexsha)
                        new_commits += 1
                        
                        # Log progress every 20 commits (keep existing detailed logging)
                        if commit_count % 20 == 0:
                            logger.info(f"  ⏳ Branch '{branch}': Processed {commit_count} commits ({new_commits} new, {len(seen_commits)} total unique)")
                        
                        # Add timeout check - if a branch takes more than 2 minutes, skip it
                        if time.time() - branch_start_time > 120:
                            logger.warning(f"Branch '{branch}' taking too long (>2min), skipping remaining commits")
                            break
                        
                        # --- Build Timeline Entry ---
                        commit_data = {
                            "hash": commit.hexsha,
                            "msg": commit.message.strip(),
                            "author": commit.author.name,
                            "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
                            "files": list(commit.stats.files.keys()),
                            "branch": branch
                        }
                        timeline.append(commit_data)
                        
                        # --- Accumulate File Stats (Heatmap & Blame) ---
                        for file_path in commit.stats.files.keys():
                            if file_path not in file_stats:
                                file_stats[file_path] = {
                                    "created_at": commit_data["date"],
                                    "commit_count": 0,
                                    "author_counts": Counter(),  # Changed from set to Counter
                                    "active_branches": set(),
                                    # Recent activity window for volatility
                                    "six_month_commit_count": 0,
                                }

                            stats = file_stats[file_path]

                            # Only update "last_modified" if this commit is newer
                            if commit_data["date"] > stats.get("last_modified", ""):
                                stats["last_modified"] = commit_data["date"]
                                stats["last_author"] = commit_data["author"]

                            stats["commit_count"] += 1
                            stats["author_counts"][commit_data["author"]] += 1
                            stats["active_branches"].add(branch)

                            # Increment recent commits if within last 6 months
                            commit_dt = datetime.fromtimestamp(commit.committed_date)
                            if commit_dt >= six_months_ago:
                                stats["six_month_commit_count"] += 1
                    
                    if commit_count > 0:
                        logger.info(f"Branch '{branch}': {commit_count} commits processed ({new_commits} new)")

                except Exception as e:
                    # Some refs might be HEAD pointers or tags that fail iter_commits
                    logger.warning(f"Skipping ref {branch}: {e}", exc_info=True)
                    continue
                except KeyboardInterrupt:
                    raise
                except BaseException as e:
                    # Catch any other unexpected errors but log them
                    logger.error(f"Unexpected error processing branch {branch}: {e}", exc_info=True)
                    continue
            
            logger.info(f"📈 Commit analysis complete: {len(seen_commits)} unique commits, {len(timeline)} timeline entries, {len(file_stats)} files tracked")

            # Sort timeline by date
            logger.info(f"🔄 Sorting timeline by date...")
            timeline.sort(key=lambda x: x['date'], reverse=True)

            # --- POST-PROCESSING: Calculate Bus Factor / Risk Score ---
            logger.info(f"Calculating bus factor and volatility scores for {len(file_stats)} files...")
            processed_files = 0
            for f_path, stats in file_stats.items():
                processed_files += 1
                
                # Log progress every 100 files
                if processed_files % 100 == 0:
                    logger.info(f"  ⏳ Bus factor calculation: {processed_files}/{len(file_stats)} files processed")
                
                total_commits = stats["commit_count"]

                # Default values
                stats["bus_risk_score"] = 0.0
                stats["top_owner"] = "None"

                if total_commits > 0:
                    # Find who owns the most commits
                    top_author, top_count = stats["author_counts"].most_common(1)[0]

                    # Risk Calculation: (Top Author Commits / Total Commits)
                    # Example: 9/10 commits by Bob = 0.9 Risk
                    risk_score = round(top_count / total_commits, 2)

                    stats["bus_risk_score"] = risk_score
                    stats["top_owner"] = top_author

                # Normalize volatility over the last 6 months (0.0 - 1.0)
                recent = stats.get("six_month_commit_count", 0)
                # Heuristic: >= 20 commits in 6 months => max volatility
                stats["volatility_score"] = round(min(1.0, recent / 20.0), 2)
                
                # Calculate churn_score (will be calculated per-file during processing)
                # This is a placeholder - actual churn_score calculated during file processing
                stats["churn_score"] = 0.0  # Will be updated during file processing

                # Cleanup: Convert sets/counters to JSON-serializable formats
                stats["authors"] = list(stats["author_counts"].keys())  # List of unique names
                del stats["author_counts"]  # Remove the counter object
                stats["active_branches"] = list(stats["active_branches"])
            
            logger.info(f"Bus factor & volatility calculation complete for {processed_files} files")

            # --- Build Feature mappings from commit messages ---
            feature_mappings: Dict[str, dict] = {}
            for entry in timeline:
                feature_name = self._extract_feature_from_message(entry.get("msg", ""))
                if not feature_name:
                    continue

                feature_id = feature_name.lower()
                existing = feature_mappings.setdefault(
                    feature_id, {"name": feature_name, "files": set()}
                )
                for file_path in entry.get("files", []):
                    existing["files"].add(file_path)

            # Persist mappings on the service for later Neo4j upsert
            self._feature_mappings = feature_mappings

            return timeline, file_stats

        except Exception as e:
            logger.warning(f"Git History Extraction Failed: {e}")
            return [], {}

    def _extract_feature_from_message(self, message: str):
        """
        Derive a human-meaningful 'Feature' name from a commit/PR title.
        Uses Conventional Commit style if present, otherwise falls back to first line.
        """
        if not message:
            return None

        first_line = message.strip().splitlines()[0]

        # Conventional commits: feat(scope): description
        m = re.match(r"(feat|feature|fix|chore|refactor)(\(.+?\))?:\s*(.+)", first_line, re.IGNORECASE)
        if m:
            return m.group(3).strip()

        # Otherwise, just use first line (truncated)
        return first_line[:120]

    def _validate_repo_url(self, repo_path: str) -> None:
        """
        Validates that a repository URL is properly formatted.
        Raises ValueError with a helpful message if invalid.
        """
        if not any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
            return  # Not a URL, assume it's a local path
        
        # Validate GitHub/GitLab URLs
        if repo_path.startswith("https://github.com/") or repo_path.startswith("http://github.com/"):
            # Remove protocol and trailing slash
            path = repo_path.replace("https://github.com/", "").replace("http://github.com/", "").rstrip("/")
            parts = path.split("/")
            
            if len(parts) < 2:
                raise ValueError(
                    f"Invalid GitHub URL: '{repo_path}'\n"
                    f"The URL appears to be incomplete. A valid GitHub URL should include both the owner and repository name.\n"
                    f"Example: https://github.com/owner/repository-name\n"
                    f"You provided: https://github.com/{parts[0] if parts else ''}\n"
                    f"Please provide the full repository URL including the repository name."
                )
            
            if len(parts) > 2 and parts[2] not in ["", ".git"]:
                # More than 2 parts and third part is not empty or .git
                raise ValueError(
                    f"Invalid GitHub URL: '{repo_path}'\n"
                    f"The URL contains extra path segments. A valid GitHub URL should be:\n"
                    f"https://github.com/owner/repository-name\n"
                    f"or\n"
                    f"https://github.com/owner/repository-name.git"
                )
        
        elif repo_path.startswith("https://gitlab.com/") or repo_path.startswith("http://gitlab.com/"):
            # Similar validation for GitLab
            path = repo_path.replace("https://gitlab.com/", "").replace("http://gitlab.com/", "").rstrip("/")
            parts = path.split("/")
            
            if len(parts) < 2:
                raise ValueError(
                    f"Invalid GitLab URL: '{repo_path}'\n"
                    f"The URL appears to be incomplete. A valid GitLab URL should include both the owner/group and repository name.\n"
                    f"Example: https://gitlab.com/owner/repository-name"
                )
        
        elif repo_path.startswith("git@"):
            # SSH format: git@github.com:owner/repo.git
            if ":" not in repo_path or repo_path.count(":") > 1:
                raise ValueError(
                    f"Invalid SSH Git URL: '{repo_path}'\n"
                    f"A valid SSH Git URL should be in the format: git@hostname:owner/repository.git\n"
                    f"Example: git@github.com:owner/repository.git"
                )

    def process_repository(self, repo_path: str):
        # Reset cancellation flag at start
        self._cancelled = False
        self._update_status("running", 0, "Initializing pipeline...")
        
        # Step 0: Clean Slate
        self._check_cancelled()
        self._wipe_knowledge_base()
        
        # --- PHASE 1: CLONING & HISTORY ---
        temp_dir = None
        actual_path = repo_path
        
        try:
            # 0. Validate repository URL before attempting clone
            if any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
                try:
                    self._validate_repo_url(repo_path)
                except ValueError as e:
                    logger.error(f"Repository URL validation failed: {e}")
                    raise RuntimeError(str(e))
            
            # 1. Clone (Full History)
            if any(repo_path.startswith(p) for p in ["http://", "https://", "git@"]):
                self._update_status("running", 15, "Cloning with full history...")
                temp_dir = tempfile.mkdtemp(prefix="dex_repo_")
                
                # Clone with progress reporting and timeout handling
                try:
                    # Use threading to implement timeout with better error handling
                    clone_result = {"success": False, "error": None, "last_progress": None}
                    clone_start_time = datetime.now()
                    
                    # Create progress callback with cancellation check and progress tracking
                    progress_callback = self._CloneProgress(self._update_status, self)
                    progress_callback.progress_result = clone_result  # Link for progress tracking
                    
                    def clone_worker():
                        try:
                            # Set git config for timeouts to prevent hanging
                            import subprocess
                            # Configure git to timeout on slow operations
                            subprocess.run(
                                ["git", "config", "--global", "http.lowSpeedLimit", "1000"],
                                capture_output=True, timeout=5
                            )
                            subprocess.run(
                                ["git", "config", "--global", "http.lowSpeedTime", "300"],
                                capture_output=True, timeout=5
                            )
                            subprocess.run(
                                ["git", "config", "--global", "http.postBuffer", "524288000"],
                                capture_output=True, timeout=5
                            )
                            
                            logger.info(f"Starting git clone for: {repo_path}")
                            # Initialize progress timestamp
                            clone_result["last_progress"] = datetime.now()
                            
                            Repo.clone_from(
                                repo_path, 
                                temp_dir, 
                                progress=progress_callback,
                                env={
                                    **os.environ,
                                    "GIT_TERMINAL_PROMPT": "0",  # Disable prompts
                                    "GIT_ASKPASS": "echo",  # Disable credential prompts
                                }
                            )
                            clone_result["success"] = True
                            logger.info(f"Git clone completed successfully for: {repo_path}")
                        except Exception as e:
                            clone_result["error"] = e
                            logger.error(f"Git clone error in worker thread: {e}", exc_info=True)
                    
                    clone_thread = threading.Thread(target=clone_worker, daemon=True)
                    clone_thread.start()
                    
                    # Monitor progress with timeout
                    timeout_seconds = 600  # 10 minutes total
                    progress_timeout = 120  # 2 minutes without progress = stuck
                    
                    while clone_thread.is_alive():
                        clone_thread.join(timeout=10)  # Check every 10 seconds
                        
                        # Check for cancellation
                        if self._cancelled:
                            logger.warning("Clone cancelled by user")
                            # Try to clean up temp directory
                            try:
                                shutil.rmtree(temp_dir, ignore_errors=True)
                            except:
                                pass
                            raise RuntimeError("Clone operation was cancelled")
                        
                        elapsed = (datetime.now() - clone_start_time).total_seconds()
                        
                        # Check if we've exceeded total timeout
                        if elapsed > timeout_seconds:
                            logger.error(f"Git clone timed out after {timeout_seconds} seconds for: {repo_path}")
                            raise TimeoutError(
                                f"Git clone timed out after {timeout_seconds} seconds. "
                                f"The repository may be too large or network is slow. "
                                f"Repository: {repo_path}"
                            )
                        
                        # Check if progress has stalled (no updates in last 2 minutes)
                        if clone_result["last_progress"]:
                            time_since_progress = (datetime.now() - clone_result["last_progress"]).total_seconds()
                            if time_since_progress > progress_timeout:
                                logger.error(
                                    f"Git clone appears stuck - no progress for {progress_timeout} seconds. "
                                    f"Repository: {repo_path}"
                                )
                                raise TimeoutError(
                                    f"Git clone appears to be stuck - no progress detected for {progress_timeout} seconds. "
                                    f"This may indicate:\n"
                                    f"- Network connectivity issues\n"
                                    f"- Repository server is unresponsive\n"
                                    f"- Repository is extremely large\n"
                                    f"Repository: {repo_path}"
                                )
                    
                    # Thread finished, check result
                    if not clone_result["success"]:
                        if clone_result["error"]:
                            # Clean up temp directory on error
                            try:
                                shutil.rmtree(temp_dir, ignore_errors=True)
                            except:
                                pass
                            raise clone_result["error"]
                        else:
                            raise RuntimeError("Git clone failed for unknown reason")
                    
                    actual_path = temp_dir
                    elapsed_time = (datetime.now() - clone_start_time).total_seconds()
                    logger.info(f"Clone completed successfully in {elapsed_time:.1f} seconds")
                    self._update_status("running", 25, "Clone completed successfully")
                    
                except GitCommandError as e:
                    error_msg = str(e)
                    # Try to get exit code from exception attributes or error message
                    exit_code = getattr(e, 'status', None) or getattr(e, 'returncode', None)
                    
                    # Also check error message for exit code pattern (e.g., "exit code(128)")
                    exit_code_match = re.search(r'exit code\((\d+)\)', error_msg)
                    if exit_code_match:
                        exit_code = int(exit_code_match.group(1))
                    
                    # Check for exit code 128 (common for repository not found, authentication, or invalid URL)
                    if exit_code == 128 or "exit code(128)" in error_msg or "exit code 128" in error_msg:
                        if "repository not found" in error_msg.lower() or "not found" in error_msg.lower():
                            logger.error(f"Repository not found: {e}")
                            raise RuntimeError(
                                f"Repository not found: '{repo_path}'\n"
                                f"This could mean:\n"
                                f"- The repository doesn't exist\n"
                                f"- The repository is private and requires authentication\n"
                                f"- The URL is incorrect or incomplete\n"
                                f"Please verify the repository URL and ensure it's publicly accessible."
                            )
                        elif "authentication" in error_msg.lower() or "permission denied" in error_msg.lower():
                            logger.error(f"Authentication failed: {e}")
                            raise RuntimeError(
                                f"Authentication failed for repository: '{repo_path}'\n"
                                f"This repository may be private. Please ensure:\n"
                                f"- The repository is public, or\n"
                                f"- You have configured SSH keys or credentials for private repositories"
                            )
                        else:
                            logger.error(f"Git clone failed with exit code 128: {e}")
                            raise RuntimeError(
                                f"Failed to clone repository: '{repo_path}'\n"
                                f"Git error (exit code 128): {error_msg}\n"
                                f"This usually means:\n"
                                f"- The repository URL is invalid or incomplete\n"
                                f"- The repository doesn't exist\n"
                                f"- Authentication is required\n"
                                f"Please verify the repository URL is correct and complete.\n"
                                f"Example: https://github.com/owner/repository-name"
                            )
                    elif "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.error(f"Git clone connection reset - network issue: {e}")
                        raise RuntimeError(f"Network connection was reset while cloning. This may be due to:\n"
                                         f"- Unstable network connection\n"
                                         f"- Repository server (GitHub) temporarily unavailable\n"
                                         f"- Firewall/proxy blocking the connection\n"
                                         f"Please check your network and try again.")
                    else:
                        logger.error(f"Git clone command failed: {e}")
                        raise RuntimeError(f"Failed to clone repository: {e}")
                except TimeoutError as e:
                    logger.error(f"Git clone timeout: {e}")
                    # Clean up temp directory on timeout
                    try:
                        if temp_dir and os.path.exists(temp_dir):
                            shutil.rmtree(temp_dir, ignore_errors=True)
                            logger.info(f"Cleaned up temp directory after timeout: {temp_dir}")
                    except Exception as cleanup_error:
                        logger.warning(f"Failed to clean up temp directory: {cleanup_error}")
                    raise
                except (ConnectionError, OSError) as e:
                    error_msg = str(e)
                    # Clean up temp directory on connection error
                    try:
                        if temp_dir and os.path.exists(temp_dir):
                            shutil.rmtree(temp_dir, ignore_errors=True)
                    except:
                        pass
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg or "104" in error_msg:
                        logger.error(f"Git clone connection reset: {e}")
                        raise RuntimeError(f"Network connection was reset while cloning repository.\n"
                                         f"Error: {error_msg}\n"
                                         f"This usually indicates a network issue. Please check:\n"
                                         f"- Your internet connection\n"
                                         f"- GitHub accessibility\n"
                                         f"- Firewall settings\n"
                                         f"Try again in a few moments.")
                    else:
                        logger.error(f"Network error during clone: {e}")
                        raise RuntimeError(f"Network error while cloning: {e}")
                except Exception as e:
                    error_msg = str(e)
                    if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                        logger.error(f"Connection reset error during clone: {e}")
                        raise RuntimeError(f"Connection was reset during repository clone. Please try again.")
                    else:
                        logger.error(f"Unexpected error during clone: {e}")
                        raise RuntimeError(f"Repository cloning failed: {e}")
            
            # 2. Git History Extraction (Multi-Branch + Risk Calc)
            self._check_cancelled()
            self._update_status("running", 30, "Analyzing Git Timeline & Bus Factor...")
            logger.info("🔍 Starting git history analysis...")
            try:
                timeline, file_stats = self._analyze_git_history(actual_path)
                logger.info(f"✅ Git history analysis complete: {len(timeline)} commits, {len(file_stats)} files")
            except Exception as e:
                logger.error(f"❌ Git history analysis failed: {e}", exc_info=True)
                raise RuntimeError(f"Git history analysis failed: {str(e)}")
            
            # Save Timeline Locally
            logger.info(f"💾 Saving timeline to {self.history_path}...")
            try:
                with open(self.history_path, 'w') as f:
                    json.dump(timeline, f)
                logger.info(f"✅ Timeline saved successfully")
            except Exception as e:
                logger.warning(f"⚠️ Failed to save timeline: {e}")

            # 3. Load Source Files
            self._check_cancelled()
            logger.info("📁 Moving to file scanning phase...")
            self._update_status("running", 40, "Scanning source files...")
            logger.info("📁 Scanning repository for code files...")
            
            # Comprehensive list of supported file extensions for ingestion
            # Organized by category for better maintainability
            CODE_EXTENSIONS = [
                # Python
                ".py", ".pyw", ".pyi", ".pyx",
                # JavaScript/TypeScript
                ".js", ".jsx", ".mjs", ".cjs",
                ".ts", ".tsx", ".d.ts",
                # Java/Kotlin/Scala
                ".java", ".kt", ".kts", ".scala",
                # C/C++
                ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".hh",
                # C# / .NET
                ".cs", ".csx",
                # Go
                ".go",
                # Rust
                ".rs",
                # Ruby
                ".rb", ".rake", ".rbw",
                # PHP
                ".php", ".phtml", ".php3", ".php4", ".php5",
                # Swift
                ".swift",
                # Objective-C
                ".m", ".mm", ".h",
                # R
                ".r", ".R",
                # Lua
                ".lua",
                # Perl
                ".pl", ".pm", ".t",
                # Shell scripts
                ".sh", ".bash", ".zsh", ".fish", ".ksh",
                # PowerShell
                ".ps1", ".psm1", ".psd1",
                # Other languages
                ".dart", ".elm", ".ex", ".exs", ".clj", ".cljs", ".hs", ".ml", ".mli",
                ".vim", ".lisp", ".cl", ".scm", ".rkt", ".jl", ".nim", ".cr", ".d",
                ".pas", ".p", ".pp", ".vb", ".vbs", ".v", ".sv", ".svh",
            ]
            
            WEB_EXTENSIONS = [
                ".html", ".htm", ".xhtml",
                ".css", ".scss", ".sass", ".less", ".styl",
                ".xml", ".xsl", ".xslt",
                ".vue", ".svelte",
            ]
            
            DATA_EXTENSIONS = [
                ".json", ".json5", ".jsonc",
                ".yaml", ".yml",
                ".toml",
                ".ini", ".cfg", ".conf",
                ".csv", ".tsv",
                ".xml",
            ]
            
            DOCUMENTATION_EXTENSIONS = [
                ".md", ".markdown", ".mdown", ".mkdn",
                ".rst", ".txt", ".text",
                ".adoc", ".asciidoc",
            ]
            
            CONFIG_EXTENSIONS = [
                ".dockerfile", ".dockerignore",
                ".gitignore", ".gitattributes",
                ".env", ".env.example",
                ".makefile", ".mk",
                ".cmake", ".cmake.in",
                ".gradle", ".gradle.kts",
                ".maven", ".pom",
                ".package.json", ".package-lock.json",
                ".requirements.txt", ".pip",
                ".gemfile", ".gemfile.lock",
                ".cargo.toml", ".cargo.lock",
                ".composer.json", ".composer.lock",
                ".pubspec.yaml", ".pubspec.lock",
            ]
            
            # Combine all extensions
            SUPPORTED_EXTENSIONS = (
                CODE_EXTENSIONS + 
                WEB_EXTENSIONS + 
                DATA_EXTENSIONS + 
                DOCUMENTATION_EXTENSIONS + 
                CONFIG_EXTENSIONS
            )
            
            raw_docs = []
            file_counts = {}
            
            # Load files by extension type
            for ext in SUPPORTED_EXTENSIONS:
                try:
                    loader = DirectoryLoader(actual_path, glob=f"**/*{ext}", loader_cls=TextLoader, silent_errors=True)
                    docs = loader.load()
                    if docs:
                        raw_docs.extend(docs)
                        file_counts[ext] = len(docs)
                        logger.info(f"Found {len(docs)} {ext} files")
                except Exception as e:
                    logger.warning(f"Error loading {ext} files: {e}")
                    continue
            
            # Also try to load any text files that might not have extensions
            # Use a more targeted approach to avoid hanging on large repos
            try:
                logger.debug("Scanning for additional text files without extensions...")
                # Limit the scan to avoid hanging - only check common text file patterns
                additional_patterns = ["**/*.txt", "**/*.md", "**/*.log", "**/*.conf", "**/*.config"]
                for pattern in additional_patterns:
                    try:
                        loader = DirectoryLoader(actual_path, glob=pattern, loader_cls=TextLoader, silent_errors=True)
                        additional_docs = loader.load()
                        if additional_docs:
                            existing_paths = {doc.metadata.get('source', '') for doc in raw_docs}
                            for doc in additional_docs:
                                source_path = doc.metadata.get('source', '')
                                if source_path and source_path not in existing_paths:
                                    raw_docs.append(doc)
                                    file_counts.setdefault('other', 0)
                                    file_counts['other'] += 1
                    except Exception as pattern_error:
                        logger.debug(f"Skipping pattern {pattern}: {pattern_error}")
                        continue
            except Exception as e:
                logger.warning(f"Error loading additional files: {e}")
            
            logger.info(f"Found {len(raw_docs)} total files to process")
            if file_counts:
                logger.info(f"File breakdown: {', '.join([f'{count} {ext}' for ext, count in file_counts.items()])}")

            # --- PHASE 2: STREAM TO CLOUD (NEO4J) - OPTIMIZED WITH BATCHING ---
            total_docs = len(raw_docs)
            logger.info(f"Starting Neo4j streaming for {total_docs} files (using batch inserts for performance)...")
            
            # Collect all nodes and edges for batch insertion
            all_nodes = []
            all_edges = []
            batch_size = 50  # Process files in batches before inserting to Neo4j
            
            for i, doc in enumerate(raw_docs):
                # Check for cancellation periodically
                if i % 10 == 0:
                    self._check_cancelled()
                
                # Update progress bar and log every 10 files
                if i % 10 == 0:
                    progress = 40 + int((i / total_docs) * 35) # 40% -> 75%
                    self._update_status("running", progress, f"Streaming Nodes to Cloud ({i}/{total_docs})...")
                    if i % 50 == 0 or i == 0:
                        logger.info(f"📤 Processing files for Neo4j: {i}/{total_docs} files ({int((i/total_docs)*100)}%)")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # Get extracted Git Metadata (Now includes bus_risk_score)
                git_meta = file_stats.get(relative_path, {})
                
                # [NEW] Identify node role for infrastructure awareness
                node_role = self._identify_node_role(relative_path)
                git_meta["node_role"] = node_role

                # Accumulate SME (expert) relationships based on git metadata
                primary_author = git_meta.get("top_owner")
                if primary_author and primary_author not in ("None", "Unknown"):
                    self._expert_map.setdefault(primary_author, []).append(
                        {
                            "file_id": relative_path,
                            "weight": git_meta.get("commit_count", 0),
                        }
                    )
                
                # Determine file type
                file_ext = os.path.splitext(relative_path)[1].lower()
                is_code_file = file_ext in ['.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php']
                
                # [LAYER 1] Calculate churn_score from git log
                churn_score = 0.0
                if is_code_file:
                    try:
                        churn_score = self._calculate_churn_score(actual_path, relative_path)
                        git_meta["churn_score"] = churn_score
                    except Exception as e:
                        logger.debug(f"Failed to calculate churn for {relative_path}: {e}")
                
                # [NEW] Get Line-Level Blame (Ownership) - only for code files
                blame_map = {}
                owner_email = "unknown@unknown.com"
                owner_confidence = 0.0
                if is_code_file:
                    try:
                        blame_map = self._get_file_blame(actual_path, relative_path)
                        # Calculate owner_email and owner_confidence from blame_map
                        owner_email, owner_confidence = self._calculate_owner_confidence(blame_map)
                        git_meta["owner_email"] = owner_email
                        git_meta["owner_confidence"] = owner_confidence
                    except Exception as e:
                        logger.debug(f"Failed to get git blame for {relative_path}: {e}")
                        blame_map = {}
                
                # [LAYER 1] Detect if this is a test file
                is_test_file = self._is_test_file(relative_path)
                if is_test_file:
                    git_meta["is_test_file"] = True
                
                # Extract structure (but don't insert yet - collect for batch)
                try:
                    # Use extract_and_build with return_data=True to get nodes/edges without inserting
                    nodes, edges = self.graph_engine.extract_and_build(
                        file_content=doc.page_content, 
                        file_path=relative_path, 
                        repo_root=actual_path,
                        git_metadata=git_meta,
                        blame_map=blame_map,
                        return_data=True
                    )
                    
                    # [LAYER 1] If this is a test file, create COVERS edges to source files it tests
                    if is_test_file:
                        # Try to infer which source files this test covers
                        # Common patterns: test_<source>.py, <source>_test.py, etc.
                        source_file = relative_path
                        # Remove test prefixes/suffixes to find source file
                        if source_file.startswith("test_"):
                            potential_source = source_file[5:]  # Remove "test_"
                            if not potential_source.endswith(".py"):
                                potential_source += ".py"
                            # Create COVERS edge if source file exists in our nodes
                            for node in nodes:
                                if node.get("id") == potential_source or potential_source in node.get("id", ""):
                                    edges.append({
                                        "source": relative_path,
                                        "target": potential_source,
                                        "relation": "COVERS"
                                    })
                        elif source_file.endswith("_test.py"):
                            potential_source = source_file[:-8] + ".py"  # Remove "_test.py"
                            for node in nodes:
                                if node.get("id") == potential_source or potential_source in node.get("id", ""):
                                    edges.append({
                                        "source": relative_path,
                                        "target": potential_source,
                                        "relation": "COVERS"
                                    })
                    
                    all_nodes.extend(nodes)
                    all_edges.extend(edges)
                except Exception as e:
                    logger.debug(f"Failed to extract structure for {relative_path}: {e}")
                    # Still add file node even if parsing fails
                    all_nodes.append({
                        "id": relative_path,
                        "type": "file",
                        "name": os.path.basename(relative_path),
                        "val": 15,
                        **git_meta
                    })
                    continue
                
                # Batch insert every batch_size files to avoid memory issues
                if (i + 1) % batch_size == 0 or (i + 1) == total_docs:
                    logger.info(f"Batch inserting {len(all_nodes)} nodes and {len(all_edges)} edges to Neo4j...")
                    try:
                        self.graph_engine.batch_upsert_nodes(all_nodes)
                        self.graph_engine.batch_upsert_edges(all_edges)
                        logger.info(f"Batch insert complete: {len(all_nodes)} nodes, {len(all_edges)} edges")
                    except Exception as e:
                        logger.error(f"Batch insert failed: {e}. Falling back to individual inserts...")
                        # Fallback to individual inserts
                        for node in all_nodes:
                            try:
                                self.graph_engine.upsert_node(node)
                            except:
                                pass
                        for edge in all_edges:
                            try:
                                self.graph_engine.upsert_edge(edge['source'], edge['target'], edge['relation'])
                            except:
                                pass
                    
                    # Clear batches
                    all_nodes = []
                    all_edges = []
            
            logger.info(f"Neo4j streaming complete: {total_docs} files processed")

            # --- [LAYER 1] Mark untested_critical files (no incoming COVERS edges) ---
            try:
                logger.info("Identifying untested critical files...")
                self.graph_engine.mark_untested_critical()
            except Exception as e:
                logger.error(f"Failed to mark untested files: {e}")

            # --- Enrich graph with SME and Feature context (Smart Impact Radius) ---
            try:
                if self._expert_map:
                    logger.info(f"📌 Upserting SME relationships for {len(self._expert_map)} authors")
                    self.graph_engine.upsert_expert_relationships(self._expert_map)
            except Exception as e:
                logger.error(f"Failed to upsert SME relationships: {e}")

            try:
                feature_mappings = getattr(self, "_feature_mappings", None)
                if feature_mappings:
                    logger.info(f"📌 Upserting Feature mappings for {len(feature_mappings)} features")
                    self.graph_engine.upsert_feature_mappings(feature_mappings)
            except Exception as e:
                logger.error(f"Failed to upsert Feature mappings: {e}")

            # --- PHASE 3: VECTOR EMBEDDINGS (PostgreSQL/pgvector) ---
            self._check_cancelled()
            self._update_status("running", 80, "Generating semantic vectors...")
            logger.info(f"🔪 Splitting {len(raw_docs)} documents into chunks using language-specific splitters...")
            
            # [MEMORY LEAK FIX] Generator-based streaming instead of accumulating all chunks in memory
            def chunk_generator():
                """Generator that yields chunks one at a time to prevent OOM on large repos."""
                chunk_stats = {}
                total_chunks = 0
                doc_count = 0
                
                logger.info(f"Starting chunk generation for {len(raw_docs)} documents...")
                for doc in raw_docs:
                    doc_count += 1
                    if doc_count % 10 == 0:
                        logger.debug(f"Processing document {doc_count}/{len(raw_docs)} for chunking...")
                    file_path = doc.metadata.get('source', 'unknown')
                    relative_path = os.path.relpath(file_path, actual_path) if file_path != 'unknown' else 'unknown'
                    
                    # Get appropriate splitter for this file
                    splitter = self._get_splitter_for_file(relative_path)
                    file_ext = os.path.splitext(relative_path)[1].lower()
                    
                    try:
                        chunks = splitter.split_documents([doc])
                        
                        # Track chunking stats
                        if file_ext not in chunk_stats:
                            chunk_stats[file_ext] = 0
                        chunk_stats[file_ext] += len(chunks)
                        
                        # Yield chunks one at a time
                        for chunk in chunks:
                            # Enhance chunk with filename immediately
                            full_path = chunk.metadata.get('source', '')
                            chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                            chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"
                            total_chunks += 1
                            yield chunk
                            
                    except Exception as e:
                        logger.warning(f"Error splitting {relative_path}: {e}")
                        # Fallback to default splitter
                        try:
                            chunks = self.default_splitter.split_documents([doc])
                            for chunk in chunks:
                                full_path = chunk.metadata.get('source', '')
                                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"
                                total_chunks += 1
                                yield chunk
                        except:
                            # If all else fails, add the document as a single chunk
                            full_path = doc.metadata.get('source', '')
                            doc.metadata['file_name'] = os.path.relpath(full_path, actual_path) if full_path != 'unknown' else 'unknown'
                            doc.page_content = f"File: {doc.metadata['file_name']}\n{doc.page_content}"
                            total_chunks += 1
                            yield doc
                
                # Log stats after processing
                logger.info(f"Created {total_chunks} vector chunks from {len(raw_docs)} documents")
                if chunk_stats:
                    top_extensions = sorted(chunk_stats.items(), key=lambda x: -x[1])[:5]
                    logger.info(f"Top chunked file types: {', '.join([f'{count} chunks from {ext}' for ext, count in top_extensions])}")
            
            # Use generator instead of accumulating in memory
            logger.info("Creating chunk generator...")
            chunk_gen = chunk_generator()
            logger.info("Chunk generator created, starting to process chunks...")

            # MEMORY-OPTIMIZED: Generate and insert embeddings in smaller batches to avoid OOM
            # Reduced batch sizes for the larger embedding model (all-mpnet-base-v2 uses more memory)
            embedding_batch_size = 50  # Smaller batch to reduce memory usage (was 500)
            db_batch_size = 100  # Smaller batch for DB inserts (was 200)
            
            # [MEMORY LEAK FIX] Count chunks from generator without storing them all
            logger.info("Starting memory-optimized PostgreSQL vector indexing (streaming mode)...")
            logger.info(f"   Embedding batch size: {embedding_batch_size}, DB insert batch size: {db_batch_size}")
            
            # Process chunks from generator in streaming batches
            # Initialize PGVector store and verify table dimension
            try:
                self._update_status("running", 80, f"Generating embeddings...")
                logger.info(f"Initializing PGVector store...")
                
                # Verify table dimension before proceeding
                conninfo_check = make_conninfo(
                        host=settings.POSTGRES_HOST,
                        port=settings.POSTGRES_PORT,
                        user=settings.POSTGRES_USER,
                        password=settings.POSTGRES_PASSWORD,
                        dbname=settings.POSTGRES_DB
                )
                expected_dim = getattr(settings, 'EMBEDDING_DIMENSION', 1024)  # Default to 1024 for Voyage AI
                
                with psycopg.connect(conninfo_check) as conn:
                    with conn.cursor() as cur:
                        # Check if table exists (using raw connection from pool)
                        cur.execute(f"""
                            SELECT EXISTS (
                                SELECT FROM information_schema.tables 
                                WHERE table_name = %s
                            );
                        """, (settings.POSTGRES_VECTOR_TABLE,))
                        table_exists = cur.fetchone()[0]
                        
                        if table_exists:
                            # Check dimension
                            cur.execute(f"""
                                SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as type
                                FROM pg_attribute a
                                JOIN pg_class c ON a.attrelid = c.oid
                                WHERE c.relname = %s AND a.attname = 'embedding';
                            """, (settings.POSTGRES_VECTOR_TABLE,))
                            type_result = cur.fetchone()
                            
                            if type_result:
                                import re
                                match = re.search(r'vector\((\d+)\)', type_result[0])
                                if match:
                                    table_dim = int(match.group(1))
                                    if table_dim != expected_dim:
                                        error_msg = (
                                                f"CRITICAL: Dimension mismatch detected!\n"
                                            f"   Table '{settings.POSTGRES_VECTOR_TABLE}' has {table_dim} dimensions\n"
                                            f"   But code expects {expected_dim} dimensions (model: {settings.EMBEDDING_MODEL_NAME})\n"
                                            f"   You must run the migration script:\n"
                                            f"   python migrate_embeddings_standalone.py"
                                        )
                                        logger.error(error_msg)
                                        raise RuntimeError(error_msg)
                                    else:
                                        logger.info(f"Verified table dimension: {table_dim} (matches expected {expected_dim})")
                
                # Create a minimal store just to ensure table exists
                dummy_store = PGVector(
                    connection_string=settings.POSTGRES_CONNECTION_STRING,
                    embedding_function=self.embeddings,
                    collection_name=settings.POSTGRES_VECTOR_TABLE,
                    use_jsonb=True
                )
                logger.info(f"PGVector store initialized")
            except RuntimeError:
                raise  # Re-raise dimension mismatch errors
            except Exception as e:
                logger.error(f"PGVector initialization failed: {e}")
                raise RuntimeError(f"Failed to initialize vector store: {e}")
            
            # MEMORY-EFFICIENT: Generate and insert embeddings in streaming batches
            # [MEMORY LEAK FIX] Process chunks from generator instead of pre-loaded list
            logger.info(f"Generating and inserting embeddings in streaming batches of {embedding_batch_size}...")
            
            # Prepare connection for bulk inserts
            conninfo = make_conninfo(
                    host=settings.POSTGRES_HOST,
                    port=settings.POSTGRES_PORT,
                    user=settings.POSTGRES_USER,
                    password=settings.POSTGRES_PASSWORD,
                    dbname=settings.POSTGRES_DB
                )
            table_name = settings.POSTGRES_VECTOR_TABLE
            
            # OPTIMIZED: Process in streaming batches with smaller accumulation for memory efficiency
            # For Railway Hobby Plan (48GB RAM), we can process larger batches, but still optimize
            # to support 100+ concurrent sessions
            accumulated_texts = []
            accumulated_embeddings = []
            accumulated_metadatas = []
            processed_count = 0
            batch_num = 0
            
            # Memory optimization: Use smaller accumulation buffer for high concurrency
            # This reduces peak memory usage per ingestion session
            # Note: os is imported at module level, don't import locally
            optimized_db_batch_size = min(db_batch_size, int(os.getenv("OPTIMIZED_DB_BATCH_SIZE", str(db_batch_size))))
            
            # Process chunks from generator in batches
            current_batch = []
            chunk_iter_count = 0
            logger.info("Starting to iterate through chunk generator...")
            try:
                for chunk in chunk_gen:
                    chunk_iter_count += 1
                    if chunk_iter_count % 100 == 0:
                        logger.info(f"Processed {chunk_iter_count} chunks from generator...")
                    current_batch.append(chunk)
                    
                    # When we have enough chunks for an embedding batch, process them
                    if len(current_batch) >= embedding_batch_size:
                        self._check_cancelled()
                        batch_num += 1
                        batch_texts = [doc.page_content for doc in current_batch]
                        # Add user_id to metadata for isolation
                        batch_metadatas = []
                        for doc in current_batch:
                            metadata = doc.metadata.copy()
                            metadata['user_id'] = self.user_id
                            batch_metadatas.append(metadata)
                        
                        # Update status with actual progress
                        self._update_status("running", 80 + int((processed_count / max(processed_count + len(current_batch), 1)) * 15), 
                                          f"Generating embeddings ({processed_count}+/{processed_count + len(current_batch)})...")
                        
                        if batch_num % 5 == 0 or batch_num == 1:
                            logger.info(f"🔄 Generating embeddings: batch {batch_num}, chunks {processed_count} to {processed_count + len(current_batch)}")
                        
                        # Generate embeddings for this batch
                        try:
                            batch_embeddings = self.embeddings.embed_documents(batch_texts)
                            accumulated_texts.extend(batch_texts)
                            accumulated_embeddings.extend(batch_embeddings)
                            accumulated_metadatas.extend(batch_metadatas)
                            processed_count += len(batch_texts)
                        except Exception as e:
                            logger.error(f"Embedding generation failed for batch {batch_num}: {e}")
                            raise RuntimeError(f"Failed to generate embeddings: {e}")
                        
                        # Clear current batch to free memory
                        current_batch = []
                        
                        # Insert accumulated embeddings when we reach optimized batch size
                        # Use smaller batches for better memory efficiency in high concurrency
                        if len(accumulated_embeddings) >= optimized_db_batch_size:
                            self._check_cancelled()
                            self._update_status("running", 80 + int((processed_count / max(processed_count + len(accumulated_embeddings), 1)) * 15), 
                                              f"Indexing vectors ({processed_count}/{processed_count + len(accumulated_embeddings)})...")
                            
                            # Prepare insert data - user_id is already in metadata
                            insert_query = f"""
                                INSERT INTO {table_name} (content, metadata, embedding, file_name, source, user_id, created_at)
                                VALUES (%s, %s, %s::vector, %s, %s, %s, CURRENT_TIMESTAMP)
                            """
                            
                            insert_data = []
                            for text, embedding, metadata in zip(accumulated_texts, accumulated_embeddings, accumulated_metadatas):
                                # Ensure user_id is in metadata (should already be set above)
                                if 'user_id' not in metadata:
                                    metadata['user_id'] = self.user_id
                                # Extract user_id from metadata for the column
                                user_id = metadata.get('user_id', self.user_id)
                                file_name = metadata.get('file_name', '')
                                source = metadata.get('source', '')
                                embedding_str = '[' + ','.join(str(float(x)) for x in embedding) + ']'
                                insert_data.append((
                                    text,
                                    json.dumps(metadata),
                                    embedding_str,
                                    file_name,
                                    source,
                                    user_id
                                ))
                            
                            # Store count before clearing
                            insert_count = len(accumulated_embeddings)
                            
                            try:
                                # OPTIMIZED: Use SQLAlchemy connection pool instead of creating new connections
                                # This significantly improves throughput and reduces connection overhead
                                from backend.app.models.user import engine
                                # Get raw connection from pool for bulk inserts (faster)
                                conn = engine.raw_connection()
                                try:
                                    with conn.cursor() as cur:
                                        cur.executemany(insert_query, insert_data)
                                        conn.commit()
                                    logger.info(f"Inserted {insert_count} vectors to database")
                                finally:
                                    # Return connection to pool
                                    conn.close()
                                        
                                logger.info(f"Inserted {insert_count} vectors to database")
                                
                                # OPTIMIZED: Explicitly clear and force garbage collection for high concurrency
                                accumulated_texts.clear()
                                accumulated_embeddings.clear()
                                accumulated_metadatas.clear()
                                insert_data.clear()
                                # Force garbage collection for memory-intensive operations
                                import gc
                                gc.collect()
                                
                            except (ConnectionError, OSError, psycopg.OperationalError) as e:
                                error_msg = str(e)
                                if "Connection reset" in error_msg or "Connection aborted" in error_msg:
                                    logger.warning(f"PostgreSQL connection issue, retrying...")
                                    # Retry once with connection pool
                                    try:
                                        from backend.app.models.user import engine
                                        conn = engine.raw_connection()
                                        try:
                                            with conn.cursor() as cur:
                                                cur.executemany(insert_query, insert_data)
                                                conn.commit()
                                            logger.info(f"Retry successful: Inserted {insert_count} vectors")
                                        finally:
                                            conn.close()
                                        logger.info(f"Retry successful: Inserted {insert_count} vectors")
                                        accumulated_texts.clear()
                                        accumulated_embeddings.clear()
                                        accumulated_metadatas.clear()
                                        insert_data.clear()
                                        import gc
                                        gc.collect()
                                    except Exception as retry_e:
                                        logger.error(f"Retry failed: {retry_e}")
                                        raise RuntimeError(f"Failed to insert vectors after retry: {retry_e}")
                                else:
                                    logger.error(f"Failed to insert {insert_count} vectors: {e}")
                                    raise RuntimeError(f"Failed to insert vectors: {e}")
                            except Exception as e:
                                logger.error(f"Failed to insert {insert_count} vectors: {e}")
                                raise RuntimeError(f"Failed to insert vectors: {e}")
                
                # Process any remaining chunks in current_batch
                if current_batch:
                    self._check_cancelled()
                    batch_num += 1
                    batch_texts = [doc.page_content for doc in current_batch]
                    # Add user_id to metadata for isolation
                    batch_metadatas = []
                    for doc in current_batch:
                        metadata = doc.metadata.copy()
                        metadata['user_id'] = self.user_id
                        batch_metadatas.append(metadata)
                    
                    logger.info(f"Generating embeddings: final batch {batch_num}, processing {len(current_batch)} chunks")
                    
                    try:
                        batch_embeddings = self.embeddings.embed_documents(batch_texts)
                        accumulated_texts.extend(batch_texts)
                        accumulated_embeddings.extend(batch_embeddings)
                        accumulated_metadatas.extend(batch_metadatas)
                        processed_count += len(batch_texts)
                    except Exception as e:
                        logger.error(f"Embedding generation failed for final batch: {e}")
                        raise RuntimeError(f"Failed to generate embeddings: {e}")
                
                # Insert any remaining accumulated embeddings
                if accumulated_embeddings:
                    self._check_cancelled()
                    insert_count = len(accumulated_embeddings)
                    insert_query = f"""
                        INSERT INTO {table_name} (content, metadata, embedding, file_name, source, user_id, created_at)
                        VALUES (%s, %s, %s::vector, %s, %s, %s, CURRENT_TIMESTAMP)
                    """
                    insert_data = []
                    for text, embedding, metadata in zip(accumulated_texts, accumulated_embeddings, accumulated_metadatas):
                        # Ensure user_id is in metadata
                        if 'user_id' not in metadata:
                            metadata['user_id'] = self.user_id
                        # Extract user_id from metadata for the column
                        user_id = metadata.get('user_id', self.user_id)
                        file_name = metadata.get('file_name', '')
                        source = metadata.get('source', '')
                        embedding_str = '[' + ','.join(str(float(x)) for x in embedding) + ']'
                        insert_data.append((
                            text,
                            json.dumps(metadata),
                            embedding_str,
                            file_name,
                            source,
                            user_id
                        ))
                    
                    try:
                        # OPTIMIZED: Use connection pool for better throughput
                        from backend.app.models.user import engine
                        conn = engine.raw_connection()
                        try:
                            with conn.cursor() as cur:
                                cur.executemany(insert_query, insert_data)
                                conn.commit()
                            logger.info(f"Inserted final {insert_count} vectors into PostgreSQL")
                        finally:
                            conn.close()
                        # Clear memory
                        insert_data.clear()
                        import gc
                        gc.collect()
                    except Exception as e:
                        logger.error(f"Failed to insert final {insert_count} vectors: {e}")
                        raise RuntimeError(f"Failed to insert vectors: {e}")
            except Exception as e:
                logger.error(f"Error iterating through chunk generator: {e}", exc_info=True)
                raise RuntimeError(f"Failed to process chunks: {e}")
            
            # Insert any remaining accumulated embeddings (outside try block in case of early exit)
            if accumulated_embeddings:
                self._check_cancelled()
                insert_count = len(accumulated_embeddings)
                insert_query = f"""
                    INSERT INTO {table_name} (content, metadata, embedding, file_name, source, user_id, created_at)
                    VALUES (%s, %s, %s::vector, %s, %s, %s, CURRENT_TIMESTAMP)
                """
                insert_data = []
                for text, embedding, metadata in zip(accumulated_texts, accumulated_embeddings, accumulated_metadatas):
                    # Ensure user_id is in metadata
                    if 'user_id' not in metadata:
                        metadata['user_id'] = self.user_id
                    # Extract user_id from metadata for the column
                    user_id = metadata.get('user_id', self.user_id)
                    file_name = metadata.get('file_name', '')
                    source = metadata.get('source', '')
                    embedding_str = '[' + ','.join(str(float(x)) for x in embedding) + ']'
                    insert_data.append((
                        text,
                        json.dumps(metadata),
                        embedding_str,
                        file_name,
                        source,
                        user_id
                    ))
                
                try:
                    # OPTIMIZED: Use connection pool
                    from backend.app.models.user import engine
                    conn = engine.raw_connection()
                    try:
                        with conn.cursor() as cur:
                            cur.executemany(insert_query, insert_data)
                            conn.commit()
                        logger.info(f"Inserted final {insert_count} vectors into PostgreSQL")
                    finally:
                        conn.close()
                    # Clear memory
                    insert_data.clear()
                    import gc
                    gc.collect()
                except Exception as e:
                    logger.error(f"Failed to insert final {insert_count} vectors: {e}")
                    raise RuntimeError(f"Failed to insert vectors: {e}")
            
            logger.info(f"PostgreSQL vector indexing complete: {processed_count} chunks indexed")
        except Exception as e:
            logger.error(f"Vector indexing failed: {e}")
            raise
            
            self._update_status("completed", 100, "Analysis Complete.")
            return {"status": "success", "chunks_processed": processed_count if 'processed_count' in locals() else 0}

        except RuntimeError as e:
            if "cancelled" in str(e).lower():
                logger.info("Ingestion cancelled successfully")
                self._update_status("cancelled", self._status.get("progress", 0), "Cancelled by user")
                return {"status": "cancelled", "message": "Ingestion cancelled by user"}
            else:
                logger.error(f"Ingestion Failed: {e}")
                self._update_status("error", 0, f"Error: {str(e)}")
                return {"status": "failed", "error": str(e)}
        except Exception as e:
            logger.error(f"Ingestion Failed: {e}")
            self._update_status("error", 0, f"Error: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True) 
                except:
                    pass