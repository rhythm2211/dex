"""Multi-repo workspaces."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.dependencies import get_db, get_user_id
from backend.app.models.engineering_models import Workspace, WorkspaceRepo

router = APIRouter()


class WorkspaceRepoIn(BaseModel):
    repo_full_name: str = Field(..., min_length=3, max_length=512)
    repo_clone_url: Optional[str] = None
    sort_order: int = 0


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    repos: List[WorkspaceRepoIn] = []


class WorkspaceOut(BaseModel):
    id: int
    name: str
    repos: List[dict]

    class Config:
        from_attributes = True


@router.get("/list", response_model=List[WorkspaceOut])
def list_workspaces(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    rows = db.query(Workspace).filter(Workspace.user_id == user_id).order_by(Workspace.id.desc()).all()
    out = []
    for w in rows:
        out.append(
            WorkspaceOut(
                id=w.id,
                name=w.name,
                repos=[
                    {
                        "repo_full_name": r.repo_full_name,
                        "repo_clone_url": r.repo_clone_url,
                        "sort_order": r.sort_order,
                    }
                    for r in (w.repos or [])
                ],
            )
        )
    return out


@router.post("/create", response_model=WorkspaceOut)
def create_workspace(body: WorkspaceCreate, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    w = Workspace(user_id=user_id, name=body.name.strip())
    db.add(w)
    db.flush()
    for r in body.repos:
        db.add(
            WorkspaceRepo(
                workspace_id=w.id,
                repo_full_name=r.repo_full_name.strip(),
                repo_clone_url=r.repo_clone_url,
                sort_order=r.sort_order,
            )
        )
    db.commit()
    db.refresh(w)
    return WorkspaceOut(
        id=w.id,
        name=w.name,
        repos=[
            {"repo_full_name": r.repo_full_name, "repo_clone_url": r.repo_clone_url, "sort_order": r.sort_order}
            for r in w.repos
        ],
    )


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    w = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == user_id).first()
    if not w:
        raise HTTPException(404, "Workspace not found")
    db.delete(w)
    db.commit()
    return {"status": "deleted"}


@router.get("/{workspace_id}/graph-summary")
def workspace_graph_summary(workspace_id: int, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    from backend.app.api.v1.router import get_ingestion_service

    w = db.query(Workspace).filter(Workspace.id == workspace_id, Workspace.user_id == user_id).first()
    if not w:
        raise HTTPException(404, "Workspace not found")
    try:
        ge = get_ingestion_service(user_id).graph_engine
    except Exception as e:
        raise HTTPException(503, str(e)) from e
    repos = [r.repo_full_name for r in (w.repos or [])]
    nodes = []
    links = []
    if ge.driver:
        try:
            with ge.driver.session(database=ge.database) as session:
                res = session.run(
                    """
                    MATCH (r:Repo {user_id: $user_id})
                    WHERE r.id IN $repos
                    OPTIONAL MATCH (r)-[e:SAME_WORKSPACE|DEPENDS_ON_PACKAGE]->(r2:Repo {user_id: $user_id})
                    RETURN r.id AS id, collect(DISTINCT r2.id) AS peers
                    """,
                    user_id=user_id,
                    repos=repos,
                )
                for rec in res:
                    nodes.append({"id": rec["id"], "type": "repo"})
                    for p in rec["peers"] or []:
                        if p:
                            links.append({"source": rec["id"], "target": p, "relation": "SAME_WORKSPACE"})
        except Exception:
            pass
    return {"workspace_id": workspace_id, "repos": repos, "nodes": nodes, "links": links}
