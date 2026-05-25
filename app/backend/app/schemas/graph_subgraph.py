"""Pydantic models for Focused View / teaching subgraph API."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class SubgraphRequest(BaseModel):
    query: str = Field(default="", max_length=500)
    depth: int = Field(default=2, ge=1, le=4)
    max_nodes: int = Field(default=120, ge=10, le=300)
    seed_k: int = Field(default=15, ge=1, le=30)
    layer: Optional[str] = Field(
        default=None,
        description="Optional layer id: api, service, data, ui, util, other",
    )
    include_functions: bool = Field(default=False)

    @model_validator(mode="after")
    def require_query_or_layer(self) -> "SubgraphRequest":
        if not self.query.strip() and not self.layer:
            raise ValueError("query or layer is required")
        return self


class MatchedSeed(BaseModel):
    nodeId: str
    score: float = Field(ge=0.0, le=1.0)


class ProjectMeta(BaseModel):
    name: str
    description: str
    languages: List[str] = Field(default_factory=list)
    frameworks: List[str] = Field(default_factory=list)
    analyzedAt: str = ""
    gitCommitHash: str = ""


class TeachingNodeDex(BaseModel):
    top_owner: Optional[str] = None
    bus_risk_score: Optional[float] = None
    last_author: Optional[str] = None
    api_route: Optional[str] = None
    infrastructure: Optional[bool] = None


class TeachingNode(BaseModel):
    id: str
    name: str
    type: str
    layer: str
    layerName: str
    color: str
    summary: str
    val: float = 12.0
    complexity: Literal["simple", "moderate", "complex"] = "moderate"
    tags: List[str] = Field(default_factory=list)
    filePath: Optional[str] = None
    lineRange: Optional[List[int]] = None
    dex: Optional[TeachingNodeDex] = None


class TeachingEdge(BaseModel):
    source: str
    target: str
    type: str
    direction: Literal["forward", "backward", "bidirectional"] = "forward"
    weight: float = Field(default=0.6, ge=0.0, le=1.0)
    description: Optional[str] = None


class LayerRef(BaseModel):
    id: str
    name: str
    description: str = ""
    color: str
    nodeIds: List[str] = Field(default_factory=list)


class SubgraphMeta(BaseModel):
    depth: int
    maxNodes: int
    truncated: bool = False
    nodeCount: int = 0
    edgeCount: int = 0
    elapsedMs: int = 0
    seedSource: Literal["vector", "keyword", "layer", "mixed"] = "vector"
    reason: Optional[str] = None


class SubgraphResponse(BaseModel):
    version: str = "1.0.0"
    view: Literal["focus"] = "focus"
    query: str = ""
    layer: Optional[str] = None
    project: ProjectMeta
    nodes: List[TeachingNode] = Field(default_factory=list)
    edges: List[TeachingEdge] = Field(default_factory=list)
    layers: List[LayerRef] = Field(default_factory=list)
    matched: List[MatchedSeed] = Field(default_factory=list)
    meta: SubgraphMeta
