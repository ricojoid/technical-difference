import { useState, useEffect, useMemo, useRef } from 'react';
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
  compareDatabases,
  listDatabases
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

function errMsg(err: unknown): string {
  return err instanceof Error ? errMsg(err) : 'An unexpected error occurred';
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: { [key: string]: TreeNode };
}

function ProcDiffView({ name, diff, dbNameA, dbNameB }: { name: string; diff: { a: string; b: string }; dbNameA: string; dbNameB: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 16 }}>
      <div 
        style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--accent-purple, #a855f7)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Database size={14} />
          <span>Procedure: <code>{name}</code></span>
        </div>
        <button className="btn-secondary" style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem' }}>
          {expanded ? "Hide Code" : "Compare SQL Code"}
        </button>
      </div>
      
      {expanded && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>{dbNameA} Code</div>
            <pre style={{ background: 'var(--bg-code, #0b0f19)', padding: 12, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-light)' }}>
              {diff.a || '/* Empty or Undefined */'}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>{dbNameB} Code</div>
            <pre style={{ background: 'var(--bg-code, #0b0f19)', padding: 12, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-light)' }}>
              {diff.b || '/* Empty or Undefined */'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function HackerGlobeBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let rotation = 0;
    const globeRadius = Math.min(width, height) * 0.38;
    
    const points: Array<{ theta: number; phi: number; size: number; pulse: number; speed: number }> = [];
    for (let i = 0; i < 40; i++) {
      points.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.acos(Math.random() * 2 - 1),
        size: Math.random() * 3 + 1,
        pulse: Math.random() * Math.PI,
        speed: Math.random() * 0.05 + 0.01
      });
    }

    let radarAngle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.75;
      const cy = height * 0.55;

      rotation += 0.002;
      radarAngle += 0.008;

      ctx.strokeStyle = 'rgba(21, 128, 61, 0.06)';
      ctx.lineWidth = 1;
      
      for (let r = globeRadius * 0.2; r <= globeRadius * 1.25; r += globeRadius * 0.25) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(cx - globeRadius * 1.3, cy);
      ctx.lineTo(cx + globeRadius * 1.3, cy);
      ctx.moveTo(cx, cy - globeRadius * 1.3);
      ctx.lineTo(cx, cy + globeRadius * 1.3);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(21, 128, 61, 0.08)';
      ctx.lineWidth = 1;

      for (let i = -4; i <= 4; i++) {
        const r = globeRadius * Math.sin(Math.acos(i / 5));
        const y = cy + globeRadius * (i / 5);
        ctx.beginPath();
        ctx.ellipse(cx, y, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < 6; i++) {
        const angle = rotation + (i * Math.PI) / 6;
        const rx = globeRadius * Math.abs(Math.sin(angle));
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, globeRadius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      points.forEach(p => {
        p.pulse += p.speed;
        
        const phi = p.phi;
        const theta = p.theta + rotation;
        
        const x = cx + globeRadius * Math.sin(phi) * Math.sin(theta);
        const y = cy + globeRadius * Math.cos(phi);
        const z = Math.sin(phi) * Math.cos(theta);
        
        if (z > -0.2) {
          const alpha = 0.15 + 0.5 * Math.abs(Math.sin(p.pulse));
          ctx.fillStyle = `rgba(21, 128, 61, ${alpha})`;
          ctx.beginPath();
          const ptSize = p.size * (1 + z * 0.3);
          ctx.arc(x, y, ptSize, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      const rx = cx + globeRadius * 1.3 * Math.cos(radarAngle);
      const ry = cy + globeRadius * 1.3 * Math.sin(radarAngle);
      ctx.strokeStyle = 'rgba(21, 128, 61, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      const scanSize = 35;
      const sx = cx + globeRadius * 0.65 * Math.cos(radarAngle * 0.4);
      const sy = cy + globeRadius * 0.45 * Math.sin(radarAngle * 0.4);
      ctx.strokeStyle = 'rgba(21, 128, 61, 0.25)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(sx - scanSize, sy - scanSize + 8);
      ctx.lineTo(sx - scanSize, sy - scanSize);
      ctx.lineTo(sx - scanSize + 8, sy - scanSize);
      
      ctx.moveTo(sx + scanSize, sy - scanSize + 8);
      ctx.lineTo(sx + scanSize, sy - scanSize);
      ctx.lineTo(sx + scanSize - 8, sy - scanSize);
      
      ctx.moveTo(sx - scanSize, sy + scanSize - 8);
      ctx.lineTo(sx - scanSize, sy + scanSize);
      ctx.lineTo(sx - scanSize + 8, sy + scanSize);
      
      ctx.moveTo(sx + scanSize, sy + scanSize - 8);
      ctx.lineTo(sx + scanSize, sy + scanSize);
      ctx.lineTo(sx + scanSize - 8, sy + scanSize);
      ctx.stroke();

      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(21, 128, 61, 0.4)';
      ctx.fillText('RADAR LOCK', sx + scanSize + 6, sy - scanSize + 12);
      ctx.fillText(`AZ: ${(radarAngle % (Math.PI * 2)).toFixed(2)}RAD`, sx + scanSize + 6, sy - scanSize + 24);

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        display: 'block'
      }}
    />
  );
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'review' | 'compare' | 'db-compare'>('review');
  
  // Configuration
  const [githubToken, setGithubToken] = useState(localStorage.getItem('github_token') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('ai_api_key') || '');
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

  // File Diff View State
  const [diffingFilePath, setDiffingFilePath] = useState<string | null>(null);
  const [diffContentA, setDiffContentA] = useState<string>('');
  const [diffContentB, setDiffContentB] = useState<string>('');
  const [loadingDiff, setLoadingDiff] = useState<boolean>(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  
  // Database Schema Comparison State
  const [schemaA, setSchemaA] = useState('');
  const [schemaB, setSchemaB] = useState('');
  const [dbNameA, setDbNameA] = useState('DEV_DB');
  const [dbNameB, setDbNameB] = useState('PROD_DB');
  const [dbComparing, setDbComparing] = useState(false);
  const [dbCompareResult, setDbCompareResult] = useState<DbCompareResponse | null>(null);
  const [dbCompareError, setDbCompareError] = useState<string | null>(null);

  // New SSMS-style connection state
  const [isAdvancedConnStr, setIsAdvancedConnStr] = useState(false);
  
  // Database A Server Fields
  const [dbTypeA, setDbTypeA] = useState('mssql');
  const [dbHostA, setDbHostA] = useState('localhost');
  const [dbPortA, setDbPortA] = useState<number | undefined>(1433);
  const [dbUserA, setDbUserA] = useState('sa');
  const [dbPassA, setDbPassA] = useState('');
  const [sqlitePathA, setSqlitePathA] = useState('');
  const [dbListA, setDbListA] = useState<string[]>([]);
  const [selectedDbA, setSelectedDbA] = useState('');
  const [connectingA, setConnectingA] = useState(false);
  const [connErrorA, setConnErrorA] = useState<string | null>(null);

  // Database B Server Fields
  const [dbTypeB, setDbTypeB] = useState('mssql');
  const [dbHostB, setDbHostB] = useState('localhost');
  const [dbPortB, setDbPortB] = useState<number | undefined>(1433);
  const [dbUserB, setDbUserB] = useState('sa');
  const [dbPassB, setDbPassB] = useState('');
  const [sqlitePathB, setSqlitePathB] = useState('');
  const [dbListB, setDbListB] = useState<string[]>([]);
  const [selectedDbB, setSelectedDbB] = useState('');
  const [connectingB, setConnectingB] = useState(false);
  const [connErrorB, setConnErrorB] = useState<string | null>(null);

  const buildConnectionString = (
    type: string,
    host: string,
    port: number | undefined,
    user: string,
    pass: string,
    selectedDb: string,
    sqlitePath: string
  ) => {
    if (type === 'sqlite') {
      return `sqlite:///${sqlitePath}`;
    }
    const portPart = port ? `:${port}` : '';
    const credentialsPart = user || pass 
      ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` 
      : '';
    return `${type}://${credentialsPart}${host}${portPart}/${selectedDb}`;
  };

  const handleDbTypeChangeA = (type: string) => {
    setDbTypeA(type);
    if (type === 'mssql') setDbPortA(1433);
    else if (type === 'postgresql' || type === 'postgres') setDbPortA(5432);
    else if (type === 'mysql') setDbPortA(3306);
    else setDbPortA(undefined);
  };

  const handleDbTypeChangeB = (type: string) => {
    setDbTypeB(type);
    if (type === 'mssql') setDbPortB(1433);
    else if (type === 'postgresql' || type === 'postgres') setDbPortB(5432);
    else if (type === 'mysql') setDbPortB(3306);
    else setDbPortB(undefined);
  };

  const handleConnectDbA = async () => {
    setConnectingA(true);
    setConnErrorA(null);
    setDbListA([]);
    try {
      const res = await listDatabases(dbTypeA, dbHostA, dbPortA, dbUserA, dbPassA);
      setDbListA(res.databases);
      if (res.databases.length > 0) {
        setSelectedDbA(res.databases[0]);
      }
    } catch (err: unknown) {
      setConnErrorA(err instanceof Error ? err.message : 'Failed to retrieve databases');
    } finally {
      setConnectingA(false);
    }
  };

  const handleConnectDbB = async () => {
    setConnectingB(true);
    setConnErrorB(null);
    setDbListB([]);
    try {
      const res = await listDatabases(dbTypeB, dbHostB, dbPortB, dbUserB, dbPassB);
      setDbListB(res.databases);
      if (res.databases.length > 0) {
        setSelectedDbB(res.databases[0]);
      }
    } catch (err: unknown) {
      setConnErrorB(err instanceof Error ? err.message : 'Failed to retrieve databases');
    } finally {
      setConnectingB(false);
    }
  };

  const loadSampleDbSchemas = () => {
    setDbNameA('DEV_DB');
    setDbNameB('PROD_DB');
    setIsAdvancedConnStr(false);
    
    setDbTypeA('mssql');
    setDbHostA('localhost');
    setDbPortA(1433);
    setDbUserA('user');
    setDbPassA('password');
    setDbListA(['dev_db', 'test_db', 'app_db']);
    setSelectedDbA('dev_db');
    
    setDbTypeB('mssql');
    setDbHostB('localhost');
    setDbPortB(1433);
    setDbUserB('user');
    setDbPassB('password');
    setDbListB(['prod_db', 'prod_test_db']);
    setSelectedDbB('prod_db');

    setSchemaA('mssql://user:password@localhost:1433/dev_db');
    setSchemaB('mssql://user:password@localhost:1433/prod_db');
  };

  const handleDbCompare = async () => {
    let finalSchemaA = schemaA;
    let finalSchemaB = schemaB;

    if (!isAdvancedConnStr) {
      if (dbTypeA !== 'sqlite' && !selectedDbA) {
        setDbCompareError('Please connect and select Database A.');
        return;
      }
      if (dbTypeA === 'sqlite' && !sqlitePathA.trim()) {
        setDbCompareError('Please enter the path to SQLite Database A.');
        return;
      }
      if (dbTypeB !== 'sqlite' && !selectedDbB) {
        setDbCompareError('Please connect and select Database B.');
        return;
      }
      if (dbTypeB === 'sqlite' && !sqlitePathB.trim()) {
        setDbCompareError('Please enter the path to SQLite Database B.');
        return;
      }

      finalSchemaA = buildConnectionString(
        dbTypeA, dbHostA, dbPortA, dbUserA, dbPassA, selectedDbA, sqlitePathA
      );
      finalSchemaB = buildConnectionString(
        dbTypeB, dbHostB, dbPortB, dbUserB, dbPassB, selectedDbB, sqlitePathB
      );
    } else {
      if (!schemaA.trim() || !schemaB.trim()) {
        setDbCompareError('Please enter connection strings for both databases.');
        return;
      }
    }

    setDbComparing(true);
    setDbCompareError(null);
    setDbCompareResult(null);
    try {
      const res = await compareDatabases(finalSchemaA, finalSchemaB, dbNameA, dbNameB);
      setDbCompareResult(res);
    } catch (err: unknown) {
      setDbCompareError(errMsg(err) || 'Failed to compare database schemas.');
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
    localStorage.setItem('ai_api_key', geminiKey);
    setShowSettings(false);
    loadRepos();
    checkStatus();
  };

  useEffect(() => {
    loadRepos();
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await fetchBackendStatus();
      setBackendStatus(status);
    } catch (err) {
      console.error("Failed to fetch backend status", err);
    }
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
    } catch (err: unknown) {
      setReposError(errMsg(err) || 'Failed to load repositories');
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
    } catch (err: unknown) {
      setReposError(errMsg(err) || 'Error loading repository branches');
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
    } catch (err: unknown) {
      setReviewError(`Failed to load file tree: ${errMsg(err)}`);
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
    } catch (err: unknown) {
      setViewedFileContent(`// Error loading file content: ${errMsg(err)}`);
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
    } catch (err: unknown) {
      setReviewError(errMsg(err) || 'Failed to complete code review');
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
    } catch (err) {
      console.error("Failed to fetch branches for Repo A", err);
    }
  };

  const handleSelectRepoB = async (repo: Repository) => {
    setSelectedRepoB(repo);
    setSelectedBranchB(repo.default_branch);
    try {
      const bList = await fetchBranches(repo.owner, repo.name);
      setBranchesB(bList);
    } catch (err) {
      console.error("Failed to fetch branches for Repo B", err);
    }
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
    } catch (err: unknown) {
      setCompareError(errMsg(err) || 'Failed to compare repositories');
    } finally {
      setComparing(false);
    }
  };

  const handleViewFileDiff = async (filePath: string) => {
    if (!selectedRepoA || !selectedRepoB) return;
    setDiffingFilePath(filePath);
    setLoadingDiff(true);
    setDiffError(null);
    setDiffContentA('');
    setDiffContentB('');

    try {
      const [resA, resB] = await Promise.all([
        fetchFileContent(selectedRepoA.owner, selectedRepoA.name, filePath, selectedBranchA),
        fetchFileContent(selectedRepoB.owner, selectedRepoB.name, filePath, selectedBranchB)
      ]);
      setDiffContentA(resA);
      setDiffContentB(resB);
    } catch (err) {
      setDiffError(`Failed to fetch file versions for diff: ${errMsg(err)}`);
    } finally {
      setLoadingDiff(false);
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
      <HackerGlobeBackground />
      <div className="hacker-scanline-1"></div>
      <div className="hacker-scanline-2"></div>
      {/* Sidebar Panel */}
      <div className="sidebar">
        <div className="sidebar-header">
          <FolderGit2 className="logo-icon" size={28} />
          <span className="logo-text">Re-Compare</span>
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
                <label className="input-label">AI API Key</label>
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
                  className={`repo-item ${selectedRepo?.id === repo.id || selectedRepoA?.id === repo.id || selectedRepoB?.id === repo.id ? 'selected' : ''}`}
                  onClick={() => activeTab === 'review' ? handleSelectRepo(repo) : (!selectedRepoA ? handleSelectRepoA(repo) : !selectedRepoB ? handleSelectRepoB(repo) : null)}
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
                <h2>Welcome to Re-Compare</h2>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
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
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Modified Files</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-warning, #f59e0b)', marginTop: 4 }}>
                        {compareResult.modified_files_count || 0}
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
                  <div className="diff-lists" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                    <div>
                      <div className="diff-title" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--severity-error)', padding: '6px 10px', borderRadius: 4 }}>
                        <span>Missing in Repo B (Removed)</span>
                      </div>
                      <div className="diff-panel" style={{ height: 200 }}>
                        {compareResult.only_in_a.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No differences.</div>
                        ) : (
                          compareResult.only_in_a.map((p: string) => (
                            <div key={p} className="diff-item delete">{p}</div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="diff-title" style={{ background: 'rgba(251, 191, 36, 0.08)', color: 'var(--severity-warning, #fbbf24)', padding: '6px 10px', borderRadius: 4 }}>
                        <span>Modified Files (Click to Diff)</span>
                      </div>
                      <div className="diff-panel" style={{ height: 200 }}>
                        {!compareResult.modified_files || compareResult.modified_files.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No modified files.</div>
                        ) : (
                          compareResult.modified_files.map((p: string) => (
                            <div 
                              key={p} 
                              className="diff-item warning" 
                              style={{ cursor: 'pointer', background: 'rgba(251, 191, 36, 0.03)', border: '1px solid rgba(251, 191, 36, 0.1)', color: '#fbbf24', marginBottom: 4 }}
                              onClick={() => handleViewFileDiff(p)}
                            >
                              {p}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="diff-title" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--severity-success)', padding: '6px 10px', borderRadius: 4 }}>
                        <span>New in Repo B (Added)</span>
                      </div>
                      <div className="diff-panel" style={{ height: 200 }}>
                        {compareResult.only_in_b.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No differences.</div>
                        ) : (
                          compareResult.only_in_b.map((p: string) => (
                            <div key={p} className="diff-item add">{p}</div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Diff Detail Panel */}
                  {diffingFilePath && (
                    <div style={{ marginTop: 24, borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                          <Code size={14} style={{ color: '#fbbf24' }} />
                          <span>Comparing File: <code>{diffingFilePath}</code></span>
                        </h4>
                        <button className="btn-secondary" style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setDiffingFilePath(null)}>
                          Close Diff
                        </button>
                      </div>

                      {loadingDiff ? (
                        <div className="empty-state" style={{ padding: 24 }}>
                          <RefreshCw size={24} className="spinner" />
                          <h4 style={{ fontSize: '0.85rem', marginTop: 8 }}>Loading file contents...</h4>
                        </div>
                      ) : diffError ? (
                        <div style={{ color: 'var(--severity-error)', fontSize: '0.8rem', padding: 12, background: 'rgba(239,68,68,0.05)', borderRadius: 6 }}>
                          {diffError}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>
                              {selectedRepoA?.owner}/{selectedRepoA?.name}:{selectedBranchA}
                            </div>
                            <pre style={{ background: 'var(--bg-code, #040604)', padding: 12, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                              {diffContentA || '/* Empty or Binaries */'}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>
                              {selectedRepoB?.owner}/{selectedRepoB?.name}:{selectedBranchB}
                            </div>
                            <pre style={{ background: 'var(--bg-code, #040604)', padding: 12, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                              {diffContentB || '/* Empty or Binaries */'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
                    Compare database structures dynamically using a SQL Server Management Studio (SSMS) style interface. Connect to database servers, browse/select schemas dynamically, and heuristically audit differences.
                  </p>
                </div>
                <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={loadSampleDbSchemas}>
                  💡 Load Sample Connection Details
                </button>
              </div>

              {/* Connection Mode Selector Toggle */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button 
                  className="btn-secondary" 
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', gap: 6 }}
                  onClick={() => setIsAdvancedConnStr(!isAdvancedConnStr)}
                >
                  <Settings size={14} />
                  <span>{isAdvancedConnStr ? "Connect using Server Details (SSMS-like)" : "Connect using Connection String (Advanced)"}</span>
                </button>
              </div>

              {/* Input Layout */}
              {isAdvancedConnStr ? (
                /* Advanced Connection String Mode */
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
                      style={{ height: 160, background: 'rgba(10, 15, 30, 0.4)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
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
                      style={{ height: 160, background: 'rgba(10, 15, 30, 0.4)', border: '1px solid var(--border-light)', borderRadius: 8, padding: 12, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' }}
                    />
                  </div>
                </div>
              ) : (
                /* Simple SSMS-Style Mode */
                <div className="compare-selectors-grid">
                  {/* Database A Panel */}
                  <div className="compare-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: 'var(--accent-cyan)', width: 8, height: 8, borderRadius: '50%' }}></span>
                        Database A (DEV)
                      </h3>
                      <input 
                        type="text" 
                        value={dbNameA} 
                        onChange={(e) => setDbNameA(e.target.value)}
                        placeholder="DEV_DB"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-primary)', width: 120 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">Database Type / Provider</label>
                      <select 
                        className="input-field"
                        value={dbTypeA}
                        onChange={(e) => handleDbTypeChangeA(e.target.value)}
                      >
                        <option value="mssql">Microsoft SQL Server</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlite">SQLite (Local File)</option>
                      </select>
                    </div>

                    {dbTypeA === 'sqlite' ? (
                      <div className="form-group">
                        <label className="input-label">SQLite File Path</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. C:/data/dev.db or :memory:" 
                          value={sqlitePathA} 
                          onChange={(e) => setSqlitePathA(e.target.value)}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
                          <div className="form-group">
                            <label className="input-label">Host / Server Name</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="localhost" 
                              value={dbHostA} 
                              onChange={(e) => setDbHostA(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="input-label">Port</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              placeholder="1433" 
                              value={dbPortA || ''} 
                              onChange={(e) => setDbPortA(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div className="form-group">
                            <label className="input-label">Username</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="sa" 
                              value={dbUserA} 
                              onChange={(e) => setDbUserA(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="input-label">Password</label>
                            <input 
                              type="password" 
                              className="input-field" 
                              placeholder="••••••••" 
                              value={dbPassA} 
                              onChange={(e) => setDbPassA(e.target.value)}
                            />
                          </div>
                        </div>

                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ padding: '8px 12px', fontSize: '0.8rem', marginTop: 4 }}
                          onClick={handleConnectDbA}
                          disabled={connectingA || !dbHostA}
                        >
                          {connectingA ? (
                            <>
                              <RefreshCw size={14} className="spinner" />
                              Connecting...
                            </>
                          ) : (
                            "Connect & List Databases"
                          )}
                        </button>

                        {connErrorA && (
                          <div style={{ color: 'var(--severity-error)', fontSize: '0.75rem', marginTop: 4, display: 'flex', gap: 4 }}>
                            <AlertCircle size={12} style={{ flexShrink: 0 }} />
                            <span>{connErrorA}</span>
                          </div>
                        )}

                        <div className="form-group" style={{ marginTop: 8 }}>
                          <label className="input-label">Select Database</label>
                          <select 
                            className="input-field"
                            value={selectedDbA}
                            onChange={(e) => setSelectedDbA(e.target.value)}
                            disabled={dbListA.length === 0}
                          >
                            {dbListA.length === 0 ? (
                              <option value="">-- Connect to Server First --</option>
                            ) : (
                              dbListA.map(db => (
                                <option key={db} value={db}>{db}</option>
                              ))
                            )}
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Database B Panel */}
                  <div className="compare-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ background: 'var(--severity-success)', width: 8, height: 8, borderRadius: '50%' }}></span>
                        Database B (PROD)
                      </h3>
                      <input 
                        type="text" 
                        value={dbNameB} 
                        onChange={(e) => setDbNameB(e.target.value)}
                        placeholder="PROD_DB"
                        style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-light)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-primary)', width: 120 }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="input-label">Database Type / Provider</label>
                      <select 
                        className="input-field"
                        value={dbTypeB}
                        onChange={(e) => handleDbTypeChangeB(e.target.value)}
                      >
                        <option value="mssql">Microsoft SQL Server</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlite">SQLite (Local File)</option>
                      </select>
                    </div>

                    {dbTypeB === 'sqlite' ? (
                      <div className="form-group">
                        <label className="input-label">SQLite File Path</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. C:/data/prod.db or :memory:" 
                          value={sqlitePathB} 
                          onChange={(e) => setSqlitePathB(e.target.value)}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
                          <div className="form-group">
                            <label className="input-label">Host / Server Name</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="localhost" 
                              value={dbHostB} 
                              onChange={(e) => setDbHostB(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="input-label">Port</label>
                            <input 
                              type="number" 
                              className="input-field" 
                              placeholder="1433" 
                              value={dbPortB || ''} 
                              onChange={(e) => setDbPortB(e.target.value ? parseInt(e.target.value) : undefined)}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div className="form-group">
                            <label className="input-label">Username</label>
                            <input 
                              type="text" 
                              className="input-field" 
                              placeholder="sa" 
                              value={dbUserB} 
                              onChange={(e) => setDbUserB(e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="input-label">Password</label>
                            <input 
                              type="password" 
                              className="input-field" 
                              placeholder="••••••••" 
                              value={dbPassB} 
                              onChange={(e) => setDbPassB(e.target.value)}
                            />
                          </div>
                        </div>

                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ padding: '8px 12px', fontSize: '0.8rem', marginTop: 4 }}
                          onClick={handleConnectDbB}
                          disabled={connectingB || !dbHostB}
                        >
                          {connectingB ? (
                            <>
                              <RefreshCw size={14} className="spinner" />
                              Connecting...
                            </>
                          ) : (
                            "Connect & List Databases"
                          )}
                        </button>

                        {connErrorB && (
                          <div style={{ color: 'var(--severity-error)', fontSize: '0.75rem', marginTop: 4, display: 'flex', gap: 4 }}>
                            <AlertCircle size={12} style={{ flexShrink: 0 }} />
                            <span>{connErrorB}</span>
                          </div>
                        )}

                        <div className="form-group" style={{ marginTop: 8 }}>
                          <label className="input-label">Select Database</label>
                          <select 
                            className="input-field"
                            value={selectedDbB}
                            onChange={(e) => setSelectedDbB(e.target.value)}
                            disabled={dbListB.length === 0}
                          >
                            {dbListB.length === 0 ? (
                              <option value="">-- Connect to Server First --</option>
                            ) : (
                              dbListB.map(db => (
                                <option key={db} value={db}>{db}</option>
                              ))
                            )}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button 
                  className="btn-primary" 
                  style={{ width: 280, padding: 14 }}
                  onClick={handleDbCompare}
                  disabled={
                    dbComparing || 
                    (isAdvancedConnStr && (!schemaA.trim() || !schemaB.trim())) ||
                    (!isAdvancedConnStr && (
                      (dbTypeA !== 'sqlite' && !selectedDbA) ||
                      (dbTypeA === 'sqlite' && !sqlitePathA.trim()) ||
                      (dbTypeB !== 'sqlite' && !selectedDbB) ||
                      (dbTypeB === 'sqlite' && !sqlitePathB.trim())
                    ))
                  }
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
                <div style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)', padding: 16, borderRadius: 8, display: 'flex', gap: 10, color: 'var(--severity-error)', marginTop: 16 }}>
                  <AlertCircle size={18} />
                  <span>{dbCompareError}</span>
                </div>
              )}

              {/* DB Compare Results Dashboard */}
              {dbCompareResult && (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={20} style={{ color: 'var(--accent-cyan)' }} />
                      <span>Database Structure Gap Report</span>
                    </h3>
                    {dbCompareResult.sync_script && (
                      <button 
                        className="btn-primary" 
                        style={{ width: 'auto', padding: '8px 16px', fontSize: '0.85rem', background: '#15803d', borderColor: '#15803d', color: '#ffffff' }}
                        onClick={() => {
                          const element = document.createElement("a");
                          const file = new Blob([dbCompareResult.sync_script || ''], { type: 'text/plain' });
                          element.href = URL.createObjectURL(file);
                          element.download = `sync_migration_${dbCompareResult.db_type || 'db'}.sql`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }}
                      >
                        💾 Download Sync Script (.sql)
                      </button>
                    )}
                  </div>

                  {/* Summary Indicators */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

                    {dbCompareResult.procedures_in_both && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                        <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Shared Procedures</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-purple, #a855f7)', marginTop: 4 }}>
                            {dbCompareResult.procedures_in_both.length}
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Procedures only in {dbNameA}</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-error)', marginTop: 4 }}>
                            {dbCompareResult.procedures_only_in_a?.length || 0}
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Procedures only in {dbNameB}</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-success)', marginTop: 4 }}>
                            {dbCompareResult.procedures_only_in_b?.length || 0}
                          </div>
                        </div>
                        <div style={{ border: '1px solid var(--border-light)', padding: 12, borderRadius: 8, textAlign: 'center', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Procedures with Gaps</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--severity-warning, #f59e0b)', marginTop: 4 }}>
                            {Object.keys(dbCompareResult.procedure_diffs || {}).length}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary Lists */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

                    {dbCompareResult.procedures_in_both && (
                      <div className="diff-lists" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                        <div>
                          <div className="diff-title" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--severity-error)' }}>
                            <span>Missing in {dbNameB} (Procedures only in {dbNameA})</span>
                          </div>
                          <div className="diff-panel">
                            {!dbCompareResult.procedures_only_in_a || dbCompareResult.procedures_only_in_a.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No unique procedures.</div>
                            ) : (
                              dbCompareResult.procedures_only_in_a.map(p => (
                                <div key={p} className="diff-item delete">{p}</div>
                              ))
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="diff-title" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--severity-success)' }}>
                            <span>New in {dbNameB} (Procedures only in {dbNameB})</span>
                          </div>
                          <div className="diff-panel">
                            {!dbCompareResult.procedures_only_in_b || dbCompareResult.procedures_only_in_b.length === 0 ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No unique procedures.</div>
                            ) : (
                              dbCompareResult.procedures_only_in_b.map(p => (
                                <div key={p} className="diff-item add">{p}</div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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

                  {/* Detailed Stored Procedures Code Gaps */}
                  {dbCompareResult.procedure_diffs && Object.keys(dbCompareResult.procedure_diffs).length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 20 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, color: 'var(--text-primary)' }}>
                        Detailed Procedure Code Gaps
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {Object.entries(dbCompareResult.procedure_diffs).map(([procName, diff]) => (
                          <ProcDiffView key={procName} name={procName} diff={diff} dbNameA={dbNameA} dbNameB={dbNameB} />
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

                  {/* Sync Script Preview Panel */}
                  {dbCompareResult.sync_script && (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, padding: 16, background: 'rgba(0,0,0,0.2)', marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', margin: 0 }}>
                          <span>🔧 Generated Sync/Migration Script</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase', border: '1px solid var(--border-light)' }}>
                            {dbCompareResult.db_type} Dialect
                          </span>
                        </h4>
                        <button 
                          className="btn-secondary" 
                          style={{ width: 'auto', padding: '2px 8px', fontSize: '0.75rem' }} 
                          onClick={() => {
                            navigator.clipboard.writeText(dbCompareResult.sync_script || '');
                            alert('Migration script copied to clipboard!');
                          }}
                        >
                          Copy Script
                        </button>
                      </div>
                      <pre style={{ background: '#020402', padding: 12, borderRadius: 6, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto', border: '1px solid var(--border-light)', color: 'var(--text-primary)' }}>
                        {dbCompareResult.sync_script}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
