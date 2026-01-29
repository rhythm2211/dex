# Blast Radius Dashboard Endpoint - Usage Guide

## 📍 Where to Access

The new blast radius dashboard endpoint is available in two places:

### 1. **Backend API Endpoint**
```
GET /api/v1/dashboard/blast-radius/{node_id}
```

**Example:**
```bash
curl http://localhost:8000/api/v1/dashboard/blast-radius/path/to/file.py
```

### 2. **Frontend API Method**
Located in: `frontend/src/lib/api.ts`

**Method:** `dexApi.getBlastRadiusDashboard(nodeId: string)`

---

## 🚀 How to Use in Frontend

### Option 1: Use in BlastRadiusGraph Component (Already Updated!)

The `BlastRadiusGraph` component now automatically fetches dashboard stats. Just use it:

```tsx
import BlastRadiusGraph from '@/components/BlastRadiusGraph';

// In your component
<BlastRadiusGraph nodeId="path/to/file.py" onClose={() => {}} />
```

### Option 2: Use Standalone in Any Component

```tsx
"use client";

import { useEffect, useState } from 'react';
import { dexApi } from '@/lib/api';

export default function MyDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const data = await dexApi.getBlastRadiusDashboard('path/to/file.py');
        setDashboard(data);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchDashboard();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!dashboard) return <div>No data</div>;

  return (
    <div>
      <h2>Blast Radius Dashboard</h2>
      <div>
        <p>Total Nodes: {dashboard.totalNodes}</p>
        <p>Direct Impact: {dashboard.directImpact}</p>
        <p>Indirect Impact: {dashboard.indirectImpact}</p>
        <p>High Risk Nodes: {dashboard.highRiskNodes}</p>
        <p>Average Bus Risk: {(dashboard.avgBusRisk * 100).toFixed(1)}%</p>
        
        <h3>Top Contributors</h3>
        <ul>
          {dashboard.topContributors.map((contrib, idx) => (
            <li key={idx}>
              {contrib.author}: {contrib.commits} commits
            </li>
          ))}
        </ul>
        
        <h3>Most Risky Nodes</h3>
        <ul>
          {dashboard.mostRiskyNodes.map((node, idx) => (
            <li key={idx}>
              {node.name}: {(node.busRiskScore * 100).toFixed(1)}% risk
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### Option 3: Use in Evolution Page

Update `frontend/src/app/evolution/page.tsx`:

```tsx
// Add state for dashboard
const [dashboardStats, setDashboardStats] = useState(null);

// In handleNodeClick, fetch dashboard stats
const handleNodeClick = async (node: any) => {
  setSelectedNode(node);
  setViewMode('impact');
  
  // Fetch both impact graph and dashboard stats
  const [impactData, dashboard] = await Promise.all([
    dexApi.getImpactGraph(node.id),
    dexApi.getBlastRadiusDashboard(node.id)
  ]);
  
  setImpactGraph(impactData);
  setDashboardStats(dashboard);
  
  // ... rest of your code
};

// Display dashboard stats in UI
{dashboardStats && (
  <div className="absolute top-20 left-6 z-10 bg-[#0a0a0a]/95 p-4 rounded-lg border border-white/10">
    <h3 className="text-sm font-bold mb-2">Blast Radius Stats</h3>
    <p className="text-xs">Total Impact: {dashboardStats.totalNodes}</p>
    <p className="text-xs">High Risk: {dashboardStats.highRiskNodes}</p>
  </div>
)}
```

---

## 📊 Response Structure

The dashboard endpoint returns:

```typescript
{
  sourceNode: {
    id: string;
    name: string;
    type: string;
    busRiskScore: number;
    commitCount: number;
    lastAuthor: string;
    topOwner: string;
    lastModified: string;
  };
  totalNodes: number;
  directImpact: number;
  indirectImpact: number;
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  avgBusRisk: number;  // 0.0 to 1.0
  highRiskNodes: number;
  totalCommits: number;
  totalEdges: number;
  topContributors: Array<{
    author: string;
    commits: number;
  }>;
  mostRiskyNodes: Array<{
    id: string;
    name: string;
    type: string;
    busRiskScore: number;
    topOwner: string;
  }>;
  nodeTypeBreakdown: {
    file: number;
    function: number;
    class: number;
    other: number;
  };
  impactDistribution: {
    source: number;    // Always 1
    direct: number;
    indirect: number;
  };
}
```

---

## 🎯 Quick Examples

### Get Dashboard Stats Only (No Graph)
```tsx
const stats = await dexApi.getBlastRadiusDashboard('backend/app/main.py');
console.log(`Impact: ${stats.totalNodes} nodes`);
console.log(`Risk: ${stats.highRiskNodes} high-risk nodes`);
```

### Compare Multiple Files
```tsx
const [file1, file2] = await Promise.all([
  dexApi.getBlastRadiusDashboard('file1.py'),
  dexApi.getBlastRadiusDashboard('file2.py')
]);

console.log(`File1 impact: ${file1.totalNodes}`);
console.log(`File2 impact: ${file2.totalNodes}`);
```

### Show Top Risky Files
```tsx
const dashboard = await dexApi.getBlastRadiusDashboard('some-file.py');
const topRisky = dashboard.mostRiskyNodes.slice(0, 5);

topRisky.forEach(node => {
  console.log(`${node.name}: ${(node.busRiskScore * 100).toFixed(1)}% risk`);
});
```

---

## 📁 File Locations

- **Backend Endpoint:** `app/backend/app/api/v1/router.py` (line ~248)
- **Frontend API Method:** `frontend/src/lib/api.ts` (line ~423)
- **Component Using It:** `frontend/src/components/BlastRadiusGraph.tsx` (updated)

---

## ✅ Benefits

1. **Faster Loading:** Dashboard stats load independently of graph data
2. **Better UX:** Show stats immediately while graph loads
3. **Flexible:** Use dashboard stats without loading the full graph
4. **Rich Data:** Includes top contributors, risky nodes, and breakdowns
