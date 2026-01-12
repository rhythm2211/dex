import networkx as nx
import json
import ast
import os
import logging
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class CodeStructureVisitor(ast.NodeVisitor):
    """
    Traverses the Python Abstract Syntax Tree (AST) to extract
    relationships (Classes, Functions) for the Deep Analysis phase.
    """
    def __init__(self, filename):
        self.filename = filename
        self.nodes = []
        self.edges = []
        # Stack to track where we are (e.g., inside Class A -> inside Function B)
        self.scope_stack = [filename] 

    def visit_ClassDef(self, node):
        class_name = node.name
        # Unique ID: filename::ClassName
        full_name = f"{self.filename}::{class_name}"
        
        self.nodes.append({
            "id": full_name,
            "type": "class",
            "name": class_name
        })
        
        # Link to Parent
        parent = self.scope_stack[-1]
        self.edges.append({
            "source": parent,
            "target": full_name,
            "relation": "DEFINES"
        })
        
        self.scope_stack.append(full_name)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_FunctionDef(self, node):
        func_name = node.name
        full_name = f"{self.scope_stack[-1]}::{func_name}"
        
        self.nodes.append({
            "id": full_name,
            "type": "function",
            "name": func_name
        })
        
        self.edges.append({
            "source": self.scope_stack[-1],
            "target": full_name,
            "relation": "CONTAINS"
        })
        
        self.generic_visit(node)

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
        """
        FAST TRACK (Phase 1): Builds graph from GitHub API JSON.
        Creates Folder and File nodes instantly.
        """
        for item in tree_data:
            path = item['path']
            
            # Filter noise - only visualize relevant code files
            if item['type'] == 'blob' and not any(path.endswith(ext) for ext in ['.py', '.ts', '.tsx', '.js', '.md', '.json']):
                continue

            item_type = item['type'] # 'blob' (file) or 'tree' (folder)
            node_type = "folder" if item_type == "tree" else "file"
            
            # Add Node
            self.graph.add_node(path, type=node_type, name=os.path.basename(path))
            
            # Link to parent folder
            if "/" in path:
                parent = os.path.dirname(path)
                # Ensure parent exists (GitHub tree usually contains parents, but safe guard)
                if parent not in self.graph:
                     self.graph.add_node(parent, type="folder", name=os.path.basename(parent))
                self.graph.add_edge(parent, path, relation="CONTAINS")
                
        return self.graph

    def extract_and_build(self, file_content: str, file_path: str):
        """
        DEEP TRACK (Phase 2): Enriches the graph using AST parsing.
        Adds Class and Function nodes to the existing File nodes.
        """
        # Ensure file node exists (if we skipped phase 1 or local ingestion)
        if file_path not in self.graph:
            self.graph.add_node(file_path, type="file", name=os.path.basename(file_path))

        visitor = CodeStructureVisitor(file_path)
        nodes, edges = visitor.process(file_content)
        
        for node in nodes:
            if node['id'] not in self.graph:
                self.graph.add_node(node['id'], **node)
        
        for edge in edges:
            self.graph.add_edge(edge['source'], edge['target'], relation=edge['relation'])

        return self.graph

    def save_graph(self, path: str = "repo_graph.json"):
        """
        Saves for React-Force-Graph-3D.
        """
        data = nx.node_link_data(self.graph)
        
        # 3D Visual Config
        formatted_nodes = []
        for node in data['nodes']:
            # Size logic for 3D Tree
            node_type = node.get('type', 'unknown')
            val = 20 if node_type == 'folder' else (
                  15 if node_type == 'file' else (
                  10 if node_type == 'class' else 5))
            
            formatted_nodes.append({
                "id": str(node['id']),
                "name": node.get('name', str(node['id'])),
                "type": node_type,
                "val": val,
                # Keep other props just in case
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