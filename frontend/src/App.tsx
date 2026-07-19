import { useState, useEffect, useMemo } from 'react';
import { 
  FolderGit2, 
  Settings, 
  GitBranch, 
  Folder, 
  File, 
  Play, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle2, 
  FileDiff, 
  Sparkles, 
  Search, 
  User, 
  RefreshCw,
  Eye,
  Info,
  Code,
  Database
} from 'lucide-react';
import { 
  fetchRepositories, 
  fetchBranches, 
  fetchRepoTree, 
  fetchFileContent, 
  requestReview, 
  compareRepositories,
  fetchBackendStatus,
  compareDatabases
} from './api';
import type {
  Repository,
  Branch,
  FileNode,
  ReviewResponse,
  CompareResponse,
  FileReviewResult,
  BackendStatus,
  DbCompareResponse
} from './api';

// Helper to construct folder structure from flat file path array
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: { [key: string]: TreeNode };
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'review' | 'compare' | 'db-compare'>('review');
  
  // Configuration
  const [githubToken, setGithubToken] = useState(localStorage.getItem('github_token') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  
  // Lists and Data
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  
  // Single Repo State
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [treeFiles, setTreeFiles] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Code Viewer State
  const [selectedFileToView, setSelectedFileToView] = useState<string | null>(null);
  const [viewedFileContent, setViewedFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  
  // Code Review State
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);
  const [activeFileReview, setActiveFileReview] = useState<FileReviewResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  
  // Repository Comparison State
  const [selectedRepoA, setSelectedRepoA] = useState<Repository | null>(null);
  const [selectedBranchA, setSelectedBranchA] = useState('');
  const [branchesA, setBranchesA] = useState<Branch[]>([]);
  
  const [selectedRepoB, setSelectedRepoB] = useState<Repository | null>(null);
  const [selectedBranchB, setSelectedBranchB] = useState('');
  const [branchesB, setBranchesB] = useState<Branch[]>([]);
  
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  
  // Database Schema Comparison State
  const [schemaA, setSchemaA] = useState('');
  const [schemaB, setSchemaB] = useState('');
  const [dbNameA, setDbNameA] = useState('DEV_DB');
  const [dbNameB, setDbNameB] = useState('PROD_DB');
  const [dbComparing, setDbComparing] = useState(false);
  const [dbCompareResult, setDbCompareResult] = useState<DbCompareResponse | null>(null);
  const [dbCompareError, setDbCompareError] = useState<string | null>(null);

  const loadSampleDbSchemas = () => {
    setDbNameA('DEV_DB (SQL Server)');
    setDbNameB('PROD_DB (SQL Server)');
    setSchemaA('mssql://sa:StrongPassword123@localhost:1433/dev_db');
    setSchemaB('mssql://sa:StrongPassword123@localhost:1433/prod_db');
  };

  const handleDbCompare = async () => {
    if (!schemaA.trim() || !schemaB.trim()) {
      setDbCompareError('Please enter connection strings for both databases.');
      return;
    }
    setDbComparing(true);
    setDbCompareError(null);
    setDbCompareResult(null);
    try {
      const res = await compareDatabases(schemaA, schemaB, dbNameA, dbNameB);
      setDbCompareResult(res);
    } catch (err: any) {
      setDbCompareError(err.message || 'Failed to compare database schemas.');
    } finally {
      setDbComparing(false);
    }
  };
  
  // Repo filter
  const [searchQuery, setSearchQuery] = useState('');

  // Backend status config
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);

  // Save Settings
  const saveSettings = () => {
    localStorage.setItem('github_token', githubToken);
    localStorage.setItem('gemini_api_key', geminiKey);
    setShowSettings(false);
    loadRepos();
    checkStatus();
  };

  // Load repositories and backend config on startup
  useEffect(() => {
    loadRepos();
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await fetchBackendStatus();
      setBackendStatus(status);
    } catch (err) {}
  };

  const loadRepos = async () => {
    setLoadingRepos(true);
    setReposError(null);
    try {
      // If we have token, fetch user repos. Otherwise, load public user repos if username exists
      const loaded = await fetchRepositories(usernameInput || undefined);
      setRepos(loaded);
      if (loaded.length > 0 && !selectedRepo) {
        handleSelectRepo(loaded[0]);
      }
    } catch (err: any) {
      setReposError(err.message || 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  // Select Single Repo
  const handleSelectRepo = async (repo: Repository) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    setCheckedFiles(new Set());
    setTreeFiles([]);
    setSelectedFileToView(null);
    setViewedFileContent(null);
    setReviewResult(null);
    setActiveFileReview(null);
    
    try {
      const bList = await fetchBranches(repo.owner, repo.name);
      setBranches(bList);
      
      // Fetch Tree
      loadTree(repo.owner, repo.name, repo.default_branch);
    } catch (err: any) {
      setReposError(err.message || 'Error loading repository branches');
    }
  };

  const loadTree = async (owner: string, name: string, branch: string) => {
    setLoadingTree(true);
    try {
      const files = await fetchRepoTree(owner, name, branch);
      setTreeFiles(files);
      // Auto-expand root folder
      const rootFolders = files
        .filter(f => f.type === 'dir' && !f.path.includes('/'))
        .map(f => f.path);
      setExpandedFolders(new Set(rootFolders));
    } catch (err: any) {
      setReviewError(`Failed to load file tree: ${err.message}`);
    } finally {
      setLoadingTree(false);
    }
  };

  // Handle branch change
  const handleBranchChange = (branch: string) => {
    setSelectedBranch(branch);
    setCheckedFiles(new Set());
    setSelectedFileToView(null);
    setViewedFileContent(null);
    if (selectedRepo) {
      loadTree(selectedRepo.owner, selectedRepo.name, branch);
    }
  };

  // Toggle Folder Expand
  const toggleFolder = (path: string) => {
    const next = new Set(expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setExpandedFolders(next);
  };

  // Toggle File Check for Review
  const toggleFileCheck = (path: string) => {
    const next = new Set(checkedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setCheckedFiles(next);
  };

  // View File content in main area
  const viewFile = async (path: string) => {
    if (!selectedRepo) return;
    setSelectedFileToView(path);
    setLoadingContent(true);
    setViewedFileContent(null);
    
    // Check if we already have review comments for this file to highlight
    if (reviewResult) {
      const fileRev = reviewResult.results.find(r => r.file_path === path);
      setActiveFileReview(fileRev || null);
    } else {
      setActiveFileReview(null);
    }

    try {
      const content = await fetchFileContent(selectedRepo.owner, selectedRepo.name, path, selectedBranch);
      setViewedFileContent(content);
    } catch (err: any) {
      setViewedFileContent(`// Error loading file content: ${err.message}`);
    } finally {
      setLoadingContent(false);
    }
  };

  // Perform Code Review
  const runCodeReview = async () => {
    if (!selectedRepo || checkedFiles.size === 0) return;
    setReviewing(true);
    setReviewError(null);
    setReviewResult(null);
    
    try {
      const result = await requestReview(
        selectedRepo.owner,
        selectedRepo.name,
        selectedBranch,
        Array.from(checkedFiles)
      );
      setReviewResult(result);
      
      // If viewing a file, update its active review
      if (selectedFileToView) {
        const fileRev = result.results.find(r => r.file_path === selectedFileToView);
        setActiveFileReview(fileRev || null);
      }
    } catch (err: any) {
      setReviewError(err.message || 'Failed to complete code review');
    } finally {
      setReviewing(false);
    }
  };

  // Handle repository selection for Compare mode
  const handleSelectRepoA = async (repo: Repository) => {
    setSelectedRepoA(repo);
    setSelectedBranchA(repo.default_branch);
    try {
      const bList = await fetchBranches(repo.owner, repo.name);
      setBranchesA(bList);
    } catch (err) {}
  };

  const handleSelectRepoB = async (repo: Repository) => {
    setSelectedRepoB(repo);
    setSelectedBranchB(repo.default_branch);
    try {
      const bList = await fetchBranches(repo.owner, repo.name);
      setBranchesB(bList);
    } catch (err) {}
  };

  // Compare repos
  const runComparison = async () => {
    if (!selectedRepoA || !selectedRepoB) return;
    setComparing(true);
    setCompareError(null);
    setCompareResult(null);
    try {
      const result = await compareRepositories(
        selectedRepoA.owner, selectedRepoA.name, selectedBranchA,
        selectedRepoB.owner, selectedRepoB.name, selectedBranchB
      );
      setCompareResult(result);
    } catch (err: any) {
      setCompareError(err.message || 'Failed to compare repositories');
    } finally {
      setComparing(false);
    }
  };

  // Construct nested tree structure from flat file array
  const nestedTree = useMemo(() => {
    const root: { [key: string]: TreeNode } = {};
    
    treeFiles.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = root;
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            path: currentPath,
            type: isLast ? file.type : 'dir',
            children: {}
          };
        }
        currentLevel = currentLevel[part].children;
      });
    });
    
    return root;
  }, [treeFiles]);

  // Render tree node component helper
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isDir = node.type === 'dir';
    const isExpanded = expandedFolders.has(node.path);
    const isChecked = checkedFiles.has(node.path);
    const isSelected = selectedFileToView === node.path;
    
    const childrenKeys = Object.keys(node.children);
    
    // Sort directory children first, then files
    const sortedKeys = childrenKeys.sort((a, b) => {
      const nodeA = node.children[a];
      const nodeB = node.children[b];
      if (nodeA.type === 'dir' && nodeB.type !== 'dir') return -1;
      if (nodeA.type !== 'dir' && nodeB.type === 'dir') return 1;
      return a.localeCompare(b);
    });

    return (
      <div key={node.path} style={{ userSelect: 'none' }}>
        <div 
          className={`tree-node ${!isDir ? 'file' : ''} ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => isDir ? toggleFolder(node.path) : viewFile(node.path)}
        >
          {isDir ? (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <input 
              type="checkbox" 
              className="tree-node-checkbox"
              checked={isChecked}
              onClick={(e) => e.stopPropagation()} 
              onChange={() => toggleFileCheck(node.path)}
            />
          )}
          
          {isDir ? (
            <Folder size={14} style={{ color: 'var(--accent-cyan)' }} />
          ) : (
            <File size={14} style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)' }} />
          )}
          
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        </div>
        
        {isDir && isExpanded && (
          <div>
            {sortedKeys.map(key => renderTreeNode(node.children[key], depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter repos based on search query
  const filteredRepos = useMemo(() => {
    return repos.filter(repo => 
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      repo.owner.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [repos, searchQuery]);

  // Code comments grouped by line number for fast lookup
  const commentsByLine = useMemo(() => {
    if (!activeFileReview) return {};
    const mapping: { [key: number]: typeof activeFileReview.comments } = {};
    activeFileReview.comments.forEach(comment => {
      const line = comment.line;
      if (!mapping[line]) mapping[line] = [];
      mapping[line].push(comment);
    });
    return mapping;
  }, [activeFileReview]);

  // Parse simple custom Markdown for AI Architectural report
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx}>{line.substring(4)}</h3>;
      }
      if (line.startsWith('#### ')) {
        return <h4 key={idx} style={{ color: 'var(--accent-cyan)', margin: '12px 0 6px 0', fontSize: '0.95rem' }}>{line.substring(5)}</h4>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        // Parse simple inline code
        const content = line.substring(2);
        return <li key={idx}>{parseInlineCode(content)}</li>;
      }
      if (line.trim() === '') return <br key={idx} />;
      return <p key={idx}>{parseInlineCode(line)}</p>;
    });
  };

  const parseInlineCode = (text: string) => {
    const parts = text.split('`');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <code key={i}>{part}</code>;
      }
      return part;
    });
  };

  // Quality metrics counts for selected file review summary
  const summaryCounts = useMemo(() => {
    if (!reviewResult) return { bugs: 0, warnings: 0, security: 0, filesCount: 0 };
    let bugs = 0;
    let warnings = 0;
    let security = 0;
    reviewResult.results.forEach(res => {
      res.comments.forEach(c => {
        if (c.category === 'bug') bugs++;
        else if (c.category === 'security') security++;
        else if (c.severity === 'warning') warnings++;
      });
    });
    return {
      bugs,
      warnings,
      security,
      filesCount: reviewResult.files_reviewed
    };
  }, [reviewResult]);

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <div className="sidebar">
        <div className="sidebar-header">
          <FolderGit2 className="logo-icon" size={28} />
          <span className="logo-text">GitReview.AI</span>
        </div>
        
        {/* Settings Toggle / Inputs */}
        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span className="sidebar-section-title" style={{ margin: 0 }}>Credentials</span>
            <button 
              className="tab-btn" 
              style={{ padding: 4, borderRadius: 4 }}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings size={16} />
            </button>
          </div>
          
          {(showSettings || !githubToken) && (
            <div style={{ padding: '4px 0 12px 0' }}>
              <div className="form-group">
                <label className="input-label">GitHub Token (PAT)</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={githubToken} 
                  placeholder="ghp_..."
                  onChange={(e) => setGithubToken(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label className="input-label">AI Gateway / Gemini API Key</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={geminiKey} 
                  placeholder="sk-..."
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
              </div>
              
              <button className="btn-primary" onClick={saveSettings} style={{ marginTop: 8 }}>
                Save Settings
              </button>
            </div>
          )}
          
          {!showSettings && githubToken && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <CheckCircle2 size={12} style={{ color: 'var(--severity-success)' }} />
              <span>Authentication saved locally</span>
            </div>
          )}
        </div>

        {/* Load Repos list */}
        <div className="sidebar-section">
          <span className="sidebar-section-title">GitHub Accounts / Org</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, position: 'relative' }}>
            <User size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: 30 }}
              placeholder="Username / Org (Public)"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRepos()}
            />
            <button 
              className="btn-secondary" 
              style={{ width: 'auto', padding: '10px' }}
              onClick={loadRepos}
              title="Load Repositories"
            >
              <RefreshCw size={16} className={loadingRepos ? 'spinner' : ''} />
            </button>
          </div>
          
          {reposError && (
            <div style={{ color: 'var(--severity-error)', fontSize: '0.8rem', marginBottom: 8, display: 'flex', gap: 6 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{reposError}</span>
            </div>
          )}

          {/* Repo List Search */}
          <div className="form-group repo-search" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input-field" 
              style={{ paddingLeft: 30 }}
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Repo List */}
          <div className="repo-list">
            {loadingRepos ? (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div className="spinner spinner-large" style={{ margin: '0 auto' }}></div>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 20 }}>
                No repositories found.
              </div>
            ) : (
              filteredRepos.map(repo => (
                <div 
                  key={repo.id}
                  className={`repo-item ${selectedRepo?.id === repo.id ? 'selected' : ''}`}
                  onClick={() => activeTab === 'review' ? handleSelectRepo(repo) : (selectedRepoA ? handleSelectRepoB(repo) : handleSelectRepoA(repo))}
                >
                  <div className="repo-item-header">
                    <span className="repo-name" title={repo.full_name}>{repo.name}</span>
                    <span className={`repo-badge ${repo.private ? 'private' : 'public'}`}>
                      {repo.private ? 'private' : 'public'}
                    </span>
                  </div>
                  {repo.description && <div className="repo-desc">{repo.description}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Info panel */}
        <div style={{ marginTop: 'auto', padding: 20, borderTop: '1px solid var(--border-light)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Review Mode:</span>
            {geminiKey ? (
              <span className="ai-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles size={10} /> Qwen 35B (Local)</span>
            ) : backendStatus?.has_ai_key ? (
              <span className="ai-badge" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)', borderColor: 'rgba(168, 85, 247, 0.3)' }}><Sparkles size={10} /> Qwen 35B (Server)</span>
            ) : (
              <span className="mock-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Info size={10} /> Mock Engine</span>
            )}
          </div>
          {backendStatus?.has_ai_key && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span>Model: {backendStatus.model}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="main-area">
        {/* Main Header navigation tabs */}
        <div className="main-header">
          <div className="active-repo-info">
            {activeTab === 'review' ? (
              selectedRepo ? (
                <>
                  <FolderGit2 size={20} style={{ color: 'var(--accent-cyan)' }} />
                  <span className="active-repo-title">{selectedRepo.owner} / {selectedRepo.name}</span>
                </>
              ) : (
                <span className="active-repo-title">Select a Repository</span>
              )
            ) : activeTab === 'compare' ? (
              <span className="active-repo-title">Compare Repositories</span>
            ) : (
              <span className="active-repo-title">Compare Databases</span>
            )}
          </div>

          <div className="header-tabs">
            <button 
              className={`tab-btn ${activeTab === 'review' ? 'active' : ''}`}
              onClick={() => setActiveTab('review')}
            >
              <Code size={16} />
              <span>Review Code</span>
            </button>
            
            <button 
              className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('compare')}
            >
              <FileDiff size={16} />
              <span>Compare Repos</span>
            </button>

            <button 
              className={`tab-btn ${activeTab === 'db-compare' ? 'active' : ''}`}
              onClick={() => setActiveTab('db-compare')}
            >
              <Database size={16} />
              <span>Compare DB</span>
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'review' ? (
          // Review Code View
          selectedRepo ? (
            <div className="review-grid">
              {/* Left Panel: Branch selector + File Tree */}
              <div className="review-left-panel">
                <div className="panel-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GitBranch size={16} />
                    <span>Branch</span>
                  </div>
                  <select 
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 4, padding: '2px 4px', fontSize: '0.8rem', outline: 'none' }}
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                  >
                    {branches.map(b => (
                      <option key={b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="file-tree-container">
                  {loadingTree ? (
                    <div style={{ textAlign: 'center', padding: 40 }}>
                      <div className="spinner spinner-large" style={{ margin: '0 auto' }}></div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 6 }}>
                        Select files to review:
                      </div>
                      {Object.keys(nestedTree).sort((a, b) => {
                        const nodeA = nestedTree[a];
                        const nodeB = nestedTree[b];
                        if (nodeA.type === 'dir' && nodeB.type !== 'dir') return -1;
                        if (nodeA.type !== 'dir' && nodeB.type === 'dir') return 1;
                        return a.localeCompare(b);
                      }).map(key => renderTreeNode(nestedTree[key]))}
                    </div>
                  )}
                </div>

                <div style={{ padding: 16, borderTop: '1px solid var(--border-light)' }}>
                  <button 
                    className="btn-primary" 
                    onClick={runCodeReview}
                    disabled={checkedFiles.size === 0 || reviewing}
                  >
                    {reviewing ? (
                      <>
                        <RefreshCw size={16} className="spinner" />
                        Reviewing ({checkedFiles.size})...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        Review Code ({checkedFiles.size})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Panel: Code Viewer and Review comments overlays */}
              <div className="code-viewer-container">
                {/* Floating summary of reviewed files */}
                {reviewResult && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', background: 'rgba(255, 255, 255, 0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Reviewed: <strong>{summaryCounts.filesCount}</strong> files
                      </span>
                      {summaryCounts.bugs > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--severity-error)' }}>
                          <strong>{summaryCounts.bugs}</strong> Bugs
                        </span>
                      )}
                      {summaryCounts.security > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--severity-error)', fontWeight: 600 }}>
                          <strong>{summaryCounts.security}</strong> Security
                        </span>
                      )}
                      {summaryCounts.warnings > 0 && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--severity-warning)' }}>
                          <strong>{summaryCounts.warnings}</strong> Warnings
                        </span>
                      )}
                    </div>
                    {reviewResult.limit_applied && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--severity-warning)' }}>
                        *Limited to first 10 files
                      </span>
                    )}
                  </div>
                )}

                {selectedFileToView ? (
                  <>
                    <div className="code-header">
                      <span>{selectedFileToView}</span>
                      {activeFileReview && (
                        <span className="ai-badge" style={{ fontSize: '0.7rem' }}>
                          Quality Summary loaded
                        </span>
                      )}
                    </div>
                    
                    {reviewError && (
                      <div style={{ margin: 16, padding: 12, background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', borderRadius: 8, display: 'flex', gap: 10, color: 'var(--severity-error)', fontSize: '0.85rem' }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>{reviewError}</span>
                      </div>
                    )}
                    
                    <div className="code-scroll-container">
                      {loadingContent ? (
                        <div className="empty-state">
                          <div className="spinner spinner-large"></div>
                          <h3>Loading File Content</h3>
                        </div>
                      ) : viewedFileContent !== null ? (
                        <div className="code-layout">
                          {/* Line numbers column */}
                          <div className="line-numbers">
                            {viewedFileContent.split('\n').map((_, i) => (
                              <div key={i + 1}>{i + 1}</div>
                            ))}
                          </div>
                          
                          {/* Code Lines column */}
                          <div className="code-lines">
                            {viewedFileContent.split('\n').map((line, idx) => {
                              const lineNum = idx + 1;
                              const comments = commentsByLine[lineNum];
                              const hasComments = comments && comments.length > 0;
                              
                              return (
                                <div key={idx} className={`code-line-wrapper ${hasComments ? 'has-comment' : ''}`}>
                                  <div className="code-line-text">{line || ' '}</div>
                                  {hasComments && comments.map((comment, cidx) => (
                                    <div 
                                      key={cidx} 
                                      className={`inline-comment-box ${comment.severity}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="comment-meta">
                                        <span className={`comment-badge ${comment.severity}`}>{comment.severity}</span>
                                        <span className="comment-category">{comment.category}</span>
                                      </div>
                                      <div className="comment-message">{comment.message}</div>
                                      {comment.suggestion && (
                                        <div>
                                          <div className="comment-suggestion-title">
                                            <Sparkles size={12} style={{ color: 'var(--accent-cyan)' }} />
                                            <span>Suggested Fix:</span>
                                          </div>
                                          <div className="comment-suggestion-code">{comment.suggestion}</div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <Eye className="empty-state-icon" size={48} />
                          <h3>Failed to load content</h3>
                        </div>
                      )}
                    </div>
                    
                    {/* File Level summary footer */}
                    {activeFileReview && (
                      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-light)', background: 'rgba(6, 182, 212, 0.05)', display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Sparkles size={18} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <strong>File Summary:</strong> {activeFileReview.summary}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state" style={{ height: '100%' }}>
                    <Eye className="empty-state-icon" size={48} />
                    <h3>No file viewed</h3>
                    <p style={{ maxWidth: 300, fontSize: '0.85rem', marginTop: 8 }}>
                      Select a file from the explorer tree on the left to display its contents.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="main-content">
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' }}>
                <FolderGit2 size={48} className="logo-icon" style={{ marginBottom: 20 }} />
                <h2>Welcome to GitReview.AI</h2>
                <p style={{ maxWidth: 460, color: 'var(--text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
                  Select or search your repositories in the sidebar list to get started. You can query any public repository by typing their GitHub username or authorize your account with a Personal Access Token to list your private repositories.
                </p>
              </div>
            </div>
          )
        ) : activeTab === 'compare' ? (
          // Compare Repos View
          <div className="main-content">
            <div className="compare-container">
              {/* Repo Selectors */}
              <div className="compare-selectors-grid">
                {/* Repo A Select */}
                <div className="compare-card">
                  <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: 'var(--accent-cyan)', width: 8, height: 8, borderRadius: '50%' }}></span>
                    Base Repository (Repo A)
                  </h3>
                  
                  {selectedRepoA ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10 }}>
                        {selectedRepoA.owner} / {selectedRepoA.name}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GitBranch size={14} style={{ color: 'var(--text-muted)' }} />
                        <select 
                          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 4, padding: '4px 6px', fontSize: '0.8rem', outline: 'none' }}
                          value={selectedBranchA}
                          onChange={(e) => setSelectedBranchA(e.target.value)}
                        >
                          {branchesA.map(b => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setSelectedRepoA(null)}>
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed var(--border-light)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                      Click on a repository card from the sidebar list to select Repo A.
                    </div>
                  )}
                </div>

                {/* Repo B Select */}
                <div className="compare-card">
                  <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: 'var(--accent-purple)', width: 8, height: 8, borderRadius: '50%' }}></span>
                    Target Repository (Repo B)
                  </h3>
                  
                  {selectedRepoB ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10 }}>
                        {selectedRepoB.owner} / {selectedRepoB.name}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GitBranch size={14} style={{ color: 'var(--text-muted)' }} />
                        <select 
                          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 4, padding: '4px 6px', fontSize: '0.8rem', outline: 'none' }}
                          value={selectedBranchB}
                          onChange={(e) => setSelectedBranchB(e.target.value)}
                        >
                          {branchesB.map(b => (
                            <option key={b.name} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setSelectedRepoB(null)}>
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', border: '1px dashed var(--border-light)', padding: 16, borderRadius: 8, textAlign: 'center' }}>
                      Click on a repository card from the sidebar list to select Repo B.
                    </div>
                  )}
                </div>
              </div>

              {/* Action Compare Button */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button 
                  className="btn-primary" 
                  style={{ width: 280, padding: 14 }}
                  onClick={runComparison}
                  disabled={!selectedRepoA || !selectedRepoB || comparing}
                >
                  {comparing ? (
                    <>
                      <RefreshCw size={18} className="spinner" />
                      Comparing Architectures...
                    </>
                  ) : (
                    <>
                      <FileDiff size={18} />
                      Compare Repositories
                    </>
                  )}
                </button>
              </div>

              {compareError && (
                <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: 16, borderRadius: 8, display: 'flex', gap: 10, color: 'var(--severity-error)' }}>
                  <AlertCircle size={18} />
                  <span>{compareError}</span>
                </div>
              )}

              {/* Compare Results Dashboard */}
              {compareResult && (
                <div className="glass-card">
                  <h3 className="card-title">
                    <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
                    Comparison Report
                  </h3>
                  
                  {/* File overlap statistics */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overlapping Files</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 4 }}>
                        {compareResult.shared_files_count}
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Only in Repo A</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-error)', marginTop: 4 }}>
                        {compareResult.only_in_a_count}
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Only in Repo B</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-success)', marginTop: 4 }}>
                        {compareResult.only_in_b_count}
                      </div>
                    </div>
                  </div>

                  {/* Structural changes details */}
                  <div className="diff-lists">
                    <div>
                      <div className="diff-title">
                        <span>Missing in Repo B (Removed)</span>
                      </div>
                      <div className="diff-panel">
                        {compareResult.only_in_a.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No differences.</div>
                        ) : (
                          compareResult.only_in_a.map(p => (
                            <div key={p} className="diff-item delete">{p}</div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="diff-title">
                        <span>New in Repo B (Added)</span>
                      </div>
                      <div className="diff-panel">
                        {compareResult.only_in_b.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No differences.</div>
                        ) : (
                          compareResult.only_in_b.map(p => (
                            <div key={p} className="diff-item add">{p}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI comparison content */}
                  <div style={{ marginTop: 32, borderTop: '1px solid var(--border-light)', paddingTop: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Architectural Review</h4>
                    </div>
                    
                    <div className="ai-markdown-report">
                      {renderMarkdown(compareResult.ai_comparison)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Compare Databases View (DEV vs PROD)
          <div className="main-content">
            <div className="compare-container">
              {/* Info Header */}
              <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Database Structure Gap Analyzer</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                    Compare database structures dynamically by pasting active connection strings (SQL Server, PostgreSQL, MySQL, SQLite). Heuristically analyzes tables, columns, types, and primary keys.
                  </p>
                </div>
                <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={loadSampleDbSchemas}>
                  💡 Load Sample Connection Strings
                </button>
              </div>

              {/* Input Layout */}
              <div className="compare-selectors-grid">
                {/* Schema A Panel */}
                <div className="compare-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'var(--accent-cyan)', width: 8, height: 8, borderRadius: '50%' }}></span>
                      Connection String A
                    </h3>
                    <input 
                      type="text" 
                      value={dbNameA} 
                      onChange={(e) => setDbNameA(e.target.value)}
                      placeholder="DEV_DB"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-primary)', width: 150 }}
                    />
                  </div>
                  <textarea
                    value={schemaA}
                    onChange={(e) => setSchemaA(e.target.value)}
                    placeholder="Enter connection string, e.g.&#10;• mssql://sa:password@localhost:1433/dev_db&#10;• sqlite:///C:/path/to/dev.sqlite&#10;• postgresql://postgres:pass@localhost:5432/dev_db"
                    style={{ height: 100, background: 'rgba(10, 15, 30, 0.4)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                </div>

                {/* Schema B Panel */}
                <div className="compare-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'var(--severity-success)', width: 8, height: 8, borderRadius: '50%' }}></span>
                      Connection String B
                    </h3>
                    <input 
                      type="text" 
                      value={dbNameB} 
                      onChange={(e) => setDbNameB(e.target.value)}
                      placeholder="PROD_DB"
                      style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-primary)', width: 150 }}
                    />
                  </div>
                  <textarea
                    value={schemaB}
                    onChange={(e) => setSchemaB(e.target.value)}
                    placeholder="Enter connection string, e.g.&#10;• mssql://sa:password@localhost:1433/prod_db&#10;• sqlite:///C:/path/to/prod.sqlite&#10;• postgresql://postgres:pass@localhost:5432/prod_db"
                    style={{ height: 100, background: 'rgba(10, 15, 30, 0.4)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button 
                  className="btn-primary" 
                  style={{ width: 280, padding: 14 }}
                  onClick={handleDbCompare}
                  disabled={dbComparing || !schemaA.trim() || !schemaB.trim()}
                >
                  {dbComparing ? (
                    <>
                      <RefreshCw size={18} className="spinner" />
                      Comparing Schemas...
                    </>
                  ) : (
                    <>
                      <Database size={18} />
                      Compare Database Gaps
                    </>
                  )}
                </button>
              </div>

              {/* Error Box */}
              {dbCompareError && (
                <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: 16, borderRadius: 8, display: 'flex', gap: 10, color: 'var(--severity-error)' }}>
                  <AlertCircle size={18} />
                  <span>{dbCompareError}</span>
                </div>
              )}

              {/* DB Compare Results Dashboard */}
              {dbCompareResult && (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <h3 className="card-title">
                    <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
                    Database Structure Gap Report
                  </h3>

                  {/* Summary Indicators */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Shared Tables</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 4 }}>
                        {dbCompareResult.tables_in_both.length}
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Only in {dbNameA}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-error)', marginTop: 4 }}>
                        {dbCompareResult.tables_only_in_a.length}
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Only in {dbNameB}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-success)', marginTop: 4 }}>
                        {dbCompareResult.tables_only_in_b.length}
                      </div>
                    </div>
                    <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tables with Gaps</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-warning, #f59e0b)', marginTop: 4 }}>
                        {Object.keys(dbCompareResult.diffs).length}
                      </div>
                    </div>
                  </div>

                  {/* Summary Lists */}
                  <div className="diff-lists">
                    <div>
                      <div className="diff-title">
                        <span>Missing in {dbNameB} (Tables only in {dbNameA})</span>
                      </div>
                      <div className="diff-panel">
                        {dbCompareResult.tables_only_in_a.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No unique tables.</div>
                        ) : (
                          dbCompareResult.tables_only_in_a.map(t => (
                            <div key={t} className="diff-item delete">{t}</div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="diff-title">
                        <span>New in {dbNameB} (Tables only in {dbNameB})</span>
                      </div>
                      <div className="diff-panel">
                        {dbCompareResult.tables_only_in_b.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No unique tables.</div>
                        ) : (
                          dbCompareResult.tables_only_in_b.map(t => (
                            <div key={t} className="diff-item add">{t}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Table-by-Table Breakdown */}
                  {Object.keys(dbCompareResult.diffs).length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, color: 'var(--text-primary)' }}>
                        Detailed Table Gaps
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {Object.entries(dbCompareResult.diffs).map(([tableName, diff]) => (
                          <div key={tableName} style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 16 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--accent-cyan)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Database size={14} />
                              <span>{tableName}</span>
                            </div>
                            
                            <ul style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 16, margin: 0, color: 'var(--text-secondary)' }}>
                              {diff.columns_only_in_a.map(c => (
                                <li key={c} style={{ color: 'var(--severity-error)' }}>
                                  ➕ Column only in <strong>{dbNameA}</strong>: <code>{c}</code>
                                </li>
                              ))}
                              {diff.columns_only_in_b.map(c => (
                                <li key={c} style={{ color: 'var(--severity-success)' }}>
                                  ➖ Column only in <strong>{dbNameB}</strong>: <code>{c}</code>
                                </li>
                              ))}
                              {diff.column_type_diffs.map(d => (
                                <li key={d.column}>
                                  ⚙️ Type mismatch on <code>{d.column}</code>: <code>{d.a}</code> in {dbNameA} vs <code>{d.b}</code> in {dbNameB}
                                </li>
                              ))}
                              {diff.column_nullability_diffs.map(d => (
                                <li key={d.column}>
                                  🔒 Nullability mismatch on <code>{d.column}</code>: <code>{d.a}</code> in {dbNameA} vs <code>{d.b}</code> in {dbNameB}
                                </li>
                              ))}
                              {diff.column_default_diffs.map(d => (
                                <li key={d.column}>
                                  📝 Default mismatch on <code>{d.column}</code>: <code>{d.a}</code> in {dbNameA} vs <code>{d.b}</code> in {dbNameB}
                                </li>
                              ))}
                              {diff.pk_diff && (
                                <li style={{ color: '#fbbf24' }}>
                                  🔑 Primary Key mismatch: <code>{diff.pk_diff.a.join(', ') || 'None'}</code> in {dbNameA} vs <code>{diff.pk_diff.b.join(', ') || 'None'}</code> in {dbNameB}
                                </li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Render Markdown Report */}
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Markdown Schema Audit Report</h4>
                    </div>
                    <div className="ai-markdown-report">
                      {renderMarkdown(dbCompareResult.markdown_report)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
