import os
import ast
import logging
import time
import re
import json
from collections import Counter
from typing import Dict, List, Tuple, Optional

# Try to import toml for pyproject.toml parsing
try:
    import toml
    TOML_AVAILABLE = True
except ImportError:
    TOML_AVAILABLE = False

logger = logging.getLogger("dex-core")
if not TOML_AVAILABLE:
    logger.debug("toml not available, pyproject.toml parsing will be skipped")

import networkx as nx
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError

from backend.app.utils.connection_utils import (
    create_neo4j_driver,
    verify_neo4j_connection,
    retry_on_connection_error,
)

logger = logging.getLogger("dex-core")

# Try to import tree-sitter for multi-language parsing
try:
    from tree_sitter import Language as TreeSitterLanguage, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False
    logger.debug("tree-sitter not available, using Python AST and regex fallbacks")


class PathResolver:
    """
    SOTA Resolution: Understands tsconfig paths, webpack aliases, and python roots.
    Handles monorepos, TypeScript aliases, Python PYTHONPATH, and Go modules.
    """
    def __init__(self, repo_root):
        self.repo_root = repo_root
        self.alias_map = {}
        self.python_paths = []
        self._load_configs()

    def _load_configs(self):
        """Load configuration files to understand path mappings."""
        # 1. Load TypeScript Aliases (Crucial for JS/TS Monorepos)
        tsconfig_path = os.path.join(self.repo_root, "tsconfig.json")
        if os.path.exists(tsconfig_path):
            try:
                with open(tsconfig_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    paths = data.get("compilerOptions", {}).get("paths", {})
                    for alias, target_list in paths.items():
                        if target_list and len(target_list) > 0:
                            clean_alias = alias.replace("/*", "").replace("*", "")
                            # Take first target, remove wildcard
                            target = target_list[0].replace("/*", "").replace("*", "")
                            self.alias_map[clean_alias] = target
                            logger.debug(f"Loaded TS alias: {clean_alias} -> {target}")
            except Exception as e:
                logger.debug(f"Failed to load tsconfig.json: {e}")

        # 2. Load package.json for webpack aliases or module resolution
        package_json_path = os.path.join(self.repo_root, "package.json")
        if os.path.exists(package_json_path):
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Check for webpack aliases in various places
                    if "webpack" in data.get("dependencies", {}) or "webpack" in data.get("devDependencies", {}):
                        # Could check webpack.config.js, but for now we'll rely on tsconfig
                        pass
            except Exception as e:
                logger.debug(f"Failed to load package.json: {e}")

        # 3. Load pyproject.toml for Python path configuration
        if TOML_AVAILABLE:
            pyproject_path = os.path.join(self.repo_root, "pyproject.toml")
            if os.path.exists(pyproject_path):
                try:
                    with open(pyproject_path, 'r', encoding='utf-8') as f:
                        data = toml.load(f)
                        # Check for tool-specific path configurations
                        # Some projects use [tool.setuptools] or [build-system]
                        if "tool" in data and "setuptools" in data["tool"]:
                            packages = data["tool"]["setuptools"].get("packages", [])
                            if packages:
                                self.python_paths.extend(packages)
                except Exception as e:
                    logger.debug(f"Failed to load pyproject.toml: {e}")

        # 4. Load go.mod for Go module paths
        go_mod_path = os.path.join(self.repo_root, "go.mod")
        if os.path.exists(go_mod_path):
            try:
                with open(go_mod_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith("module "):
                            module_name = line.split("module ", 1)[1].strip()
                            self.alias_map[module_name] = "."
                            logger.debug(f"Loaded Go module: {module_name}")
                            break
            except Exception as e:
                logger.debug(f"Failed to load go.mod: {e}")

    def resolve(self, import_str: str, current_file_path: str) -> Optional[str]:
        """
        Resolve import string to actual file path.
        
        Args:
            import_str: The import string (e.g., "@utils/logger", "my.module")
            current_file_path: Path to the current file making the import
            
        Returns:
            Resolved file path or None if cannot resolve
        """
        # 1. Check Aliases (@utils/logger -> src/shared/utils/logger)
        for alias, target in self.alias_map.items():
            if import_str.startswith(alias):
                resolved = import_str.replace(alias, target, 1)
                # Handle relative paths
                if resolved.startswith("./") or resolved.startswith("../"):
                    base_dir = os.path.dirname(current_file_path)
                    resolved_path = os.path.normpath(os.path.join(base_dir, resolved))
                else:
                    resolved_path = os.path.join(self.repo_root, resolved)
                
                # Try common extensions
                for ext in ['.ts', '.tsx', '.js', '.jsx', '.py', '.go']:
                    if os.path.exists(resolved_path + ext):
                        return resolved_path + ext
                    if os.path.exists(resolved_path):
                        return resolved_path
                return resolved_path
        
        # 2. Standard Relative Resolution
        if import_str.startswith('.'):
            base_dir = os.path.dirname(current_file_path)
            resolved = os.path.normpath(os.path.join(base_dir, import_str))
            # Try with extensions
            for ext in ['.ts', '.tsx', '.js', '.jsx', '.py', '.go']:
                if os.path.exists(resolved + ext):
                    return resolved + ext
            if os.path.exists(resolved):
                return resolved
            return resolved
        
        # 3. Absolute module resolution (Python, Node.js, etc.)
        # Convert dots to path separators
        path = import_str.replace(".", os.sep)
        # Try with extensions
        for ext in ['.py', '.ts', '.tsx', '.js', '.jsx', '.go']:
            full_path = os.path.join(self.repo_root, path + ext)
            if os.path.exists(full_path):
                return full_path
        
        # 4. Try as directory with index file
        dir_path = os.path.join(self.repo_root, path)
        if os.path.isdir(dir_path):
            for index_file in ['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py']:
                index_path = os.path.join(dir_path, index_file)
                if os.path.exists(index_path):
                    return index_path
        
        return None

class CodeStructureVisitor(ast.NodeVisitor):
    """
    Traverses AST to extract Structure AND Line Location.
    """
    def __init__(self, filename, base_path, path_resolver=None):
        self.filename = filename
        self.base_path = base_path
        self.nodes = []
        self.edges = []
        self.scope_stack = [filename]
        self.path_resolver = path_resolver  # PathResolver instance

    def _resolve_import_path(self, module_name, level=0):
        try:
            if level > 0:
                # Relative import - use path resolver if available
                if self.path_resolver:
                    relative_path = "." * level + module_name if module_name else "." * level
                    return self.path_resolver.resolve(relative_path, self.filename)
                return None
            
            # Use PathResolver if available for better resolution
            if self.path_resolver:
                resolved = self.path_resolver.resolve(module_name, self.filename)
                if resolved:
                    return resolved
            
            # Fallback to simple resolution
            path = module_name.replace(".", os.sep) + ".py"
            if os.sep == "\\":
                path = path.replace("/", "\\")
            return path
        except Exception:
            return None

    def _scan_for_sensitivity(self, node, full_name):
        """
        Detects if this code handles Money, Passwords, or PII.
        Returns list of sensitivity tags if found.
        """
        sensitive_patterns = {
            "PII": r"(ssn|social_security|passport|dob|date_of_birth|personal_data|user_data|customer_data)",
            "AUTH": r"(password|secret|token|api_key|jwt|auth_token|access_token|refresh_token|credential)",
            "FINANCE": r"(credit_card|amount|balance|currency|payment|transaction|price|cost|revenue)"
        }
        
        # Check function/class name and arguments
        content_to_check = getattr(node, "name", "")
        if hasattr(node, "args") and hasattr(node.args, "args"):
            content_to_check += " " + " ".join([a.arg for a in node.args.args])
        
        # Also check decorators and docstrings
        if hasattr(node, "decorator_list"):
            for decorator in node.decorator_list:
                if isinstance(decorator, ast.Name):
                    content_to_check += " " + decorator.id
                elif isinstance(decorator, ast.Attribute):
                    content_to_check += " " + ".".join(self._get_attr_name(decorator))
        
        sensitivity_tags = []
        for category, pattern in sensitive_patterns.items():
            if re.search(pattern, content_to_check, re.IGNORECASE):
                sensitivity_tags.append(category)
        
        return sensitivity_tags

    def _get_attr_name(self, node):
        """Helper to get full attribute name from AST node."""
        if isinstance(node, ast.Name):
            return [node.id]
        elif isinstance(node, ast.Attribute):
            return self._get_attr_name(node.value) + [node.attr]
        return []

    def visit_ClassDef(self, node):
        full_name = f"{self.filename}::{node.name}"
        # [NEW] Capture Line Numbers for Blame Analysis
        node_data = {
            "id": full_name, 
            "type": "class", 
            "name": node.name,
            "start_line": node.lineno,
            "end_line": getattr(node, 'end_lineno', node.lineno)
        }
        
        # [NEW] Scan for sensitive data
        sensitivity_tags = self._scan_for_sensitivity(node, full_name)
        if sensitivity_tags:
            node_data["sensitivity"] = sensitivity_tags
            node_data["risk_multiplier"] = 3.0  # Hard multiplier for sensitive code
        
        self.nodes.append(node_data)
        self.edges.append({"source": self.scope_stack[-1], "target": full_name, "relation": "DEFINES"})
        self.scope_stack.append(full_name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_FunctionDef(self, node):
        full_name = f"{self.scope_stack[-1]}::{node.name}"
        # [NEW] Capture Line Numbers
        node_data = {
            "id": full_name, 
            "type": "function", 
            "name": node.name,
            "start_line": node.lineno,
            "end_line": getattr(node, 'end_lineno', node.lineno)
        }
        
        # [NEW] Scan for sensitive data
        sensitivity_tags = self._scan_for_sensitivity(node, full_name)
        if sensitivity_tags:
            node_data["sensitivity"] = sensitivity_tags
            node_data["risk_multiplier"] = 3.0  # Hard multiplier for sensitive code
        
        # [NEW] Detect API routes (common patterns)
        func_name_lower = node.name.lower()
        if any(keyword in func_name_lower for keyword in ["route", "endpoint", "api", "handler", "controller"]):
            node_data["api_route"] = True
        
        self.nodes.append(node_data)
        self.edges.append({"source": self.scope_stack[-1], "target": full_name, "relation": "CONTAINS"})
        self.generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            target_file = self._resolve_import_path(alias.name)
            if target_file:
                # Regular imports are definite dependencies
                self.edges.append(
                    {
                        "source": self.filename,
                        "target": target_file,
                        "relation": "IMPORTS",
                    }
                )

    def visit_ImportFrom(self, node):
        if not node.module:
            return

        target_file = self._resolve_import_path(node.module, node.level)
        if not target_file:
            return

        # Detect wildcard "from X import *" as ambiguous dependency
        has_wildcard = any(alias.name == "*" for alias in node.names)
        relation = "MAYBE_IMPORTS" if has_wildcard else "IMPORTS"

        self.edges.append(
            {
                "source": self.filename,
                "target": target_file,
                "relation": relation,
            }
        )
    
    def visit_Call(self, node):
        """Detect dynamic imports: importlib.import_module(), __import__(), require(variable)"""
        # Check for importlib.import_module() or importlib.__import__()
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name) and node.func.value.id == "importlib":
                if node.func.attr in ["import_module", "__import__"]:
                    # This is a dynamic import - create MAYBE_DEPENDS edge
                    if node.args and isinstance(node.args[0], ast.Str):
                        target_module = node.args[0].s
                        target_file = self._resolve_import_path(target_module)
                        if target_file:
                            self.edges.append({
                                "source": self.filename,
                                "target": target_file,
                                "relation": "MAYBE_DEPENDS"
                            })
        
        # Check for __import__() builtin
        if isinstance(node.func, ast.Name) and node.func.id == "__import__":
            if node.args and isinstance(node.args[0], ast.Str):
                target_module = node.args[0].s
                target_file = self._resolve_import_path(target_module)
                if target_file:
                    self.edges.append({
                        "source": self.filename,
                        "target": target_file,
                        "relation": "MAYBE_DEPENDS"
                    })
        
        self.generic_visit(node)

    def process(self, source_code):
        """Process source code - currently only supports Python AST parsing."""
        try:
            tree = ast.parse(source_code)
            self.visit(tree)
        except SyntaxError:
            pass
        except Exception as e:
            logger.debug(f"AST parsing failed: {e}")
        return self.nodes, self.edges

class GraphEngine:
    def __init__(self, repo_root=None, user_id: str = None):
        """
        Initialize GraphEngine with user isolation support.
        
        Args:
            repo_root: Root directory of the repository
            user_id: User ID for data isolation (required for multi-user support)
        """
        if not user_id:
            raise ValueError("user_id is required for user isolation. All graph operations must be scoped to a user.")
        
        self.user_id = user_id
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        self.database = os.getenv("NEO4J_DATABASE", "neo4j")
        self.repo_root = repo_root or ""
        
        # Initialize PathResolver if repo_root is provided
        self.path_resolver = PathResolver(self.repo_root) if self.repo_root else None
        
        if uri and user and password:
            # Use connection utility with proper configuration
            self.driver = create_neo4j_driver(uri, user, password, database=self.database)
            if self.driver:
                self._create_indices()
            else:
                logger.error("Neo4j driver creation failed.")
        else:
            logger.error("Neo4j Credentials missing.")
            self.driver = None

    def close(self):
        if self.driver: self.driver.close()

    def _create_indices(self):
        if not self.driver: return
        try:
            # Create unique constraint on (user_id, id) combination for isolation
            self._safe_session_run(
                "CREATE CONSTRAINT node_id_unique IF NOT EXISTS FOR (n:CodeNode) REQUIRE (n.user_id, n.id) IS UNIQUE"
            )
            # Create index on user_id for faster filtering
            self._safe_session_run(
                "CREATE INDEX user_id_index IF NOT EXISTS FOR (n:CodeNode) ON (n.user_id)"
            )
        except Exception as e:
            logger.warning(f"Neo4j index skipped: {e}")
    
    @retry_on_connection_error(max_retries=3, delay=1.0)
    def _safe_session_run(self, query: str, **params):
        """Execute a Neo4j query with retry logic."""
        if not self.driver:
            raise RuntimeError("Neo4j driver not initialized")
        
        # Verify connection before use
        if not verify_neo4j_connection(self.driver, database=self.database):
            logger.warning("Neo4j connection lost, attempting to reconnect...")
            # Driver will attempt to reconnect automatically on next query
        
        with self.driver.session(database=self.database) as session:
            return session.run(query, **params)
    
    def batch_upsert_nodes(self, nodes: list, batch_size: int = 100):
        """
        Batch insert nodes into Neo4j for better performance.
        Uses UNWIND to insert multiple nodes in a single transaction.
        """
        if not self.driver or not nodes:
            return
        
        # Process in batches to avoid query size limits
        for i in range(0, len(nodes), batch_size):
            batch = nodes[i:i + batch_size]
            
            query = """
            UNWIND $nodes AS node
            MERGE (n:CodeNode {user_id: $user_id, id: node.id})
            SET n.name = node.name,
                n.type = node.type,
                n.val = node.val,
                n.last_author = node.last_author,
                n.last_modified = node.last_modified,
                n.commit_count = node.commit_count,
                n.bus_risk_score = node.bus_risk_score,
                n.top_owner = node.top_owner,
                n.collaborators = node.collaborators,
                n.volatility_score = node.volatility_score,
                n.churn_score = node.churn_score,
                n.owner_email = node.owner_email,
                n.owner_confidence = node.owner_confidence,
                n.untested_critical = node.untested_critical,
                n.sensitivity = node.sensitivity,
                n.risk_multiplier = node.risk_multiplier,
                n.api_route = node.api_route,
                n.infrastructure = node.infrastructure
            """
            
            params = {
                "user_id": self.user_id,
                "nodes": [
                    {
                        "id": node.get("id"),
                        "name": node.get("name", ""),
                        "type": node.get("type", "file"),
                        "val": node.get("val", 5),
                        "last_author": node.get("last_author", "Unknown"),
                        "last_modified": node.get("last_modified", ""),
                        "commit_count": node.get("commit_count", 0),
                        "bus_risk_score": node.get("bus_risk_score", 0.0),
                        "top_owner": node.get("top_owner", "None"),
                        "collaborators": node.get("collaborators", []),
                        "volatility_score": node.get("volatility_score", 0.0),
                        "churn_score": node.get("churn_score", 0.0),
                        "owner_email": node.get("owner_email", "unknown@unknown.com"),
                        "owner_confidence": node.get("owner_confidence", 0.0),
                        "untested_critical": node.get("untested_critical", False),
                        "sensitivity": node.get("sensitivity", []),
                        "risk_multiplier": node.get("risk_multiplier", 1.0),
                        "api_route": node.get("api_route", False),
                        "infrastructure": node.get("infrastructure", False),
                    }
                    for node in batch
                ]
            }
            
            try:
                self._safe_session_run(query, **params)
            except Exception as e:
                logger.error(f"Failed to batch upsert {len(batch)} nodes: {e}")
                # Fallback to individual inserts for this batch
                for node in batch:
                    try:
                        self.upsert_node(node)
                    except:
                        pass
    
    def batch_upsert_edges(self, edges: list, batch_size: int = 200):
        """
        Batch insert edges into Neo4j for better performance.
        Uses UNWIND to insert multiple edges in a single transaction.
        """
        if not self.driver or not edges:
            return
        
        # Process in batches to avoid query size limits
        for i in range(0, len(edges), batch_size):
            batch = edges[i:i + batch_size]
            
            # Group edges by relationship type for efficiency
            edges_by_type = {}
            for edge in batch:
                raw_rel = edge.get("relation", "DEPENDS_ON")
                if raw_rel == "IMPORTS":
                    rel_type = "DEPENDS_ON"
                elif raw_rel == "MAYBE_IMPORTS":
                    rel_type = "MAYBE_CALLS"
                elif raw_rel == "COVERS":
                    rel_type = "COVERS"  # Test coverage relationship
                else:
                    rel_type = raw_rel
                if rel_type not in edges_by_type:
                    edges_by_type[rel_type] = []
                edges_by_type[rel_type].append(edge)
            
            # Insert each relationship type in a separate query
            for rel_type, type_edges in edges_by_type.items():
                query = f"""
                UNWIND $edges AS edge
                MATCH (a:CodeNode {{user_id: $user_id, id: edge.source}})
                MATCH (b:CodeNode {{user_id: $user_id, id: edge.target}})
                MERGE (a)-[:{rel_type}]->(b)
                """
                
                params = {
                    "user_id": self.user_id,
                    "edges": [
                        {"source": edge.get("source"), "target": edge.get("target")}
                        for edge in type_edges
                    ]
                }
                
                try:
                    self._safe_session_run(query, **params)
                except Exception as e:
                    logger.error(f"Failed to batch upsert {len(type_edges)} {rel_type} edges: {e}")
                    # Fallback to individual inserts for this batch
                    for edge in type_edges:
                        try:
                            self.upsert_edge(edge.get("source"), edge.get("target"), edge.get("relation"))
                        except:
                            pass
    
    def mark_untested_critical(self):
        """
        [LAYER 1] Mark files as untested_critical if they have no incoming COVERS edges.
        These are source files that have no test coverage.
        """
        if not self.driver:
            return
        
        try:
            query = """
            // Find all source files (not test files) that have no incoming COVERS edges
            MATCH (n:CodeNode)
            WHERE n.user_id = $user_id
            AND n.type = 'file' 
            AND NOT (n.is_test_file = true)
            AND NOT EXISTS {
                MATCH (test:CodeNode {user_id: $user_id})-[:COVERS]->(n)
            }
            SET n.untested_critical = true
            RETURN count(n) as untested_count
            """
            
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query)
                    # Fetch all records before session closes to avoid ResultConsumedError
                    return list(result)
            
            records = _execute_query()
            for record in records:
                untested_count = record.get("untested_count", 0)
                logger.info(f"Marked {untested_count} files as untested_critical")
        except Exception as e:
            logger.error(f"Failed to mark untested critical files: {e}")

    def wipe_graph(self):
        """Wipe all graph data for the current user"""
        if not self.driver: return
        try:
            self._safe_session_run(
                "MATCH (n:CodeNode {user_id: $user_id}) DETACH DELETE n",
                user_id=self.user_id
            )
        except Exception as e:
            logger.error(f"Failed to wipe graph for user {self.user_id}: {e}")
            raise

    def upsert_node(self, node_data: dict):
        if not self.driver: return
        
        # [NEW] Added 'owner' and 'collaborators' properties
        # [ISOLATION] Added user_id for multi-user isolation
        query = """
            MERGE (n:CodeNode {user_id: $user_id, id: $id})
            SET n.name = $name,
                n.type = $type,
                n.val = $val,
                n.last_author = $last_author,
                n.last_modified = $last_modified,
                n.commit_count = $commit_count,
                n.bus_risk_score = $bus_risk_score,
                n.top_owner = $top_owner,
                n.collaborators = $collaborators,
                n.volatility_score = $volatility_score,
                n.churn_score = $churn_score,
                n.owner_email = $owner_email,
                n.owner_confidence = $owner_confidence,
                n.untested_critical = $untested_critical,
                n.sensitivity = $sensitivity,
                n.risk_multiplier = $risk_multiplier,
                n.api_route = $api_route,
                n.infrastructure = $infrastructure
            """
        
        params = {
                "user_id": self.user_id,
                "id": node_data.get("id"),
                "name": node_data.get("name", ""),
                "type": node_data.get("type", "file"),
                "val": node_data.get("val", 5),
                "last_author": node_data.get("last_author", "Unknown"),
                "last_modified": node_data.get("last_modified", ""),
                "commit_count": node_data.get("commit_count", 0),
                "bus_risk_score": node_data.get("bus_risk_score", 0.0),
                "top_owner": node_data.get("top_owner", "None"),
                "collaborators": node_data.get("collaborators", []), # List of strings
                "volatility_score": node_data.get("volatility_score", 0.0),
                "churn_score": node_data.get("churn_score", 0.0),
                "owner_email": node_data.get("owner_email", "unknown@unknown.com"),
                "owner_confidence": node_data.get("owner_confidence", 0.0),
                "untested_critical": node_data.get("untested_critical", False),
                "sensitivity": node_data.get("sensitivity", []),
                "risk_multiplier": node_data.get("risk_multiplier", 1.0),
                "api_route": node_data.get("api_route", False),
                "infrastructure": node_data.get("infrastructure", False),
            }
        
        try:
            self._safe_session_run(query, **params)
        except Exception as e:
            logger.error(f"Failed to upsert node {node_data.get('id')}: {e}")
            raise

    def upsert_edge(self, source: str, target: str, relation: str):
        if not self.driver: return
        if relation == "IMPORTS":
            rel_type = "DEPENDS_ON"
        elif relation == "MAYBE_IMPORTS":
            rel_type = "MAYBE_CALLS"
        elif relation == "COVERS":
            rel_type = "COVERS"  # Test coverage relationship
        else:
            rel_type = relation
        
        # Normalize paths to handle both forward and backslash formats
        # Try to find the target node with different path formats - filtered by user_id
        query = f"""
        MATCH (a:CodeNode {{user_id: $user_id}})
        WHERE a.id = $source OR a.id = $source_normalized
        WITH a
        MATCH (b:CodeNode {{user_id: $user_id}})
        WHERE b.id = $target OR b.id = $target_normalized OR b.id = $target_alt
        MERGE (a)-[:{rel_type}]->(b)
        """
        try:
            # Normalize target path formats
            target_normalized = target.replace("\\", "/")
            target_alt = target.replace("/", "\\")
            source_normalized = source.replace("\\", "/")
            
            self._safe_session_run(
                query, 
                user_id=self.user_id,
                source=source, 
                target=target,
                source_normalized=source_normalized,
                target_normalized=target_normalized,
                target_alt=target_alt
            )
        except Exception as e:
            logger.warning(f"Failed to upsert edge {source} -> {target}: {e}. Trying alternative formats...")
            # Fallback: try with exact match first, then normalized
            try:
                query_simple = f"""
                MATCH (a:CodeNode {{user_id: $user_id, id: $source}})
                MATCH (b:CodeNode {{user_id: $user_id}})
                WHERE b.id = $target OR b.id = $target_normalized OR b.id = $target_alt
                MERGE (a)-[:{rel_type}]->(b)
                """
                self._safe_session_run(
                    query_simple,
                    user_id=self.user_id,
                    source=source,
                    target=target,
                    target_normalized=target.replace("\\", "/"),
                    target_alt=target.replace("/", "\\")
                )
            except Exception as e2:
                logger.error(f"Failed to upsert edge {source} -> {target} even with fallback: {e2}")
                # Don't raise - just log and continue (some imports might not have corresponding files)

    def upsert_expert_relationships(self, expert_map: Dict[str, list]):
        """
        Creates (:Person)-[:EXPERT_ON {weight}]->(:CodeNode) relationships based on git history.
        expert_map: { author_name: [ { "file_id": str, "weight": int }, ... ] }
        """
        if not self.driver or not expert_map:
            return

        rows = []
        for author, entries in expert_map.items():
            for entry in entries:
                file_id = entry.get("file_id")
                weight = entry.get("weight", 0)
                if file_id:
                    rows.append(
                        {
                            "author": author,
                            "file_id": file_id,
                            "weight": int(weight),
                        }
                    )

        if not rows:
            return

        query = """
        UNWIND $rows AS row
        MERGE (p:Person {name: row.author})
        WITH p, row
        MATCH (f:CodeNode {id: row.file_id})
        MERGE (p)-[r:EXPERT_ON]->(f)
        ON CREATE SET r.weight = row.weight
        ON MATCH SET  r.weight = row.weight
        """

        try:
            self._safe_session_run(query, rows=rows)
        except Exception as e:
            logger.error(f"Failed to upsert SME relationships: {e}")

    def upsert_feature_mappings(self, feature_mappings: Dict[str, dict]):
        """
        Creates (:Feature)-[:IMPLEMENTED_BY]->(:CodeNode) edges based on commit history.
        feature_mappings: { feature_id: { "name": str, "files": set[str] } }
        """
        if not self.driver or not feature_mappings:
            return

        rows = []
        for feature_id, data in feature_mappings.items():
            feature_name = data.get("name", feature_id)
            files = data.get("files") or []
            for file_id in files:
                rows.append(
                    {
                        "feature_id": feature_id,
                        "feature_name": feature_name,
                        "file_id": file_id,
                    }
                )

        if not rows:
            return

        query = """
        UNWIND $rows AS row
        MERGE (f:Feature {id: row.feature_id})
          ON CREATE SET f.name = row.feature_name
        WITH f, row
        MATCH (file:CodeNode {id: row.file_id})
        MERGE (f)-[:IMPLEMENTED_BY]->(file)
        """

        try:
            self._safe_session_run(query, rows=rows)
        except Exception as e:
            logger.error(f"Failed to upsert Feature mappings: {e}")

    def _calculate_function_owner(self, start_line, end_line, blame_map):
        """
        Determines who owns a function based on line-by-line blame.
        blame_map: { line_number (int) : {"author": str, "email": str} } or { line_number: str } (legacy)
        """
        if not blame_map:
            return "Unknown", [], "unknown@unknown.com", 0.0
            
        authors = []
        emails = []
        # Check every line in the function's range
        for i in range(start_line, end_line + 1):
            if i in blame_map:
                line_data = blame_map[i]
                if isinstance(line_data, dict):
                    authors.append(line_data.get("author", "Unknown"))
                    emails.append(line_data.get("email", "unknown@unknown.com"))
                else:
                    # Legacy format: just author name
                    authors.append(line_data)
                    emails.append("unknown@unknown.com")
        
        if not authors:
            return "Unknown", [], "unknown@unknown.com", 0.0

        author_counts = Counter(authors)
        email_counts = Counter(emails)
        
        top_owner = author_counts.most_common(1)[0][0]
        top_email, top_email_count = email_counts.most_common(1)[0]
        owner_confidence = round(top_email_count / len(emails), 3)
        collaborators = list(author_counts.keys())
        
        return top_owner, collaborators, top_email, owner_confidence

    def _detect_language(self, file_path: str) -> str:
        """Detect programming language from file extension."""
        ext = os.path.splitext(file_path)[1].lower()
        language_map = {
            '.py': 'python', '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
            '.java': 'java', '.kt': 'kotlin', '.scala': 'scala',
            '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.h': 'c', '.hpp': 'cpp',
            '.cs': 'csharp', '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
            '.swift': 'swift', '.m': 'objective-c', '.mm': 'objective-cpp',
            '.r': 'r', '.lua': 'lua', '.pl': 'perl', '.sh': 'bash', '.bash': 'bash',
            '.dart': 'dart', '.elm': 'elm', '.ex': 'elixir', '.clj': 'clojure',
            '.hs': 'haskell', '.ml': 'ocaml', '.vim': 'vim', '.lisp': 'lisp',
            '.jl': 'julia', '.nim': 'nim', '.cr': 'crystal', '.d': 'd',
            '.pas': 'pascal', '.vb': 'vb', '.v': 'verilog', '.sv': 'systemverilog',
        }
        return language_map.get(ext, 'unknown')
    
    def _extract_structure_regex(self, file_content: str, file_path: str, language: str) -> Tuple[List[dict], List[dict]]:
        """Fallback regex-based structure extraction for non-Python languages."""
        nodes = []
        edges = []
        lines = file_content.split('\n')
        
        # Common patterns for different languages
        patterns = {
            'javascript': {
                'class': r'^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)',
                'function': r'^\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*[=\(]',
                'method': r'^\s*(\w+)\s*[:\(]\s*function\s*\(|^\s*(\w+)\s*[:=]\s*\([^)]*\)\s*=>',
                'import': r'import\s+(?:.*\s+from\s+)?[\'"]([^\'"]+)[\'"]|require\s*\([\'"]([^\'"]+)[\'"]',
                'dynamic_require': r'require\s*\(\s*(\w+)\s*\)',  # require(variable) - dynamic import
            },
            'typescript': {
                'class': r'^\s*(?:export\s+)?(?:abstract\s+)?(?:public\s+)?class\s+(\w+)',
                'function': r'^\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)\s*[<\(:]',
                'method': r'^\s*(?:public\s+|private\s+|protected\s+)?(\w+)\s*[\(:]',
                'import': r'import\s+(?:.*\s+from\s+)?[\'"]([^\'"]+)[\'"]',
            },
            'java': {
                'class': r'^\s*(?:public\s+|private\s+|protected\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)',
                'method': r'^\s*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:[\w<>\[\]]+\s+)?(\w+)\s*\(',
                'import': r'import\s+(?:static\s+)?([\w.]+)',
            },
            'cpp': {
                'class': r'^\s*(?:class|struct)\s+(\w+)',
                'function': r'^\s*(?:[\w:<>\[\]]+\s+)?(\w+)\s*\(',
                'include': r'#include\s*[<"]([^>"]+)[>"]',
            },
            'go': {
                'function': r'^\s*func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(',
                'type': r'^\s*type\s+(\w+)',
                'import': r'import\s+[\'"]([^\'"]+)[\'"]',
            },
            'rust': {
                'struct': r'^\s*(?:pub\s+)?struct\s+(\w+)',
                'function': r'^\s*(?:pub\s+)?fn\s+(\w+)\s*\(',
                'impl': r'^\s*impl\s+(\w+)',
                'use': r'use\s+([\w:]+)',
            },
            'ruby': {
                'class': r'^\s*class\s+(\w+)',
                'module': r'^\s*module\s+(\w+)',
                'def': r'^\s*def\s+(?:self\.)?(\w+)',
                'require': r'require\s+[\'"]([^\'"]+)[\'"]',
            },
        }
        
        lang_patterns = patterns.get(language, {})
        current_class = None
        
        for line_num, line in enumerate(lines, 1):
            # Extract classes
            if 'class' in lang_patterns:
                match = re.search(lang_patterns['class'], line)
                if match:
                    class_name = match.group(1)
                    full_name = f"{file_path}::{class_name}"
                    nodes.append({
                        "id": full_name,
                        "type": "class",
                        "name": class_name,
                        "start_line": line_num,
                        "end_line": line_num,  # Will be updated if we find closing brace
                    })
                    edges.append({"source": file_path, "target": full_name, "relation": "DEFINES"})
                    current_class = full_name
            
            # Extract functions/methods
            func_patterns = ['function', 'method', 'def', 'fn']
            for pattern_key in func_patterns:
                if pattern_key in lang_patterns:
                    match = re.search(lang_patterns[pattern_key], line)
                    if match:
                        func_name = match.group(1) if match.lastindex >= 1 else match.group(2) if match.lastindex >= 2 else None
                        if func_name:
                            scope = current_class if current_class else file_path
                            full_name = f"{scope}::{func_name}"
                            nodes.append({
                                "id": full_name,
                                "type": "function",
                                "name": func_name,
                                "start_line": line_num,
                                "end_line": line_num,
                            })
                            edges.append({"source": scope, "target": full_name, "relation": "CONTAINS"})
                        break
            
            # Extract imports/dependencies
            import_patterns = ['import', 'include', 'use', 'require']
            for pattern_key in import_patterns:
                if pattern_key in lang_patterns:
                    match = re.search(lang_patterns[pattern_key], line)
                    if match:
                        import_path = match.group(1) if match.lastindex >= 1 else match.group(2) if match.lastindex >= 2 else None
                        if import_path:
                            # Resolve import path to file
                            target_file = self._resolve_import_path(import_path, file_path, language)
                            if target_file:
                                edges.append({"source": file_path, "target": target_file, "relation": "IMPORTS"})
                        break
            
            # [LAYER 2] Detect dynamic imports: require(variable) in JavaScript
            if language == 'javascript' and 'dynamic_require' in lang_patterns:
                dynamic_match = re.search(lang_patterns['dynamic_require'], line)
                if dynamic_match:
                    # This is a dynamic require - mark as MAYBE_DEPENDS
                    # We can't resolve the exact target, but we mark it as a potential dependency
                    logger.debug(f"Dynamic require detected in {file_path} at line {line_num}")
                    # Note: We can't create an edge without knowing the target, but we'll mark the file
                    # The frontend will show a warning about potential hidden dependencies
        
        return nodes, edges
    
    def _resolve_import_path(self, import_path: str, current_file: str, language: str) -> Optional[str]:
        """Resolve import path to actual file path."""
        # Use PathResolver if available
        if self.path_resolver:
            resolved = self.path_resolver.resolve(import_path, current_file)
            if resolved:
                return resolved
        
        # Fallback to simple resolution
        if language == 'python':
            return import_path.replace('.', '/') + '.py'
        elif language in ['javascript', 'typescript']:
            # Handle relative imports
            if import_path.startswith('.'):
                base_dir = os.path.dirname(current_file)
                return os.path.normpath(os.path.join(base_dir, import_path.lstrip('.'))) + '.js'
            return import_path + '.js'
        elif language == 'java':
            return import_path.replace('.', '/') + '.java'
        # Add more language-specific resolution as needed
        return None

    def _is_infrastructure_file(self, file_path: str) -> bool:
        """Check if file is an infrastructure/config file."""
        filename = os.path.basename(file_path).lower()
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
        return filename in infrastructure_files or any(filename.endswith(ext) for ext in ['.tf', '.tfvars'])

    def extract_and_build(self, file_content: str, file_path: str, repo_root: str = "", git_metadata: dict = None, blame_map: dict = None, return_data: bool = False):
        """
        Extract code structure and build graph nodes/edges.
        Supports Python (AST) and other languages (regex fallback).
        
        Args:
            return_data: If True, returns (nodes, edges) instead of inserting to Neo4j
        """
        # Update repo_root and path_resolver if provided
        if repo_root and repo_root != self.repo_root:
            self.repo_root = repo_root
            self.path_resolver = PathResolver(repo_root)
        
        file_meta = git_metadata or {}
        
        # 1. File Node
        file_node = {
            "id": file_path,
            "type": "file",
            "name": os.path.basename(file_path),
            "val": 15,
            **file_meta
        }

        # [NEW] Check if this is an infrastructure file
        if self._is_infrastructure_file(file_path):
            file_node["type"] = "infrastructure"
            file_node["val"] = 50  # Massive visual weight
            file_node["infrastructure"] = True

        # 2. Parse structure based on language
        language = self._detect_language(file_path)
        nodes = []
        edges = []
        
        if language == 'python':
            # Use Python AST parser with PathResolver
            visitor = CodeStructureVisitor(file_path, repo_root, self.path_resolver)
            nodes, edges = visitor.process(file_content)
        elif language != 'unknown':
            # Use regex-based extraction for other languages
            try:
                nodes, edges = self._extract_structure_regex(file_content, file_path, language)
                logger.debug(f"Regex extraction for {language}: {len(nodes)} nodes, {len(edges)} edges")
            except Exception as e:
                logger.debug(f"Regex extraction failed for {file_path}: {e}")
        else:
            # Unknown language - just create file node
            logger.debug(f"Unknown language for {file_path}, skipping structure extraction")
        
        if len(nodes) > 0 or len(edges) > 0:
            logger.debug(f"Neo4j: Extracted {len(nodes)} nodes, {len(edges)} edges from {os.path.basename(file_path)}")

        # [NEW] For infrastructure files, create implicit DEPENDS_ON edges to all sibling files
        if file_node.get("infrastructure"):
            # This will be handled after we know all files, but we mark it here
            file_node["affects_all_siblings"] = True

        # 3. Process Children (Classes/Functions) with ownership
        processed_nodes = [file_node]  # Start with file node
        for node in nodes:
            # [NEW] Calculate Function-Level Ownership with email and confidence
            top_owner = "Unknown"
            collaborators = []
            owner_email = "unknown@unknown.com"
            owner_confidence = 0.0
            
            if blame_map and "start_line" in node:
                top_owner, collaborators, owner_email, owner_confidence = self._calculate_function_owner(
                    node["start_line"], 
                    node["end_line"], 
                    blame_map
                )

            # Node inherits file metadata but overrides owner info
            node_data = {**node, **file_meta} # Start with file defaults
            node_data["top_owner"] = top_owner # Override with specific function owner
            node_data["collaborators"] = collaborators
            node_data["owner_email"] = owner_email
            node_data["owner_confidence"] = owner_confidence
            node_data["val"] = 10 if node["type"] == "class" else 5
            
            # Preserve sensitivity and risk_multiplier from AST scanning
            if "sensitivity" in node:
                node_data["sensitivity"] = node["sensitivity"]
            if "risk_multiplier" in node:
                node_data["risk_multiplier"] = node["risk_multiplier"]
            if "api_route" in node:
                node_data["api_route"] = node["api_route"]
            
            processed_nodes.append(node_data)

        # If return_data is True, return without inserting
        if return_data:
            return processed_nodes, edges

        # 4. Insert to Neo4j (original behavior)
        self.upsert_node(file_node)
        for node in processed_nodes[1:]:  # Skip file node (already inserted)
            self.upsert_node(node)
        for edge in edges:
            self.upsert_edge(edge['source'], edge['target'], edge['relation'])

    def _verify_connection(self):
        """Verify Neo4j connection is working."""
        if not self.driver:
            return False
        try:
            with self.driver.session(database=self.database) as session:
                session.run("RETURN 1").single()
            return True
        except Exception as e:
            logger.error(f"Neo4j connection verification failed: {e}")
            return False

    def get_full_graph(self, limit=2000):
        """
        Fetches graph for Frontend Visualization.
        Optimized query: Get nodes first, then relationships separately.
        This is faster than OPTIONAL MATCH on large graphs.
        """
        if not self.driver: 
            logger.warning("Neo4j driver not available, returning empty graph")
            return {"nodes": [], "links": []}
        
        # Verify connection before attempting query
        if not self._verify_connection():
            logger.error("Neo4j connection failed, returning empty graph")
            return {"nodes": [], "links": []}
        
        # Optimized query: Get nodes first, then relationships separately
        # This is faster than OPTIONAL MATCH on large graphs
        nodes_map = {}
        links = []

        try:
            start_time = time.time()
            
            # Use retry wrapper for connection resilience
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    # First, get all nodes (up to limit) - filtered by user_id
                    # Optimized: Get nodes first, then relationships separately
                    nodes_query = """
                    MATCH (n:CodeNode {user_id: $user_id})
                    RETURN n
                    LIMIT $limit
                    """
                    result = session.run(nodes_query, user_id=self.user_id, limit=limit)
                    for record in result:
                        n = dict(record["n"])
                        nodes_map[n["id"]] = n
                    
                    # Then get relationships only for nodes we fetched
                    if nodes_map:
                        node_ids = list(nodes_map.keys())
                        # Split into chunks to avoid query size limits
                        chunk_size = 500
                        for i in range(0, len(node_ids), chunk_size):
                            chunk = node_ids[i:i + chunk_size]
                            rel_query = """
                            MATCH (n:CodeNode {user_id: $user_id})-[r]->(m:CodeNode {user_id: $user_id})
                            WHERE n.id IN $node_ids
                            RETURN n.id as source, m.id as target, type(r) as relation, m as target_node
                            LIMIT 10000
                            """
                            rel_result = session.run(rel_query, user_id=self.user_id, node_ids=chunk)
                            for record in rel_result:
                                source_id = record["source"]
                                target_id = record["target"]
                                
                                # Add target node if not already in map
                                if target_id not in nodes_map:
                                    target_node = dict(record["target_node"])
                                    nodes_map[target_id] = target_node
                                
                                links.append({
                                    "source": source_id,
                                    "target": target_id,
                                    "relation": record["relation"]
                                })
            
            _execute_query()
            
            elapsed = time.time() - start_time
            logger.info(f"Fetched {len(nodes_map)} nodes and {len(links)} links from Neo4j in {elapsed:.2f}s")
            return {"nodes": list(nodes_map.values()), "links": links}
                
        except Exception as e:
            elapsed = time.time() - start_time if 'start_time' in locals() else 0
            logger.error(f"Neo4j query error in get_full_graph (after {elapsed:.2f}s): {e}")
            import traceback
            logger.debug(traceback.format_exc())
            # Return partial results if we have any
            if nodes_map:
                logger.warning(f"Returning partial graph: {len(nodes_map)} nodes, {len(links)} links")
                return {"nodes": list(nodes_map.values()), "links": links}
            return {"nodes": [], "links": []}

    def get_neighbors(self, node_id: str):
        """
        LAZY LOADING: Fetches immediate children/neighbors of a node.
        Used when a user clicks a Folder to see its contents.
        """
        if not self.driver: return {"nodes": [], "links": []}

        # Query: Find the clicked node (p) and its outgoing children (c) - filtered by user_id
        query = """
        MATCH (p:CodeNode {user_id: $user_id, id: $id})-[r]->(c:CodeNode {user_id: $user_id})
        RETURN p, r, c
        LIMIT 500
        """
        
        nodes_map = {}
        links = []
        
        with self.driver.session(database=self.database) as session:
            result = session.run(query, user_id=self.user_id, id=node_id)
            for record in result:
                p = dict(record["p"])
                c = dict(record["c"])
                
                # Ensure we send both Parent and Child so the frontend can link them
                nodes_map[p["id"]] = p
                nodes_map[c["id"]] = c
                
                links.append({
                    "source": p["id"],
                    "target": c["id"],
                    "relation": record["r"].type
                })

        return {"nodes": list(nodes_map.values()), "links": links}

    def get_impact_subgraph(self, target_id: str):
        """
        IMPACT RADAR: Cypher Query to find 'Blast Radius'.
        Finds all files that recursively DEPEND ON the target.
        """
        if not self.driver: return {"nodes": [], "links": []}
        
        # Cypher: Find all upstream nodes (source) that connect to target - filtered by user_id
        query = """
        MATCH (target:CodeNode {user_id: $user_id, id: $id})
        MATCH (source:CodeNode {user_id: $user_id})-[r:DEPENDS_ON*1..3]->(target)
        RETURN source, r, target
        """
        
        nodes_map = {target_id: {"id": target_id, "type": "file", "val": 20}} # Ensure target exists
        links = []
        
        with self.driver.session(database=self.database) as session:
            # We first fetch the target node details to be safe
            target_res = session.run(
                "MATCH (n:CodeNode {user_id: $user_id, id: $id}) RETURN n",
                user_id=self.user_id,
                id=target_id
            )
            for rec in target_res:
                nodes_map[target_id] = dict(rec["n"])

            # Then fetch dependencies
            result = session.run(query, user_id=self.user_id, id=target_id)
            for record in result:
                # 'r' is a list of relationships in the path, but we simplify for visualization
                # Actually, let's use a simpler query pattern for the graph lib
                pass 

            # Simpler Graph Query (Path Expansion)
            # We use a union to get immediate edges for visualization
            simple_query = """
            MATCH (t:CodeNode {id: $id})<-[r:DEPENDS_ON]-(s:CodeNode)
            RETURN s, r, t
            UNION
            MATCH (t:CodeNode {id: $id})<-[:DEPENDS_ON]-(inter)<-[r:DEPENDS_ON]-(s:CodeNode)
            RETURN s, r, inter as t
            """
            
            result = session.run(simple_query, id=target_id)
            for record in result:
                s = dict(record["s"])
                t = dict(record["t"])
                
                nodes_map[s["id"]] = s
                nodes_map[t["id"]] = t
                links.append({
                    "source": s["id"],
                    "target": t["id"],
                    "relation": "DEPENDS_ON"
                })

        return {"nodes": list(nodes_map.values()), "links": links}

    def find_dead_code(self):
        """
        Finds public functions/classes that are defined but NEVER called.
        Excludes 'Main' functions and Framework Entry points (like Django views).
        
        Returns list of orphan nodes that are safe to delete.
        """
        if not self.driver:
            return []
        
        try:
            query = """
            MATCH (n:CodeNode)
            WHERE n.type IN ['function', 'class']
              AND NOT (n)<-[:CALLS|DEPENDS_ON]-(:CodeNode)
              AND NOT n.name IN ['main', '__init__', 'handler', 'index', 'app', 'router']
              AND NOT n.id CONTAINS 'test'
              AND NOT n.id CONTAINS 'spec'
              AND NOT n.id CONTAINS '__main__'
            RETURN n.id, n.name, n.type, n.last_author, n.last_modified
            ORDER BY n.last_modified DESC
            LIMIT 100
            """
            
            @retry_on_connection_error(max_retries=3, delay=1.0)
            def _execute_query():
                with self.driver.session(database=self.database) as session:
                    result = session.run(query)
                    # Fetch all records before session closes to avoid ResultConsumedError
                    return list(result)
            
            records = _execute_query()
            dead_code = []
            for record in records:
                dead_code.append({
                    "id": record["n.id"],
                    "name": record["n.name"],
                    "type": record["n.type"],
                    "last_author": record["n.last_author"],
                    "last_modified": record["n.last_modified"]
                })
            
            logger.info(f"Found {len(dead_code)} potential dead code items")
            return dead_code
        except Exception as e:
            logger.error(f"Failed to find dead code: {e}")
            return []

    def get_blast_radius(self, node_id: str):
        """
        [LAYER 2] IMPROVED RISK SCORING: Dynamic Risk Propagation with Relationship Traversal
        
        Calculates risk scores dynamically based on:
        - Actual relationship traversal (BFS up to 3 hops)
        - Relationship type weights (DEPENDS_ON > IMPORTS > MAYBE_*)
        - Node characteristics (critical paths, test coverage, churn)
        - Dynamic coloring based on risk scores (not just hop distance)
        
        Returns React Flow compatible format with risk scores and prioritized action items.
        Now includes categorized impact: Breaking API Changes, Data Compliance Risk, Infrastructure Reset, Logic Breakage.
        """
        if not self.driver:
            return {
                "nodes": [], 
                "edges": [], 
                "total_risk_score": 0, 
                "test_files": [], 
                "warnings": [],
                "impact_categories": {
                    "breaking_api_changes": [],
                    "data_compliance_risk": [],
                    "infrastructure_reset": [],
                    "logic_breakage": []
                }
            }
        
        nodes_map = {}
        edges_map = {}
        total_risk_score = 0
        test_files = []
        warnings = []
        
        # [NEW] Categorized impact tracking
        impact_categories = {
            "breaking_api_changes": [],  # Nodes marked api_route
            "data_compliance_risk": [],   # Nodes marked sensitivity=['PII', 'AUTH', 'FINANCE']
            "infrastructure_reset": [],   # Nodes marked infrastructure
            "logic_breakage": []          # Standard code dependencies
        }
        
        try:
            with self.driver.session(database=self.database) as session:
                # Normalize node_id - try both forward and backslash formats
                normalized_node_id = node_id.replace("\\", "/")
                alt_node_id = node_id.replace("/", "\\")
                
                logger.info(f"Searching for node: {node_id} (normalized: {normalized_node_id}, alt: {alt_node_id})")
                
                # First, fetch the source node - try multiple formats and flexible matching
                source_result = session.run(
                    """
                    MATCH (n:CodeNode)
                    WHERE n.id = $node_id 
                       OR n.id = $normalized_id
                       OR n.id = $alt_id
                       OR n.id STARTS WITH $node_id
                       OR $node_id STARTS WITH n.id
                       OR n.id CONTAINS $search_term
                    RETURN n, n.id as actual_id
                    ORDER BY 
                      CASE 
                        WHEN n.id = $node_id THEN 1
                        WHEN n.id = $normalized_id THEN 2
                        WHEN n.id = $alt_id THEN 3
                        WHEN n.id STARTS WITH $node_id THEN 4
                        ELSE 5
                      END
                    LIMIT 1
                    """,
                    node_id=node_id,
                    normalized_id=normalized_node_id,
                    alt_id=alt_node_id,
                    search_term=node_id.split("\\")[-1].split("/")[-1]  # Just filename
                )
                source_node = None
                actual_node_id = node_id
                for record in source_result:
                    source_node = dict(record["n"])
                    actual_node_id = record.get("actual_id", node_id)
                    logger.info(f"Found source node with ID: {actual_node_id}")
                    break
                
                if not source_node:
                    logger.warning(f"Source node not found: {node_id}")
                    return {"nodes": [], "edges": [], "total_risk_score": 0, "test_files": [], "warnings": []}
                
                # Use the actual node ID from database
                node_id = actual_node_id
                
                # Add source node
                # [NEW] Check if source is DEPENDENCY_MANIFEST - affects entire repository
                node_role = source_node.get("node_role", "CODE")
                if node_role == "DEPENDENCY_MANIFEST":
                    # DEPENDENCY_MANIFEST changes affect the entire repository
                    warnings.append("CRITICAL: This is a dependency manifest file. Changes affect the ENTIRE repository!")
                    # Query to get ALL files in the repository
                    all_files_query = """
                    MATCH (n:CodeNode)
                    WHERE n.type = 'file'
                      AND n.id <> $node_id
                    RETURN n
                    LIMIT 10000
                    """
                    all_files_result = session.run(all_files_query, node_id=node_id)
                    for record in all_files_result:
                        file_node = dict(record["n"])
                        file_id = file_node.get("id")
                        if file_id and file_id != node_id:
                            nodes_map[file_id] = {
                                **file_node,
                                "color": "#ef4444",  # Red for critical impact
                                "type": "dependency_impact",
                                "impactType": "dependency_impact",
                                "risk_score": 100,  # Maximum risk
                                "hop_distance": 1,
                                "dependency_manifest_impact": True
                            }
                            total_risk_score += 100
                
                nodes_map[node_id] = {
                    **source_node,
                    "color": "#000000",  # Black for source
                    "type": "source",
                    "impactType": "source",
                    "risk_score": 0,
                    "hop_distance": 0,
                    "node_role": node_role
                }
                
                # [IMPROVED] Use flexible traversal to find relationships - similar to hybrid retriever approach
                # This finds relationships using STARTS WITH and flexible path matching
                
                # Query 1: Find files that depend on source (files that import/include source)
                # Use flexible matching like the hybrid retriever does
                query_dependents_bfs = """
                MATCH (source:CodeNode)
                WHERE source.id = $node_id OR source.id STARTS WITH $node_id
                WITH source
                
                // Direct relationships - files that directly depend on source
                OPTIONAL MATCH (dependent:CodeNode)-[r1]->(source)
                WHERE dependent <> source 
                  AND NOT dependent.id CONTAINS '::'
                  AND type(r1) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS', 'MAYBE_CALLS', 'MAYBE_DEPENDS']
                
                // Reverse - files that source depends on (these would be affected if source changes)
                OPTIONAL MATCH (source)-[r2]->(dependent2:CodeNode)
                WHERE dependent2 <> source 
                  AND NOT dependent2.id CONTAINS '::'
                  AND type(r2) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS']
                
                // Through CONTAINS - files -> functions -> source
                OPTIONAL MATCH (dependent3:CodeNode)-[:CONTAINS]->(func:CodeNode)-[r3]->(source)
                WHERE dependent3 <> source 
                  AND NOT dependent3.id CONTAINS '::'
                  AND type(r3) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS']
                
                // Through CONTAINS reverse - source -> functions -> other files
                OPTIONAL MATCH (source)-[:CONTAINS]->(func2:CodeNode)-[r4]->(dependent4:CodeNode)
                WHERE dependent4 <> source 
                  AND NOT dependent4.id CONTAINS '::'
                  AND type(r4) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS']
                
                // Files in same directory (sibling files - likely related)
                OPTIONAL MATCH (sibling:CodeNode)
                WHERE sibling <> source 
                  AND NOT sibling.id CONTAINS '::'
                  AND sibling.id STARTS WITH $dir_prefix
                  AND sibling.id <> $node_id
                
                WITH DISTINCT 
                  COALESCE(dependent, dependent2, dependent3, dependent4, sibling) as node,
                  CASE 
                    WHEN dependent IS NOT NULL THEN 1
                    WHEN dependent2 IS NOT NULL THEN 1
                    WHEN dependent3 IS NOT NULL THEN 2
                    WHEN dependent4 IS NOT NULL THEN 2
                    WHEN sibling IS NOT NULL THEN 1
                    ELSE 3
                  END as hop_distance,
                  CASE 
                    WHEN dependent IS NOT NULL THEN 'direct'
                    WHEN dependent2 IS NOT NULL THEN 'direct'
                    WHEN dependent3 IS NOT NULL THEN 'indirect'
                    WHEN dependent4 IS NOT NULL THEN 'indirect'
                    WHEN sibling IS NOT NULL THEN 'sibling'
                    ELSE 'indirect'
                  END as impact_type
                
                WHERE node IS NOT NULL
                RETURN node, hop_distance, impact_type
                ORDER BY hop_distance, node.id
                LIMIT 300
                """
                
                # Query 2: Find what source depends on (files that source imports/includes)
                query_dependencies_bfs = """
                MATCH (source:CodeNode)
                WHERE source.id = $node_id OR source.id STARTS WITH $node_id
                WITH source
                
                // Direct dependencies - source imports/depends on
                OPTIONAL MATCH (source)-[r1]->(dependency:CodeNode)
                WHERE dependency <> source 
                  AND NOT dependency.id CONTAINS '::'
                  AND type(r1) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS', 'MAYBE_CALLS', 'MAYBE_DEPENDS']
                
                // Through CONTAINS - source -> functions -> other files
                OPTIONAL MATCH (source)-[:CONTAINS]->(func:CodeNode)-[r2]->(dependency2:CodeNode)
                WHERE dependency2 <> source 
                  AND NOT dependency2.id CONTAINS '::'
                  AND type(r2) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS']
                
                // Files that depend on source (reverse - these would be affected)
                OPTIONAL MATCH (dependency3:CodeNode)-[r3]->(source)
                WHERE dependency3 <> source 
                  AND NOT dependency3.id CONTAINS '::'
                  AND type(r3) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS']
                
                WITH DISTINCT 
                  COALESCE(dependency, dependency2, dependency3) as node,
                  CASE 
                    WHEN dependency IS NOT NULL THEN 1
                    WHEN dependency2 IS NOT NULL THEN 2
                    WHEN dependency3 IS NOT NULL THEN 1
                    ELSE 2
                  END as hop_distance
                
                WHERE node IS NOT NULL
                RETURN node, hop_distance
                ORDER BY hop_distance, node.id
                LIMIT 200
                """
                
                logger.info(f"Executing improved BFS queries for node: {node_id}")
                
                # Extract directory prefix for sibling file matching
                dir_prefix = "\\".join(node_id.split("\\")[:-1]) + "\\" if "\\" in node_id else "/".join(node_id.split("/")[:-1]) + "/"
                if not dir_prefix or dir_prefix == "\\" or dir_prefix == "/":
                    # If no directory, use first part of path
                    dir_prefix = node_id.split("\\")[0] + "\\" if "\\" in node_id else node_id.split("/")[0] + "/"
                
                # Process dependents (files that would be affected by changes to source)
                result_dependents = session.run(query_dependents_bfs, node_id=node_id, dir_prefix=dir_prefix)
                for record in result_dependents:
                    node_obj = record.get("node")
                    if not node_obj:
                        continue
                    
                    node_dict = dict(node_obj)
                    dep_id = node_dict.get("id")
                    hop_distance = record.get("hop_distance", 1)
                    impact_type = record.get("impact_type", "indirect")
                    
                    if dep_id and dep_id != node_id and dep_id not in nodes_map:
                        # Calculate dynamic risk score with improved model
                        # Base score: Higher for direct relationships, decreases with distance
                        if impact_type == "direct":
                            base_score = max(20, 30 - (hop_distance * 5))
                        elif impact_type == "sibling":
                            base_score = max(10, 20 - (hop_distance * 3))
                        else:
                            base_score = max(5, 15 - (hop_distance * 3))
                        
                        multiplier = 1.0
                        
                        # Relationship type weight
                        if impact_type == "direct":
                            multiplier *= 1.8  # Direct relationships are more critical
                        elif impact_type == "sibling":
                            multiplier *= 1.2  # Sibling files are somewhat related
                        
                        # Node characteristics
                        node_name = (node_dict.get("name") or "").lower()
                        node_id_lower = dep_id.lower()
                        
                        # Critical path detection - expanded keywords
                        is_critical = any(keyword in node_name or keyword in node_id_lower 
                                        for keyword in ["auth", "payment", "security", "config", "main", "init", 
                                                      "decoder", "encoder", "parser", "compiler", "recompiler",
                                                      "runtime", "core", "kernel", "driver"])
                        if is_critical:
                            multiplier *= 2.0  # Critical components have higher impact
                        
                        # Database/API detection
                        if any(keyword in node_name or keyword in node_id_lower 
                              for keyword in ["schema", "migration", "model", "db", "database", "table"]):
                            multiplier *= 1.5
                        elif any(keyword in node_name or keyword in node_id_lower 
                                for keyword in ["route", "endpoint", "api", "controller", "handler"]):
                            multiplier *= 1.4
                        
                        # Code health indicators
                        churn_score = float(node_dict.get("churn_score", 0.0))
                        if churn_score > 0.7:
                            multiplier *= 1.8  # Fragile code is riskier
                        elif churn_score > 0.5:
                            multiplier *= 1.3  # Moderate churn
                        
                        if node_dict.get("untested_critical", False):
                            multiplier *= 2.5  # Untested critical code is very risky
                            warnings.append(f"{dep_id} is untested and critical")
                        
                        # File type risk (headers, core files, etc.)
                        if any(ext in dep_id.lower() for ext in [".h", ".hpp", ".hxx"]):
                            multiplier *= 1.3  # Header files affect many files
                        if "core" in dep_id.lower() or "base" in dep_id.lower():
                            multiplier *= 1.5  # Core/base files are important
                        
                        # Calculate final risk score
                        node_risk = min(100, int(round(base_score * multiplier)))
                        total_risk_score += node_risk
                        
                        # Dynamic color based on risk score (not hop distance)
                        if node_risk >= 75:
                            color = "#ef4444"  # Red for high risk
                        elif node_risk >= 40:
                            color = "#f59e0b"  # Orange/Amber for medium risk
                        elif node_risk >= 15:
                            color = "#3b82f6"  # Blue for moderate risk
                        else:
                            color = "#10b981"  # Green for low risk
                        
                        node_entry = {
                            **node_dict,
                            "color": color,
                            "type": impact_type,
                            "impactType": impact_type,
                            "risk_score": node_risk,
                            "hop_distance": hop_distance,
                            "risk_multiplier": round(multiplier, 2)
                        }
                        nodes_map[dep_id] = node_entry
                        
                        # [NEW] Categorize impact
                        if node_dict.get("api_route", False):
                            impact_categories["breaking_api_changes"].append({
                                "id": dep_id,
                                "name": node_dict.get("name", dep_id),
                                "risk_score": node_risk
                            })
                        
                        sensitivity = node_dict.get("sensitivity", [])
                        if sensitivity:
                            impact_categories["data_compliance_risk"].append({
                                "id": dep_id,
                                "name": node_dict.get("name", dep_id),
                                "sensitivity": sensitivity,
                                "risk_score": node_risk
                            })
                        
                        if node_dict.get("infrastructure", False):
                            impact_categories["infrastructure_reset"].append({
                                "id": dep_id,
                                "name": node_dict.get("name", dep_id),
                                "risk_score": node_risk
                            })
                        
                        # Logic breakage (standard dependencies)
                        if not node_dict.get("api_route") and not sensitivity and not node_dict.get("infrastructure"):
                            impact_categories["logic_breakage"].append({
                                "id": dep_id,
                                "name": node_dict.get("name", dep_id),
                                "risk_score": node_risk
                            })
                
                # Process dependencies (files that source depends on)
                result_dependencies = session.run(query_dependencies_bfs, node_id=node_id)
                for record in result_dependencies:
                    node_obj = record.get("node")
                    if not node_obj:
                        continue
                    
                    node_dict = dict(node_obj)
                    dep_id = node_dict.get("id")
                    hop_distance = record.get("hop_distance", 1)
                    
                    if dep_id and dep_id != node_id and dep_id not in nodes_map:
                        # Dependencies have lower base risk (changing them affects source, but less critical)
                        base_score = max(3, 8 - (hop_distance * 2))
                        multiplier = 1.0
                        
                        node_name = (node_dict.get("name") or "").lower()
                        node_id_lower = dep_id.lower()
                        
                        # Still check for critical dependencies
                        if any(keyword in node_name or keyword in node_id_lower 
                              for keyword in ["auth", "payment", "security", "config"]):
                            multiplier *= 1.5
                        
                        churn_score = float(node_dict.get("churn_score", 0.0))
                        if churn_score > 0.7:
                            multiplier *= 1.3
                        
                        node_risk = min(100, int(round(base_score * multiplier)))
                        total_risk_score += node_risk * 0.3  # Dependencies contribute less
                        
                        # Color based on risk
                        if node_risk >= 50:
                            color = "#3b82f6"  # Blue for dependencies
                        else:
                            color = "#60a5fa"  # Lighter blue for low-risk dependencies
                        
                        nodes_map[dep_id] = {
                            **node_dict,
                            "color": color,
                            "type": "dependency",
                            "impactType": "dependency",
                            "risk_score": node_risk,
                            "hop_distance": hop_distance,
                            "risk_multiplier": round(multiplier, 2)
                        }
                
                # If no relationships found with main queries, try fallback using flexible matching
                if len(nodes_map) <= 1:
                    logger.info("No relationships found with main queries, trying fallback flexible matching...")
                    
                    # Fallback 1: Use the same approach as hybrid retriever - find any relationships
                    # Use actual_node_id (the one we found) for better matching
                    fallback_query = """
                    MATCH (source:CodeNode)
                    WHERE source.id = $actual_node_id 
                       OR source.id STARTS WITH $actual_node_id
                       OR $actual_node_id STARTS WITH source.id
                       OR source.id CONTAINS $filename
                    WITH source
                    OPTIONAL MATCH (source)-[r]-(related:CodeNode)
                    WHERE related <> source
                      AND NOT related.id CONTAINS '::'
                    WITH source, related, r
                    LIMIT 200
                    RETURN DISTINCT related, 
                           CASE WHEN type(r) IN ['DEPENDS_ON', 'IMPORTS', 'CALLS'] THEN 1 ELSE 2 END as hop_distance,
                           CASE WHEN type(r) IN ['DEPENDS_ON', 'IMPORTS'] THEN 'direct' ELSE 'indirect' END as impact_type
                    """
                    
                    filename = actual_node_id.split("\\")[-1].split("/")[-1]
                    fallback_result = session.run(fallback_query, actual_node_id=actual_node_id, filename=filename)
                    
                    # Fallback 2: Find relationships through function-level nodes
                    if len(nodes_map) <= 1:
                        logger.info("Trying function-level relationship traversal...")
                        function_fallback_query = """
                        MATCH (source:CodeNode)
                        WHERE source.id = $actual_node_id 
                           OR source.id STARTS WITH $actual_node_id
                        WITH source
                        OPTIONAL MATCH (source)-[:CONTAINS]->(func:CodeNode)-[r]-(otherFunc:CodeNode)<-[:CONTAINS]-(otherFile:CodeNode)
                        WHERE otherFile <> source
                          AND NOT otherFile.id CONTAINS '::'
                        WITH DISTINCT otherFile, r
                        LIMIT 100
                        RETURN otherFile as related, 2 as hop_distance, 'indirect' as impact_type
                        """
                        function_fallback_result = session.run(function_fallback_query, actual_node_id=actual_node_id)
                        
                        # Combine results
                        all_fallback_results = []
                        for rec in fallback_result:
                            all_fallback_results.append(rec)
                        for rec in function_fallback_result:
                            all_fallback_results.append(rec)
                        
                        fallback_result = all_fallback_results
                    fallback_count = 0
                    for record in fallback_result:
                        node_obj = record.get("related")
                        if not node_obj:
                            continue
                        
                        node_dict = dict(node_obj)
                        dep_id = node_dict.get("id")
                        hop_distance = record.get("hop_distance", 2)
                        impact_type = record.get("impact_type", "indirect")
                        
                        if dep_id and dep_id != node_id and dep_id not in nodes_map:
                            fallback_count += 1
                            base_score = max(5, 15 - (hop_distance * 3))
                            multiplier = 1.0
                            
                            if impact_type == "direct":
                                multiplier *= 1.5
                            
                            node_name = (node_dict.get("name") or "").lower()
                            node_id_lower = dep_id.lower()
                            
                            if any(keyword in node_name or keyword in node_id_lower 
                                  for keyword in ["auth", "payment", "security", "config", "main", "init"]):
                                multiplier *= 1.8
                            
                            node_risk = min(100, int(round(base_score * multiplier)))
                            total_risk_score += node_risk
                            
                            if node_risk >= 75:
                                color = "#ef4444"
                            elif node_risk >= 40:
                                color = "#f59e0b"
                            elif node_risk >= 15:
                                color = "#3b82f6"
                            else:
                                color = "#10b981"
                            
                            nodes_map[dep_id] = {
                                **node_dict,
                                "color": color,
                                "type": impact_type,
                                "impactType": impact_type,
                                "risk_score": node_risk,
                                "hop_distance": hop_distance,
                                "risk_multiplier": round(multiplier, 2)
                            }
                    
                    logger.info(f"Fallback query found {fallback_count} additional nodes")
                
                # Log what we found for debugging
                logger.info(f"Found {len(nodes_map) - 1} affected nodes (excluding source)")
                if len(nodes_map) > 1:
                    logger.info(f"Node IDs found: {list(nodes_map.keys())[:10]}...")
                else:
                    logger.warning(f"Only found source node, no relationships detected")
                
                # [IMPROVED] Find test files that cover affected nodes
                node_ids = list(nodes_map.keys())
                if node_ids:
                    test_query = """
                    MATCH (test:CodeNode)-[:COVERS]->(source:CodeNode)
                    WHERE source.id IN $node_ids
                    AND (test.is_test_file = true OR test.id CONTAINS 'test' OR test.id CONTAINS 'spec')
                    RETURN DISTINCT test.id as test_id, test.name as test_name
                    """
                    test_result = session.run(test_query, node_ids=node_ids)
                    for rec in test_result:
                        test_files.append({
                            "id": rec["test_id"],
                            "name": rec["test_name"]
                        })
                
                # [IMPROVED] Get edges between nodes - use same approach as hybrid retriever
                logger.info(f"🔗 Fetching edges for {len(node_ids)} nodes...")
                if len(node_ids) > 0:
                    # Use the same flexible approach as hybrid retriever - match ANY relationship
                    edges_query = """
                    UNWIND $node_ids as node_id
                    MATCH (a:CodeNode)
                    WHERE a.id = node_id OR a.id STARTS WITH node_id OR node_id STARTS WITH a.id
                    WITH a
                    OPTIONAL MATCH (a)-[r]-(b:CodeNode)
                    WHERE (b.id IN $node_ids OR ANY(id IN $node_ids WHERE b.id = id OR b.id STARTS WITH id OR id STARTS WITH b.id))
                      AND a <> b
                      AND NOT a.id CONTAINS '::'
                      AND NOT b.id CONTAINS '::'
                    WITH DISTINCT a, b, r
                    WHERE b IS NOT NULL
                    RETURN a.id as source, b.id as target, type(r) as relation
                    LIMIT 1000
                    """
                    
                    edges_result = session.run(edges_query, node_ids=node_ids)
                    edge_count = 0
                    
                    for edge_rec in edges_result:
                        edge_count += 1
                        src = edge_rec.get("source")
                        tgt = edge_rec.get("target")
                        relation = edge_rec.get("relation", "RELATED")
                        
                        if not src or not tgt or src == tgt:
                            continue
                        
                        edge_key = f"{src}->{tgt}"
                        if edge_key in edges_map:
                            continue
                        
                        # Determine edge properties based on relationship and node risk
                        is_maybe = relation in ["MAYBE_CALLS", "MAYBE_DEPENDS"]
                        is_covers = relation == "COVERS"
                        is_imports = relation in ["IMPORTS", "DEPENDS_ON"]
                        is_contains = relation == "CONTAINS"
                        
                        # Get risk scores for dynamic edge coloring
                        source_risk = nodes_map.get(src, {}).get("risk_score", 0)
                        target_risk = nodes_map.get(tgt, {}).get("risk_score", 0)
                        max_risk = max(source_risk, target_risk)
                        
                        # Color edges based on risk and relationship type
                        if is_covers:
                            edge_color = "#10b981"  # Green for test coverage
                            stroke_width = 2.5
                        elif tgt == actual_node_id or src == actual_node_id:
                            # Connected to source - use risk-based color
                            if max_risk >= 75:
                                edge_color = "#ef4444"  # Red for high risk
                            elif max_risk >= 40:
                                edge_color = "#f59e0b"  # Orange for medium risk
                            else:
                                edge_color = "#3b82f6"  # Blue for lower risk
                            stroke_width = 2.5
                        elif is_imports:
                            edge_color = "#6366f1"  # Indigo for imports
                            stroke_width = 2
                        elif is_contains:
                            edge_color = "#8b5cf6"  # Purple for contains
                            stroke_width = 1.5
                        else:
                            edge_color = "#6b7280"  # Gray for other
                            stroke_width = 1.5
                        
                        edges_map[edge_key] = {
                            "id": edge_key,
                            "source": src,
                            "target": tgt,
                            "type": "smoothstep",
                            "style": {
                                "stroke": edge_color,
                                "strokeWidth": stroke_width,
                                "strokeDasharray": "5,5" if is_maybe else None
                            },
                            "label": "Potential" if is_maybe else (
                                "Test Coverage" if is_covers else None
                            ),
                            "animated": (tgt == actual_node_id or src == actual_node_id) and max_risk >= 40
                        }
                    
                    # If no edges found, create inferred edges based on file relationships
                    if edge_count == 0 and len(node_ids) > 1:
                        logger.info("No explicit edges found, creating inferred relationships...")
                        
                        # Create inferred edges based on:
                        # 1. Files in same directory (sibling files)
                        # 2. Files with similar names (likely related)
                        # 3. Files that might be related based on path patterns
                        
                        file_nodes = [nid for nid in node_ids if '::' not in nid]
                        inferred_count = 0
                        
                        for i, source_id in enumerate(file_nodes):
                            source_dir = '\\'.join(source_id.split('\\')[:-1]) if '\\' in source_id else '/'.join(source_id.split('/')[:-1])
                            source_name = source_id.split('\\')[-1].split('/')[-1].lower()
                            
                            for target_id in file_nodes[i+1:]:
                                if source_id == target_id:
                                    continue
                                
                                target_dir = '\\'.join(target_id.split('\\')[:-1]) if '\\' in target_id else '/'.join(target_id.split('/')[:-1])
                                target_name = target_id.split('\\')[-1].split('/')[-1].lower()
                                
                                # Check if they should be connected
                                should_connect = False
                                edge_type = "INFERRED"
                                
                                # Same directory = likely related
                                if source_dir == target_dir and source_dir:
                                    should_connect = True
                                    edge_type = "SIBLING"
                                
                                # Similar names (e.g., decoder.cpp and decoder.h)
                                source_base = source_name.rsplit('.', 1)[0] if '.' in source_name else source_name
                                target_base = target_name.rsplit('.', 1)[0] if '.' in target_name else target_name
                                if source_base == target_base:
                                    should_connect = True
                                    edge_type = "PAIRED"
                                
                                # Check if one includes the other's name (e.g., r5900_decoder and decoder)
                                if source_base in target_base or target_base in source_base:
                                    if len(source_base) > 3 and len(target_base) > 3:  # Avoid false positives
                                        should_connect = True
                                        edge_type = "RELATED"
                                
                                if should_connect:
                                    edge_key = f"{source_id}->{target_id}"
                                    if edge_key not in edges_map:
                                        inferred_count += 1
                                        
                                        source_risk = nodes_map.get(source_id, {}).get("risk_score", 0)
                                        target_risk = nodes_map.get(target_id, {}).get("risk_score", 0)
                                        max_risk = max(source_risk, target_risk)
                                        
                                        # Inferred edges are lighter/dashed
                                        if max_risk >= 75:
                                            edge_color = "#ef4444"
                                        elif max_risk >= 40:
                                            edge_color = "#f59e0b"
                                        else:
                                            edge_color = "#6b7280"
                                        
                                        edges_map[edge_key] = {
                                            "id": edge_key,
                                            "source": source_id,
                                            "target": target_id,
                                            "type": "smoothstep",
                                            "style": {
                                                "stroke": edge_color,
                                                "strokeWidth": 1.5,
                                                "strokeDasharray": "8,4",  # Dashed for inferred
                                                "opacity": 0.6
                                            },
                                            "label": f"Inferred ({edge_type.lower()})",
                                            "animated": False
                                        }
                        
                        logger.info(f"Created {inferred_count} inferred edges between {len(file_nodes)} files")
                    
                    logger.info(f"Total edges found: {len(edges_map)}")
        
        except Exception as e:
            logger.error(f"Blast radius query error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {"nodes": [], "edges": [], "total_risk_score": 0, "test_files": [], "warnings": []}
        
        logger.info(f"Blast radius complete: {len(nodes_map)} nodes, {len(edges_map)} edges, risk score: {total_risk_score}")
        
        # [NEW] Also categorize the source node if applicable
        source_node = nodes_map.get(node_id, {})
        if source_node:
            if source_node.get("api_route", False):
                impact_categories["breaking_api_changes"].insert(0, {
                    "id": node_id,
                    "name": source_node.get("name", node_id),
                    "risk_score": 0,
                    "is_source": True
                })
            
            sensitivity = source_node.get("sensitivity", [])
            if sensitivity:
                impact_categories["data_compliance_risk"].insert(0, {
                    "id": node_id,
                    "name": source_node.get("name", node_id),
                    "sensitivity": sensitivity,
                    "risk_score": 0,
                    "is_source": True
                })
            
            if source_node.get("infrastructure", False):
                impact_categories["infrastructure_reset"].insert(0, {
                    "id": node_id,
                    "name": source_node.get("name", node_id),
                    "risk_score": 0,
                    "is_source": True
                })
        
        return {
            "nodes": list(nodes_map.values()),
            "edges": list(edges_map.values()),
            "total_risk_score": min(100, total_risk_score),  # Cap at 100
            "test_files": test_files,
            "warnings": warnings,
            "impact_categories": impact_categories
        }