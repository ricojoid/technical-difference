import httpx
from typing import List, Dict, Any, Optional

class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "GitHub-Code-Reviewer-App"
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

    async def _get(self, path: str, params: Optional[Dict[str, Any]] = None, raw: bool = False) -> Any:
        url = f"{self.base_url}{path}" if not path.startswith("http") else path
        
        # For raw contents, change Accept header
        headers = self.headers.copy()
        if raw:
            headers["Accept"] = "application/vnd.github.v3.raw"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, params=params, timeout=30.0)
            if response.status_code == 401:
                raise Exception("Unauthorized: Invalid GitHub token.")
            elif response.status_code == 403:
                # Handle rate limit
                rate_limit_reset = response.headers.get("X-RateLimit-Reset")
                raise Exception(f"Forbidden: GitHub API rate limit exceeded or access denied. Reset at {rate_limit_reset}")
            elif response.status_code == 404:
                raise Exception(f"Not Found: The resource at {path} could not be found.")
            
            response.raise_for_status()
            
            if raw:
                return response.text
            return response.json()

    async def get_user_repos(self) -> List[Dict[str, Any]]:
        """Fetch repositories for the authenticated user (token required)."""
        if not self.token:
            raise Exception("Authentication token is required to fetch authenticated user's repositories.")
        
        # We fetch repositories where the user is owner or collaborator, up to 100
        repos = await self._get("/user/repos", params={"per_page": 100, "sort": "updated"})
        return [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "owner": repo["owner"]["login"],
                "private": repo["private"],
                "description": repo["description"],
                "html_url": repo["html_url"],
                "default_branch": repo["default_branch"]
            }
            for repo in repos
        ]

    async def get_public_repos(self, username: str) -> List[Dict[str, Any]]:
        """Fetch public repositories for a specific user or org (no token required, but uses it if available)."""
        # Endpoint: /users/{username}/repos or /orgs/{org}/repos. Let's try users first, fallback to orgs if failed.
        try:
            repos = await self._get(f"/users/{username}/repos", params={"per_page": 100, "sort": "updated"})
        except Exception as e:
            if "Not Found" in str(e):
                # Try as organization
                repos = await self._get(f"/orgs/{username}/repos", params={"per_page": 100, "sort": "updated"})
            else:
                raise e
                
        return [
            {
                "id": repo["id"],
                "name": repo["name"],
                "full_name": repo["full_name"],
                "owner": repo["owner"]["login"],
                "private": repo["private"],
                "description": repo["description"],
                "html_url": repo["html_url"],
                "default_branch": repo["default_branch"]
            }
            for repo in repos
        ]

    async def get_branches(self, owner: str, repo: str) -> List[Dict[str, Any]]:
        """Fetch list of branches for a repository."""
        branches = await self._get(f"/repos/{owner}/{repo}/branches", params={"per_page": 100})
        return [{"name": b["name"], "protected": b["protected"]} for b in branches]

    async def get_repo_tree(self, owner: str, repo: str, branch: str) -> List[Dict[str, Any]]:
        """Fetch repository file tree recursively."""
        # Use git trees API to list all files recursively
        # First we need to get the commit SHA or branch ref to load the tree
        try:
            tree_data = await self._get(f"/repos/{owner}/{repo}/git/trees/{branch}", params={"recursive": "1"})
        except Exception as e:
            # Fallback if recursive trees fails or branch name is complex, try ref path
            raise Exception(f"Failed to fetch tree for branch '{branch}': {str(e)}")

        files = []
        ignored_extensions = {
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz',
            '.mp4', '.mp3', '.woff', '.woff2', '.ttf', '.eot', '.exe', '.dll', '.so',
            '.dylib', '.bin', '.db', '.sqlite', '.pyc', '.class', '.o', '.a'
        }
        ignored_directories = {
            'node_modules', '.git', '.github', 'dist', 'build', 'venv', '.venv',
            'env', '.env', '__pycache__', 'target', 'out', 'bin', 'obj', '.idea',
            '.vscode', '.agents'
        }

        for item in tree_data.get("tree", []):
            path = item.get("path", "")
            item_type = item.get("type", "")
            
            # Skip if it matches any ignored directories or files
            parts = path.split('/')
            if any(part in ignored_directories for part in parts):
                continue
                
            if item_type == "blob":
                # Check extension
                import os
                _, ext = os.path.splitext(path.lower())
                if ext in ignored_extensions:
                    continue
                
                files.append({
                    "path": path,
                    "type": "file",
                    "size": item.get("size", 0),
                    "sha": item.get("sha", "")
                })
            elif item_type == "tree":
                files.append({
                    "path": path,
                    "type": "dir"
                })

        return files

    async def get_file_content(self, owner: str, repo: str, branch: str, path: str) -> str:
        """Fetch raw content of a file."""
        return await self._get(f"/repos/{owner}/{repo}/contents/{path}", params={"ref": branch}, raw=True)
