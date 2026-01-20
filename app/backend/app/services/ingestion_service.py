import os
import shutil
import logging
import tempfile
import json
import threading
import re
from datetime import datetime
from collections import Counter
from git import Repo, RemoteProgress
from git.exc import GitCommandError
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter, Language
# Explicitly import pgvector before PGVector to ensure it's available
import pgvector  # Required for LangChain's PGVector implementation
from langchain_community.vectorstores import PGVector
from langchain_huggingface import HuggingFaceEmbeddings
import psycopg
from psycopg.conninfo import make_conninfo
from backend.app.core.config import settings
from backend.app.domain.graph_engine import GraphEngine

# Setup Logging
logger = logging.getLogger("dex-core")

class IngestionService:
    def __init__(self):
        self.splitter = RecursiveCharacterTextSplitter.from_language(
            language=Language.PYTHON, 
            chunk_size=1000, 
            chunk_overlap=100
        )
        # Initialize the Neo4j-backed Graph Engine
        self.graph_engine = GraphEngine()
        self.embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Paths
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        self.data_dir = os.path.join(base_dir, "backend", "data")
        os.makedirs(self.data_dir, exist_ok=True)
        
        # We still keep history locally for the timeline slider (it's small & sequential)
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
        """Progress callback for git clone operations"""
        def __init__(self, status_callback):
            super().__init__()
            self.status_callback = status_callback
            self.last_update = 0
            
        def update(self, op_code, cur_count, max_count=None, message=''):
            # Update every 5% or when max_count changes
            if max_count and max_count > 0:
                progress_pct = int((cur_count / max_count) * 10)  # 0-10% of total 15% progress
                if progress_pct != self.last_update:
                    self.status_callback("running", 15 + progress_pct, 
                                       f"Cloning... ({cur_count}/{max_count} objects)" if max_count else "Cloning...")
                    self.last_update = progress_pct

    def _wipe_knowledge_base(self):
        """
        Atomic Wipe: Clears Vector DB (PostgreSQL/pgvector) AND Graph DB (Neo4j).
        """
        # 1. Clear PostgreSQL vector table
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
                    cur.execute(f"TRUNCATE TABLE {settings.POSTGRES_VECTOR_TABLE};")
                    conn.commit()
            logger.info(f"✅ PostgreSQL vector table '{settings.POSTGRES_VECTOR_TABLE}' cleared.")
        except Exception as e:
            logger.error(f"PostgreSQL vector table wipe failed: {e}")

        # 2. Clear Neo4j
        try:
            self.graph_engine.wipe_graph()
            logger.info("✅ Neo4j database wiped.")
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
                
                # Create progress callback
                progress_callback = self._CloneProgress(self._update_status)
                
                # Clone with progress reporting and timeout handling
                try:
                    # Use threading to implement timeout
                    clone_result = {"success": False, "error": None}
                    
                    def clone_worker():
                        try:
                            Repo.clone_from(repo_path, temp_dir, progress=progress_callback)
                            clone_result["success"] = True
                        except Exception as e:
                            clone_result["error"] = e
                    
                    clone_thread = threading.Thread(target=clone_worker, daemon=True)
                    clone_thread.start()
                    clone_thread.join(timeout=600)  # 10 minute timeout
                    
                    if clone_thread.is_alive():
                        # Thread is still running, timeout occurred
                        raise TimeoutError(f"Git clone timed out after 10 minutes. The repository may be too large or network is slow.")
                    
                    if not clone_result["success"]:
                        if clone_result["error"]:
                            raise clone_result["error"]
                        else:
                            raise RuntimeError("Git clone failed for unknown reason")
                    
                    actual_path = temp_dir
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
                    raise
                except (ConnectionError, OSError) as e:
                    error_msg = str(e)
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
            logger.info("📁 Scanning repository for Python files...")
            loader = DirectoryLoader(actual_path, glob="**/*.py", loader_cls=TextLoader)
            try:
                raw_docs = loader.load()
                logger.info(f"✅ Found {len(raw_docs)} Python files to process")
            except Exception as e:
                logger.warning(f"⚠️  Error loading some files: {e}")
                raw_docs = []
                logger.info(f"📁 Loaded {len(raw_docs)} files (some may have been skipped)")

            # --- PHASE 2: STREAM TO CLOUD (NEO4J) ---
            total_docs = len(raw_docs)
            logger.info(f"🚀 Starting Neo4j streaming for {total_docs} files...")
            
            for i, doc in enumerate(raw_docs):
                # Check for cancellation periodically
                if i % 5 == 0:
                    self._check_cancelled()
                
                # Update progress bar and log every 5 files or every 10%
                if i % 5 == 0:
                    progress = 40 + int((i / total_docs) * 35) # 40% -> 75%
                    self._update_status("running", progress, f"Streaming Nodes to Cloud ({i}/{total_docs})...")
                    if i % 10 == 0 or i == 0:
                        logger.info(f"📤 Streaming to Neo4j: {i}/{total_docs} files ({int((i/total_docs)*100)}%)")
                
                file_path = doc.metadata.get('source', 'unknown')
                relative_path = os.path.relpath(file_path, actual_path)
                
                # Get extracted Git Metadata (Now includes bus_risk_score)
                git_meta = file_stats.get(relative_path, {})
                
                # [NEW] Get Line-Level Blame (Ownership)
                # We calculate this ON THE FLY for the current file
                if i % 20 == 0:
                    logger.info(f"  🔍 Getting git blame for: {relative_path}")
                blame_map = self._get_file_blame(actual_path, relative_path)
                
                # PUSH TO NEO4J (Streaming)
                # Pass the blame_map so GraphEngine can assign function owners
                if i % 20 == 0:
                    logger.info(f"  📊 Extracting AST and pushing to Neo4j: {relative_path}")
                self.graph_engine.extract_and_build(
                    file_content=doc.page_content, 
                    file_path=relative_path, 
                    repo_root=actual_path,
                    git_metadata=git_meta,
                    blame_map=blame_map
                )
            
            logger.info(f"✅ Neo4j streaming complete: {total_docs} files processed")

            # --- PHASE 3: VECTOR EMBEDDINGS (PostgreSQL/pgvector) ---
            self._check_cancelled()
            self._update_status("running", 80, "Generating semantic vectors...")
            logger.info(f"🔪 Splitting {len(raw_docs)} documents into chunks...")
            vector_chunks = self.splitter.split_documents(raw_docs)
            logger.info(f"✅ Created {len(vector_chunks)} vector chunks from {len(raw_docs)} documents")
            
            # Enhance chunks with filenames
            logger.info("📝 Enhancing chunks with metadata...")
            for chunk in vector_chunks:
                full_path = chunk.metadata.get('source', '')
                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"

            # Initialize PGVector store for batch insertion
            # We'll use from_documents for the first batch, then add_texts for subsequent batches
            batch_size = 100
            total_chunks = len(vector_chunks)
            logger.info(f"💾 Starting PostgreSQL vector indexing: {total_chunks} chunks in batches of {batch_size}")
            
            # Process first batch to initialize the store
            if vector_chunks:
                first_batch = vector_chunks[:batch_size]
                try:
                    self._update_status("running", 80, f"Indexing vectors (0/{total_chunks})...")
                    logger.info(f"🔧 Initializing PGVector store with first batch ({len(first_batch)} chunks)...")
                    vector_store = PGVector.from_documents(
                        documents=first_batch,
                        embedding=self.embeddings,
                        connection_string=settings.POSTGRES_CONNECTION_STRING,
                        collection_name=settings.POSTGRES_VECTOR_TABLE,
                        use_jsonb=True
                    )
                    logger.info(f"✅ PGVector store initialized with first batch")
                except Exception as e:
                    logger.error(f"❌ PGVector initialization failed: {e}")
                    raise RuntimeError(f"Failed to initialize vector store: {e}")
                
                # Process remaining batches
                total_batches = (total_chunks + batch_size - 1) // batch_size
                logger.info(f"📦 Processing {total_batches - 1} remaining batches...")
                for i in range(batch_size, total_chunks, batch_size):
                    self._check_cancelled()
                    batch_num = (i // batch_size) + 1
                    batch_progress = 80 + int((i / total_chunks) * 15) # 80% -> 95%
                    self._update_status("running", batch_progress, f"Indexing vectors ({i}/{total_chunks})...")
                    
                    batch = vector_chunks[i:i + batch_size]
                    logger.info(f"  📤 Indexing batch {batch_num}/{total_batches}: chunks {i} to {min(i+batch_size, total_chunks)}")
                    try:
                        # Extract texts and metadatas for add_texts
                        texts = [doc.page_content for doc in batch]
                        metadatas = [doc.metadata for doc in batch]
                        
                        vector_store.add_texts(
                            texts=texts,
                            metadatas=metadatas
                        )
                        logger.info(f"  ✅ Batch {batch_num} indexed successfully")
                    except (ConnectionError, OSError, psycopg.OperationalError) as e:
                        error_msg = str(e)
                        if "Connection reset" in error_msg or "Connection aborted" in error_msg or "connection" in error_msg.lower():
                            logger.warning(f"⚠️  PostgreSQL connection issue during batch {batch_num}, retrying...")
                            # Retry once
                            try:
                                vector_store.add_texts(
                                    texts=texts,
                                    metadatas=metadatas
                                )
                                logger.info(f"  ✅ Batch {batch_num} indexed after retry")
                            except Exception as retry_e:
                                logger.error(f"❌ PostgreSQL retry failed for batch {batch_num}: {retry_e}")
                                raise RuntimeError(f"Failed to index vectors to PostgreSQL after retry. Connection issue: {retry_e}")
                        else:
                            raise
                    except Exception as e:
                        logger.error(f"❌ PostgreSQL indexing error for batch {batch_num}: {e}")
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