import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional

class CodeReviewer:
    def __init__(self, api_key: Optional[str] = None):
        # Load custom credentials from env
        self.api_key = api_key or os.getenv("AI_API_KEY")
        self.gateway_url = os.getenv("AI_GATEWAY_URL", "https://gateway.codepilot.my.id/v1")
        self.model = os.getenv("AI_MODEL", "openai/Qwen3.6-35B")
        
        # Clean url if it ends with a slash
        if self.gateway_url.endswith("/"):
            self.gateway_url = self.gateway_url[:-1]

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _parse_json_response(self, text: str) -> Dict[str, Any]:
        """Robust parser to extract JSON objects from LLM text responses."""
        text_clean = text.strip()
        
        # 1. Direct try
        try:
            return json.loads(text_clean)
        except Exception:
            pass
            
        # 2. Try to extract from Markdown code blocks: ```json ... ``` or ``` ... ```
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text_clean, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except Exception:
                pass
                
        # 3. Try to locate first '{' and last '}'
        start = text_clean.find('{')
        end = text_clean.rfind('}')
        if start != -1 and end != -1:
            try:
                return json.loads(text_clean[start:end+1].strip())
            except Exception:
                pass
                
        raise Exception(f"Failed to parse structured JSON from AI output: {text[:400]}...")

    async def review_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Review a single file using the custom AI Gateway."""
        if not content.strip():
            return {
                "file_path": file_path,
                "comments": [],
                "summary": "This file is empty."
            }

        # If API key is missing, fallback to mock mode
        if not self.api_key or self.api_key.lower() in ("null", "undefined", ""):
            return self._mock_review(file_path, content)

        try:
            _, ext = os.path.splitext(file_path.lower())
            lang = ext.replace(".", "") or "text"

            system_prompt = """You are an expert software engineer and code reviewer.
You must review the code for bugs, style guidelines, documentation, vulnerabilities, and performance.
You MUST respond ONLY with a single JSON object matching this exact schema:
{
  "file_path": "string",
  "comments": [
    {
      "line": 12,
      "severity": "warning", 
      "category": "performance",
      "message": "Use list comprehensions...",
      "suggestion": "results = [x for x in data if x > 0]"
    }
  ],
  "summary": "This file is generally well-structured..."
}
Guidelines:
- line: 1-based index where the issue is. Use 0 if it applies to the whole file.
- severity: 'info', 'warning', or 'error'.
- category: 'bug', 'style', 'security', 'performance', or 'documentation'.
- Do NOT output any markdown tags outside the JSON block. Do not write text before or after the JSON.
"""

            user_prompt = f"Please review this code file:\n\nFile Path: {file_path}\nLanguage: {lang}\n\nCode Content:\n```\n{content}\n```"

            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.gateway_url}/chat/completions",
                    headers=self._get_headers(),
                    json=payload,
                    timeout=45.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"AI Gateway returned status {response.status_code}: {response.text}")
                
                resp_json = response.json()
                ai_text = resp_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not ai_text:
                    raise Exception("Empty AI response")
                
                # Parse structured JSON review
                review_data = self._parse_json_response(ai_text)
                return review_data

        except Exception as e:
            print(f"Custom AI Review call failed, falling back to mock mode: {e}")
            return self._mock_review(file_path, content)

    def _detect_naming_convention(self, path: str) -> str:
        filename = os.path.basename(path)
        name, _ = os.path.splitext(filename)
        if not name or name.startswith('.'):
            return "other"
        if not re.match(r'^[a-zA-Z0-9_-]+$', name):
            return "other"
        if '_' in name and '-' not in name and not any(c.isupper() for c in name):
            return "snake_case"
        elif '-' in name and '_' not in name and not any(c.isupper() for c in name):
            return "kebab-case"
        elif any(c.isupper() for c in name) and '_' not in name and '-' not in name:
            if name[0].isupper():
                return "PascalCase"
            else:
                return "camelCase"
        elif name.islower() and '_' not in name and '-' not in name:
            return "lowercase"
        else:
            return "other"

    def _analyze_naming_style(self, files: List[str]) -> Dict[str, Any]:
        stats = {"snake_case": 0, "kebab-case": 0, "camelCase": 0, "PascalCase": 0, "lowercase": 0, "other": 0}
        total = 0
        for f in files:
            if f.endswith('/') or not f:
                continue
            style = self._detect_naming_convention(f)
            stats[style] += 1
            total += 1
        
        percentages = {}
        for style, count in stats.items():
            percentages[style] = f"{(count / total * 100):.1f}%" if total > 0 else "0%"
        
        dominant = "mixed / other"
        if total > 0:
            sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
            if sorted_stats[0][1] > total * 0.5:
                dominant = sorted_stats[0][0]
        return {"stats": stats, "percentages": percentages, "dominant": dominant, "total": total}

    def _parse_pkg_dependencies(self, pkg_json_content: str) -> Dict[str, str]:
        try:
            data = json.loads(pkg_json_content)
            deps = {}
            for key in ("dependencies", "devDependencies"):
                if key in data and isinstance(data[key], dict):
                    deps.update(data[key])
            return deps
        except Exception:
            return {}

    def _parse_req_dependencies(self, req_txt_content: str) -> Dict[str, str]:
        deps = {}
        for line in req_txt_content.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            match = re.match(r'^([a-zA-Z0-9_\-\[\]]+)(.*?)$', line)
            if match:
                pkg_name = match.group(1).lower()
                version = match.group(2).strip()
                deps[pkg_name] = version or "any"
        return deps

    def _check_indentation(self, content: str) -> str:
        lines = content.splitlines()
        tab_count = 0
        space_2_count = 0
        space_4_count = 0
        for line in lines:
            if not line:
                continue
            match = re.match(r'^([ \t]+)', line)
            if match:
                indent = match.group(1)
                if '\t' in indent:
                    tab_count += 1
                else:
                    width = len(indent)
                    if width % 2 == 0 and width % 4 != 0:
                        space_2_count += 1
                    elif width % 4 == 0:
                        space_4_count += 1
        if tab_count > space_2_count and tab_count > space_4_count:
            return "Tabs"
        elif space_2_count > space_4_count:
            return "2 Spaces"
        elif space_4_count > space_2_count:
            return "4 Spaces"
        return "Undetermined"

    @staticmethod
    def _generate_tree_text(files: List[Dict[str, Any]], max_entries: int = 80) -> str:
        sorted_paths = sorted(f["path"] for f in files)
        truncated = len(sorted_paths) > max_entries
        if truncated:
            sorted_paths = sorted_paths[:max_entries]

        tree: Dict[str, Any] = {}
        for path in sorted_paths:
            parts = path.split('/')
            node = tree
            for part in parts:
                if part not in node:
                    node[part] = {}
                node = node[part]

        def render(node: Dict[str, Any], prefix: str = "") -> List[str]:
            lines = []
            items = sorted(node.items(), key=lambda x: (not bool(x[1]), x[0]))
            for name, children in items:
                if children:
                    lines.append(f"{prefix}{name}/")
                    lines.extend(render(children, prefix + "  "))
                else:
                    lines.append(f"{prefix}{name}")
            return lines

        result = "\n".join(render(tree))
        if truncated:
            result += f"\n... ({len(files) - max_entries} more files)"
        return result

    @staticmethod
    def _get_file_type_breakdown(files: Dict[str, Any]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for path in files:
            _, ext = os.path.splitext(path.lower())
            ext = ext or "(no extension)"
            counts[ext] = counts.get(ext, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: -x[1]))

    @staticmethod
    def _detect_entry_points(files: Dict[str, Any]) -> List[str]:
        entry_patterns = [
            r'(^|/)main\.(py|go|ts|js|tsx|jsx|rs)$',
            r'(^|/)app\.(py|ts|js|tsx|jsx)$',
            r'(^|/)index\.(ts|js|tsx|jsx)$',
            r'(^|/)server\.(py|ts|js)$',
            r'(^|/)manage\.py$',
            r'(^|/)wsgi\.py$',
            r'(^|/)asgi\.py$',
            r'(^|/)urls\.py$',
            r'(^|/)routes\.(py|ts|js)$',
            r'(^|/)router\.(py|ts|js)$',
            r'(^|/)cmd/.*\.go$',
        ]
        matches = []
        for path in files:
            for pattern in entry_patterns:
                if re.search(pattern, path, re.IGNORECASE):
                    matches.append(path)
                    break
        return sorted(matches)

    async def compare_repositories(self, repo_a_files: List[Dict[str, Any]], repo_b_files: List[Dict[str, Any]], 
                                  repo_a_name: str, repo_b_name: str,
                                  config_files_a: Optional[List[Dict[str, str]]] = None,
                                  config_files_b: Optional[List[Dict[str, str]]] = None,
                                  modified_files_content: Optional[List[Dict[str, Any]]] = None,
                                  entry_point_files_a: Optional[List[Dict[str, str]]] = None,
                                  entry_point_files_b: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        files_a = {f["path"]: f for f in repo_a_files}
        files_b = {f["path"]: f for f in repo_b_files}
        
        shared_paths = set(files_a.keys()) & set(files_b.keys())
        only_a = set(files_a.keys()) - set(files_b.keys())
        only_b = set(files_b.keys()) - set(files_a.keys())

        tree_text_a = self._generate_tree_text(repo_a_files)
        tree_text_b = self._generate_tree_text(repo_b_files)

        ext_breakdown_a = self._get_file_type_breakdown(files_a)
        ext_breakdown_b = self._get_file_type_breakdown(files_b)

        entry_points_a = self._detect_entry_points(files_a)
        entry_points_b = self._detect_entry_points(files_b)

        def _detect_tech(files: Dict[str, Any]) -> List[str]:
            tech = set()
            for path in files:
                if "package.json" in path: tech.add("Node.js")
                if "requirements.txt" in path or "pyproject.toml" in path: tech.add("Python")
                if "go.mod" in path: tech.add("Go")
                if "pom.xml" in path or "build.gradle" in path: tech.add("Java")
                if "Dockerfile" in path: tech.add("Docker")
                if "tsconfig.json" in path: tech.add("TypeScript")
                if "composer.json" in path: tech.add("PHP")
                if "cargo.toml" in path or "Cargo.toml" in path: tech.add("Rust")
                if ".csproj" in path or ".sln" in path: tech.add("C#/.NET")
            return sorted(tech)

        tech_a = _detect_tech(files_a)
        tech_b = _detect_tech(files_b)
        tech_a_str = ", ".join(tech_a) or "Generic/Other"
        tech_b_str = ", ".join(tech_b) or "Generic/Other"

        md = []
        md.append(f"# Repository Architectural Comparison: {repo_a_name} vs {repo_b_name}")
        md.append("")
        
        md.append("## 1. Directory Structure & Layout")
        md.append(f"- **Shared Files**: {len(shared_paths)} file(s)")
        md.append(f"- **Only in {repo_a_name}**: {len(only_a)} file(s)")
        md.append(f"- **Only in {repo_b_name}**: {len(only_b)} file(s)")
        md.append("")

        md.append(f"### Folder Tree: {repo_a_name}")
        md.append("```")
        md.append(tree_text_a)
        md.append("```")
        md.append("")
        md.append(f"### Folder Tree: {repo_b_name}")
        md.append("```")
        md.append(tree_text_b)
        md.append("```")
        md.append("")

        md.append(f"| Metric | {repo_a_name} | {repo_b_name} |")
        md.append("| :--- | :--- | :--- |")
        md.append(f"| **Tech Stack** | {tech_a_str} | {tech_b_str} |")
        md.append(f"| **Total Files** | {len(files_a)} | {len(files_b)} |")
        md.append(f"| **Docker** | {'Yes' if 'Docker' in tech_a else 'No'} | {'Yes' if 'Docker' in tech_b else 'No'} |")
        md.append(f"| **CI/CD** | {'Yes' if any('.github/workflows' in p for p in files_a) else 'No'} | {'Yes' if any('.github/workflows' in p for p in files_b) else 'No'} |")
        md.append(f"| **Entry Points** | {', '.join(f'`{e}`' for e in entry_points_a) or 'None detected'} | {', '.join(f'`{e}`' for e in entry_points_b) or 'None detected'} |")
        md.append("")

        md.append("## 2. File Type Breakdown")
        all_exts = sorted(set(list(ext_breakdown_a.keys()) + list(ext_breakdown_b.keys())))
        md.append(f"| Extension | {repo_a_name} | {repo_b_name} |")
        md.append("| :--- | :--- | :--- |")
        for ext in all_exts:
            md.append(f"| `{ext}` | {ext_breakdown_a.get(ext, 0)} | {ext_breakdown_b.get(ext, 0)} |")
        md.append("")
        
        md.append("## 3. File Naming Conventions")
        style_a = self._analyze_naming_style(list(files_a.keys()))
        style_b = self._analyze_naming_style(list(files_b.keys()))
        
        md.append(f"| Convention | {repo_a_name} | {repo_b_name} |")
        md.append("| :--- | :--- | :--- |")
        for style in ["snake_case", "camelCase", "PascalCase", "kebab-case", "lowercase", "other"]:
            cnt_a = style_a["stats"].get(style, 0)
            pct_a = style_a["percentages"].get(style, "0%")
            cnt_b = style_b["stats"].get(style, 0)
            pct_b = style_b["percentages"].get(style, "0%")
            md.append(f"| **{style}** | {cnt_a} ({pct_a}) | {cnt_b} ({pct_b}) |")
            
        md.append("")
        md.append(f"- **Dominant in {repo_a_name}**: `{style_a['dominant']}`")
        md.append(f"- **Dominant in {repo_b_name}**: `{style_b['dominant']}`")
        md.append("")
        
        md.append("## 4. Coding Style & Dependencies")
        
        indents_a = {}
        if config_files_a:
            for f in config_files_a:
                indents_a[f["path"]] = self._check_indentation(f["content"])
        indents_b = {}
        if config_files_b:
            for f in config_files_b:
                indents_b[f["path"]] = self._check_indentation(f["content"])
                
        if indents_a or indents_b:
            md.append("### Indentation")
            md.append(f"| Config File | {repo_a_name} | {repo_b_name} |")
            md.append("| :--- | :--- | :--- |")
            all_configs = set(indents_a.keys()) | set(indents_b.keys())
            for cfg in sorted(list(all_configs)):
                val_a = indents_a.get(cfg, "N/A")
                val_b = indents_b.get(cfg, "N/A")
                md.append(f"| `{cfg}` | {val_a} | {val_b} |")
            md.append("")
            
        pkg_json_a = next((f["content"] for f in (config_files_a or []) if f["path"].endswith("package.json")), None)
        pkg_json_b = next((f["content"] for f in (config_files_b or []) if f["path"].endswith("package.json")), None)
        
        if pkg_json_a or pkg_json_b:
            md.append("### Node.js Dependencies")
            deps_a = self._parse_pkg_dependencies(pkg_json_a) if pkg_json_a else {}
            deps_b = self._parse_pkg_dependencies(pkg_json_b) if pkg_json_b else {}
            
            all_deps = set(deps_a.keys()) | set(deps_b.keys())
            mismatches = []
            only_in_deps_a = []
            only_in_deps_b = []
            
            for dep in sorted(list(all_deps)):
                if dep in deps_a and dep in deps_b:
                    if deps_a[dep] != deps_b[dep]:
                        mismatches.append(f"- `{dep}`: `{deps_a[dep]}` vs `{deps_b[dep]}`")
                elif dep in deps_a:
                    only_in_deps_a.append(f"- `{dep}` (`{deps_a[dep]}`)")
                elif dep in deps_b:
                    only_in_deps_b.append(f"- `{dep}` (`{deps_b[dep]}`)")
                    
            if mismatches:
                md.append("#### Version Mismatches")
                md.extend(mismatches)
                md.append("")
            if only_in_deps_a:
                md.append(f"#### Only in {repo_a_name}")
                md.extend(only_in_deps_a)
                md.append("")
            if only_in_deps_b:
                md.append(f"#### Only in {repo_b_name}")
                md.extend(only_in_deps_b)
                md.append("")
            if not mismatches and not only_in_deps_a and not only_in_deps_b:
                md.append("Node.js dependencies are fully in sync.")
                md.append("")
                
        req_a = next((f["content"] for f in (config_files_a or []) if f["path"].endswith("requirements.txt")), None)
        req_b = next((f["content"] for f in (config_files_b or []) if f["path"].endswith("requirements.txt")), None)
        
        if req_a or req_b:
            md.append("### Python Dependencies")
            deps_a = self._parse_req_dependencies(req_a) if req_a else {}
            deps_b = self._parse_req_dependencies(req_b) if req_b else {}
            
            all_deps = set(deps_a.keys()) | set(deps_b.keys())
            mismatches = []
            only_in_deps_a = []
            only_in_deps_b = []
            
            for dep in sorted(list(all_deps)):
                if dep in deps_a and dep in deps_b:
                    if deps_a[dep] != deps_b[dep]:
                        mismatches.append(f"- `{dep}`: `{deps_a[dep]}` vs `{deps_b[dep]}`")
                elif dep in deps_a:
                    only_in_deps_a.append(f"- `{dep}` (`{deps_a[dep]}`)")
                elif dep in deps_b:
                    only_in_deps_b.append(f"- `{dep}` (`{deps_b[dep]}`)")
                    
            if mismatches:
                md.append("#### Version Mismatches")
                md.extend(mismatches)
                md.append("")
            if only_in_deps_a:
                md.append(f"#### Only in {repo_a_name}")
                md.extend(only_in_deps_a)
                md.append("")
            if only_in_deps_b:
                md.append(f"#### Only in {repo_b_name}")
                md.extend(only_in_deps_b)
                md.append("")
            if not mismatches and not only_in_deps_a and not only_in_deps_b:
                md.append("Python packages are fully in sync.")
                md.append("")

        if self.api_key and self.api_key.lower() not in ("null", "undefined", ""):
            try:
                system_prompt = (
                    "You are an expert software architect performing a deep behavioral and structural comparison of two codebases.\n"
                    "You will receive:\n"
                    "1. Full directory tree listings for both repositories\n"
                    "2. Entry point file contents (main files, app files, routers, etc.)\n"
                    "3. Modified files showing how the same file differs between repos\n"
                    "4. Dependency and configuration metadata\n\n"
                    "Your analysis MUST cover:\n"
                    "- **Folder Architecture**: Map each repo's folder structure, explain what each top-level directory does, and compare the organizational patterns (monorepo vs multi-folder, feature-based vs layer-based, etc.)\n"
                    "- **Entry Points & Application Flow**: Trace how each application boots up, what the main entry point does, how routing/request handling is wired, and how data flows through the system\n"
                    "- **Behavioral Differences**: For each modified file, explain WHAT the code does (its purpose/behavior), not just syntactic differences. Compare the business logic, algorithms, error handling strategies, and API contracts\n"
                    "- **Component Mapping**: Create a mapping table showing which component/module in Repo A corresponds to which in Repo B (or is missing)\n"
                    "- **Technology & Pattern Differences**: Compare frameworks, design patterns (MVC, service layer, etc.), state management, data access patterns\n"
                    "- **Risk Assessment**: What could break during migration? What behavioral differences could cause bugs?\n\n"
                    "Write in Markdown. Be specific with file paths and code references. No placeholders or generic statements."
                )
                
                entry_points_text = ""
                if entry_point_files_a:
                    entry_points_text += f"\n### Entry Point Files in {repo_a_name}:\n"
                    for f in entry_point_files_a:
                        lines = f["content"].splitlines()[:150]
                        content = "\n".join(lines)
                        if len(f["content"].splitlines()) > 150:
                            content += "\n... [truncated]"
                        entry_points_text += f"\n`{f['path']}`:\n```\n{content}\n```\n"

                if entry_point_files_b:
                    entry_points_text += f"\n### Entry Point Files in {repo_b_name}:\n"
                    for f in entry_point_files_b:
                        lines = f["content"].splitlines()[:150]
                        content = "\n".join(lines)
                        if len(f["content"].splitlines()) > 150:
                            content += "\n... [truncated]"
                        entry_points_text += f"\n`{f['path']}`:\n```\n{content}\n```\n"

                modified_files_text = ""
                if modified_files_content:
                    modified_files_text = "\n### Modified Files (same path, different content):\n"
                    for item in modified_files_content:
                        path = item["path"]
                        lines_a = item["content_a"].splitlines()[:300]
                        lines_b = item["content_b"].splitlines()[:300]
                        truncated_a = "\n".join(lines_a) + ("\n... [truncated]" if len(item["content_a"].splitlines()) > 300 else "")
                        truncated_b = "\n".join(lines_b) + ("\n... [truncated]" if len(item["content_b"].splitlines()) > 300 else "")
                        modified_files_text += f"""
File: `{path}`
---- {repo_a_name} ----
```
{truncated_a}
```
---- {repo_b_name} ----
```
{truncated_b}
```
"""

                ext_text_a = ", ".join(f"{ext}: {cnt}" for ext, cnt in list(ext_breakdown_a.items())[:15])
                ext_text_b = ", ".join(f"{ext}: {cnt}" for ext, cnt in list(ext_breakdown_b.items())[:15])

                user_prompt = f"""Compare these two repositories in depth:

## Repo A: {repo_a_name}
### Directory Tree:
```
{tree_text_a}
```
- Tech Stack: {tech_a_str}
- Total Files: {len(files_a)}
- File Types: {ext_text_a}
- Entry Points: {', '.join(entry_points_a) or 'None detected'}

## Repo B: {repo_b_name}
### Directory Tree:
```
{tree_text_b}
```
- Tech Stack: {tech_b_str}
- Total Files: {len(files_b)}
- File Types: {ext_text_b}
- Entry Points: {', '.join(entry_points_b) or 'None detected'}

## Overlap Statistics:
- Shared files: {len(shared_paths)}
- Only in Repo A: {len(only_a)} ({sorted(list(only_a))[:30]})
- Only in Repo B: {len(only_b)} ({sorted(list(only_b))[:30]})

## Naming Conventions:
- Repo A dominant: {style_a['dominant']}
- Repo B dominant: {style_b['dominant']}

{entry_points_text}

{modified_files_text}

Provide a comprehensive deep-dive comparison covering:
1. **Folder Architecture Analysis**: What does each directory do? How are the repos organized differently?
2. **Application Behavior & Flow**: Trace each app's startup, request handling, and data flow based on the entry points and code provided
3. **Component-by-Component Mapping**: Which modules in Repo A map to which in Repo B? What's missing or added?
4. **Code Behavior Differences**: For each modified file, explain the functional/behavioral differences (not just syntax)
5. **Dependency & Infrastructure Gap**: What libraries, tools, or configs differ and what's the impact?
6. **Migration Risk Assessment**: What would break if migrating from A to B or vice versa?
"""
                
                payload = {
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.gateway_url}/chat/completions",
                        headers=self._get_headers(),
                        json=payload,
                        timeout=120.0
                    )
                    
                    if response.status_code == 200:
                        resp_json = response.json()
                        ai_text = resp_json.get("choices", [{}])[0].get("message", {}).get("content", "")
                        if ai_text:
                            ai_report = [
                                f"# Repository Comparison: {repo_a_name} vs {repo_b_name}",
                                "",
                                ai_text,
                                "",
                                "---",
                                "## Locally Verified Metrics",
                                ""
                            ]
                            ai_report.extend(md[1:])
                            md = ai_report
            except Exception as e:
                print(f"AI comparison failed, using local report: {e}")
                
        return {
            "repo_a": repo_a_name,
            "repo_b": repo_b_name,
            "total_files_a": len(files_a),
            "total_files_b": len(files_b),
            "shared_files_count": len(shared_paths),
            "only_in_a_count": len(only_a),
            "only_in_b_count": len(only_b),
            "only_in_a": sorted(list(only_a)),
            "only_in_b": sorted(list(only_b)),
            "ai_comparison": "\n".join(md)
        }

    def _mock_review(self, file_path: str, content: str) -> Dict[str, Any]:
        """Generate realistic mock review comments based on simple code heuristics."""
        comments = []
        lines = content.splitlines()
        _, ext = os.path.splitext(file_path.lower())
        
        if len(lines) > 300:
            comments.append({
                "line": 0,
                "severity": "info",
                "category": "style",
                "message": f"This file is quite long ({len(lines)} lines). Consider breaking it down into smaller, modular components.",
                "suggestion": None
            })

        if ext == ".py":
            has_module_docstring = content.startswith('"""') or content.startswith("'''")
            if not has_module_docstring and len(lines) > 10:
                comments.append({
                    "line": 1,
                    "severity": "info",
                    "category": "documentation",
                    "message": "Missing module-level docstring. Adding docstrings helps document the module purpose.",
                    "suggestion": '"""\nModule Name: ...\nDescription: Detailed explanation.\n"""'
                })

            for idx, line in enumerate(lines):
                line_num = idx + 1
                if re.search(r'\bprint\(', line) and not re.search(r'#.*\bprint\(', line):
                    comments.append({
                        "line": line_num,
                        "severity": "warning",
                        "category": "style",
                        "message": "Avoid using print statements in production code. Prefer logging module for output.",
                        "suggestion": "import logging\nlogger = logging.getLogger(__name__)\nlogger.info(...)"
                    })
                if re.search(r'\bexcept\s*:', line):
                    comments.append({
                        "line": line_num,
                        "severity": "error",
                        "category": "security",
                        "message": "Bare 'except:' clause catches all exceptions, including SystemExit and KeyboardInterrupt. Catch specific exceptions instead.",
                        "suggestion": "except Exception as e:\n    # Log or handle exception"
                    })
                if re.search(r'def\s+\w+\(.*=\s*\[\s*\]', line) or re.search(r'def\s+\w+\(.*=\s*\{\s*\}', line):
                    comments.append({
                        "line": line_num,
                        "severity": "error",
                        "category": "bug",
                        "message": "Do not use mutable default arguments (like list or dict) in function definitions. They persist across function calls.",
                        "suggestion": "def func(data=None):\n    if data is None:\n        data = []"
                    })

        elif ext in (".js", ".ts", ".jsx", ".tsx"):
            for idx, line in enumerate(lines):
                line_num = idx + 1
                if "console.log" in line and not line.strip().startswith("//"):
                    comments.append({
                        "line": line_num,
                        "severity": "warning",
                        "category": "performance",
                        "message": "Avoid leaving console.log statements in production code. Use a proper logging framework or remove before deployment.",
                        "suggestion": "// Remove or replace with logger"
                    })
                if re.search(r'\bvar\s+\w+', line) and not re.search(r'//.*\bvar\b', line):
                    comments.append({
                        "line": line_num,
                        "severity": "warning",
                        "category": "style",
                        "message": "Avoid using 'var' for variable declarations. Use 'let' or 'const' to ensure block scoping.",
                        "suggestion": "const variableName = value;"
                    })

        if not comments:
            comments.append({
                "line": 1,
                "severity": "info",
                "category": "style",
                "message": "Code looks clean and follows basic syntax standards. Keep it up!",
                "suggestion": None
            })

        bug_count = sum(1 for c in comments if c["category"] == "bug")
        warn_count = sum(1 for c in comments if c["severity"] == "warning")
        sec_count = sum(1 for c in comments if c["category"] == "security")
        
        if bug_count > 0 or sec_count > 0:
            summary = f"Review completed. Found {len(comments)} issues. Action is recommended due to {bug_count} potential bugs and {sec_count} security concerns."
        elif warn_count > 0:
            summary = f"Review completed. Code structure is good overall, but contains {warn_count} styling or minor improvement warnings."
        else:
            summary = "Excellent code quality! The file follows best practices and has no major structural or syntax issues."

        return {
            "file_path": file_path,
            "comments": comments,
            "summary": summary
        }


def get_sqlite_schema(db_path: str) -> Dict[str, Any]:
    import sqlite3
    db_path = db_path.strip()

    if not os.path.exists(db_path) and db_path != ":memory:":
        raise Exception(f"SQLite database file not found at path: {db_path}")
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute(f'PRAGMA table_info("{table}");')
            columns_info = cursor.fetchall()
            
            columns = {}
            primary_key = []
            
            for col in columns_info:
                col_name = col[1]
                data_type = col[2] or "TEXT"
                is_nullable = col[3] == 0
                default_val = col[4]
                is_pk = col[5] > 0
                
                columns[col_name] = {
                    "type": data_type,
                    "nullable": is_nullable,
                    "default": str(default_val) if default_val is not None else None,
                    "is_primary": is_pk,
                    "is_unique": False
                }
                if is_pk:
                    primary_key.append(col_name)
                    
            schema[table] = {
                "columns": columns,
                "primary_key": primary_key,
                "indexes": [],
                "foreign_keys": []
            }
        return schema
    finally:
        conn.close()

def get_postgres_schema(conn_str: str) -> Dict[str, Any]:
    import psycopg2
    try:
        conn = psycopg2.connect(conn_str)
    except Exception as e:
        raise Exception(f"Failed to connect to PostgreSQL database: {str(e)}")
        
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s;
            """, (table,))
            cols_info = cursor.fetchall()
            
            columns = {}
            for col in cols_info:
                col_name = col[0]
                data_type = col[1]
                if col[4] is not None:
                    data_type = f"{data_type}({col[4]})"
                is_nullable = col[2] == 'YES'
                default_val = col[3]
                
                columns[col_name] = {
                    "type": data_type,
                    "nullable": is_nullable,
                    "default": str(default_val) if default_val is not None else None,
                    "is_primary": False,
                    "is_unique": False
                }
                
            cursor.execute("""
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' 
                  AND tc.table_schema = 'public' 
                  AND tc.table_name = %s;
            """, (table,))
            pk_cols = [row[0] for row in cursor.fetchall()]
            
            for pk in pk_cols:
                if pk in columns:
                    columns[pk]["is_primary"] = True
                    
            schema[table] = {
                "columns": columns,
                "primary_key": pk_cols,
                "indexes": [],
                "foreign_keys": []
            }
        return schema
    finally:
        conn.close()

def get_mysql_schema(conn_str: str) -> Dict[str, Any]:
    import pymysql
    from urllib.parse import urlparse
    
    try:
        parsed = urlparse(conn_str)
        db_name = parsed.path.lstrip('/')
        conn = pymysql.connect(
            host=parsed.hostname or 'localhost',
            port=parsed.port or 3306,
            user=parsed.username,
            password=parsed.password,
            database=db_name
        )
    except Exception as e:
        raise Exception(f"Failed to connect to MySQL database: {str(e)}")
        
    cursor = conn.cursor()
    try:
        cursor.execute("SHOW TABLES;")
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute(f"DESCRIBE `{table}`;")
            cols_info = cursor.fetchall()
            
            columns = {}
            primary_key = []
            for col in cols_info:
                col_name = col[0]
                data_type = col[1]
                is_nullable = col[2] == 'YES'
                is_pk = col[3] == 'PRI'
                default_val = col[4]
                
                columns[col_name] = {
                    "type": data_type.decode() if isinstance(data_type, bytes) else str(data_type),
                    "nullable": is_nullable,
                    "default": str(default_val) if default_val is not None else None,
                    "is_primary": is_pk,
                    "is_unique": col[3] == 'UNI'
                }
                if is_pk:
                    primary_key.append(col_name)
                    
            schema[table] = {
                "columns": columns,
                "primary_key": primary_key,
                "indexes": [],
                "foreign_keys": []
            }
        return schema
    finally:
        conn.close()

def get_mssql_schema(conn_str: str) -> Dict[str, Any]:
    import pymssql
    from urllib.parse import urlparse
    
    try:
        parsed = urlparse(conn_str)
        db_name = parsed.path.lstrip('/')
        host = parsed.hostname or 'localhost'
        port = parsed.port
        if port:
            host = f"{host}:{port}"
            
        conn = pymssql.connect(
            server=host,
            user=parsed.username,
            password=parsed.password,
            database=db_name
        )
    except Exception as e:
        raise Exception(f"Failed to connect to Microsoft SQL Server: {str(e)}")
        
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE';
        """)
        tables = [row[0] for row in cursor.fetchall()]
        
        schema = {}
        for table in tables:
            cursor.execute("""
                SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = %s;
            """, (table,))
            cols_info = cursor.fetchall()
            
            columns = {}
            for col in cols_info:
                col_name = col[0]
                data_type = col[1]
                if col[4] is not None:
                    data_type = f"{data_type}({col[4]})"
                is_nullable = col[2] == 'YES'
                default_val = col[3]
                
                columns[col_name] = {
                    "type": data_type,
                    "nullable": is_nullable,
                    "default": str(default_val) if default_val is not None else None,
                    "is_primary": False,
                    "is_unique": False
                }
                
            cursor.execute("""
                SELECT col.name AS column_name
                FROM sys.indexes idx
                JOIN sys.index_columns idx_col ON idx.object_id = idx_col.object_id AND idx.index_id = idx_col.index_id
                JOIN sys.columns col ON idx_col.object_id = col.object_id AND idx_col.column_id = col.column_id
                WHERE idx.is_primary_key = 1 AND OBJECT_NAME(idx.object_id) = %s;
            """, (table,))
            pk_cols = [row[0] for row in cursor.fetchall()]
            
            for pk in pk_cols:
                if pk in columns:
                    columns[pk]["is_primary"] = True
                    
            schema[table] = {
                "columns": columns,
                "primary_key": pk_cols,
                "indexes": [],
                "foreign_keys": []
            }
        return schema
    finally:
        conn.close()

def fetch_schema_from_connection(conn_str: str) -> Dict[str, Any]:
    conn_str_lower = conn_str.lower().strip()
    if conn_str_lower.startswith("postgresql://") or conn_str_lower.startswith("postgres://"):
        return get_postgres_schema(conn_str)
    elif conn_str_lower.startswith("mysql://"):
        return get_mysql_schema(conn_str)
    elif conn_str_lower.startswith("mssql://") or conn_str_lower.startswith("sqlserver://"):
        return get_mssql_schema(conn_str)
    elif conn_str_lower.startswith("sqlite:///"):
        return get_sqlite_schema(conn_str[10:])
    elif conn_str_lower.startswith("sqlite://"):
        return get_sqlite_schema(conn_str[9:])
    elif conn_str_lower.endswith(".db") or conn_str_lower.endswith(".sqlite"):
        return get_sqlite_schema(conn_str)
    else:
        raise Exception(f"Unsupported connection string format. Use postgresql://, mysql://, mssql://, or sqlite:/// prefix.")

def compare_database_schemas(schema_a: str, schema_b: str, name_a: str = "Database A", name_b: str = "Database B") -> Dict[str, Any]:
    try:
        tables_a = fetch_schema_from_connection(schema_a)
        tables_b = fetch_schema_from_connection(schema_b)
    except Exception as e:
        return {
            "tables_only_in_a": [],
            "tables_only_in_b": [],
            "tables_in_both": [],
            "diffs": {},
            "markdown_report": f"⚠️ **Failed to connect or fetch schemas**: {str(e)}"
        }
        
    tables_only_a = sorted(list(set(tables_a.keys()) - set(tables_b.keys())))
    tables_only_b = sorted(list(set(tables_b.keys()) - set(tables_a.keys())))
    shared_tables = sorted(list(set(tables_a.keys()) & set(tables_b.keys())))
    
    diffs = {}
    
    for table in shared_tables:
        t_a = tables_a[table]
        t_b = tables_b[table]
        
        cols_a = t_a["columns"]
        cols_b = t_b["columns"]
        
        only_cols_a = sorted(list(set(cols_a.keys()) - set(cols_b.keys())))
        only_cols_b = sorted(list(set(cols_b.keys()) - set(cols_a.keys())))
        shared_cols = sorted(list(set(cols_a.keys()) & set(cols_b.keys())))
        
        col_type_diffs = []
        col_null_diffs = []
        col_default_diffs = []
        
        for col in shared_cols:
            c_a = cols_a[col]
            c_b = cols_b[col]
            
            type_a = re.sub(r'\s+', '', c_a["type"].upper())
            type_b = re.sub(r'\s+', '', c_b["type"].upper())
            if type_a != type_b:
                col_type_diffs.append({
                    "column": col,
                    "a": c_a["type"],
                    "b": c_b["type"]
                })
                
            if c_a["nullable"] != c_b["nullable"]:
                col_null_diffs.append({
                    "column": col,
                    "a": "NULL" if c_a["nullable"] else "NOT NULL",
                    "b": "NULL" if c_b["nullable"] else "NOT NULL"
                })
                
            if c_a["default"] != c_b["default"]:
                col_default_diffs.append({
                    "column": col,
                    "a": c_a["default"] if c_a["default"] is not None else "NULL",
                    "b": c_b["default"] if c_b["default"] is not None else "NULL"
                })
                
        pk_a = sorted(t_a["primary_key"])
        pk_b = sorted(t_b["primary_key"])
        pk_diff = None
        if pk_a != pk_b:
            pk_diff = {
                "a": pk_a,
                "b": pk_b
            }
            
        if only_cols_a or only_cols_b or col_type_diffs or col_null_diffs or col_default_diffs or pk_diff:
            diffs[table] = {
                "columns_only_in_a": only_cols_a,
                "columns_only_in_b": only_cols_b,
                "column_type_diffs": col_type_diffs,
                "column_nullability_diffs": col_null_diffs,
                "column_default_diffs": col_default_diffs,
                "pk_diff": pk_diff
            }
            
    # Generate Markdown report
    markdown_report = generate_db_comparison_markdown(
        {
            "tables_only_in_a": tables_only_a,
            "tables_only_in_b": tables_only_b,
            "tables_in_both": shared_tables,
            "diffs": diffs
        },
        name_a, name_b
    )
    
    return {
        "tables_only_in_a": tables_only_a,
        "tables_only_in_b": tables_only_b,
        "tables_in_both": shared_tables,
        "diffs": diffs,
        "markdown_report": markdown_report
    }

def generate_db_comparison_markdown(results: Dict[str, Any], name_a: str, name_b: str) -> str:
    md = []
    md.append(f"# Database Schema Comparison: {name_a} vs {name_b}")
    md.append("")
    md.append("## 📊 Summary Metrics")
    md.append(f"- **Tables in {name_a}**: {len(results['tables_only_in_a']) + len(results['tables_in_both'])}")
    md.append(f"- **Tables in {name_b}**: {len(results['tables_only_in_b']) + len(results['tables_in_both'])}")
    md.append(f"- **Shared Tables**: {len(results['tables_in_both'])}")
    md.append(f"- **Tables Only in {name_a}**: {len(results['tables_only_in_a'])}")
    md.append(f"- **Tables Only in {name_b}**: {len(results['tables_only_in_b'])}")
    md.append(f"- **Tables with Schema Gaps**: {len(results['diffs'])}")
    md.append("")
    
    md.append("## ⚠️ Identified Gaps")
    if not results['tables_only_in_a'] and not results['tables_only_in_b'] and not results['diffs']:
        md.append("✅ **No structural differences found! Both database schemas are perfectly aligned.**")
        return "\n".join(md)
        
    if results['tables_only_in_a']:
        md.append(f"### 📁 Tables only in {name_a}")
        for t in results['tables_only_in_a']:
            md.append(f"- `{t}`")
        md.append("")
        
    if results['tables_only_in_b']:
        md.append(f"### 📁 Tables only in {name_b}")
        for t in results['tables_only_in_b']:
            md.append(f"- `{t}`")
        md.append("")
        
    if results['diffs']:
        md.append("### 🔄 Table Structure Gaps")
        for table, diff in results['diffs'].items():
            md.append(f"#### Table: `{table}`")
            
            if diff["columns_only_in_a"]:
                md.append(f"- ➕ **Columns only in {name_a}**:")
                for col in diff["columns_only_in_a"]:
                    md.append(f"  - `{col}`")
            if diff["columns_only_in_b"]:
                md.append(f"- ➖ **Columns only in {name_b}**:")
                for col in diff["columns_only_in_b"]:
                    md.append(f"  - `{col}`")
            if diff["column_type_diffs"]:
                md.append("- ⚙️ **Column Data Type Mismatches**:")
                for d in diff["column_type_diffs"]:
                    md.append(f"  - `{d['column']}`: `{d['a']}` in {name_a} vs `{d['b']}` in {name_b}")
            if diff["column_nullability_diffs"]:
                md.append("- 🔒 **Column Nullability Mismatches**:")
                for d in diff["column_nullability_diffs"]:
                    md.append(f"  - `{d['column']}`: `{d['a']}` in {name_a} vs `{d['b']}` in {name_b}")
            if diff["column_default_diffs"]:
                md.append("- 📝 **Column Default Value Mismatches**:")
                for d in diff["column_default_diffs"]:
                    md.append(f"  - `{d['column']}`: `{d['a']}` in {name_a} vs `{d['b']}` in {name_b}")
            if diff["pk_diff"]:
                pk_a_str = ", ".join(diff['pk_diff']['a']) if diff['pk_diff']['a'] else "None"
                pk_b_str = ", ".join(diff['pk_diff']['b']) if diff['pk_diff']['b'] else "None"
                md.append(f"- 🔑 **Primary Key Mismatch**: Primary key is `{pk_a_str}` in {name_a} vs `{pk_b_str}` in {name_b}")
                
            md.append("")
            
    return "\n".join(md)
