import os
import ast
import logging
from neo4j import GraphDatabase
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class CodeStructureVisitor(ast.NodeVisitor):
    """
    Traverses AST to extract:
    1. Structure (Classes, Functions)
    2. Dependencies (Imports) -> CRITICAL for Impact Radar
    
    (Kept identical to your logic, just separated for clarity)
    """
    def __init__(self, filename, base_path):
        self.filename = filename      # e.g., "app/services/auth.py"
        self.base_path = base_path    # Root of the repo
        self.nodes = []
        self.edges = []
        self.scope_stack = [filename] 

    def _resolve_import_path(self, module_name, level=0):
        """
        Attempts to resolve Python dotted imports to actual file paths.
        """
        try:
            if level > 0: return None # Skip relative imports for now
            return module_name.replace(".", "/") + ".py"
        except Exception:
            return None

    def visit_ClassDef(self, node):
        full_name = f"{self.filename}::{node.name}"
        self.nodes.append({"id": full_name, "type": "class", "name": node.name})
        self.edges.append({"source": self.scope_stack[-1], "target": full_name, "relation": "DEFINES"})
        self.scope_stack.append(full_name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_FunctionDef(self, node):
        full_name = f"{self.scope_stack[-1]}::{node.name}"
        self.nodes.append({"id": full_name, "type": "function", "name": node.name})
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
        # --- NEO4J CONNECTION ---
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        
        if uri and user and password:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            self._create_indices()
        else:
            logger.error("❌ Neo4j Credentials missing! Graph features will fail.")
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def _create_indices(self):
        """Ensures fast lookups for massive repos."""
        if not self.driver: return
        try:
            with self.driver.session() as session:
                session.run("CREATE CONSTRAINT node_id_unique IF NOT EXISTS FOR (n:CodeNode) REQUIRE n.id IS UNIQUE")
        except Exception as e:
            logger.warning(f"Index creation skipped (might already exist): {e}")

    def wipe_graph(self):
        """Clears the Cloud Database for fresh ingestion."""
        if not self.driver: return
        logger.warning("🧹 Wiping Neo4j Database...")
        with self.driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")

    def upsert_node(self, node_data: dict):
        """
        Streams a single node to Neo4j (No RAM usage).
        """
        if not self.driver: return
        query = """
        MERGE (n:CodeNode {id: $id})
        SET n.name = $name,
            n.type = $type,
            n.val = $val,
            n.last_author = $last_author,
            n.last_modified = $last_modified,
            n.commit_count = $commit_count
        """
        # Set defaults to prevent Cypher errors
        params = {
            "id": node_data.get("id"),
            "name": node_data.get("name", ""),
            "type": node_data.get("type", "file"),
            "val": node_data.get("val", 5),
            "last_author": node_data.get("last_author", "Unknown"),
            "last_modified": node_data.get("last_modified", ""),
            "commit_count": node_data.get("commit_count", 0)
        }
        with self.driver.session() as session:
            session.run(query, **params)

    def upsert_edge(self, source: str, target: str, relation: str):
        """
        Streams a relationship to Neo4j.
        Note: We only link if both nodes exist (prevents ghost links).
        """
        if not self.driver: return
        
        # Map our internal relation types to cleaner Cypher Types
        rel_type = "DEPENDS_ON" if relation == "IMPORTS" else relation
        
        query = f"""
        MATCH (a:CodeNode {{id: $source}})
        MATCH (b:CodeNode {{id: $target}})
        MERGE (a)-[:{rel_type}]->(b)
        """
        with self.driver.session() as session:
            session.run(query, source=source, target=target)

    def extract_and_build(self, file_content: str, file_path: str, repo_root: str = "", git_metadata: dict = None):
        """
        CORE ENGINE: Parses AST and streams data to Cloud DB.
        Replaces 'self.graph.add_node' with 'self.upsert_node'.
        """
        # 1. Push File Node
        file_meta = git_metadata or {}
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
            # Children inherit git metadata (Author of file = Author of function)
            node.update(file_meta) 
            node["val"] = 10 if node["type"] == "class" else 5
            self.upsert_node(node)

        # 4. Push Edges
        for edge in edges:
            self.upsert_edge(edge['source'], edge['target'], edge['relation'])

    def get_full_graph(self, limit=2000):
        """
        Fetches graph for Frontend Visualization.
        Replaces 'save_graph' and reading local JSON.
        """
        if not self.driver: return {"nodes": [], "links": []}
        
        query = """
        MATCH (n:CodeNode)
        OPTIONAL MATCH (n)-[r]->(m:CodeNode)
        RETURN n, r, m
        LIMIT $limit
        """
        nodes_map = {}
        links = []

        with self.driver.session() as session:
            result = session.run(query, limit=limit)
            for record in result:
                n = dict(record["n"])
                nodes_map[n["id"]] = n
                
                if record["r"] and record["m"]:
                    m = dict(record["m"])
                    nodes_map[m["id"]] = m
                    links.append({
                        "source": n["id"],
                        "target": m["id"],
                        "relation": record["r"].type
                    })
        
        return {"nodes": list(nodes_map.values()), "links": links}

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