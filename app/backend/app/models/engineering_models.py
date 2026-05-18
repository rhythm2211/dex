"""
SQLAlchemy models for engineering-intelligence features (GitHub App, workspaces, digests).
Uses the same Base as users for a single metadata registry.
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship

from backend.app.models.user import Base


class GitHubRepoLink(Base):
    """Maps a GitHub owner/repo to a DEX user for webhook-driven PR reviews."""

    __tablename__ = "github_repo_links"
    __table_args__ = (UniqueConstraint("user_id", "owner", "repo", name="uq_github_repo_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner = Column(String(255), nullable=False)
    repo = Column(String(255), nullable=False)
    installation_id = Column(String(64), nullable=True)
    merge_block_critical = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    repos = relationship("WorkspaceRepo", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceRepo(Base):
    __tablename__ = "workspace_repos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    repo_full_name = Column(String(512), nullable=False)  # owner/repo
    repo_clone_url = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)

    workspace = relationship("Workspace", back_populates="repos")


class ArchitectureSnapshot(Base):
    """Weekly / on-demand counts of architecture violations for leadership trends."""

    __tablename__ = "architecture_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    week_start = Column(String(32), nullable=False)  # ISO date (Monday)
    violation_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("user_id", "week_start", name="uq_arch_snapshot_user_week"),)


class UserNotificationPrefs(Base):
    __tablename__ = "user_notification_prefs"

    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    weekly_digest_enabled = Column(Boolean, default=False)
    slack_webhook_url = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
