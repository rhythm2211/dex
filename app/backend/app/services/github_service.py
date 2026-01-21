"""
GitHub API service for fetching user contributions, repositories, and activity
"""
import logging
import requests
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from backend.app.core.config import settings

logger = logging.getLogger("dex-core")

class GitHubService:
    """Service for fetching GitHub user data"""
    
    def __init__(self):
        self.github_token = settings.GITHUB_TOKEN if hasattr(settings, 'GITHUB_TOKEN') else None
        self.base_url = "https://api.github.com"
        
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for GitHub API requests"""
        headers = {
            "Accept": "application/vnd.github.v3+json",
        }
        if self.github_token:
            headers["Authorization"] = f"Bearer {self.github_token}"
        return headers
    
    def get_user_contributions(self, username: str) -> Optional[Dict[str, Any]]:
        """
        Fetch user contribution graph data
        Note: GitHub doesn't provide a direct API for contribution graph,
        so we'll use repositories and events to estimate contributions
        """
        try:
            # Get user's public repositories
            repos_url = f"{self.base_url}/users/{username}/repos"
            repos_response = requests.get(
                repos_url,
                headers=self._get_headers(),
                params={"per_page": 100, "sort": "updated"},
                timeout=10
            )
            
            if repos_response.status_code != 200:
                logger.warning(f"Failed to fetch repos for {username}: {repos_response.status_code}")
                return None
            
            repos = repos_response.json()
            
            # Get user events to estimate contributions
            events_url = f"{self.base_url}/users/{username}/events/public"
            events_response = requests.get(
                events_url,
                headers=self._get_headers(),
                params={"per_page": 100},
                timeout=10
            )
            
            events = events_response.json() if events_response.status_code == 200 else []
            
            # Build contribution data (last 52 weeks)
            weeks = 52
            days_per_week = 7
            total_days = weeks * days_per_week
            contributions = [0] * total_days
            
            # Process events to count contributions per day
            today = datetime.utcnow().date()
            for event in events:
                if event.get("type") in ["PushEvent", "PullRequestEvent", "IssuesEvent", "CreateEvent"]:
                    event_date = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00")).date()
                    days_ago = (today - event_date).days
                    if 0 <= days_ago < total_days:
                        contributions[total_days - 1 - days_ago] += 1
            
            # Limit contributions to max 4 per day for visualization
            contributions = [min(c, 4) for c in contributions]
            
            return {
                "contributions": contributions,
                "total_contributions": sum(contributions),
                "repositories_count": len(repos),
            }
            
        except Exception as e:
            logger.error(f"Error fetching contributions for {username}: {str(e)}")
            return None
    
    def get_user_repositories(self, username: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch user's repositories"""
        try:
            url = f"{self.base_url}/users/{username}/repos"
            response = requests.get(
                url,
                headers=self._get_headers(),
                params={"per_page": limit, "sort": "updated", "direction": "desc"},
                timeout=10
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch repos for {username}: {response.status_code}")
                return []
            
            repos = response.json()
            return [
                {
                    "name": repo["name"],
                    "full_name": repo["full_name"],
                    "description": repo.get("description", ""),
                    "language": repo.get("language", ""),
                    "stars": repo.get("stargazers_count", 0),
                    "forks": repo.get("forks_count", 0),
                    "updated_at": repo.get("updated_at", ""),
                    "url": repo.get("html_url", ""),
                }
                for repo in repos[:limit]
            ]
            
        except Exception as e:
            logger.error(f"Error fetching repositories for {username}: {str(e)}")
            return []
    
    def get_user_stats(self, username: str) -> Optional[Dict[str, Any]]:
        """Fetch user statistics"""
        try:
            # Get user profile
            user_url = f"{self.base_url}/users/{username}"
            user_response = requests.get(user_url, headers=self._get_headers(), timeout=10)
            
            if user_response.status_code != 200:
                logger.warning(f"Failed to fetch user {username}: {user_response.status_code}")
                return None
            
            user_data = user_response.json()
            
            # Get repositories
            repos = self.get_user_repositories(username, limit=100)
            
            # Calculate stats
            total_stars = sum(repo.get("stars", 0) for repo in repos)
            total_forks = sum(repo.get("forks", 0) for repo in repos)
            
            # Get languages used
            languages = {}
            for repo in repos:
                if repo.get("language"):
                    lang = repo["language"]
                    languages[lang] = languages.get(lang, 0) + 1
            
            return {
                "username": user_data.get("login", username),
                "name": user_data.get("name", ""),
                "bio": user_data.get("bio", ""),
                "avatar_url": user_data.get("avatar_url", ""),
                "public_repos": user_data.get("public_repos", 0),
                "followers": user_data.get("followers", 0),
                "following": user_data.get("following", 0),
                "total_stars": total_stars,
                "total_forks": total_forks,
                "languages": languages,
                "created_at": user_data.get("created_at", ""),
            }
            
        except Exception as e:
            logger.error(f"Error fetching stats for {username}: {str(e)}")
            return None
    
    def get_repository_contributions(self, username: str) -> List[Dict[str, Any]]:
        """
        Get contribution breakdown by repository/folder
        This is an approximation based on repository activity
        """
        try:
            repos = self.get_user_repositories(username, limit=20)
            
            # Group by common folder patterns
            folder_stats: Dict[str, Dict[str, Any]] = {}
            
            for repo in repos:
                # Extract folder name from repo name (simple heuristic)
                folder_name = repo["name"].split("-")[0].split("_")[0]
                if folder_name not in folder_stats:
                    folder_stats[folder_name] = {
                        "name": folder_name,
                        "commits": 0,
                        "files": 0,
                        "repos": [],
                    }
                
                folder_stats[folder_name]["repos"].append(repo["name"])
                # Estimate commits based on repo activity (this is approximate)
                folder_stats[folder_name]["commits"] += max(1, repo.get("stars", 0) // 2)
                folder_stats[folder_name]["files"] += 10  # Approximate
            
            # Convert to list and sort by commits
            result = [
                {
                    "name": stats["name"],
                    "commits": stats["commits"],
                    "files": stats["files"],
                    "color": self._get_color_for_folder(stats["name"]),
                }
                for stats in folder_stats.values()
            ]
            
            result.sort(key=lambda x: x["commits"], reverse=True)
            return result[:10]  # Top 10
            
        except Exception as e:
            logger.error(f"Error fetching repository contributions for {username}: {str(e)}")
            return []
    
    def _get_color_for_folder(self, folder_name: str) -> str:
        """Assign color based on folder name"""
        colors = ["#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"]
        hash_val = sum(ord(c) for c in folder_name.lower())
        return colors[hash_val % len(colors)]
    
    def get_recent_activity(self, username: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent activity/events"""
        try:
            url = f"{self.base_url}/users/{username}/events/public"
            response = requests.get(
                url,
                headers=self._get_headers(),
                params={"per_page": limit},
                timeout=10
            )
            
            if response.status_code != 200:
                logger.warning(f"Failed to fetch events for {username}: {response.status_code}")
                return []
            
            events = response.json()
            
            activity = []
            for event in events[:limit]:
                event_type = event.get("type", "")
                created_at = event.get("created_at", "")
                
                # Format message based on event type
                message = self._format_event_message(event)
                
                activity.append({
                    "type": event_type.lower().replace("event", ""),
                    "message": message,
                    "time": created_at,
                    "repo": event.get("repo", {}).get("name", ""),
                })
            
            return activity
            
        except Exception as e:
            logger.error(f"Error fetching activity for {username}: {str(e)}")
            return []
    
    def _format_event_message(self, event: Dict[str, Any]) -> str:
        """Format event into human-readable message"""
        event_type = event.get("type", "")
        payload = event.get("payload", {})
        repo = event.get("repo", {}).get("name", "")
        
        if event_type == "PushEvent":
            commits = payload.get("commits", [])
            commit_count = len(commits)
            branch = payload.get("ref", "").replace("refs/heads/", "")
            return f"Pushed {commit_count} commit(s) to {branch}"
        elif event_type == "PullRequestEvent":
            action = payload.get("action", "")
            pr = payload.get("pull_request", {})
            title = pr.get("title", "pull request")
            return f"{action.capitalize()} pull request: {title}"
        elif event_type == "IssuesEvent":
            action = payload.get("action", "")
            issue = payload.get("issue", {})
            title = issue.get("title", "issue")
            return f"{action.capitalize()} issue: {title}"
        elif event_type == "CreateEvent":
            ref_type = payload.get("ref_type", "")
            ref = payload.get("ref", "")
            return f"Created {ref_type}: {ref}"
        else:
            return f"{event_type.replace('Event', '')} in {repo}"

# Global GitHub service instance
github_service = GitHubService()
