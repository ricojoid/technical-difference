import os
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from github_client import GitHubClient
from reviewer import CodeReviewer, compare_database_schemas

# Load environment variables from .env if present
load_dotenv()

app = FastAPI(title="GitHub Code Reviewer API")

# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas for requests
class ReviewRequest(BaseModel):
    owner: str
    repo: str
    branch: str
    files: List[str]

class RepoCompareSpec(BaseModel):
    owner: str
    repo: str
    branch: str

class CompareRequest(BaseModel):
    repo_a: RepoCompareSpec
    repo_b: RepoCompareSpec

class DbCompareRequest(BaseModel):
    schema_a: str
    schema_b: str
    name_a: Optional[str] = "Database A (DEV)"
    name_b: Optional[str] = "Database B (PROD)"

@app.get("/api/status")
async def get_status():
    """Get backend status and configuration info."""
    ai_key = os.getenv("AI_API_KEY")
    has_ai_key = ai_key is not None and ai_key.lower() not in ("null", "undefined", "")
    return {
        "status": "online",
        "has_ai_key": has_ai_key,
        "model": os.getenv("AI_MODEL", "openai/Qwen3.6-35B"),
        "gateway_url": os.getenv("AI_GATEWAY_URL", "https://gateway.codepilot.my.id/v1")
    }

@app.get("/api/repos")
async def get_repos(
    username: Optional[str] = Query(None),
    x_github_token: Optional[str] = Header(None)
):
    """Retrieve repositories for the authenticated user or a public user/org."""
    token = x_github_token
    
    # If no token in header, check environment
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    client = GitHubClient(token=token)
    
    try:
        if token:
            # Fetch authenticated user's repos (including private)
            return await client.get_user_repos()
        elif username:
            # Fetch public repos for username
            return await client.get_public_repos(username)
        else:
            raise HTTPException(
                status_code=400,
                detail="Either GitHub Token header (X-GitHub-Token) or username query parameter must be provided."
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/repos/{owner}/{repo}/branches")
async def get_branches(
    owner: str,
    repo: str,
    x_github_token: Optional[str] = Header(None)
):
    """Fetch branches list for a repository."""
    token = x_github_token
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    client = GitHubClient(token=token)
    try:
        return await client.get_branches(owner, repo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/repos/{owner}/{repo}/tree")
async def get_repo_tree(
    owner: str,
    repo: str,
    branch: str = Query("main"),
    x_github_token: Optional[str] = Header(None)
):
    """Fetch files list in the repository tree recursively."""
    token = x_github_token
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    client = GitHubClient(token=token)
    try:
        return await client.get_repo_tree(owner, repo, branch)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/repos/{owner}/{repo}/content")
async def get_file_content(
    owner: str,
    repo: str,
    path: str = Query(...),
    branch: str = Query("main"),
    x_github_token: Optional[str] = Header(None)
):
    """Fetch raw file content from GitHub repository."""
    token = x_github_token
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    client = GitHubClient(token=token)
    try:
        content = await client.get_file_content(owner, repo, branch, path)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/review")
async def review_repository(
    request: ReviewRequest,
    x_github_token: Optional[str] = Header(None),
    x_gemini_apikey: Optional[str] = Header(None)
):
    """Review files in a repository and return comments."""
    token = x_github_token
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    gemini_key = x_gemini_apikey
    if not gemini_key or gemini_key == "null" or gemini_key == "undefined":
        gemini_key = os.getenv("GEMINI_API_KEY")

    client = GitHubClient(token=token)
    reviewer = CodeReviewer(api_key=gemini_key)
    
    results = []
    files_to_review = request.files
    
    for file_path in files_to_review:
        try:
            content = await client.get_file_content(request.owner, request.repo, request.branch, file_path)
            review_result = await reviewer.review_file(file_path, content)
            results.append(review_result)
        except Exception as e:
            results.append({
                "file_path": file_path,
                "comments": [{
                    "line": 0,
                    "severity": "error",
                    "category": "bug",
                    "message": f"Failed to fetch or review this file: {str(e)}"
                }],
                "summary": f"Review failed for file {file_path} due to error."
            })
            
    return {
        "files_reviewed": len(results),
        "total_requested": len(request.files),
        "limit_applied": False,
        "results": results
    }

def get_infrastructure_files(tree: List[Dict[str, Any]]) -> List[str]:
    # Key infrastructure and build config file patterns
    patterns = [
        r'(^|/)package\.json$',
        r'(^|/)requirements\.txt$',
        r'(^|/)go\.mod$',
        r'(^|/)pom\.xml$',
        r'(^|/)build\.gradle$',
        r'(^|/)Dockerfile$',
        r'(^|/)docker-compose\.yml$',
        r'(^|/)tsconfig\.json$',
        r'(^|/)vite\.config\.(ts|js)$',
        r'(^|/)\.github/workflows/.*\.ya?ml$',
        r'(^|/)composer\.json$',
        r'(^|/)cargo\.toml$'
    ]
    import re
    matches = []
    for item in tree:
        path = item.get("path", "")
        # Check if the path matches any of the patterns
        for pattern in patterns:
            if re.search(pattern, path, re.IGNORECASE):
                matches.append(path)
                break
    # Return all matched infrastructure configuration files without limit
    return matches

@app.post("/api/compare")
async def compare_repositories(
    request: CompareRequest,
    x_github_token: Optional[str] = Header(None),
    x_gemini_apikey: Optional[str] = Header(None)
):
    """Compare two repositories or branches."""
    token = x_github_token
    if not token or token == "null" or token == "undefined":
        token = os.getenv("GITHUB_TOKEN")
        
    gemini_key = x_gemini_apikey
    if not gemini_key or gemini_key == "null" or gemini_key == "undefined":
        gemini_key = os.getenv("GEMINI_API_KEY")

    client = GitHubClient(token=token)
    reviewer = CodeReviewer(api_key=gemini_key)

    try:
        # Fetch file trees for both repos
        tree_a = await client.get_repo_tree(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch)
        tree_b = await client.get_repo_tree(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch)
        
        # Scan for config files in both trees
        config_paths_a = get_infrastructure_files(tree_a)
        config_paths_b = get_infrastructure_files(tree_b)
        
        # Fetch content for config files in Repo A
        config_files_a = []
        for path in config_paths_a:
            try:
                content = await client.get_file_content(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch, path)
                config_files_a.append({"path": path, "content": content})
            except Exception as e:
                print(f"Failed to fetch config file content for {path} in Repo A: {e}")
                
        # Fetch content for config files in Repo B
        config_files_b = []
        for path in config_paths_b:
            try:
                content = await client.get_file_content(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch, path)
                config_files_b.append({"path": path, "content": content})
            except Exception as e:
                print(f"Failed to fetch config file content for {path} in Repo B: {e}")
                
        # Scan for modified files (shared files with different sha)
        files_dict_a = {f["path"]: f for f in tree_a}
        files_dict_b = {f["path"]: f for f in tree_b}
        shared_paths = set(files_dict_a.keys()) & set(files_dict_b.keys())
        
        modified_files = []
        for path in shared_paths:
            f_a = files_dict_a[path]
            f_b = files_dict_b[path]
            if f_a.get("type") == "file" and f_b.get("type") == "file":
                if f_a.get("sha") != f_b.get("sha"):
                    modified_files.append(path)
                    
        # Select up to 3 modified code files to compare in-depth
        code_extensions = {".py", ".js", ".ts", ".tsx", ".go", ".java", ".cpp", ".c", ".h", ".cs", ".php", ".rb"}
        modified_code_paths = [
            p for p in modified_files 
            if os.path.splitext(p.lower())[1] in code_extensions
        ][:3]
        
        modified_files_content = []
        for path in modified_code_paths:
            try:
                content_a = await client.get_file_content(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch, path)
                content_b = await client.get_file_content(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch, path)
                modified_files_content.append({
                    "path": path,
                    "content_a": content_a,
                    "content_b": content_b
                })
            except Exception as e:
                print(f"Failed to fetch content for modified file {path}: {e}")
                
        repo_a_fullname = f"{request.repo_a.owner}/{request.repo_a.repo}:{request.repo_a.branch}"
        repo_b_fullname = f"{request.repo_b.owner}/{request.repo_b.repo}:{request.repo_b.branch}"
        
        # Compare them
        comparison = await reviewer.compare_repositories(
            repo_a_files=tree_a,
            repo_b_files=tree_b,
            repo_a_name=repo_a_fullname,
            repo_b_name=repo_b_fullname,
            config_files_a=config_files_a,
            config_files_b=config_files_b,
            modified_files_content=modified_files_content
        )
        return comparison
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-db")
async def compare_db_schemas(request: DbCompareRequest):
    """Compare two DDL database schemas and identify gaps."""
    try:
        res = compare_database_schemas(
            schema_a=request.schema_a,
            schema_b=request.schema_b,
            name_a=request.name_a or "Database A (DEV)",
            name_b=request.name_b or "Database B (PROD)"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
