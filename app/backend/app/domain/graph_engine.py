import os
import ast
import logging
import time
from collections import Counter
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, TransientError
from backend.app.utils.connection_utils import create_neo4j_driver, verify_neo4j_connection, retry_on_connection_error

logger = logging.getLogger("dex-core")

class CodeStructureVisitor(ast.NodeVisitor):
    """
    Traverses AST to extract Structure AND Line Location.
    """
    def __init__(self, filename, base_path):
        self.filename = filename
        self.base_path = base_path
        self.nodes = []
        self.edges = []
        self.scope_stack = [filename] 

    def _resolve_import_path(self, module_name, level=0):
        try:
            if level > 0: return None 
            return module_name.replace(".", "/") + ".py"
        except Exception:
            return None

    def visit_ClassDef(self, node):
        full_name = f"{self.filename}::{node.name}"
        # [NEW] Capture Line Numbers for Blame Analysis
        self.nodes.append({
            "id": full_name, 
            "type": "class", 
            "name": node.name,
            "start_line": node.lineno,
            "end_line": getattr(node, 'end_lineno', node.lineno)
        })
        self.edges.append({"source": self.scope_stack[-1], "target": full_name, "relation": "DEFINES"})
        self.scope_stack.append(full_name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_FunctionDef(self, node):
        full_name = f"{self.scope_stack[-1]}::{node.name}"
        # [NEW] Capture Line Numbers
        self.nodes.append({
            "id": full_name, 
            "type": "function", 
            "name": node.name,
            "start_line": node.lineno,
            "end_line": getattr(node, 'end_lineno', node.lineno)
        })
        self.edges.append({"source": self.scope_stack[-1], "target": full_name, "relation": "CONTAINS"})
        self.generic_visit(node)

    def visit_Import(self, node):
        for alias in node.names:
            target_file = self._resolve_import_path(alias.name)
            if target_file:
                self.edges.append({"source": self.filename, "target": target_file, "relation": "IMPORTS"})

    def visit_ImportFrom(self, node):
        if node.module:
            target_file = self._resolve_import_path(node.module, node.level)
            if target_file:
                self.edges.append({"source": self.filename, "target": target_file, "relation": "IMPORTS"})

    def process(self, source_code):
        try:
            tree = ast.parse(source_code)
            self.visit(tree)
        except SyntaxError:
            pass
        return self.nodes, self.edges

class GraphEngine:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        
        if uri and user and password:
            # Use connection utility with proper configuration
            self.driver = create_neo4j_driver(uri, user, password)
            if self.driver:
                self._create_indices()
            else:
                logger.error("❌ Neo4j driver creation failed.")
        else:
            logger.error("❌ Neo4j Credentials missing.")
            self.driver = None

    def close(self):
        if self.driver: self.driver.close()

    def _create_indices(self):
        if not self.driver: return
        try:
            self._safe_session_run(
                "CREATE CONSTRAINT node_id_unique IF NOT EXISTS FOR (n:CodeNode) REQUIRE n.id IS UNIQUE"
            )
        except Exception as e:
            logger.warning(f"Neo4j index skipped: {e}")
    
    @retry_on_connection_error(max_retries=3, delay=1.0)
    def _safe_session_run(self, query: str, **params):
        """Execute a Neo4j query with retry logic."""
        if not self.driver:
            raise RuntimeError("Neo4j driver not initialized")
        
        # Verify connection before use
        if not verify_neo4j_connection(self.driver):
            logger.warning("Neo4j connection lost, attempting to reconnect...")
            # Driver will attempt to reconnect automatically on next query
        
        with self.driver.session() as session:
            return session.run(query, **params)

    def wipe_graph(self):
        if not self.driver: return
        try:
            self._safe_session_run("MATCH (n) DETACH DELETE n")
        except Exception as e:
            logger.error(f"Failed to wipe graph: {e}")
            raise

    def upsert_node(self, node_data: dict):
        if not self.driver: return
        
        # [NEW] Added 'owner' and 'collaborators' properties
        query = """
        MERGE (n:CodeNode {id: $id})
        SET n.name = $name,
            n.type = $type,
            n.val = $val,
            n.last_author = $last_author,
            n.last_modified = $last_modified,
            n.commit_count = $commit_count,
            n.bus_risk_score = $bus_risk_score,
            n.top_owner = $top_owner,
            n.collaborators = $collaborators
        """
        
        params = {
            "id": node_data.get("id"),
            "name": node_data.get("name", ""),
            "type": node_data.get("type", "file"),
            "val": node_data.get("val", 5),
            "last_author": node_data.get("last_author", "Unknown"),
            "last_modified": node_data.get("last_modified", ""),
            "commit_count": node_data.get("commit_count", 0),
            "bus_risk_score": node_data.get("bus_risk_score", 0.0),
            "top_owner": node_data.get("top_owner", "None"),
            "collaborators": node_data.get("collaborators", []) # List of strings
        }
        try:
            self._safe_session_run(query, **params)
        except Exception as e:
            logger.error(f"Failed to upsert node {node_data.get('id')}: {e}")
            raise

    def upsert_edge(self, source: str, target: str, relation: str):
        if not self.driver: return
        rel_type = "DEPENDS_ON" if relation == "IMPORTS" else relation
        query = f"""
        MATCH (a:CodeNode {{id: $source}})
        MATCH (b:CodeNode {{id: $target}})
        MERGE (a)-[:{rel_type}]->(b)
        """
        try:
            self._safe_session_run(query, source=source, target=target)
        except Exception as e:
            logger.error(f"Failed to upsert edge {source} -> {target}: {e}")
            raise

    def _calculate_function_owner(self, start_line, end_line, blame_map):
        """
        Determines who owns a function based on line-by-line blame.
        blame_map: { line_number (int) : author_name (str) }
        """
        if not blame_map:
            return "Unknown", []
            
        authors = []
        # Check every line in the function's range
        for i in range(start_line, end_line + 1):
            if i in blame_map:
                authors.append(blame_map[i])
        
        if not authors:
            return "Unknown", []

        counts = Counter(authors)
        top_owner = counts.most_common(1)[0][0]
        collaborators = list(counts.keys())
        
        return top_owner, collaborators

    def extract_and_build(self, file_content: str, file_path: str, repo_root: str = "", git_metadata: dict = None, blame_map: dict = None):
        """
        Now accepts 'blame_map' to assign ownership to Functions/Classes.
        """
        file_meta = git_metadata or {}
        
        # 1. Push File Node
        self.upsert_node({
            "id": file_path,
            "type": "file",
            "name": os.path.basename(file_path),
            "val": 15,
            **file_meta
        })

        # 2. Parse AST
        visitor = CodeStructureVisitor(file_path, repo_root)
        nodes, edges = visitor.process(file_content)

        # 3. Push Children (Classes/Functions)
        for node in nodes:
            # [NEW] Calculate Function-Level Ownership
            top_owner = "Unknown"
            collaborators = []
            
            if blame_map and "start_line" in node:
                top_owner, collaborators = self._calculate_function_owner(
                    node["start_line"], 
                    node["end_line"], 
                    blame_map
                )

            # Node inherits file metadata but overrides owner info
            node_data = {**node, **file_meta} # Start with file defaults
            node_data["top_owner"] = top_owner # Override with specific function owner
            node_data["collaborators"] = collaborators
            node_data["val"] = 10 if node["type"] == "class" else 5
            
            self.upsert_node(node_data)

        # 4. Push Edges
        for edge in edges:
            self.upsert_edge(edge['source'], edge['target'], edge['relation'])

    def _verify_connection(self):
        """Verify Neo4j connection is working."""
        if not self.driver:
            return False
        try:
            with self.driver.session() as session:
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
                with self.driver.session() as session:
                    # First, get all nodes (up to limit)
                    # Optimized: Get nodes first, then relationships separately
                    nodes_query = """
                    MATCH (n:CodeNode)
                    RETURN n
                    LIMIT $limit
                    """
                    result = session.run(nodes_query, limit=limit)
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
                            MATCH (n:CodeNode)-[r]->(m:CodeNode)
                            WHERE n.id IN $node_ids
                            RETURN n.id as source, m.id as target, type(r) as relation, m as target_node
                            LIMIT 10000
                            """
                            rel_result = session.run(rel_query, node_ids=chunk)
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

        # Query: Find the clicked node (p) and its outgoing children (c)
        query = """
        MATCH (p:CodeNode {id: $id})-[r]->(c:CodeNode)
        RETURN p, r, c
        LIMIT 500
        """
        
        nodes_map = {}
        links = []
        
        with self.driver.session() as session:
            result = session.run(query, id=node_id)
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
        
        # Cypher: Find all upstream nodes (source) that connect to target
        query = """
        MATCH (target:CodeNode {id: $id})
        MATCH (source)-[r:DEPENDS_ON*1..3]->(target)
        RETURN source, r, target
        """
        
        nodes_map = {target_id: {"id": target_id, "type": "file", "val": 20}} # Ensure target exists
        links = []
        
        with self.driver.session() as session:
            # We first fetch the target node details to be safe
            target_res = session.run("MATCH (n:CodeNode {id: $id}) RETURN n", id=target_id)
            for rec in target_res:
                nodes_map[target_id] = dict(rec["n"])

            # Then fetch dependencies
            result = session.run(query, id=target_id)
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