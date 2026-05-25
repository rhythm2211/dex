import os
import shutil
import logging
import sys
import tempfile
import json
import threading
import re
import time
from datetime import datetime, timedelta
from collections import Counter
from typing import Dict, Optional

from git import Repo, RemoteProgress
from git.exc import GitCommandError
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import psycopg
from psycopg.conninfo import make_conninfo
from backend.app.core.config import settings
from backend.app.domain.graph_engine import GraphEngine
from backend.app.domain.contextual_chunker import build_contextual_chunks, build_manifest_chunks
from backend.app.domain.manifest_parser import is_manifest_file
from backend.app.utils.embedding_utils import get_embeddings
from backend.app.utils import ingest_tuning

logger = logging.getLogger("dex-core")

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
        # Last successfully processed repo root (temp clone path during ingest; used for architecture pass)
        self.last_ingested_repo_root: Optional[str] = None
        self.last_repo_full_name: Optional[str] = None

        # Internal status for polling (detail + eta surfaced in UI)
        self._status = {
            "state": "idle",
            "progress": 0,
            "step": "Ready",
            "detail": "",
            "eta_seconds": None,
        }
        
        # Structure extracted during graph phase, reused for contextual embedding chunks
        self._structure_cache: Dict[str, list] = {}
        
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

    def _ingest_verbose(self) -> bool:
        flag = os.getenv("INGEST_VERBOSE", "").lower()
        if flag in ("0", "false", "no"):
            return False
        if flag in ("1", "true", "yes"):
            return True
        return os.getenv("ENVIRONMENT", "development").lower() == "development"

    def _log_ingest(self, message: str, *, level: int = logging.INFO) -> None:
        """Always log ingestion milestones; flush so uvicorn consoles update live."""
        logger.log(level, message)
        if self._ingest_verbose() or level >= logging.WARNING:
            print(f"[ingest] {message}", flush=True)

    def _update_status(
        self,
        state: str,
        progress: int,
        step: str,
        *,
        detail: str = "",
        eta_seconds: Optional[int] = None,
    ):
        self._status = {
            "state": state,
            "progress": progress,
            "step": step,
            "detail": detail or "",
            "eta_seconds": eta_seconds,
        }
        self._sync_global_status()
        eta_part = f" | ETA ~{max(0, int(eta_seconds))}s" if eta_seconds is not None else ""
        detail_part = f" — {detail}" if detail else ""
        self._log_ingest(f"[{progress}%] {step}{detail_part}{eta_part}")

    def _sync_global_status(self) -> None:
        """Mirror status to router cache so /ingest/status stays fast during heavy ingest."""
        try:
            from backend.app.api.v1.router import _ingestion_statuses

            _ingestion_statuses[self.user_id] = dict(self._status)
        except Exception:
            pass

    def _select_git_branches(self, repo: "Repo") -> list:
        """
        Pick a small set of refs for history analysis.
        Scanning every origin/* branch on large repos can hang for 10+ minutes.
        """
        max_branches = ingest_tuning.ingest_max_git_branches()
        scan_all = os.getenv("INGEST_ALL_BRANCHES", "").lower() in ("1", "true", "yes")
        ref_names = {r.name for r in repo.references}

        priority: list = []
        try:
            if not repo.head.is_detached:
                priority.append(repo.active_branch.name)
        except Exception:
            pass

        for candidate in (
            "main",
            "master",
            "develop",
            "origin/main",
            "origin/master",
            "origin/develop",
            "HEAD",
        ):
            if candidate in ref_names and candidate not in priority:
                priority.append(candidate)

        if scan_all:
            remotes = sorted(
                r for r in ref_names if r.startswith("origin/") and r not in ("origin/HEAD",)
            )
            for r in remotes:
                if r not in priority:
                    priority.append(r)
                if len(priority) >= max_branches:
                    break
        else:
            self._log_ingest(
                f"Git history: using {len(priority)} priority branch(es) "
                f"(set INGEST_ALL_BRANCHES=true to scan more, max {max_branches})",
                level=logging.DEBUG,
            )

        if not priority:
            priority = ["HEAD"]
        return priority[:max_branches]
    
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
            # Neon: ensure pooler endpoint options are present.
            # This variable is kept for historical reasons; the actual queries use SQLAlchemy engine.
            conninfo = settings.POSTGRES_CONNECTION_STRING
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

    def _resolve_vector_batch_sizes(self) -> tuple[int, int]:
        from backend.app.utils.embedding_utils import default_ingest_embedding_batch_size

        embed_bs = default_ingest_embedding_batch_size()
        db_default = "400" if ingest_tuning.ingest_fast_mode() else "200"
        db_bs = max(50, int(os.getenv("INGEST_VECTOR_DB_BATCH_SIZE", os.getenv("OPTIMIZED_DB_BATCH_SIZE", db_default))))
        return embed_bs, db_bs

    def _prepare_embedding_batch(self, chunks) -> tuple[list, list]:
        texts = []
        metadatas = []
        for doc in chunks:
            texts.append(doc.page_content)
            metadata = doc.metadata.copy()
            metadata["user_id"] = self.user_id
            metadatas.append(metadata)
        return texts, metadatas

    def _bulk_insert_vector_batch(self, texts, embeddings, metadatas, conn=None) -> int:
        from backend.app.models.user import engine
        from backend.app.utils.vector_bulk_insert import bulk_insert_document_vectors

        _, db_bs = self._resolve_vector_batch_sizes()
        return bulk_insert_document_vectors(
            engine,
            table_name=settings.POSTGRES_VECTOR_TABLE,
            texts=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            user_id=self.user_id,
            page_size=min(500, db_bs),
            conn=conn,
        )

    def _ingest_verbose_logging(self) -> bool:
        return os.getenv("INGEST_VERBOSE", "").lower() in ("1", "true", "yes")

    def _resolve_embed_parallel(self) -> int:
        try:
            default = "4" if ingest_tuning.ingest_fast_mode() else "2"
            n = int(os.getenv("INGEST_EMBED_PARALLEL", default))
        except ValueError:
            n = 4 if ingest_tuning.ingest_fast_mode() else 2
        cap = 6 if settings.EMBEDDING_PROVIDER.lower() == "voyage" else 3
        return max(1, min(cap, n))

    def _verify_pgvector_table_dimension(self) -> None:
        conninfo_check = settings.POSTGRES_CONNECTION_STRING
        expected_dim = getattr(settings, "EMBEDDING_DIMENSION", 1024)
        with psycopg.connect(conninfo_check) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = %s
                    );
                    """,
                    (settings.POSTGRES_VECTOR_TABLE,),
                )
                table_exists = cur.fetchone()[0]
                if not table_exists:
                    return
                cur.execute(
                    """
                    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as type
                    FROM pg_attribute a
                    JOIN pg_class c ON a.attrelid = c.oid
                    WHERE c.relname = %s AND a.attname = 'embedding';
                    """,
                    (settings.POSTGRES_VECTOR_TABLE,),
                )
                type_result = cur.fetchone()
                if not type_result:
                    return
                match = re.search(r"vector\((\d+)\)", type_result[0])
                if not match:
                    return
                table_dim = int(match.group(1))
                if table_dim != expected_dim:
                    raise RuntimeError(
                        f"Dimension mismatch: table {settings.POSTGRES_VECTOR_TABLE} has {table_dim} dims, "
                        f"expected {expected_dim} ({settings.EMBEDDING_MODEL_NAME}). "
                        f"Run: python migrate_embeddings_standalone.py"
                    )
                logger.info(f"Verified table dimension: {table_dim}")

    def _embed_and_insert_batch(
        self, chunks, batch_num: int, processed_count: int, conn=None
    ) -> int:
        self._check_cancelled()
        batch_texts, batch_metadatas = self._prepare_embedding_batch(chunks)
        n = len(batch_texts)
        if batch_num % 5 == 0 or batch_num == 1:
            self._update_status(
                "running",
                80 + min(15, int((processed_count / max(processed_count + n, 1)) * 15)),
                f"Indexing vectors ({processed_count + n} chunks)...",
            )
        verbose = self._ingest_verbose_logging()
        if verbose or batch_num % 5 == 0 or batch_num == 1:
            logger.info(
                f"Embedding batch {batch_num}: {n} chunks (total indexed so far: {processed_count})"
            )
        try:
            batch_embeddings = self.embeddings.embed_documents(batch_texts)
        except Exception as e:
            logger.error(f"Embedding generation failed for batch {batch_num}: {e}")
            raise RuntimeError(f"Failed to generate embeddings: {e}") from e
        inserted = self._bulk_insert_vector_batch(
            batch_texts, batch_embeddings, batch_metadatas, conn=conn
        )
        if verbose or batch_num % 5 == 0:
            logger.info(f"Inserted {inserted} vectors (batch {batch_num})")
        return processed_count + inserted

    def _run_vector_indexing(self, chunk_gen) -> int:
        """Stream chunks -> embed in large batches -> fast pgvector bulk insert."""
        from collections import deque
        from concurrent.futures import ThreadPoolExecutor
        from backend.app.core.config import settings as app_settings
        from backend.app.models.user import engine
        from backend.app.utils.vector_index_utils import (
            create_embedding_hnsw_index,
            defer_vector_index_enabled,
            drop_embedding_hnsw_index,
        )

        embed_bs, db_bs = self._resolve_vector_batch_sizes()
        pipeline = os.getenv("INGEST_VECTOR_PIPELINE", "true").lower() not in ("0", "false", "no")
        api_providers = {"voyage", "cohere", "openai", "hf_inference"}
        provider = app_settings.EMBEDDING_PROVIDER.lower()
        use_pipeline = pipeline and provider in api_providers
        embed_parallel = self._resolve_embed_parallel() if use_pipeline else 1
        defer_index = defer_vector_index_enabled()
        table_name = settings.POSTGRES_VECTOR_TABLE

        self._update_status("running", 80, "Generating semantic vectors...")
        logger.info(
            f"Vector indexing: embed_batch={embed_bs}, db_page={db_bs}, pipeline={use_pipeline}, "
            f"embed_parallel={embed_parallel}, defer_index={defer_index}, provider={provider}"
        )

        self._verify_pgvector_table_dimension()

        processed_count = 0
        batch_num = 0
        current_batch = []
        executor = (
            ThreadPoolExecutor(max_workers=embed_parallel, thread_name_prefix="dex-embed")
            if use_pipeline
            else None
        )
        pending = deque()

        db_conn = engine.raw_connection()
        index_dropped = False
        try:
            if defer_index:
                drop_embedding_hnsw_index(db_conn, table_name)
                index_dropped = True

            def flush_oldest():
                nonlocal processed_count
                if not pending:
                    return
                future, batch_texts, batch_metadatas, num = pending[0]
                try:
                    batch_embeddings = future.result()
                except Exception as e:
                    logger.error(f"Embedding generation failed for batch {num}: {e}")
                    raise RuntimeError(f"Failed to generate embeddings: {e}") from e
                pending.popleft()
                inserted = self._bulk_insert_vector_batch(
                    batch_texts, batch_embeddings, batch_metadatas, conn=db_conn
                )
                processed_count += inserted
                verbose = self._ingest_verbose_logging()
                if verbose or num % 5 == 0:
                    logger.info(f"Inserted {inserted} vectors (pipelined batch {num})")

            def flush_all_pending():
                while pending:
                    flush_oldest()

            for chunk in chunk_gen:
                current_batch.append(chunk)
                if len(current_batch) < embed_bs:
                    continue
                batch_num += 1
                self._check_cancelled()
                if executor:
                    batch_texts, batch_metadatas = self._prepare_embedding_batch(current_batch)
                    if batch_num % 5 == 0 or batch_num == 1:
                        self._update_status(
                            "running",
                            80
                            + min(
                                15,
                                int(
                                    (processed_count / max(processed_count + len(current_batch), 1))
                                    * 15
                                ),
                            ),
                            f"Embedding batch {batch_num} ({len(current_batch)} chunks)...",
                        )
                    pending.append(
                        (
                            executor.submit(self.embeddings.embed_documents, batch_texts),
                            batch_texts,
                            batch_metadatas,
                            batch_num,
                        )
                    )
                    while len(pending) >= embed_parallel:
                        flush_oldest()
                else:
                    processed_count = self._embed_and_insert_batch(
                        current_batch, batch_num, processed_count, conn=db_conn
                    )
                current_batch = []

            if current_batch:
                batch_num += 1
                if executor:
                    batch_texts, batch_metadatas = self._prepare_embedding_batch(current_batch)
                    pending.append(
                        (
                            executor.submit(self.embeddings.embed_documents, batch_texts),
                            batch_texts,
                            batch_metadatas,
                            batch_num,
                        )
                    )
                    flush_all_pending()
                else:
                    processed_count = self._embed_and_insert_batch(
                        current_batch, batch_num, processed_count, conn=db_conn
                    )
            elif executor:
                flush_all_pending()

            if index_dropped:
                self._update_status("running", 95, "Building vector search index...")
                create_embedding_hnsw_index(db_conn, table_name)

            logger.info(f"PostgreSQL vector indexing complete: {processed_count} chunks indexed")
            return processed_count
        except Exception as e:
            if index_dropped:
                logger.warning(f"Vector ingest failed after index drop; rebuilding index: {e}")
                try:
                    create_embedding_hnsw_index(db_conn, table_name)
                except Exception as rebuild_err:
                    logger.error(f"Failed to rebuild HNSW index: {rebuild_err}")
            raise
        finally:
            if executor:
                executor.shutdown(wait=True, cancel_futures=False)
            db_conn.close()

    def _get_file_blame(self, repo_path: str, relative_file_path: str, repo=None):
        """
        Runs 'git blame' to map every line number to an author and email.
        Returns: { 1: {"author": "Alice", "email": "alice@example.com"}, ... }
        Used to determine Function-Level Ownership with email.
        """
        try:
            repo = repo or Repo(repo_path)
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
        
        # Split dir on both / and \ so Windows paths work correctly
        _dir_parts = set(re.split(r'[/\\]', dir_path))
        # Common test file patterns
        test_patterns = [
            # Python
            filename.startswith('test_') or filename.endswith('_test.py'),
            # JavaScript/TypeScript — .endswith('.test.') never matches 'foo.test.ts'; use 'in'
            '.test.' in filename or '.spec.' in filename or
            '__tests__' in dir_path or '__test__' in dir_path,
            # Java
            'test.java' in filename or 'tests.java' in filename,
            # Go
            filename.endswith('_test.go'),
            # Rust
            filename.endswith('_test.rs'),
            # General — match 'test' or 'tests' as a full directory component
            'test' in _dir_parts or 'tests' in _dir_parts,
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
        
        if is_manifest_file(file_path):
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
        Extracts commit history from priority branches (main/master + optional cap).
        Calculates 'Bus Factor' risk by tracking author dominance per file.
        """
        timeline = []
        file_stats = {}
        seen_commits = set()  # CRITICAL: Deduplication set

        # Rolling window cutoff for volatility (last 6 months)
        six_months_ago = datetime.now() - timedelta(days=180)
        phase_start = time.time()
        max_commits_per_branch = ingest_tuning.ingest_git_commits_per_branch()
        
        try:
            self._log_ingest(f"Opening git repo at {repo_path}...")
            t0 = time.time()
            repo = Repo(repo_path)
            self._log_ingest(f"Git repo opened in {time.time() - t0:.1f}s")

            branches = self._select_git_branches(repo)
            total_branches = len(branches)
            self._log_ingest(
                f"Git history: analyzing {total_branches} branch(es): {', '.join(branches[:5])}"
                + ("..." if total_branches > 5 else "")
            )

            for branch_idx, branch in enumerate(branches):
                # Check for cancellation every branch
                if self._cancelled:
                    logger.info("Cancellation detected during git history analysis")
                    raise RuntimeError("Ingestion cancelled by user")
                
                try:
                    elapsed = time.time() - phase_start
                    avg_per = elapsed / max(branch_idx, 1)
                    eta = int(avg_per * max(total_branches - branch_idx, 0))
                    pct = 30 + int(8 * branch_idx / max(total_branches, 1))
                    self._update_status(
                        "running",
                        pct,
                        "Analyzing Git Timeline & Bus Factor...",
                        detail=f"branch {branch_idx + 1}/{total_branches}: {branch}",
                        eta_seconds=eta,
                    )
                    self._log_ingest(f"Git branch {branch_idx + 1}/{total_branches}: {branch}")

                    commit_count = 0
                    new_commits = 0
                    branch_start_time = time.time()
                    for commit in repo.iter_commits(branch, max_count=max_commits_per_branch):
                        if commit_count % 10 == 0:
                            if self._cancelled:
                                raise RuntimeError("Ingestion cancelled by user")
                            if commit_count > 0 and self._ingest_verbose():
                                self._log_ingest(
                                    f"  {branch}: {commit_count} commits scanned",
                                    level=logging.DEBUG,
                                )
                        commit_count += 1
                        
                        if commit.hexsha in seen_commits:
                            continue # Skip if we already processed this via another branch
                        
                        seen_commits.add(commit.hexsha)
                        new_commits += 1
                        
                        if commit_count % 20 == 0:
                            self._log_ingest(
                                f"  {branch}: {commit_count} commits ({new_commits} new, {len(seen_commits)} unique)"
                            )

                        branch_timeout = int(os.getenv("INGEST_GIT_BRANCH_TIMEOUT_SEC", "90"))
                        if time.time() - branch_start_time > branch_timeout:
                            self._log_ingest(
                                f"Branch '{branch}' exceeded {branch_timeout}s — skipping rest",
                                level=logging.WARNING,
                            )
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
                        self._log_ingest(
                            f"Branch '{branch}' done: {commit_count} commits ({new_commits} new) in {time.time() - branch_start_time:.1f}s"
                        )

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
            
            self._log_ingest(
                f"Commit scan done in {time.time() - phase_start:.1f}s: "
                f"{len(seen_commits)} unique commits, {len(file_stats)} files"
            )

            self._update_status(
                "running",
                36,
                "Analyzing Git Timeline & Bus Factor...",
                detail="sorting timeline",
                eta_seconds=max(5, int((time.time() - phase_start) * 0.1)),
            )
            timeline.sort(key=lambda x: x['date'], reverse=True)

            processed_files = 0
            total_files = len(file_stats)
            bus_start = time.time()
            self._log_ingest(f"Bus factor pass over {total_files} files...")
            for f_path, stats in file_stats.items():
                processed_files += 1

                if processed_files % 100 == 0 or processed_files == total_files:
                    bus_elapsed = time.time() - bus_start
                    rate = processed_files / max(bus_elapsed, 0.01)
                    remaining = int((total_files - processed_files) / max(rate, 1))
                    self._update_status(
                        "running",
                        36 + int(4 * processed_files / max(total_files, 1)),
                        "Analyzing Git Timeline & Bus Factor...",
                        detail=f"bus factor {processed_files}/{total_files} files",
                        eta_seconds=remaining,
                    )
                    if self._ingest_verbose():
                        self._log_ingest(f"  bus factor {processed_files}/{total_files}")
                
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
            
            self._log_ingest(
                f"Bus factor complete for {processed_files} files in {time.time() - bus_start:.1f}s"
            )

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

    def _github_slug_from_url(self, repo_path: str) -> Optional[str]:
        """Return owner/repo for GitHub HTTPS or SSH URLs."""
        u = (repo_path or "").strip()
        m = re.match(r"https?://(?:www\.)?github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", u)
        if m:
            return f"{m.group(1)}/{m.group(2)}"
        m2 = re.match(r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", u)
        if m2:
            return f"{m2.group(1)}/{m2.group(2)}"
        return None

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
        self._structure_cache = {}
        self._update_status("running", 0, "Initializing pipeline...")
        if ingest_tuning.ingest_fast_mode():
            logger.info(
                "INGEST_FAST_MODE enabled: shallow clone, skip git blame, "
                "reduced git history, larger embed batches, skip SCIP/architecture"
            )
        
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
                clone_label = "Cloning repository..." if ingest_tuning.ingest_shallow_clone() else "Cloning with full history..."
                self._update_status("running", 15, clone_label)
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
                        heartbeat_stop = threading.Event()

                        def clone_heartbeat():
                            while not heartbeat_stop.wait(5):
                                clone_result["last_progress"] = datetime.now()

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
                            # Windows: enable long path support to avoid [Errno 22] on deep repo trees
                            subprocess.run(
                                ["git", "config", "--global", "core.longpaths", "true"],
                                capture_output=True, timeout=5
                            )
                            
                            logger.info(f"Starting git clone for: {repo_path}")
                            # Initialize progress timestamp
                            clone_result["last_progress"] = datetime.now()

                            clone_env = {
                                **os.environ,
                                "GIT_TERMINAL_PROMPT": "0",  # Disable prompts
                                "GIT_ASKPASS": "echo",  # Disable credential prompts
                            }
                            # GitPython RemoteProgress uses stderr IPC that raises
                            # OSError [Errno 22] on Windows during clone_from.
                            use_progress = sys.platform != "win32"
                            if not use_progress:
                                logger.info(
                                    "Skipping git clone progress callback on Windows "
                                    "(GitPython RemoteProgress can raise Errno 22)"
                                )
                                heartbeat = threading.Thread(
                                    target=clone_heartbeat, daemon=True
                                )
                                heartbeat.start()

                            clone_kwargs = {"env": clone_env}
                            if ingest_tuning.ingest_shallow_clone():
                                clone_kwargs["depth"] = 1
                                logger.info("Using shallow clone (depth=1) for faster ingest")
                            try:
                                if use_progress:
                                    Repo.clone_from(
                                        repo_path,
                                        temp_dir,
                                        progress=progress_callback,
                                        **clone_kwargs,
                                    )
                                else:
                                    Repo.clone_from(
                                        repo_path,
                                        temp_dir,
                                        **clone_kwargs,
                                    )
                            finally:
                                heartbeat_stop.set()

                            clone_result["success"] = True
                            logger.info(f"Git clone completed successfully for: {repo_path}")
                        except Exception as e:
                            clone_result["error"] = e
                            logger.error(f"Git clone error in worker thread: {e}", exc_info=True)
                        finally:
                            heartbeat_stop.set()
                    
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
                    slug = self._github_slug_from_url(repo_path)
                    if slug:
                        self.last_repo_full_name = slug
                        self.graph_engine.repo_full_name = slug
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
                                f"Please verify the repository URL and ensure the backend has access to it."
                            )
                        elif "authentication" in error_msg.lower() or "permission denied" in error_msg.lower():
                            logger.error(f"Authentication failed: {e}")
                            raise RuntimeError(
                                f"Authentication failed for repository: '{repo_path}'\n"
                                f"This repository may be private. Please ensure:\n"
                                f"- You have configured SSH keys or credentials for the repository, or\n"
                                f"- The token/user account has permission to read the repository"
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
            self._update_status(
                "running",
                30,
                "Analyzing Git Timeline & Bus Factor...",
                detail="starting",
            )
            self._log_ingest("Starting git history analysis...")
            try:
                timeline, file_stats = self._analyze_git_history(actual_path)
                self._log_ingest(
                    f"Git history complete: {len(timeline)} commits, {len(file_stats)} files"
                )
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
            
            # Single-pass file scan — replaces N separate DirectoryLoader passes (one per extension).
            # Also correctly handles extensionless files (Dockerfile, Makefile) and skips
            # generated/dependency directories that would otherwise flood the corpus.
            _SUPPORTED_EXTS = {
                # Python
                '.py', '.pyw', '.pyi', '.pyx',
                # JavaScript/TypeScript
                '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
                # Java/Kotlin/Scala
                '.java', '.kt', '.kts', '.scala',
                # C/C++/C#
                '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx', '.hh', '.cs', '.csx',
                # Other languages
                '.go', '.rs', '.rb', '.rake', '.rbw',
                '.php', '.phtml', '.swift', '.m', '.mm',
                '.r', '.lua', '.pl', '.pm', '.t',
                '.sh', '.bash', '.zsh', '.fish', '.ksh', '.ps1', '.psm1', '.psd1',
                '.dart', '.elm', '.ex', '.exs', '.clj', '.cljs', '.hs', '.ml', '.mli',
                '.vim', '.lisp', '.cl', '.scm', '.rkt', '.jl', '.nim', '.cr', '.d',
                '.pas', '.p', '.pp', '.vb', '.vbs', '.v', '.sv', '.svh',
                # Web
                '.html', '.htm', '.xhtml', '.css', '.scss', '.sass', '.less', '.styl',
                '.xml', '.xsl', '.xslt', '.vue', '.svelte',
                # Data/Config
                '.json', '.json5', '.jsonc', '.yaml', '.yml', '.toml',
                '.ini', '.cfg', '.conf', '.mk', '.cmake', '.gradle',
                '.tf', '.hcl', '.tfvars', '.sql', '.graphql', '.gql', '.proto',
                # Docs
                '.md', '.markdown', '.mdown', '.mkdn', '.rst', '.txt', '.text',
                '.adoc', '.asciidoc', '.csv', '.tsv',
                # Dotfile-style configs
                '.env', '.lock',
            }
            # Extensionless files that are important infrastructure/config files
            _SPECIAL_FILENAMES = {
                'Dockerfile', 'Makefile', 'makefile', 'GNUmakefile',
                'Jenkinsfile', 'Vagrantfile', 'Procfile',
                '.gitignore', '.gitattributes', '.dockerignore', '.editorconfig',
                'requirements.txt', 'requirements-dev.txt', 'requirements-test.txt',
                'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
                'Cargo.toml', 'Cargo.lock', 'pyproject.toml', 'setup.py', 'setup.cfg',
                'go.mod', 'go.sum', 'Gemfile', 'Gemfile.lock', 'composer.json',
                'pubspec.yaml', 'build.gradle', 'pom.xml', 'build.sbt',
                'schema.prisma', '.env.example', 'tsconfig.json',
            }
            # Directories to skip — avoids scanning thousands of generated/vendor files
            _IGNORED_DIRS = {
                '.git', 'node_modules', '__pycache__', '.next', 'dist', 'build',
                'target', '.gradle', '.idea', '.vscode', '.pytest_cache', '.mypy_cache',
                'vendor', 'venv', '.venv', 'site-packages', 'coverage', '.tox',
                '.terraform', 'bower_components', 'jspm_packages', '.cache',
                'out', '.output', '.nuxt', '.svelte-kit',
            }

            raw_docs = []
            file_counts: Dict[str, int] = {}
            _seen_scan_paths: set = set()

            for _walk_root, _walk_dirs, _walk_files in os.walk(actual_path):
                # Prune ignored dirs in-place so os.walk doesn't descend into them
                _walk_dirs[:] = [
                    d for d in _walk_dirs
                    if d not in _IGNORED_DIRS
                    and not (d.startswith('.') and d not in {'.github', '.circleci', '.gitlab'})
                ]
                for _fname in _walk_files:
                    _fext = os.path.splitext(_fname)[1].lower()
                    if _fext not in _SUPPORTED_EXTS and _fname not in _SPECIAL_FILENAMES:
                        continue
                    _fpath = os.path.join(_walk_root, _fname)
                    if _fpath in _seen_scan_paths:
                        continue
                    _seen_scan_paths.add(_fpath)
                    try:
                        try:
                            _fdocs = TextLoader(_fpath, encoding="utf-8").load()
                        except Exception:
                            try:
                                _fdocs = TextLoader(_fpath, encoding="latin-1").load()
                            except Exception:
                                # chardet optional; only used when utf-8/latin-1 fail
                                _fdocs = TextLoader(_fpath, autodetect_encoding=True).load()
                        if _fdocs:
                            raw_docs.extend(_fdocs)
                            _key = _fext if _fext else _fname
                            file_counts[_key] = file_counts.get(_key, 0) + len(_fdocs)
                    except OSError as _fe:
                        logger.warning(f"OS error loading {_fpath} (skipping): {_fe}")
                    except Exception as _fe:
                        logger.debug(f"Could not load {_fpath}: {_fe}")

            logger.info(f"Found {len(raw_docs)} total files to process")
            if file_counts:
                _top_exts = sorted(file_counts.items(), key=lambda x: -x[1])[:10]
                logger.info(f"File breakdown: {', '.join(f'{cnt} {ext}' for ext, cnt in _top_exts)}")

            # --- PHASE 2: STREAM TO CLOUD (NEO4J) - OPTIMIZED WITH BATCHING ---
            self.last_ingested_repo_root = actual_path
            total_docs = len(raw_docs)
            logger.info(f"Starting Neo4j streaming for {total_docs} files (using batch inserts for performance)...")

            # Open repo once for blame operations — avoids re-constructing Repo() for each file
            _blame_repo = None
            try:
                _blame_repo = Repo(actual_path)
            except Exception as _bre:
                logger.debug(f"Could not open repo for blame operations: {_bre}")
            
            # Collect all nodes and edges for batch insertion
            all_nodes = []
            all_edges = []
            batch_size = ingest_tuning.ingest_neo4j_file_batch_size()  # files per Neo4j flush
            
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
                
                # Derive churn_score from pre-computed git history (avoids per-file git log calls)
                churn_score = 0.0
                _fs = file_stats.get(relative_path, {})
                if _fs:
                    _total_c = _fs.get("commit_count", 0)
                    _recent_c = _fs.get("six_month_commit_count", 0)
                    if _total_c >= 50:
                        churn_score = round(min(1.0, 0.7 + (_recent_c / 20.0) * 0.3), 3)
                    elif _total_c > 0:
                        churn_score = round(min(1.0, (_recent_c / 20.0) * 0.7 + (_total_c / 50.0) * 0.3), 3)
                git_meta["churn_score"] = churn_score
                
                # [NEW] Get Line-Level Blame (Ownership) - only for code files
                blame_map = {}
                owner_email = "unknown@unknown.com"
                owner_confidence = 0.0
                if is_code_file and not ingest_tuning.ingest_skip_git_blame():
                    try:
                        blame_map = self._get_file_blame(actual_path, relative_path, repo=_blame_repo)
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
                    self._structure_cache[relative_path] = nodes
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

            try:
                if self.last_repo_full_name:
                    self.graph_engine.propagate_repo_slug_to_files(self.last_repo_full_name)
            except Exception as e:
                logger.debug(f"repo slug propagation skipped: {e}")

            try:
                from backend.app.domain.cross_repo_resolver import attach_openapi_service_nodes

                if self.last_repo_full_name:
                    attach_openapi_service_nodes(self.user_id, self.graph_engine, actual_path, self.last_repo_full_name)
            except Exception as e:
                logger.debug(f"OpenAPI attach skipped: {e}")

            try:
                if not ingest_tuning.ingest_skip_architecture():
                    from backend.app.domain.architecture_engine import (
                        apply_architecture_layers_after_ingestion,
                        record_architecture_snapshot,
                    )

                    arch_stats = apply_architecture_layers_after_ingestion(
                        self.graph_engine, actual_path, self.user_id
                    )
                    record_architecture_snapshot(self.user_id, int(arch_stats.get("violations_tagged", 0)))
                    logger.info(f"Architecture pass: {arch_stats}")
                else:
                    logger.info("Architecture pass skipped (INGEST_FAST_MODE / INGEST_SKIP_ARCHITECTURE)")
            except Exception as e:
                logger.warning(f"Architecture layer pass skipped: {e}")

            try:
                from backend.app.domain.cross_repo_resolver import link_workspace_repos_neo4j

                link_workspace_repos_neo4j(self.user_id, self.graph_engine)
            except Exception as e:
                logger.debug(f"cross-repo resolver skipped: {e}")

            try:
                if not ingest_tuning.ingest_skip_scip():
                    from backend.app.domain.scip_indexer import index_repo_with_scip
                    scip_summary = index_repo_with_scip(actual_path, self.user_id, self.graph_engine)
                    logger.info(f"SCIP indexing: {scip_summary}")
                else:
                    logger.info("SCIP indexing skipped (INGEST_FAST_MODE / INGEST_SKIP_SCIP)")
            except Exception as e:
                logger.debug(f"SCIP indexing skipped: {e}")

            try:
                from backend.app.utils.fts_migration import ensure_content_tsv_index
                from backend.app.models.user import engine as pg_engine
                conn = pg_engine.raw_connection()
                try:
                    ensure_content_tsv_index(conn, settings.POSTGRES_VECTOR_TABLE)
                finally:
                    conn.close()
            except Exception as e:
                logger.debug(f"FTS migration during ingest skipped: {e}")

            # --- PHASE 3: VECTOR EMBEDDINGS (PostgreSQL/pgvector) ---
            self._check_cancelled()
            self._update_status("running", 80, "Generating semantic vectors...")
            logger.info(f"🔪 Splitting {len(raw_docs)} documents into contextual + language-aware chunks...")
            
            class _EmbeddingChunk:
                __slots__ = ("page_content", "metadata")
                def __init__(self, page_content, metadata):
                    self.page_content = page_content
                    self.metadata = metadata

            # [MEMORY LEAK FIX] Generator-based streaming instead of accumulating all chunks in memory
            def chunk_generator():
                """Generator that yields chunks one at a time to prevent OOM on large repos."""
                chunk_stats_by_ext = {}
                contextual_count = 0
                fallback_count = 0
                total_chunks = 0
                doc_count = 0
                
                logger.info(f"Starting chunk generation for {len(raw_docs)} documents...")
                for doc in raw_docs:
                    doc_count += 1
                    if doc_count % 10 == 0:
                        logger.debug(f"Processing document {doc_count}/{len(raw_docs)} for chunking...")
                    file_path = doc.metadata.get('source', 'unknown')
                    relative_path = os.path.relpath(file_path, actual_path) if file_path != 'unknown' else 'unknown'
                    file_ext = os.path.splitext(relative_path)[1].lower()

                    structure_nodes = self._structure_cache.get(relative_path, [])
                    if is_manifest_file(relative_path):
                        contextual = build_manifest_chunks(relative_path, doc.page_content)
                    elif file_ext in (".md", ".markdown", ".mdown", ".rst"):
                        from backend.app.domain.doc_chunker import chunk_markdown
                        contextual = chunk_markdown(
                            doc.page_content,
                            relative_path,
                            max_chars=ingest_tuning.ingest_doc_max_chars(),
                        )
                    else:
                        contextual = build_contextual_chunks(relative_path, doc.page_content, structure_nodes)

                    if contextual:
                        contextual_count += 1
                        chunk_stats_by_ext[file_ext] = chunk_stats_by_ext.get(file_ext, 0) + len(contextual)
                        for item in contextual:
                            meta = dict(item["metadata"])
                            meta.setdefault("source", file_path)
                            total_chunks += 1
                            yield _EmbeddingChunk(item["page_content"], meta)
                        continue

                    # Fallback: character-based splitter for files without structure
                    splitter = self._get_splitter_for_file(relative_path)
                    try:
                        chunks = splitter.split_documents([doc])
                        chunk_stats_by_ext[file_ext] = chunk_stats_by_ext.get(file_ext, 0) + len(chunks)
                        fallback_count += 1
                        for chunk in chunks:
                            full_path = chunk.metadata.get('source', '')
                            chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                            chunk.metadata['chunking'] = 'character'
                            chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"
                            total_chunks += 1
                            yield chunk
                    except Exception as e:
                        logger.warning(f"Error splitting {relative_path}: {e}")
                        try:
                            chunks = self.default_splitter.split_documents([doc])
                            fallback_count += 1
                            for chunk in chunks:
                                full_path = chunk.metadata.get('source', '')
                                chunk.metadata['file_name'] = os.path.relpath(full_path, actual_path)
                                chunk.metadata['chunking'] = 'character'
                                chunk.page_content = f"File: {chunk.metadata['file_name']}\n{chunk.page_content}"
                                total_chunks += 1
                                yield chunk
                        except Exception:
                            full_path = doc.metadata.get('source', '')
                            doc.metadata['file_name'] = os.path.relpath(full_path, actual_path) if full_path != 'unknown' else 'unknown'
                            doc.metadata['chunking'] = 'character'
                            doc.page_content = f"File: {doc.metadata['file_name']}\n{doc.page_content}"
                            fallback_count += 1
                            total_chunks += 1
                            yield doc
                
                logger.info(
                    f"Created {total_chunks} vector chunks ({contextual_count} contextual files, "
                    f"{fallback_count} character-split files)"
                )
                if chunk_stats_by_ext:
                    top_extensions = sorted(chunk_stats_by_ext.items(), key=lambda x: -x[1])[:5]
                    logger.info(
                        f"Top chunked file types: {', '.join([f'{count} chunks from {ext}' for ext, count in top_extensions])}"
                    )
            
            # Use generator instead of accumulating in memory
            logger.info("Creating chunk generator...")
            chunk_gen = chunk_generator()
            logger.info("Chunk generator created, starting to process chunks...")

            processed_count = self._run_vector_indexing(chunk_gen)

            self._update_status("completed", 100, "Analysis Complete.")
            return {"status": "success", "chunks_processed": processed_count}

        except RuntimeError as e:
            if "cancelled" in str(e).lower():
                logger.info("Ingestion cancelled successfully")
                self._update_status("cancelled", self._status.get("progress", 0), "Cancelled by user")
                return {"status": "cancelled", "message": "Ingestion cancelled by user"}
            else:
                logger.error(f"Ingestion Failed: {e}")
                self._update_status("error", 0, f"Error: {str(e)}")
                return {"status": "failed", "error": str(e)}
        except OSError as e:
            import errno as _errno_mod
            if e.errno == 22:
                msg = (
                    f"Windows path error (Errno 22): {e}. "
                    "This usually means a file in the repo has a Windows-reserved name "
                    "(CON, NUL, AUX, COM1…) or a path exceeding 260 characters. "
                    "Try enabling long paths: git config --global core.longpaths true"
                )
                logger.error(msg)
                self._update_status("error", 0, msg[:300])
                return {"status": "failed", "error": msg}
            logger.error(f"Ingestion Failed (OS error {e.errno}): {e}")
            self._update_status("error", 0, f"OS Error: {str(e)}")
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