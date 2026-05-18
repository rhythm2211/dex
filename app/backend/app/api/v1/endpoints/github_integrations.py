"""Register GitHub repositories for webhook-driven PR intelligence."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.dependencies import get_db, get_user_id
from backend.app.models.engineering_models import GitHubRepoLink

router = APIRouter()


class GitHubRepoLinkCreate(BaseModel):
    owner: str = Field(..., min_length=1, max_length=255)
    repo: str = Field(..., min_length=1, max_length=255)
    installation_id: Optional[str] = None
    merge_block_critical: bool = True


class GitHubRepoLinkOut(BaseModel):
    owner: str
    repo: str
    installation_id: Optional[str] = None
    merge_block_critical: bool = True

    class Config:
        from_attributes = True


@router.get("/github/repos", response_model=List[GitHubRepoLinkOut])
def list_linked_repos(user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    rows = db.query(GitHubRepoLink).filter(GitHubRepoLink.user_id == user_id).all()
    return [
        GitHubRepoLinkOut(
            owner=r.owner,
            repo=r.repo,
            installation_id=r.installation_id,
            merge_block_critical=r.merge_block_critical,
        )
        for r in rows
    ]


@router.post("/github/repos", response_model=GitHubRepoLinkOut)
def link_repo(
    body: GitHubRepoLinkCreate,
    user_id: str = Depends(get_user_id),
    db: Session = Depends(get_db),
):
    owner = body.owner.strip()
    repo = body.repo.strip().removesuffix(".git")
    existing = (
        db.query(GitHubRepoLink)
        .filter(GitHubRepoLink.user_id == user_id, GitHubRepoLink.owner == owner, GitHubRepoLink.repo == repo)
        .first()
    )
    if existing:
        existing.installation_id = body.installation_id or existing.installation_id
        existing.merge_block_critical = body.merge_block_critical
        db.commit()
        db.refresh(existing)
        r = existing
    else:
        r = GitHubRepoLink(
            user_id=user_id,
            owner=owner,
            repo=repo,
            installation_id=body.installation_id,
            merge_block_critical=body.merge_block_critical,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
    return GitHubRepoLinkOut(
        owner=r.owner,
        repo=r.repo,
        installation_id=r.installation_id,
        merge_block_critical=r.merge_block_critical,
    )


@router.delete("/github/repos/{owner}/{repo}")
def unlink_repo(owner: str, repo: str, user_id: str = Depends(get_user_id), db: Session = Depends(get_db)):
    q = db.query(GitHubRepoLink).filter(
        GitHubRepoLink.user_id == user_id,
        GitHubRepoLink.owner == owner,
        GitHubRepoLink.repo == repo,
    )
    if q.delete():
        db.commit()
        return {"status": "removed"}
    raise HTTPException(404, "Link not found")
