import networkx as nx
import json
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from backend.app.core.config import settings

class GraphEngine:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0,
            groq_api_key=settings.GROQ_API_KEY
        )
        self.extraction_prompt = PromptTemplate.from_template(
            """
            Extract knowledge triples from the text below.
            Format: JSON list of objects with keys "head", "relation", "tail".
            Text: {text}
            Constraint: Return ONLY JSON. No markdown.
            """
        )

    def extract_and_build(self, text_chunks: list):
        for chunk in text_chunks:
            try:
                chain = self.extraction_prompt | self.llm
                response = chain.invoke({"text": chunk})
                triples = self._parse_json(response.content)
                
                for triple in triples:
                    self.graph.add_edge(
                        triple['head'], 
                        triple['tail'], 
                        relation=triple['relation']
                    )
            except Exception as e:
                continue
        
        return self.graph

    def _parse_json(self, content: str):
        cleaned = content.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)

    def get_context_subgraph(self, entities: list, depth: int = 1):
        nodes = set(entities)
        for _ in range(depth):
            neighbors = set()
            for node in nodes:
                if self.graph.has_node(node):
                    neighbors.update(self.graph.neighbors(node))
            nodes.update(neighbors)
        
        subgraph = self.graph.subgraph(nodes)
        return nx.node_link_data(subgraph)
    
    def save_graph(self, path: str = "knowledge_graph.json"):
        data = nx.node_link_data(self.graph)
        with open(path, 'w') as f:
            json.dump(data, f)