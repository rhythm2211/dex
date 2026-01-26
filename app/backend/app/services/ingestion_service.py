import os
import shutil
import logging
import tempfile
import json
import threading
import re
from datetime import datetime
from collections import Counter
from typing import Dict, Optional
from git import Repo, RemoteProgress
from git.exc import GitCommandError
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
# Explicitly import pgvector before PGVector to ensure it's available
import pgvector  # Required for LangChain's PGVector implementation
from langchain_community.vectorstores import PGVector
from langchain_huggingface import HuggingFaceEmbeddings
import psycopg
from psycopg.conninfo import make_conninfo
from backend.app.core.config import settings
from backend.app.domain.graph_engine import GraphEngine

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
    
    def __init__(self, user_id: str = None, repository_id: str = None):
        # Create language-specific splitters for better chunking
        self.splitters: Dict[str, RecursiveCharacterTextSplitter] = {}
        self._init_language_splitters()
        
        # Store user and repository context for multi-tenant isolation
        self.user_id = user_id
        self.repository_id = repository_id
        
        # Initialize the Neo4j-backed Graph Engine
        self.graph_engine = GraphEngine()
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Paths - user-scoped if user_id provided
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        if user_id:
            # User-specific data directory
            self.data_dir = os.path.join(base_dir, "backend", "data", user_id)
        else:
            # Legacy: shared data directory
            self.data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(self.data_dir, exist_ok=True)
        
        # We still keep history locally for the timeline slider (it's small & sequential)
        # Use repository_id in filename if provided
        if repository_id:
            self.history_path = os.path.join(self.data_dir, f"repo_history_{repository_id}.json")
        else:
            self.history_path = os.path.join(self.data_dir, "repo_history.json") 

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
        logger.info("🛑 Ingestion cancellation requested")
        self._update_status("cancelled", self._status.get("progress", 0), "Cancellation requested...")

    def _check_cancelled(self):
        """Check if cancellation was requested and raise if so."""
        if self._cancelled:
            logger.info("🛑 Ingestion cancelled by user")
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
        Atomic Wipe: Clears Vector DB (PostgreSQL/pgvector) AND Graph DB (Neo4j).
        Now supports user/repository-scoped wiping for multi-tenant isolation.
        """
        # 1. Clear PostgreSQL vector table - filter by user_id and repository_id if provided
        try:
            conninfo = make_conninfo(
                host=settings.POSTGRES_HOST,
                port=settings.POSTGRES_PORT,
                user=settings.POSTGRES_USER,
                password=settings.POSTGRES_PASSWORD,
                dbname=settings.POSTGRES_DB
            )
            with psycopg.connect(conninfo) as conn:
                with conn.cursor() as cur:
                    if self.user_id and self.repository_id:
                        # Delete only vectors for this user/repository
                        cur.execute(
                            f"DELETE FROM {settings.POSTGRES_VECTOR_TABLE} WHERE metadata->>'user_id' = %s AND metadata->>'repository_id' = %s;",
                            (self.user_id, self.repository_id)
                        )
                        logger.info(f"✅ PostgreSQL vector table '{settings.POSTGRES_VECTOR_TABLE}' cleared for user_id={self.user_id}, repository_id={self.repository_id}.")
                    else:
                        # Legacy: clear all (backward compatibility)
                        cur.execute(f"TRUNCATE TABLE {settings.POSTGRES_VECTOR_TABLE};")
                        logger.info(f"✅ PostgreSQL vector table '{settings.POSTGRES_VECTOR_TABLE}' cleared (all data).")
                    conn.commit()
        except Exception as e:
            logger.error(f"PostgreSQL vector table wipe failed: {e}")

        # 2. Clear Neo4j - filter by user_id and repository_id if provided
        try:
            self.graph_engine.wipe_graph(user_id=self.user_id, repository_id=self.repository_id)
            logger.info(f"✅ Neo4j database wiped for user_id={self.user_id}, repository_id={self.repository_id}.")
        except Exception as e:
            logger.error(f"Neo4j wipe failed: {e}")

    def _get_file_blame(self, repo_path: str, relative_file_path: str):
        """
        Runs 'git blame' to map every line number to an author.
        Returns: { 1: "Alice", 2: "Alice", 3: "Bob" }
        Used to determine Function-Level Ownership.
        """
        try:
            repo = Repo(repo_path)
            blame_map = {}
            
            # Use porcelain for easy parsing
            # '--line-porcelain' outputs full commit info for every line
            val = repo.git.blame('--line-porcelain', relative_file_path)
            
            current_author = "Unknown"
            current_line = 0
            
            for line in val.splitlines():
                if line.startswith("author "):
                    current_author = line[7:] # Remove "author "
                elif line.startswith("\t"):
                    # This is the actual code line (starts with tab in porcelain)
                    current_line += 1
                    blame_map[current_line] = current_author
                        
            return blame_map
            
        except Exception as e:
            # If file is new/uncommitted or binary, blame might fail.
            # logger.warning(f"Blame failed for {relative_file_path}: {e}")
            return {}

    def _analyze_git_history(self, repo_path: str):
        """
        Extracts commit history from ALL branches (main + features).
        Calculates 'Bus Factor' risk by tracking author dominance per file.
        """
        timeline = []
        file_stats = {}
        seen_commits = set()  # CRITICAL: Deduplication set
        
        try:
            repo = Repo(repo_path)
            
            # 1. Identify all refs to scan (Local + Remote)
            # We filter for 'origin/' to capture remote branches even if not checked out locally
            all_refs = [r.name for r in repo.references if 'origin/' in r.name or r.name in ['main', 'master', 'HEAD']]
            
            # Dedup ref names and sort so 'main' is processed first (optimization)
            branches = sorted(list(set(all_refs)), key=lambda x: 0 if 'main' in x or 'master' in x else 1)
            
            logger.info(f"📊 Analyzing history across refs: {len(branches)} found")
            logger.info(f"🔄 Starting commit analysis across {len(branches)} branches...")

            total_branches = len(branches)
            for branch_idx, branch in enumerate(branches):
                # Check for cancellation every 10 branches
                if branch_idx % 10 == 0:
                    if self._cancelled:
                        logger.info("🛑 Cancellation detected during git history analysis")
                        raise RuntimeError("Ingestion cancelled by user")
                
                try:
                    # Log branch progress every 10 branches or for important branches
                    if branch_idx % 10 == 0 or 'main' in branch or 'master' in branch:
                        logger.info(f"📂 Processing branch {branch_idx + 1}/{total_branches}: {branch}")
                    
                    commit_count = 0
                    new_commits = 0
                    # Limit per branch to prevent timeouts on massive repos
                    # 100 commits per branch is usually enough to capture active dev
                    for commit in repo.iter_commits(branch, max_count=100):
                        # Check cancellation every 20 commits
                        if commit_count % 20 == 0 and self._cancelled:
                            raise RuntimeError("Ingestion cancelled by user")
                        commit_count += 1
                        
                        if commit.hexsha in seen_commits:
                            continue # Skip if we already processed this via another branch
                        
                        seen_commits.add(commit.hexsha)
                        new_commits += 1
                        
                        # Log progress every 20 commits
                        if commit_count % 20 == 0:
                            logger.info(f"  ⏳ Branch '{branch}': Processed {commit_count} commits ({new_commits} new, {len(seen_commits)} total unique)")
                        
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
                                    "author_counts": Counter(), # Changed from set to Counter
                                    "active_branches": set()
                                }
                            
                            stats = file_stats[file_path]
                            
                            # Only update "last_modified" if this commit is newer
                            if commit_data["date"] > stats.get("last_modified", ""):
                                stats["last_modified"] = commit_data["date"]
                                stats["last_author"] = commit_data["author"]
                            
                            stats["commit_count"] += 1
                            stats["author_counts"][commit_data["author"]] += 1
                            stats["active_branches"].add(branch)
                    
                    if commit_count > 0:
                        logger.info(f"  ✅ Branch '{branch}': {commit_count} commits processed ({new_commits} new)")

                except Exception as e:
                    # Some refs might be HEAD pointers or tags that fail iter_commits
                    logger.warning(f"  ⚠️  Skipping ref {branch}: {e}")
                    continue
            
            logger.info(f"📈 Commit analysis complete: {len(seen_commits)} unique commits, {len(timeline)} timeline entries, {len(file_stats)} files tracked")

            # Sort timeline by date
            logger.info(f"🔄 Sorting timeline by date...")
            timeline.sort(key=lambda x: x['date'], reverse=True)

            # --- POST-PROCESSING: Calculate Bus Factor / Risk Score ---
            logger.info(f"📊 Calculating bus factor risk scores for {len(file_stats)} files...")
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
                
                # Cleanup: Convert sets/counters to JSON-serializable formats
                stats["authors"] = list(stats["author_counts"].keys()) # List of unique names
                del stats["author_counts"] # Remove the counter object
                stats["active_branches"] = list(stats["active_branches"])
            
            logger.info(f"✅ Bus factor calculation complete for {processed_files} files")
                
            return timeline, file_stats

        except Exception as e:
            logger.warning(f"Git History Extraction Failed: {e}")
            return [], {}

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

    def process_repository(self, repo_path: str, user_id: str = None, repository_id: str = None):
        """
        Process a repository for ingestion.
        Now supports user_id and repository_id for multi-tenant isolation.
        """
        # Update user/repository context if provided
        if user_id:
            self.user_id = user_id
        if repository_id:
            self.repository_id = repository_id
        
        # Reset cancellation flag at start
        self._cancelled = False
        self._update_status("running", 0, "Initializing pipeline...")
        
        # Step 0: Clean Slate - wipe only this user's repository data
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
            timeline, file_stats = self._analyze_git_history(actual_path)
            logger.info(f"✅ Git history analysis complete: {len(timeline)} commits, {len(file_stats)} files")
            
            # Save Timeline Locally
            logger.info(f"💾 Saving timeline to {self.history_path}...")
            with open(self.history_path, 'w') as f:
                json.dump(timeline, f)
            logger.info(f"✅ Timeline saved successfully")

            # 3. Load Source Files
            self._check_cancelled()
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
                        logger.info(f"  📄 Found {len(docs)} {ext} files")
                except Exception as e:
                    logger.warning(f"⚠️  Error loading {ext} files: {e}")
                    continue
            
            # Also try to load any text files that might not have extensions
            try:
                loader = DirectoryLoader(actual_path, glob="**/*", loader_cls=TextLoader, silent_errors=True)
                all_docs = loader.load()
                # Filter out files we already loaded and binary files
                existing_paths = {doc.metadata.get('source', '') for doc in raw_docs}
                for doc in all_docs:
                    source_path = doc.metadata.get('source', '')
                    if source_path and source_path not in existing_paths:
                        # Check if it's likely a text file (not binary)
                        try:
                            content = doc.page_content
                            # Skip if content is mostly non-printable characters (likely binary)
                            if content and len([c for c in content[:1000] if c.isprintable() or c in '\n\r\t']) > len(content[:1000]) * 0.8:
                                raw_docs.append(doc)
                                file_counts.setdefault('other', 0)
                                file_counts['other'] += 1
                        except:
                            pass
            except Exception as e:
                logger.warning(f"⚠️  Error loading additional files: {e}")
            
            logger.info(f"✅ Found {len(raw_docs)} total files to process")
            if file_counts:
                logger.info(f"📊 File breakdown: {', '.join([f'{count} {ext}' for ext, count in file_counts.items()])}")

            # --- PHASE 2: STREAM TO CLOUD (NEO4J) - OPTIMIZED WITH BATCHING ---
            total_docs = len(raw_docs)
            logger.info(f"🚀 Starting Neo4j streaming for {total_docs} files (using batch inserts for performance)...")
            
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
                
                # Determine file type
                file_ext = os.path.splitext(relative_path)[1].lower()
                is_code_file = file_ext in ['.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php']
                
                # [NEW] Get Line-Level Blame (Ownership) - only for code files
                blame_map = {}
                if is_code_file:
                    try:
                        blame_map = self._get_file_blame(actual_path, relative_path)
                    except Exception as e:
                        logger.debug(f"  ⚠️  Failed to get git blame for {relative_path}: {e}")
                        blame_map = {}
                
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
                    all_nodes.extend(nodes)
                    all_edges.extend(edges)
                except Exception as e:
                    logger.debug(f"  ⚠️  Failed to extract structure for {relative_path}: {e}")
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
                    logger.info(f"  💾 Batch inserting {len(all_nodes)} nodes and {len(all_edges)} edges to Neo4j...")
                    try:
                        self.graph_engine.batch_upsert_nodes(all_nodes, user_id=self.user_id, repository_id=self.repository_id)
                        self.graph_engine.batch_upsert_edges(all_edges, user_id=self.user_id, repository_id=self.repository_id)
                        logger.info(f"  ✅ Batch insert complete: {len(all_nodes)} nodes, {len(all_edges)} edges")
                    except Exception as e:
                        logger.error(f"  ❌ Batch insert failed: {e}. Falling back to individual inserts...")
                        # Fallback to individual inserts
                        for node in all_nodes:
                            try:
                                self.graph_engine.upsert_node(node, user_id=self.user_id, repository_id=self.repository_id)
                            except:
                                pass
                        for edge in all_edges:
                            try:
                                self.graph_engine.upsert_edge(edge['source'], edge['target'], edge['relation'], user_id=self.user_id, repository_id=self.repository_id)
                            except:
                                pass
                    
                    # Clear batches
                    all_nodes = []
                    all_edges = []
            
            logger.info(f"✅ Neo4j streaming complete: {total_docs} files processed")

            # --- PHASE 3: VECTOR EMBEDDINGS (PostgreSQL/pgvector) ---
            self._check_cancelled()
            self._update_status("running", 80, "Generating semantic vectors...")
            logger.info(f"🔪 Splitting {len(raw_docs)} documents into chunks using language-specific splitters...")
            
            # Use language-specific splitters for better chunking
            vector_chunks = []
            chunk_stats = {}
            
            for doc in raw_docs:
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path) if file_path != 'unknown' else 'unknown'
                
                # Get appropriate splitter for this file
                splitter = self._get_splitter_for_file(relative_path)
                file_ext = os.path.splitext(relative_path)[1].lower()
                
                try:
                    chunks = splitter.split_documents([doc])
                    vector_chunks.extend(chunks)
                    
                    # Track chunking stats
                    if file_ext not in chunk_stats:
                        chunk_stats[file_ext] = 0
                    chunk_stats[file_ext] += len(chunks)
                except Exception as e:
                    logger.warning(f"⚠️  Error splitting {relative_path}: {e}")
                    # Fallback to default splitter
                    try:
                        chunks = self.default_splitter.split_documents([doc])
                        vector_chunks.extend(chunks)
                    except:
                        # If all else fails, add the document as a single chunk
                        vector_chunks.append(doc)
            
            logger.info(f"✅ Created {len(vector_chunks)} vector chunks from {len(raw_docs)} documents")
            if chunk_stats:
                top_extensions = sorted(chunk_stats.items(), key=lambda x: -x[1])[:5]
                logger.info(f"📊 Top chunked file types: {', '.join([f'{count} chunks from {ext}' for ext, count in top_extensions])}")
            
            # Enhance chunks with filenames and user/repository context
            logger.info("📝 Enhancing chunks with metadata...")
            for chunk in vector_chunks:
                full_path = chunk.metadata.get('source', '')
                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"
                # Add user_id and repository_id for multi-tenant isolation
                if self.user_id:
                    chunk.metadata['user_id'] = self.user_id
                if self.repository_id:
                    chunk.metadata['repository_id'] = self.repository_id

            # OPTIMIZED: Pre-generate embeddings in large batches, then bulk insert
            # This is much faster than generating embeddings one-by-one in add_texts
            embedding_batch_size = 500  # Larger batch for embedding generation (CPU-bound)
            db_batch_size = 200  # Smaller batch for DB inserts (I/O-bound)
            total_chunks = len(vector_chunks)
            logger.info(f"💾 Starting optimized PostgreSQL vector indexing: {total_chunks} chunks")
            logger.info(f"   Embedding batch size: {embedding_batch_size}, DB insert batch size: {db_batch_size}")
            
            if vector_chunks:
                # Initialize PGVector store (just to ensure table exists)
                try:
                    self._update_status("running", 80, f"Generating embeddings (0/{total_chunks})...")
                    logger.info(f"🔧 Initializing PGVector store...")
                    # Create a minimal store just to ensure table exists
                    dummy_store = PGVector(
                        connection_string=settings.POSTGRES_CONNECTION_STRING,
                        embedding_function=self.embeddings,
                        collection_name=settings.POSTGRES_VECTOR_TABLE,
                        use_jsonb=True
                    )
                    logger.info(f"✅ PGVector store initialized")
                except Exception as e:
                    logger.error(f"❌ PGVector initialization failed: {e}")
                    raise RuntimeError(f"Failed to initialize vector store: {e}")
                
                # Pre-generate all embeddings in large batches (much faster)
                logger.info(f"🧮 Generating embeddings for {total_chunks} chunks in batches of {embedding_batch_size}...")
                all_texts = [doc.page_content for doc in vector_chunks]
                all_metadatas = [doc.metadata for doc in vector_chunks]
                all_embeddings = []
                
                # Generate embeddings in batches
                for i in range(0, total_chunks, embedding_batch_size):
                    self._check_cancelled()
                    batch_texts = all_texts[i:i + embedding_batch_size]
                    batch_progress = 80 + int((i / total_chunks) * 10) # 80% -> 90%
                    self._update_status("running", batch_progress, f"Generating embeddings ({i}/{total_chunks})...")
                    
                    if (i // embedding_batch_size) % 10 == 0 or i == 0:
                        logger.info(f"  🧮 Generating embeddings: batch {i//embedding_batch_size + 1}, chunks {i} to {min(i+embedding_batch_size, total_chunks)}")
                    
                    # Use the embedding model's embed_documents method (optimized for batch processing)
                    try:
                        batch_embeddings = self.embeddings.embed_documents(batch_texts)
                        all_embeddings.extend(batch_embeddings)
                    except Exception as e:
                        logger.error(f"❌ Embedding generation failed for batch starting at {i}: {e}")
                        raise RuntimeError(f"Failed to generate embeddings: {e}")
                
                logger.info(f"✅ Generated {len(all_embeddings)} embeddings")
                
                # Bulk insert into PostgreSQL using direct SQL (much faster than add_texts)
                logger.info(f"💾 Bulk inserting {total_chunks} vectors into PostgreSQL in batches of {db_batch_size}...")
                conninfo = make_conninfo(
                    host=settings.POSTGRES_HOST,
                    port=settings.POSTGRES_PORT,
                    user=settings.POSTGRES_USER,
                    password=settings.POSTGRES_PASSWORD,
                    dbname=settings.POSTGRES_DB
                )
                
                table_name = settings.POSTGRES_VECTOR_TABLE
                total_db_batches = (total_chunks + db_batch_size - 1) // db_batch_size
                
                with psycopg.connect(conninfo) as conn:
                    with conn.cursor() as cur:
                        for i in range(0, total_chunks, db_batch_size):
                            self._check_cancelled()
                            batch_num = (i // db_batch_size) + 1
                            batch_progress = 90 + int((i / total_chunks) * 5) # 90% -> 95%
                            self._update_status("running", batch_progress, f"Indexing vectors ({i}/{total_chunks})...")
                            
                            batch_texts = all_texts[i:i + db_batch_size]
                            batch_embeddings = all_embeddings[i:i + db_batch_size]
                            batch_metadatas = all_metadatas[i:i + db_batch_size]
                            
                            if batch_num % 10 == 0 or batch_num == 1:
                                logger.info(f"  💾 Inserting batch {batch_num}/{total_db_batches}: chunks {i} to {min(i+db_batch_size, total_chunks)}")
                            
                            try:
                                # Bulk insert using executemany for better performance
                                # Format: pgvector accepts string format '[1,2,3]' or list (if adapter registered)
                                insert_query = f"""
                                    INSERT INTO {table_name} (content, metadata, embedding, file_name, source, created_at)
                                    VALUES (%s, %s, %s::vector, %s, %s, CURRENT_TIMESTAMP)
                                """
                                
                                # Prepare data for bulk insert
                                insert_data = []
                                for text, embedding, metadata in zip(batch_texts, batch_embeddings, batch_metadatas):
                                    file_name = metadata.get('file_name', '')
                                    source = metadata.get('source', '')
                                    # Ensure user_id and repository_id are in metadata
                                    if self.user_id and 'user_id' not in metadata:
                                        metadata['user_id'] = self.user_id
                                    if self.repository_id and 'repository_id' not in metadata:
                                        metadata['repository_id'] = self.repository_id
                                    # Convert embedding list to string format for pgvector
                                    # Format: '[1.0,2.0,3.0]' - pgvector accepts this format
                                    embedding_str = '[' + ','.join(str(float(x)) for x in embedding) + ']'
                                    insert_data.append((
                                        text,
                                        json.dumps(metadata),
                                        embedding_str,
                                        file_name,
                                        source
                                    ))
                                
                                # Bulk insert
                                cur.executemany(insert_query, insert_data)
                                conn.commit()
                                
                            except (ConnectionError, OSError, psycopg.OperationalError) as e:
                                error_msg = str(e)
                                if "Connection reset" in error_msg or "Connection aborted" in error_msg or "connection" in error_msg.lower():
                                    logger.warning(f"⚠️  PostgreSQL connection issue during batch {batch_num}, retrying...")
                                    conn.rollback()
                                    # Retry once
                                    try:
                                        cur.executemany(insert_query, insert_data)
                                        conn.commit()
                                        logger.info(f"  ✅ Batch {batch_num} inserted after retry")
                                    except Exception as retry_e:
                                        logger.error(f"❌ PostgreSQL retry failed for batch {batch_num}: {retry_e}")
                                        raise RuntimeError(f"Failed to index vectors to PostgreSQL after retry. Connection issue: {retry_e}")
                                else:
                                    raise
                            except Exception as e:
                                logger.error(f"❌ PostgreSQL indexing error for batch {batch_num}: {e}")
                                conn.rollback()
                                raise RuntimeError(f"Failed to index vectors to PostgreSQL: {e}")
                
                logger.info(f"✅ PostgreSQL vector indexing complete: {total_chunks} chunks indexed")

            self._update_status("completed", 100, "Analysis Complete.")
            return {"status": "success", "chunks_processed": total_chunks}

        except RuntimeError as e:
            if "cancelled" in str(e).lower():
                logger.info("🛑 Ingestion cancelled successfully")
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