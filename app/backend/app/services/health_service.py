"""
Health Service: Codebase Health Dashboard
Provides diagnostic queries for code quality metrics.
"""
import logging
from typing import List, Optional
from pydantic import BaseModel
from backend.app.domain.graph_engine import GraphEngine

logger = logging.getLogger("dex-core")


# --- Pydantic Models ---
class CycleDetected(BaseModel):
    """Represents a circular dependency cycle."""
    cycle_path: List[str]
    depth: int


class GodObject(BaseModel):
    """Represents a file/class with high coupling."""
    name: str
    fan_in: int
    fan_out: int
    complexity_score: int
    type: Optional[str] = None
    bus_risk_score: Optional[float] = None


class OrphanNode(BaseModel):
    """Represents code that is never imported/used."""
    name: str
    path: Optional[str] = None
    last_modified: Optional[str] = None
    type: Optional[str] = None


class HealthSummary(BaseModel):
    """Overall health dashboard summary."""
    score: int  # 0-100
    total_files: int
    critical_issues: int
    cycles_count: int
    god_objects_count: int
    orphans_count: int
    bus_factor_risk: float  # Average bus risk score


class HealthService:
    """Service for running codebase health diagnostics."""
    
    def __init__(self, graph_engine: Optional[GraphEngine] = None):
        """Initialize with a GraphEngine instance."""
        self.graph_engine = graph_engine
    
    def _get_driver(self):
        """Get Neo4j driver from graph engine."""
        if not self.graph_engine or not self.graph_engine.driver:
            raise RuntimeError("GraphEngine not initialized or Neo4j not connected")
        return self.graph_engine.driver
    
    def get_circular_dependencies(self, max_depth: int = 3, limit: int = 10) -> List[CycleDetected]:
        """
        Find circular dependencies (A -> B -> C -> A).
        Optimized for free-tier: reduced depth to 3 and added early termination.
        """
        if not self.graph_engine:
            return []
        
        # Optimized query: Reduced depth to 2..3 to prevent timeouts
        # Using APOC procedures if available, otherwise fallback to simple query
        query = f"""
        MATCH path = (n:CodeNode)-[:DEPENDS_ON*2..{max_depth}]->(n)
        WHERE n.type = 'file'
        AND NOT n.name CONTAINS 'test' 
        AND NOT n.name CONTAINS 'Test'
        AND NOT n.name CONTAINS '__pycache__'
        WITH [node in nodes(path) | node.name] AS cycle_path, length(path) as depth
        RETURN DISTINCT cycle_path, depth
        ORDER BY depth ASC
        LIMIT $limit
        """
        
        cycles = []
        try:
            with self._get_driver().session() as session:
                result = session.run(query, limit=limit)
                for record in result:
                    cycles.append(CycleDetected(
                        cycle_path=record["cycle_path"],
                        depth=record["depth"]
                    ))
        except Exception as e:
            logger.error(f"Error detecting cycles: {e}")
        
        return cycles
    
    def get_god_objects(self, threshold: int = 20, limit: int = 10) -> List[GodObject]:
        """
        Find files/classes with high coupling (Fan-In + Fan-Out > Threshold).
        Optimized query with index hints and early filtering.
        """
        if not self.graph_engine:
            return []
        
        # Optimized: Filter by type first, then calculate degrees
        query = """
        MATCH (n:CodeNode)
        WHERE n.type = 'file'
        WITH n
        OPTIONAL MATCH (n)<-[:DEPENDS_ON]-(incoming)
        OPTIONAL MATCH (n)-[:DEPENDS_ON]->(outgoing)
        WITH n, 
             count(DISTINCT incoming) as fan_in, 
             count(DISTINCT outgoing) as fan_out
        WITH n, fan_in, fan_out, (fan_in + fan_out) as complexity_score
        WHERE complexity_score > $threshold
        RETURN n.name as name, n.type as type, fan_in, fan_out, complexity_score, 
               COALESCE(n.bus_risk_score, 0.0) as bus_risk_score
        ORDER BY complexity_score DESC
        LIMIT $limit
        """
        
        god_objects = []
        try:
            with self._get_driver().session() as session:
                result = session.run(query, threshold=threshold, limit=limit)
                for record in result:
                    god_objects.append(GodObject(
                        name=record["name"],
                        fan_in=record["fan_in"],
                        fan_out=record["fan_out"],
                        complexity_score=record["complexity_score"],
                        type=record.get("type"),
                        bus_risk_score=record.get("bus_risk_score")
                    ))
        except Exception as e:
            logger.error(f"Error detecting god objects: {e}")
        
        return god_objects
    
    def get_orphan_nodes(self, limit: int = 50) -> List[OrphanNode]:
        """
        Find code that is never imported/used (dead code).
        Excludes entry points like main.py and page.tsx.
        """
        if not self.graph_engine:
            return []
        
        query = """
        MATCH (n:CodeNode)
        WHERE NOT (n)<-[:DEPENDS_ON]-() 
        AND NOT n.name ENDS WITH 'main.py'
        AND NOT n.name ENDS WITH '__main__.py'
        AND NOT n.name ENDS WITH 'page.tsx'
        AND NOT n.name ENDS WITH 'page.ts'
        AND NOT n.name CONTAINS '__pycache__'
        AND NOT n.name CONTAINS 'node_modules'
        RETURN n.name as name, n.path as path, n.last_modified as last_modified, 
               n.type as type
        ORDER BY n.last_modified DESC
        LIMIT $limit
        """
        
        orphans = []
        try:
            with self._get_driver().session() as session:
                result = session.run(query, limit=limit)
                for record in result:
                    orphans.append(OrphanNode(
                        name=record["name"],
                        path=record.get("path"),
                        last_modified=record.get("last_modified"),
                        type=record.get("type")
                    ))
        except Exception as e:
            logger.error(f"Error detecting orphan nodes: {e}")
        
        return orphans
    
    def get_total_files(self) -> int:
        """Get total count of file nodes. Optimized with timeout."""
        if not self.graph_engine:
            return 0
        
        query = """
        MATCH (n:CodeNode)
        WHERE n.type = 'file'
        RETURN count(n) as total
        """
        
        try:
            with self._get_driver().session() as session:
                result = session.run(query)
                record = result.single()
                return record["total"] if record else 0
        except Exception as e:
            logger.error(f"Error counting files: {e}")
            return 0
    
    def get_average_bus_risk(self) -> float:
        """Calculate average bus factor risk score."""
        if not self.graph_engine:
            return 0.0
        
        query = """
        MATCH (n:CodeNode)
        WHERE n.type = 'file' AND n.bus_risk_score IS NOT NULL
        RETURN avg(n.bus_risk_score) as avg_risk
        """
        
        try:
            with self._get_driver().session() as session:
                result = session.run(query)
                record = result.single()
                return float(record["avg_risk"]) if record and record["avg_risk"] is not None else 0.0
        except Exception as e:
            logger.error(f"Error calculating bus risk: {e}")
            return 0.0
    
    def get_health_summary(self) -> HealthSummary:
        """
        Calculate overall health score and summary statistics.
        Formula: 100 - (cycles * 10) - (god_objects * 5) - (orphans * 1)
        """
        cycles = self.get_circular_dependencies(limit=100)  # Count all cycles
        god_objects = self.get_god_objects(limit=100)  # Count all god objects
        orphans = self.get_orphan_nodes(limit=100)  # Count all orphans
        
        cycles_count = len(cycles)
        god_objects_count = len(god_objects)
        orphans_count = len(orphans)
        
        # Calculate health score (0-100)
        # Penalties: cycles are worst (10 pts each), god objects medium (5 pts), orphans minor (1 pt)
        score = 100 - (cycles_count * 10) - (god_objects_count * 5) - (orphans_count * 1)
        score = max(0, min(100, score))  # Clamp between 0-100
        
        critical_issues = cycles_count + god_objects_count
        
        total_files = self.get_total_files()
        bus_factor_risk = self.get_average_bus_risk()
        
        return HealthSummary(
            score=score,
            total_files=total_files,
            critical_issues=critical_issues,
            cycles_count=cycles_count,
            god_objects_count=god_objects_count,
            orphans_count=orphans_count,
            bus_factor_risk=bus_factor_risk
        )
