import os
import re
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from github_client import GitHubClient
from reviewer import CodeReviewer, compare_database_schemas

ENTRY_POINT_PATTERNS = [
    r'(^|/)main\.(py|go|ts|js|tsx|jsx|rs)$',
    r'(^|/)app\.(py|ts|js|tsx|jsx)$',
    r'(^|/)index\.(ts|js|tsx|jsx)$',
    r'(^|/)server\.(py|ts|js)$',
    r'(^|/)manage\.py$',
    r'(^|/)routes\.(py|ts|js)$',
    r'(^|/)router\.(py|ts|js)$',
]

load_dotenv()

app = FastAPI(title="GitHub Code Reviewer API")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def _resolve_token(header_val: Optional[str]) -> Optional[str]:
    if header_val and header_val not in ("null", "undefined", ""):
        return header_val
    return os.getenv("GITHUB_TOKEN")

def _resolve_ai_key(header_val: Optional[str]) -> Optional[str]:
    if header_val and header_val not in ("null", "undefined", ""):
        return header_val
    return os.getenv("AI_API_KEY")

@app.get("/api/status")
async def get_status():
    ai_key = os.getenv("AI_API_KEY")
    has_ai_key = bool(ai_key and ai_key.lower() not in ("null", "undefined", ""))
    return {
        "status": "online",
        "has_ai_key": has_ai_key,
        "model": os.getenv("AI_MODEL", "openai/Qwen3.6-35B"),
    }

@app.get("/api/repos")
async def get_repos(
    username: Optional[str] = Query(None),
    x_github_token: Optional[str] = Header(None)
):
    token = _resolve_token(x_github_token)
    client = GitHubClient(token=token)

    try:
        if token:
            return await client.get_user_repos()
        elif username:
            return await client.get_public_repos(username)
        else:
            raise HTTPException(
                status_code=400,
                detail="Either GitHub Token header or username query parameter must be provided."
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch repositories.")

@app.get("/api/repos/{owner}/{repo}/branches")
async def get_branches(
    owner: str,
    repo: str,
    x_github_token: Optional[str] = Header(None)
):
    client = GitHubClient(token=_resolve_token(x_github_token))
    try:
        return await client.get_branches(owner, repo)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch branches.")

@app.get("/api/repos/{owner}/{repo}/tree")
async def get_repo_tree(
    owner: str,
    repo: str,
    branch: str = Query("main"),
    x_github_token: Optional[str] = Header(None)
):
    client = GitHubClient(token=_resolve_token(x_github_token))
    try:
        return await client.get_repo_tree(owner, repo, branch)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch repository tree.")

@app.get("/api/repos/{owner}/{repo}/content")
async def get_file_content(
    owner: str,
    repo: str,
    path: str = Query(...),
    branch: str = Query("main"),
    x_github_token: Optional[str] = Header(None)
):
    client = GitHubClient(token=_resolve_token(x_github_token))
    try:
        content = await client.get_file_content(owner, repo, branch, path)
        return {"content": content}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch file content.")

@app.post("/api/review")
async def review_repository(
    request: ReviewRequest,
    x_github_token: Optional[str] = Header(None),
    x_ai_apikey: Optional[str] = Header(None)
):
    token = _resolve_token(x_github_token)
    ai_key = _resolve_ai_key(x_ai_apikey)

    client = GitHubClient(token=token)
    reviewer = CodeReviewer(api_key=ai_key)
    
    results = []
    for file_path in request.files:
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
    matches = []
    for item in tree:
        path = item.get("path", "")
        for pattern in patterns:
            if re.search(pattern, path, re.IGNORECASE):
                matches.append(path)
                break
    return matches

@app.post("/api/compare")
async def compare_repositories(
    request: CompareRequest,
    x_github_token: Optional[str] = Header(None),
    x_ai_apikey: Optional[str] = Header(None)
):
    token = _resolve_token(x_github_token)
    ai_key = _resolve_ai_key(x_ai_apikey)

    client = GitHubClient(token=token)
    reviewer = CodeReviewer(api_key=ai_key)

    try:
        tree_a = await client.get_repo_tree(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch)
        tree_b = await client.get_repo_tree(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch)
        
        config_paths_a = get_infrastructure_files(tree_a)
        config_paths_b = get_infrastructure_files(tree_b)
        
        config_files_a = []
        for path in config_paths_a:
            try:
                content = await client.get_file_content(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch, path)
                config_files_a.append({"path": path, "content": content})
            except Exception:
                pass
                
        config_files_b = []
        for path in config_paths_b:
            try:
                content = await client.get_file_content(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch, path)
                config_files_b.append({"path": path, "content": content})
            except Exception:
                pass
                
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
                    
        code_extensions = {".py", ".js", ".ts", ".tsx", ".go", ".java", ".cpp", ".c", ".h", ".cs", ".php", ".rb"}
        modified_code_paths = [
            p for p in modified_files 
            if os.path.splitext(p.lower())[1] in code_extensions
        ][:5]
        
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
            except Exception:
                pass

        def _find_entry_points(tree_files):
            paths = []
            for item in tree_files:
                p = item.get("path", "")
                for pattern in ENTRY_POINT_PATTERNS:
                    if re.search(pattern, p, re.IGNORECASE):
                        paths.append(p)
                        break
            return paths[:8]

        entry_paths_a = _find_entry_points(tree_a)
        entry_paths_b = _find_entry_points(tree_b)

        entry_files_a = []
        for path in entry_paths_a:
            try:
                content = await client.get_file_content(request.repo_a.owner, request.repo_a.repo, request.repo_a.branch, path)
                entry_files_a.append({"path": path, "content": content})
            except Exception:
                pass

        entry_files_b = []
        for path in entry_paths_b:
            try:
                content = await client.get_file_content(request.repo_b.owner, request.repo_b.repo, request.repo_b.branch, path)
                entry_files_b.append({"path": path, "content": content})
            except Exception:
                pass
                
        repo_a_fullname = f"{request.repo_a.owner}/{request.repo_a.repo}:{request.repo_a.branch}"
        repo_b_fullname = f"{request.repo_b.owner}/{request.repo_b.repo}:{request.repo_b.branch}"
        
        comparison = await reviewer.compare_repositories(
            repo_a_files=tree_a,
            repo_b_files=tree_b,
            repo_a_name=repo_a_fullname,
            repo_b_name=repo_b_fullname,
            config_files_a=config_files_a,
            config_files_b=config_files_b,
            modified_files_content=modified_files_content,
            entry_point_files_a=entry_files_a,
            entry_point_files_b=entry_files_b
        )
        return comparison
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to compare repositories.")

@app.post("/api/compare-db")
async def compare_db_schemas(request: DbCompareRequest):
    try:
        res = compare_database_schemas(
            schema_a=request.schema_a,
            schema_b=request.schema_b,
            name_a=request.name_a or "Database A (DEV)",
            name_b=request.name_b or "Database B (PROD)"
        )
        return res
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to compare database schemas.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
