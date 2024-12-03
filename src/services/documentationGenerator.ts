import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import { IDocumentationGenerator, DocumentationOptions, APIDocumentationOptions, ReadmeSection, ChangelogEntry } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

export class DocumentationGenerator implements IDocumentationGenerator {
    constructor(private claudeAPI: ClaudeAPI) {}

    async generateDocumentation(document: vscode.TextDocument, options: DocumentationOptions = {}): Promise<void> {
        try {
            const code = document.getText();
            const language = this.getLanguage(document.fileName);
            const prompt = this.buildDocumentationPrompt(code, language, options);
            
            const response = await this.claudeAPI.chat([
                { role: 'system', content: 'You are a documentation expert. Generate clear, comprehensive documentation following the specified format and best practices.' },
                { role: 'user', content: prompt }
            ]);

            const documentation = this.extractDocumentation(response.content[0].text, options.format);
            await this.insertDocumentation(document, documentation);
            vscode.window.showInformationMessage('Documentation generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async generateAPIDocumentation(document: vscode.TextDocument, options: APIDocumentationOptions = {}): Promise<void> {
        try {
            const code = document.getText();
            const language = this.getLanguage(document.fileName);
            const prompt = this.buildAPIDocumentationPrompt(code, language, options);
            
            const response = await this.claudeAPI.chat([
                { role: 'system', content: 'You are an API documentation expert. Generate clear, comprehensive API documentation following the specified format and best practices.' },
                { role: 'user', content: prompt }
            ]);

            const documentation = this.extractDocumentation(response.content[0].text, options.format);
            await this.insertDocumentation(document, documentation);
            vscode.window.showInformationMessage('API documentation generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate API documentation: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async generateReadme(): Promise<ReadmeSection[]> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }

            const projectInfo = await this.gatherProjectInfo(workspaceRoot);
            const prompt = this.buildReadmePrompt(projectInfo);
            
            const response = await this.claudeAPI.chat([
                { role: 'system', content: 'You are a documentation expert. Generate a comprehensive README.md file following best practices.' },
                { role: 'user', content: prompt }
            ]);

            const sections = this.parseReadmeSections(response.content[0].text);
            await this.writeReadme(workspaceRoot, sections);
            return sections;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate README: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async generateChangelog(): Promise<ChangelogEntry[]> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }

            const gitLog = await this.getGitLog(workspaceRoot);
            const prompt = this.buildChangelogPrompt(gitLog);
            
            const response = await this.claudeAPI.chat([
                { role: 'system', content: 'You are a changelog expert. Generate a comprehensive changelog following the Keep a Changelog format.' },
                { role: 'user', content: prompt }
            ]);

            const entries = this.parseChangelogEntries(response.content[0].text);
            await this.writeChangelog(workspaceRoot, entries);
            return entries;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate changelog: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    private getLanguage(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: Record<string, string> = {
            '.ts': 'TypeScript',
            '.js': 'JavaScript',
            '.py': 'Python',
            '.java': 'Java',
            '.cs': 'C#',
            '.go': 'Go',
            '.rs': 'Rust'
        };
        return languageMap[ext] || 'Unknown';
    }

    private buildDocumentationPrompt(code: string, language: string, options: DocumentationOptions): string {
        let prompt = `Generate documentation for the following ${language} code:\n\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (options.format) {
            prompt += `Format: ${options.format}\n`;
        }
        if (options.includeExamples) {
            prompt += 'Include usage examples\n';
        }
        if (options.includeTypes) {
            prompt += 'Include type information\n';
        }
        if (options.includeReturns) {
            prompt += 'Include return value descriptions\n';
        }

        prompt += '\nProvide clear and comprehensive documentation that follows best practices.';
        return prompt;
    }

    private buildAPIDocumentationPrompt(code: string, language: string, options: APIDocumentationOptions): string {
        let prompt = `Generate API documentation for the following ${language} code:\n\`\`\`\n${code}\n\`\`\`\n\n`;
        
        if (options.format) {
            prompt += `Format: ${options.format}\n`;
        }
        if (options.includeEndpoints) {
            prompt += 'Include endpoint details\n';
        }
        if (options.includeRequestResponse) {
            prompt += 'Include request/response examples\n';
        }
        if (options.includeAuthentication) {
            prompt += 'Include authentication information\n';
        }

        prompt += '\nProvide clear and comprehensive API documentation that follows best practices.';
        return prompt;
    }

    private async gatherProjectInfo(workspaceRoot: string): Promise<any> {
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            
            const files = await fs.readdir(workspaceRoot, { withFileTypes: true });
            const sourceFiles = files
                .filter(file => file.isFile() && /\.(ts|js|py|java|cs|go|rs)$/.test(file.name))
                .map(file => file.name);

            return {
                name: packageJson.name,
                version: packageJson.version,
                description: packageJson.description,
                dependencies: packageJson.dependencies,
                devDependencies: packageJson.devDependencies,
                sourceFiles
            };
        } catch (error) {
            console.error('Error gathering project info:', error);
            return {};
        }
    }

    private async getGitLog(workspaceRoot: string): Promise<string> {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const { stdout } = await execAsync(
                'git log --pretty=format:"%h %s" --reverse',
                { cwd: workspaceRoot }
            );
            return stdout;
        } catch (error) {
            console.error('Error getting git log:', error);
            return '';
        }
    }

    private extractDocumentation(response: string, format?: string): string {
        if (!format || format === 'markdown') {
            return response;
        }

        const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/;
        const match = response.match(codeBlockRegex);
        return match ? match[1].trim() : response;
    }

    private async insertDocumentation(document: vscode.TextDocument, documentation: string): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const firstLine = document.lineAt(0);
        edit.insert(document.uri, firstLine.range.start, documentation + '\n\n');
        await vscode.workspace.applyEdit(edit);
    }

    private parseReadmeSections(response: string): ReadmeSection[] {
        const sections: ReadmeSection[] = [];
        let currentSection: Partial<ReadmeSection> = {};
        let content: string[] = [];

        const lines = response.split('\n');
        let order = 0;

        for (const line of lines) {
            if (line.startsWith('#')) {
                if (currentSection.title) {
                    sections.push({
                        title: currentSection.title,
                        content: content.join('\n').trim(),
                        order: order++
                    });
                    content = [];
                }
                currentSection.title = line.replace(/^#+\s*/, '');
            } else {
                content.push(line);
            }
        }

        if (currentSection.title) {
            sections.push({
                title: currentSection.title,
                content: content.join('\n').trim(),
                order: order
            });
        }

        return sections;
    }

    private parseChangelogEntries(response: string): ChangelogEntry[] {
        const entries: ChangelogEntry[] = [];
        const lines = response.split('\n');
        let currentEntry: Partial<ChangelogEntry> = {};
        let currentChanges: { type: string; description: string }[] = [];

        for (const line of lines) {
            if (line.startsWith('## ')) {
                if (currentEntry.version) {
                    entries.push({
                        version: currentEntry.version!,
                        date: currentEntry.date!,
                        changes: currentChanges
                    });
                    currentChanges = [];
                }
                const [version, date] = line.replace('## ', '').split(' - ');
                currentEntry = { version, date };
            } else if (line.startsWith('### ')) {
                const type = line.replace('### ', '').toLowerCase() as any;
                const nextLine = lines[lines.indexOf(line) + 1];
                if (nextLine && nextLine.startsWith('- ')) {
                    currentChanges.push({
                        type,
                        description: nextLine.replace('- ', '')
                    });
                }
            }
        }

        if (currentEntry.version) {
            entries.push({
                version: currentEntry.version,
                date: currentEntry.date!,
                changes: currentChanges
            });
        }

        return entries;
    }

    private async writeReadme(workspaceRoot: string, sections: ReadmeSection[]): Promise<void> {
        const content = sections
            .sort((a, b) => a.order - b.order)
            .map(section => `# ${section.title}\n\n${section.content}`)
            .join('\n\n');

        const readmePath = path.join(workspaceRoot, 'README.md');
        await fs.writeFile(readmePath, content);
        vscode.window.showInformationMessage('README.md generated successfully!');
    }

    private async writeChangelog(workspaceRoot: string, entries: ChangelogEntry[]): Promise<void> {
        const content = ['# Changelog', '', 'All notable changes to this project will be documented in this file.', ''];

        entries.forEach(entry => {
            content.push(`## ${entry.version} - ${entry.date}`);
            const changesByType = new Map<string, string[]>();
            
            entry.changes.forEach(change => {
                if (!changesByType.has(change.type)) {
                    changesByType.set(change.type, []);
                }
                changesByType.get(change.type)!.push(`- ${change.description}`);
            });

            for (const [type, changes] of changesByType) {
                content.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}`);
                content.push(...changes);
                content.push('');
            }
        });

        const changelogPath = path.join(workspaceRoot, 'CHANGELOG.md');
        await fs.writeFile(changelogPath, content.join('\n'));
        vscode.window.showInformationMessage('CHANGELOG.md generated successfully!');
    }
}
