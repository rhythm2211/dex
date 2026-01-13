import networkx as nx
import json
import ast
import os
import logging

logger = logging.getLogger("dex-core")

class CodeStructureVisitor(ast.NodeVisitor):
    """
    Traverses AST to extract:
    1. Structure (Classes, Functions)
    2. Dependencies (Imports) -> CRITICAL for Impact Radar
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
        e.g., 'backend.app.core.config' -> 'backend/app/core/config.py'
        """
        try:
            # Handle relative imports (e.g., from ..utils import x)
            if level > 0:
                # This is a simplification; robust resolution requires full path logic
                # For now, we assume standard structure or skip complex relative imports
                return None 

            # Convert dots to slashes
            potential_path = module_name.replace(".", "/") + ".py"
            
            # We treat this as a "potential" dependency. 
            # The Graph Engine will verify if this node actually exists later.
            return potential_path
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
        """Handles: import math, import backend.core.config"""
        for alias in node.names:
            target_file = self._resolve_import_path(alias.name)
            if target_file:
                # We link the CURRENT file to the TARGET file
                self.edges.append({
                    "source": self.filename,
                    "target": target_file,
                    "relation": "IMPORTS"
                })

    def visit_ImportFrom(self, node):
        """Handles: from backend.core import config"""
        if node.module:
            target_file = self._resolve_import_path(node.module, node.level)
            if target_file:
                self.edges.append({
                    "source": self.filename,
                    "target": target_file,
                    "relation": "IMPORTS"
                })

    def process(self, source_code):
        try:
            tree = ast.parse(source_code)
            self.visit(tree)
        except SyntaxError:
            pass
        return self.nodes, self.edges

class GraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()

    def build_from_github_tree(self, tree_data: list):
        # ... (Keep your existing Phase 1 logic here if you want, or just rely on Phase 2) ...
        # For brevity, I'll focus on the Deep Analysis part where the magic happens
        pass 

    def extract_and_build(self, file_content: str, file_path: str, repo_root: str = ""):
        """
        Updated to pass repo_root for better import resolution
        """
        # Ensure file node exists
        if file_path not in self.graph:
            self.graph.add_node(file_path, type="file", name=os.path.basename(file_path))

        visitor = CodeStructureVisitor(file_path, repo_root)
        nodes, edges = visitor.process(file_content)
        
        for node in nodes:
            if node['id'] not in self.graph:
                self.graph.add_node(node['id'], **node)
        
        for edge in edges:
            # For imports, we only add the edge if the target file actually exists in our graph
            # This prevents "ghost" nodes from external libraries (like 'math' or 'os')
            if edge['relation'] == 'IMPORTS':
                if edge['target'] in self.graph:
                    self.graph.add_edge(edge['source'], edge['target'], relation="DEPENDS_ON")
            else:
                self.graph.add_edge(edge['source'], edge['target'], relation=edge['relation'])

        return self.graph

    def get_impact_subgraph(self, target_file: str, depth=2):
        """
        Generates the 'Blast Radius' for the Impact Radar.
        Returns all files that depend on 'target_file' up to 'depth' levels.
        """
        if target_file not in self.graph:
            return {"nodes": [], "links": []}
            
        # Reverse graph to traverse 'upstream' (who imports me?)
        # Logic: If A imports B, Graph is A->B. We want to find A given B.
        rev_graph = self.graph.reverse()
        
        # BFS traversal upstream
        relevant_nodes = {target_file}
        curr_layer = {target_file}
        
        for _ in range(depth):
            next_layer = set()
            for node in curr_layer:
                predecessors = list(rev_graph.neighbors(node))
                next_layer.update(predecessors)
            relevant_nodes.update(next_layer)
            curr_layer = next_layer
            
        subgraph = self.graph.subgraph(relevant_nodes)
        return nx.node_link_data(subgraph)

    def save_graph(self, path: str = "repo_graph.json"):
        data = nx.node_link_data(self.graph)
        
        formatted_nodes = []
        for node in data['nodes']:
            # Determine visual weight
            node_type = node.get('type', 'unknown')
            val = 20 if node_type == 'folder' else (
                  15 if node_type == 'file' else (
                  10 if node_type == 'class' else 5))
            
            formatted_nodes.append({
                "id": str(node['id']),
                "name": node.get('name', str(node['id'])),
                "type": node_type,
                "val": val,
                # Pass through any metadata (like git info we will add later)
                **{k: v for k, v in node.items() if k not in ['id', 'name', 'type']}
            })
            
        formatted_links = []
        for link in data['links']:
            formatted_links.append({
                "source": str(link['source']),
                "target": str(link['target']),
                "relation": link.get('relation', 'related')
            })

        with open(path, 'w') as f:
            json.dump({"nodes": formatted_nodes, "links": formatted_links}, f, indent=2)