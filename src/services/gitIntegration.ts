import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface GitDiff {
    file: string;
    additions: number;
    deletions: number;
    changes: Array<{
        type: 'add' | 'delete' | 'modify';
        content: string;
        lineNumber: number;
    }>;
}

interface GitBlame {
    hash: string;
    author: string;
    date: string;
    message: string;
    lines: Array<{
        number: number;
        content: string;
    }>;
}

interface RepoAnalysis {
    complexity: {
        totalFiles: number;
        totalLines: number;
        averageFileSize: number;
        hotspots: string[];
    };
    dependencies: {
        direct: string[];
        dev: string[];
        indirect: string[];
    };
    codeHealth: {
        duplicateCode: Array<{
            files: string[];
            similarity: number;
        }>;
        longFiles: string[];
        complexFunctions: Array<{
            file: string;
            function: string;
            complexity: number;
        }>;
    };
    security: {
        secrets: string[];
        vulnerabilities: Array<{
            file: string;
            type: string;
            severity: 'low' | 'medium' | 'high';
            description: string;
        }>;
    };
}

interface CommitSuggestion {
    message: string;
    type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
    scope?: string;
    description: string;
    breakingChanges: boolean;
    relatedIssues: string[];
}

interface CodeReviewComment {
    file: string;
    line: number;
    message: string;
    severity: 'info' | 'warning' | 'error';
    category: 'security' | 'performance' | 'maintainability' | 'bug' | 'style';
    suggestion?: string;
}

export class GitIntegration {
    private repoCache: Map<string, any> = new Map();
    private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private workspaceRoot: string;

    constructor(
        private claudeAPI: ClaudeAPI,
        private maxDiffSize: number = 1000,
        private maxFileSize: number = 1000000
    ) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }
        this.workspaceRoot = workspaceFolders[0].uri.fsPath;
    }

    private async getRepoContext(forceRefresh: boolean = false): Promise<any> {
        const cacheKey = 'repo-context';
        const cachedContext = this.repoCache.get(cacheKey);
        
        if (!forceRefresh && cachedContext && Date.now() - cachedContext.timestamp < GitIntegration.CACHE_DURATION) {
            return cachedContext.data;
        }

        const context = {
            branch: await this.getCurrentBranch(),
            remotes: await this.getRemotes(),
            status: await this.getStatus(),
            lastCommit: await this.getLastCommit(),
            config: await this.getGitConfig(),
            stats: await this.getRepoStats(),
            analysis: await this.analyzeRepo(),
            timestamp: Date.now()
        };

        this.repoCache.set(cacheKey, {
            data: context,
            timestamp: Date.now()
        });

        return context;
    }

    private async getCurrentBranch(): Promise<string> {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
            cwd: this.workspaceRoot
        });
        return stdout.trim();
    }

    private async getRemotes(): Promise<Record<string, string>> {
        const { stdout } = await execAsync('git remote -v', {
            cwd: this.workspaceRoot
        });
        
        const remotes: Record<string, string> = {};
        stdout.split('\n').forEach(line => {
            const match = line.match(/^(\S+)\s+(\S+)/);
            if (match) {
                remotes[match[1]] = match[2];
            }
        });
        
        return remotes;
    }

    private async getStatus(): Promise<{
        staged: string[];
        modified: string[];
        untracked: string[];
    }> {
        const { stdout } = await execAsync('git status --porcelain', {
            cwd: this.workspaceRoot
        });

        const status = {
            staged: [] as string[],
            modified: [] as string[],
            untracked: [] as string[]
        };

        stdout.split('\n').forEach(line => {
            if (!line) return;
            const [state, file] = [line.slice(0, 2), line.slice(3)];
            if (state.includes('A') || state.includes('M')) {
                status.staged.push(file);
            } else if (state.includes('??')) {
                status.untracked.push(file);
            } else if (state.includes(' M')) {
                status.modified.push(file);
            }
        });

        return status;
    }

    private async getLastCommit(): Promise<{
        hash: string;
        author: string;
        date: string;
        message: string;
    }> {
        const { stdout } = await execAsync(
            'git log -1 --pretty=format:"%H%n%an%n%ad%n%s"',
            { cwd: this.workspaceRoot }
        );

        const [hash, author, date, message] = stdout.split('\n');
        return { hash, author, date, message };
    }

    private async getGitConfig(): Promise<Record<string, string>> {
        const { stdout } = await execAsync('git config --list', {
            cwd: this.workspaceRoot
        });

        const config: Record<string, string> = {};
        stdout.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                config[key.trim()] = value.trim();
            }
        });

        return config;
    }

    private async getRepoStats(): Promise<{
        commits: number;
        branches: number;
        contributors: number;
        size: number;
    }> {
        const [commits, branches, contributors] = await Promise.all([
            execAsync('git rev-list --count HEAD', { cwd: this.workspaceRoot }),
            execAsync('git branch | wc -l', { cwd: this.workspaceRoot }),
            execAsync('git shortlog -sn --no-merges | wc -l', { cwd: this.workspaceRoot })
        ]);

        const size = await this.getRepoSize();

        return {
            commits: parseInt(commits.stdout.trim()),
            branches: parseInt(branches.stdout.trim()),
            contributors: parseInt(contributors.stdout.trim()),
            size
        };
    }

    private async getRepoSize(): Promise<number> {
        const { stdout } = await execAsync('git count-objects -v', {
            cwd: this.workspaceRoot
        });

        const sizeInfo = stdout.split('\n').find(line => line.startsWith('size-pack:'));
        return sizeInfo ? parseInt(sizeInfo.split(':')[1].trim()) * 1024 : 0;
    }

    private async analyzeRepo(): Promise<RepoAnalysis> {
        const analysis: RepoAnalysis = {
            complexity: await this.analyzeComplexity(),
            dependencies: await this.analyzeDependencies(),
            codeHealth: await this.analyzeCodeHealth(),
            security: await this.analyzeSecurity()
        };
        return analysis;
    }

    private async analyzeComplexity(): Promise<RepoAnalysis['complexity']> {
        const { stdout: files } = await execAsync('git ls-files', { cwd: this.workspaceRoot });
        const fileList = files.split('\n').filter(Boolean);
        
        let totalLines = 0;
        let totalSize = 0;
        const fileSizes = new Map<string, number>();
        
        for (const file of fileList) {
            const stats = await fs.stat(path.join(this.workspaceRoot, file));
            if (stats.size > this.maxFileSize) continue;
            
            const content = await fs.readFile(path.join(this.workspaceRoot, file), 'utf-8');
            const lines = content.split('\n').length;
            totalLines += lines;
            totalSize += stats.size;
            fileSizes.set(file, stats.size);
        }

        // Find hotspots (files with most changes)
        const { stdout: changes } = await execAsync(
            'git log --format=format: --name-only | sort | uniq -c | sort -rn | head -n 10',
            { cwd: this.workspaceRoot }
        );

        return {
            totalFiles: fileList.length,
            totalLines,
            averageFileSize: totalSize / fileList.length,
            hotspots: changes.split('\n')
                .filter(Boolean)
                .map(line => line.trim().split(/\s+/)[1])
        };
    }

    private async analyzeDependencies(): Promise<RepoAnalysis['dependencies']> {
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            return {
                direct: Object.keys(packageJson.dependencies || {}),
                dev: Object.keys(packageJson.devDependencies || {}),
                indirect: await this.findIndirectDependencies(packageJson)
            };
        } catch {
            return { direct: [], dev: [], indirect: [] };
        }
    }

    private async findIndirectDependencies(packageJson: any): Promise<string[]> {
        const nodeModulesPath = path.join(this.workspaceRoot, 'node_modules');
        const indirect = new Set<string>();

        const checkDependencies = async (deps: Record<string, string>) => {
            for (const dep of Object.keys(deps)) {
                try {
                    const depPackageJson = JSON.parse(
                        await fs.readFile(
                            path.join(nodeModulesPath, dep, 'package.json'),
                            'utf-8'
                        )
                    );
                    Object.keys(depPackageJson.dependencies || {}).forEach(d => indirect.add(d));
                } catch {
                    continue;
                }
            }
        };

        await Promise.all([
            checkDependencies(packageJson.dependencies || {}),
            checkDependencies(packageJson.devDependencies || {})
        ]);

        return Array.from(indirect);
    }

    private async analyzeCodeHealth(): Promise<RepoAnalysis['codeHealth']> {
        const { stdout: files } = await execAsync('git ls-files', { cwd: this.workspaceRoot });
        const fileList = files.split('\n').filter(Boolean);
        
        const duplicates: Array<{ files: string[]; similarity: number }> = [];
        const longFiles: string[] = [];
        const complexFunctions: Array<{ file: string; function: string; complexity: number }> = [];

        for (const file of fileList) {
            if (!file.match(/\.(ts|js|jsx|tsx)$/)) continue;
            
            const content = await fs.readFile(path.join(this.workspaceRoot, file), 'utf-8');
            
            // Check for long files
            if (content.split('\n').length > 500) {
                longFiles.push(file);
            }

            // Analyze function complexity
            const functionMatches = content.match(/function.*?{|}$/gms);
            if (functionMatches) {
                for (const func of functionMatches) {
                    const complexity = this.calculateFunctionComplexity(func);
                    if (complexity > 10) {
                        complexFunctions.push({
                            file,
                            function: func.split('function')[1].split('{')[0].trim(),
                            complexity
                        });
                    }
                }
            }

            // Find similar files
            for (const otherFile of fileList) {
                if (file === otherFile) continue;
                const similarity = await this.calculateFileSimilarity(file, otherFile);
                if (similarity > 0.8) {
                    duplicates.push({ files: [file, otherFile], similarity });
                }
            }
        }

        return { duplicateCode: duplicates, longFiles, complexFunctions };
    }

    private async analyzeSecurity(): Promise<RepoAnalysis['security']> {
        const { stdout: files } = await execAsync('git ls-files', { cwd: this.workspaceRoot });
        const fileList = files.split('\n').filter(Boolean);
        
        const security: RepoAnalysis['security'] = {
            secrets: [],
            vulnerabilities: []
        };

        const secretPatterns = [
            /(?i)(api[_-]?key|api[_-]?secret|access[_-]?key|access[_-]?secret|password|secret)[_-]?=\s*['"][^'"]*['"]/,
            /(?i)BEGIN\s+(?:RSA|DSA|EC|PGP)\s+PRIVATE\s+KEY/,
            /(?i)aws[_-]?(?:access[_-]?)?key[_-]?id\s*=\s*['"][A-Za-z0-9/+=]{20,}['"]/
        ];

        const vulnPatterns = [
            { pattern: /eval\(.*\)/, type: 'code-injection', severity: 'high' },
            { pattern: /innerHTML\s*=/, type: 'xss', severity: 'medium' },
            { pattern: /exec\(.*\)/, type: 'command-injection', severity: 'high' }
        ];

        for (const file of fileList) {
            const content = await fs.readFile(path.join(this.workspaceRoot, file), 'utf-8');

            // Check for secrets
            for (const pattern of secretPatterns) {
                if (pattern.test(content)) {
                    security.secrets.push(file);
                    break;
                }
            }

            // Check for vulnerabilities
            for (const { pattern, type, severity } of vulnPatterns) {
                if (pattern.test(content)) {
                    security.vulnerabilities.push({
                        file,
                        type,
                        severity,
                        description: `Potential ${type} vulnerability detected`
                    });
                }
            }
        }

        return security;
    }

    private calculateFunctionComplexity(functionCode: string): number {
        const complexityFactors = [
            { pattern: /if\s*\(/, weight: 1 },
            { pattern: /else\s*{/, weight: 1 },
            { pattern: /for\s*\(/, weight: 2 },
            { pattern: /while\s*\(/, weight: 2 },
            { pattern: /catch\s*\(/, weight: 1 },
            { pattern: /switch\s*\(/, weight: 1 },
            { pattern: /\|\||\&\&/, weight: 0.5 },
            { pattern: /\?.*:/, weight: 0.5 }
        ];

        return complexityFactors.reduce((complexity, factor) => {
            const matches = functionCode.match(factor.pattern) || [];
            return complexity + matches.length * factor.weight;
        }, 1);
    }

    private async calculateFileSimilarity(file1: string, file2: string): Promise<number> {
        const [content1, content2] = await Promise.all([
            fs.readFile(path.join(this.workspaceRoot, file1), 'utf-8'),
            fs.readFile(path.join(this.workspaceRoot, file2), 'utf-8')
        ]);

        const lines1 = new Set(content1.split('\n').map(line => line.trim()));
        const lines2 = new Set(content2.split('\n').map(line => line.trim()));

        const intersection = new Set([...lines1].filter(x => lines2.has(x)));
        const union = new Set([...lines1, ...lines2]);

        return intersection.size / union.size;
    }

    async suggestCommitMessage(files?: string[]): Promise<CommitSuggestion> {
        const context = await this.getRepoContext();
        const diff = await this.getGitDiff(files);
        
        if (!diff.length) {
            throw new Error('No changes to commit');
        }

        const prompt = `Analyze the following changes and suggest a commit message:
Repository Context:
- Branch: ${context.branch}
- Last Commit: ${context.lastCommit.message}
- Project Stats: ${JSON.stringify(context.stats)}

Changes:
${diff.map(d => `
File: ${d.file}
Changes: +${d.additions}, -${d.deletions}
${d.changes.map(c => `${c.type === 'add' ? '+' : '-'} ${c.content}`).join('\n')}
`).join('\n')}

Generate a commit message following the Conventional Commits format that:
1. Accurately describes the changes
2. Uses appropriate type and scope
3. Mentions breaking changes if any
4. References related issues
5. Is concise but informative`;

        const response = await this.claudeAPI.chat([
            { 
                role: 'system', 
                content: 'You are an expert at analyzing code changes and generating meaningful commit messages following the Conventional Commits specification.'
            },
            { role: 'user', content: prompt }
        ]);

        return this.parseCommitMessage(response.content[0].text);
    }

    private parseCommitMessage(response: string): CommitSuggestion {
        const lines = response.split('\n');
        const messageMatch = lines[0].match(/^(\w+)(?:\(([\w-]+)\))?: (.+)/);
        
        if (!messageMatch) {
            return {
                message: lines[0],
                type: 'chore',
                description: lines.slice(1).join('\n'),
                breakingChanges: false,
                relatedIssues: []
            };
        }

        const [, type, scope, message] = messageMatch;
        const description = lines.slice(1).join('\n');
        const breakingChanges = description.toLowerCase().includes('breaking change');
        const issueMatches = description.match(/#\d+/g) || [];

        return {
            message: lines[0],
            type: type as CommitSuggestion['type'],
            scope,
            description,
            breakingChanges,
            relatedIssues: issueMatches.map(issue => issue.slice(1))
        };
    }

    private async getGitDiff(files?: string[]): Promise<GitDiff[]> {
        const command = files?.length 
            ? `git diff --staged ${files.join(' ')}`
            : 'git diff --staged';

        const { stdout } = await execAsync(command, { cwd: this.workspaceRoot });
        if (!stdout) return [];

        const diffs: GitDiff[] = [];
        let currentDiff: GitDiff | null = null;

        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.startsWith('diff --git')) {
                if (currentDiff) {
                    diffs.push(currentDiff);
                }
                const file = line.split(' ')[2].slice(2);
                currentDiff = {
                    file,
                    additions: 0,
                    deletions: 0,
                    changes: []
                };
            } else if (currentDiff && line.startsWith('+')) {
                currentDiff.additions++;
                currentDiff.changes.push({
                    type: 'add',
                    content: line.slice(1),
                    lineNumber: currentDiff.changes.length + 1
                });
            } else if (currentDiff && line.startsWith('-')) {
                currentDiff.deletions++;
                currentDiff.changes.push({
                    type: 'delete',
                    content: line.slice(1),
                    lineNumber: currentDiff.changes.length + 1
                });
            } else if (currentDiff && !line.startsWith('@')) {
                currentDiff.changes.push({
                    type: 'modify',
                    content: line,
                    lineNumber: currentDiff.changes.length + 1
                });
            }
        }

        if (currentDiff) {
            diffs.push(currentDiff);
        }

        return diffs;
    }

    async reviewChanges(files?: string[]): Promise<CodeReviewComment[]> {
        const context = await this.getRepoContext();
        const diff = await this.getGitDiff(files);
        
        if (!diff.length) {
            throw new Error('No changes to review');
        }

        const codeHealth = context.analysis.codeHealth;
        const security = context.analysis.security;

        const prompt = `Review the following code changes in the context of the entire repository:

Repository Context:
- Branch: ${context.branch}
- Code Health: ${JSON.stringify(codeHealth)}
- Security Analysis: ${JSON.stringify(security)}

Changes to Review:
${diff.map(d => `
File: ${d.file}
Changes: +${d.additions}, -${d.deletions}
${d.changes.map(c => `${c.type === 'add' ? '+' : '-'} ${c.content}`).join('\n')}
`).join('\n')}

Provide a detailed code review that:
1. Identifies potential bugs, security issues, and performance problems
2. Suggests improvements for code quality and maintainability
3. Checks for consistency with existing codebase
4. Reviews test coverage and documentation
5. Considers edge cases and error handling

Format each comment as:
[severity: info/warning/error] [category: security/performance/maintainability/bug/style]
[file] [line number]: [message]
[suggestion (if applicable)]`;

        const response = await this.claudeAPI.chat([
            { 
                role: 'system', 
                content: 'You are an expert code reviewer with deep knowledge of software engineering principles, security best practices, and performance optimization.'
            },
            { role: 'user', content: prompt }
        ]);

        return this.parseCodeReview(response.content[0].text);
    }

    private parseCodeReview(review: string): CodeReviewComment[] {
        const comments: CodeReviewComment[] = [];
        const lines = review.split('\n');

        for (const line of lines) {
            const match = line.match(
                /\[(info|warning|error)\]\s*\[(security|performance|maintainability|bug|style)\]\s*([^:]+):(\d+):\s*(.+?)(?:\s*\[suggestion:\s*(.+)\])?$/
            );

            if (match) {
                const [, severity, category, file, lineNum, message, suggestion] = match;
                comments.push({
                    file: file.trim(),
                    line: parseInt(lineNum),
                    message: message.trim(),
                    severity: severity as CodeReviewComment['severity'],
                    category: category as CodeReviewComment['category'],
                    suggestion: suggestion?.trim()
                });
            }
        }

        return comments;
    }

    async generatePRDescription(targetBranch: string = 'main'): Promise<{
        title: string;
        body: string;
        reviewers: string[];
        labels: string[];
    }> {
        const context = await this.getRepoContext();
        const diff = await this.getGitDiff();
        const commits = await this.getCommitsSinceBase(targetBranch);
        const codeReview = await this.reviewChanges();

        const prompt = `Generate a Pull Request description for the following changes:

Repository Context:
- Source Branch: ${context.branch}
- Target Branch: ${targetBranch}
- Repository Stats: ${JSON.stringify(context.stats)}

Changes Overview:
${diff.map(d => `
File: ${d.file}
Changes: +${d.additions}, -${d.deletions}
`).join('\n')}

Commits:
${commits.map(c => `- ${c.hash.slice(0, 7)}: ${c.message}`).join('\n')}

Code Review Comments:
${codeReview.map(c => `- [${c.severity}] ${c.file}: ${c.message}`).join('\n')}

Generate a comprehensive PR description that includes:
1. A clear, concise title that summarizes the changes
2. A detailed description of the changes and their purpose
3. Any breaking changes or important notes
4. Testing instructions
5. Related issues or tickets
6. Suggested reviewers based on code ownership
7. Appropriate labels based on the type of changes`;

        const response = await this.claudeAPI.chat([
            { 
                role: 'system', 
                content: 'You are an expert at creating clear, informative Pull Request descriptions that facilitate efficient code review.'
            },
            { role: 'user', content: prompt }
        ]);

        return this.parsePRDescription(response.content[0].text);
    }

    private async getCommitsSinceBase(baseBranch: string): Promise<Array<{
        hash: string;
        message: string;
        author: string;
        date: string;
    }>> {
        const { stdout } = await execAsync(
            `git log ${baseBranch}..HEAD --pretty=format:"%H%n%s%n%an%n%ad"`,
            { cwd: this.workspaceRoot }
        );

        const commits: Array<{
            hash: string;
            message: string;
            author: string;
            date: string;
        }> = [];

        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length; i += 4) {
            if (i + 3 < lines.length) {
                commits.push({
                    hash: lines[i],
                    message: lines[i + 1],
                    author: lines[i + 2],
                    date: lines[i + 3]
                });
            }
        }

        return commits;
    }

    private parsePRDescription(response: string): {
        title: string;
        body: string;
        reviewers: string[];
        labels: string[];
    } {
        const lines = response.split('\n');
        const title = lines[0];
        
        const sections: Record<string, string[]> = {
            description: [],
            reviewers: [],
            labels: []
        };
        
        let currentSection = 'description';
        
        for (const line of lines.slice(1)) {
            if (line.toLowerCase().startsWith('reviewers:')) {
                currentSection = 'reviewers';
                continue;
            } else if (line.toLowerCase().startsWith('labels:')) {
                currentSection = 'labels';
                continue;
            }
            
            if (line.trim()) {
                sections[currentSection].push(line.trim());
            }
        }

        return {
            title: title.trim(),
            body: sections.description.join('\n'),
            reviewers: sections.reviewers
                .join(' ')
                .split(/[,\s]+/)
                .map(r => r.replace('@', ''))
                .filter(Boolean),
            labels: sections.labels
                .join(' ')
                .split(/[,\s]+/)
                .filter(Boolean)
        };
    }

    async suggestCodeOwners(): Promise<Array<{
        pattern: string;
        owners: string[];
        explanation: string;
    }>> {
        const context = await this.getRepoContext();
        const { stdout: files } = await execAsync('git ls-files', { cwd: this.workspaceRoot });
        const fileList = files.split('\n').filter(Boolean);

        // Get git blame info for all files
        const blameInfo = new Map<string, Map<string, number>>();
        for (const file of fileList) {
            try {
                const blame = await this.getGitBlame(file);
                const authorContributions = new Map<string, number>();
                
                blame.lines.forEach(line => {
                    const count = authorContributions.get(blame.author) || 0;
                    authorContributions.set(blame.author, count + 1);
                });
                
                blameInfo.set(file, authorContributions);
            } catch {
                continue;
            }
        }

        const prompt = `Suggest code owners for the following repository structure:

Repository Stats:
${JSON.stringify(context.stats, null, 2)}

File Ownership Analysis:
${Array.from(blameInfo.entries()).map(([file, authors]) => `
${file}:
${Array.from(authors.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([author, lines]) => `- ${author}: ${lines} lines`)
    .join('\n')}
`).join('\n')}

Generate CODEOWNERS patterns that:
1. Group related files and directories
2. Consider primary and secondary owners
3. Include explanation for each pattern
4. Follow the principle of least privilege
5. Ensure complete coverage of the codebase`;

        const response = await this.claudeAPI.chat([
            { 
                role: 'system', 
                content: 'You are an expert at analyzing repository structure and contribution patterns to suggest optimal code ownership rules.'
            },
            { role: 'user', content: prompt }
        ]);

        return this.parseCodeOwners(response.content[0].text);
    }

    private async getGitBlame(file: string): Promise<GitBlame> {
        const { stdout } = await execAsync(
            `git blame --line-porcelain ${file}`,
            { cwd: this.workspaceRoot }
        );

        const lines = stdout.split('\n');
        const blame: GitBlame = {
            hash: '',
            author: '',
            date: '',
            message: '',
            lines: []
        };

        let currentLine: { number: number; content: string } | null = null;

        for (const line of lines) {
            if (line.startsWith('author ')) {
                blame.author = line.slice(7);
            } else if (line.startsWith('author-time ')) {
                blame.date = new Date(parseInt(line.slice(12)) * 1000).toISOString();
            } else if (line.startsWith('summary ')) {
                blame.message = line.slice(8);
            } else if (line.match(/^\t/)) {
                if (currentLine) {
                    blame.lines.push({
                        number: currentLine.number,
                        content: line.slice(1)
                    });
                }
                currentLine = null;
            } else {
                const match = line.match(/^([0-9a-f]{40}) (\d+)/);
                if (match) {
                    blame.hash = match[1];
                    currentLine = {
                        number: parseInt(match[2]),
                        content: ''
                    };
                }
            }
        }

        return blame;
    }

    private parseCodeOwners(response: string): Array<{
        pattern: string;
        owners: string[];
        explanation: string;
    }> {
        const owners: Array<{
            pattern: string;
            owners: string[];
            explanation: string;
        }> = [];

        const lines = response.split('\n');
        let currentExplanation = '';
        
        for (const line of lines) {
            if (line.startsWith('#')) {
                currentExplanation = line.slice(1).trim();
            } else if (line.trim()) {
                const [pattern, ...ownersList] = line.split(/\s+/);
                owners.push({
                    pattern,
                    owners: ownersList.map(o => o.replace('@', '')),
                    explanation: currentExplanation
                });
                currentExplanation = '';
            }
        }

        return owners;
    }
}
