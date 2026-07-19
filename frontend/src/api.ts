const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  description: string | null;
  html_url: string;
  default_branch: string;
}

export interface Branch {
  name: string;
  protected: boolean;
}

export interface FileNode {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface ReviewComment {
  line: number;
  severity: 'info' | 'warning' | 'error';
  category: 'bug' | 'style' | 'security' | 'performance' | 'documentation';
  message: string;
  suggestion?: string;
}

export interface FileReviewResult {
  file_path: string;
  comments: ReviewComment[];
  summary: string;
}

export interface ReviewResponse {
  files_reviewed: number;
  total_requested: number;
  limit_applied: boolean;
  results: FileReviewResult[];
}

export interface CompareResponse {
  repo_a: string;
  repo_b: string;
  total_files_a: number;
  total_files_b: number;
  shared_files_count: number;
  only_in_a_count: number;
  only_in_b_count: number;
  only_in_a: string[];
  only_in_b: string[];
  ai_comparison: string;
}

export interface DbCompareResponse {
  tables_only_in_a: string[];
  tables_only_in_b: string[];
  tables_in_both: string[];
  diffs: Record<string, {
    columns_only_in_a: string[];
    columns_only_in_b: string[];
    column_type_diffs: Array<{ column: string; a: string; b: string }>;
    column_nullability_diffs: Array<{ column: string; a: string; b: string }>;
    column_default_diffs: Array<{ column: string; a: string; b: string }>;
    pk_diff?: { a: string[]; b: string[] };
  }>;
  markdown_report: string;
}

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('github_token') || '';
  const geminiKey = localStorage.getItem('ai_api_key') || '';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) headers['X-Github-Token'] = token;
  if (geminiKey) headers['X-Ai-Apikey'] = geminiKey;
  
  return headers;
}

export interface BackendStatus {
  status: string;
  has_ai_key: boolean;
  model: string;
}

export async function fetchBackendStatus(): Promise<BackendStatus> {
  const response = await fetch(`${BASE_URL}/api/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch backend status');
  }
  return response.json();
}

export async function fetchRepositories(username?: string): Promise<Repository[]> {
  const headers = getHeaders();
  const url = username 
    ? `${BASE_URL}/api/repos?username=${encodeURIComponent(username)}`
    : `${BASE_URL}/api/repos`;
    
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch repositories' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function fetchBranches(owner: string, repo: string): Promise<Branch[]> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/repos/${owner}/${repo}/branches`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch branches' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function fetchRepoTree(owner: string, repo: string, branch: string = 'main'): Promise<FileNode[]> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/repos/${owner}/${repo}/tree?branch=${encodeURIComponent(branch)}`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch repo structure' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function requestReview(owner: string, repo: string, branch: string, files: string[]): Promise<ReviewResponse> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ owner, repo, branch, files }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to trigger review' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function compareRepositories(
  ownerA: string, repoA: string, branchA: string,
  ownerB: string, repoB: string, branchB: string
): Promise<CompareResponse> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/compare`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      repo_a: { owner: ownerA, repo: repoA, branch: branchA },
      repo_b: { owner: ownerB, repo: repoB, branch: branchB },
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to compare repositories' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}

export async function fetchFileContent(owner: string, repo: string, path: string, branch: string = 'main'): Promise<string> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/repos/${owner}/${repo}/content?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch)}`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch file content' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  const data = await response.json();
  return data.content;
}

export async function compareDatabases(
  schemaA: string,
  schemaB: string,
  nameA?: string,
  nameB?: string
): Promise<DbCompareResponse> {
  const headers = getHeaders();
  const response = await fetch(`${BASE_URL}/api/compare-db`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      schema_a: schemaA,
      schema_b: schemaB,
      name_a: nameA,
      name_b: nameB,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Failed to compare database schemas' }));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }
  return response.json();
}
