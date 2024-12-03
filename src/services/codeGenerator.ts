import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import { ICodeGenerator, CodeGenerationOptions, TestGenerationOptions } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

interface DependencyInfo {
    name: string;
    version: string;
    type: 'production' | 'development';
}

interface CodeAnalysis {
    complexity: number;
    dependencies: string[];
    potentialIssues: string[];
    suggestions: string[];
}

export class CodeGenerator implements ICodeGenerator {
    private contextCache: Map<string, any> = new Map();
    private static readonly QUALITY_THRESHOLD = 0.8;

    constructor(private claudeAPI: ClaudeAPI) {}

    async generateCode(description: string, options: CodeGenerationOptions = {}): Promise<void> {
        try {
            // Gather context from workspace
            const context = await this.gatherContext();
            const prompt = await this.buildEnhancedCodeGenerationPrompt(description, context, options);
            
            const response = await this.claudeAPI.chat([
                { 
                    role: 'system', 
                    content: 'You are an expert code generator with deep knowledge of software architecture, design patterns, and best practices. Generate production-ready code that is secure, efficient, and maintainable.'
                },
                { role: 'user', content: prompt }
            ]);

            const generatedCode = this.extractCodeFromResponse(response.content[0].text);
            if (!generatedCode) {
                throw new Error('No code was generated');
            }

            // Analyze generated code quality
            const analysis = await this.analyzeCode(generatedCode);
            if (analysis.complexity > 20) {
                vscode.window.showWarningMessage('Generated code has high complexity. Consider breaking it down into smaller functions.');
            }

            // Handle dependencies
            const dependencies = await this.extractDependencies(generatedCode);
            await this.manageDependencies(dependencies);

            // Create and format the file
            const fileName = await this.suggestFileName(description, options.language);
            const uri = vscode.Uri.file(fileName);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(uri, { ignoreIfExists: true });
            edit.insert(uri, new vscode.Position(0, 0), generatedCode);

            await vscode.workspace.applyEdit(edit);
            await this.formatDocument(uri);
            await vscode.window.showTextDocument(uri);

            // Generate accompanying documentation if requested
            if (options.generateDocs) {
                await this.generateDocumentation(uri, generatedCode);
            }

            vscode.window.showInformationMessage('Code generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate code: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async generateTests(document: vscode.TextDocument, options: TestGenerationOptions = {}): Promise<void> {
        try {
            const sourceCode = document.getText();
            const context = await this.gatherContext();
            const prompt = await this.buildEnhancedTestGenerationPrompt(sourceCode, context, options);
            
            const response = await this.claudeAPI.chat([
                { 
                    role: 'system', 
                    content: 'You are a testing expert with deep knowledge of testing frameworks, methodologies, and best practices. Generate comprehensive tests that ensure code reliability and maintainability.'
                },
                { role: 'user', content: prompt }
            ]);

            const generatedTests = this.extractCodeFromResponse(response.content[0].text);
            if (!generatedTests) {
                throw new Error('No tests were generated');
            }

            // Add test dependencies
            const testDependencies = this.extractTestDependencies(generatedTests, options.framework);
            await this.manageDependencies(testDependencies);

            // Create test file
            const testFileName = this.getTestFileName(document.fileName);
            const uri = vscode.Uri.file(testFileName);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(uri, { ignoreIfExists: true });
            edit.insert(uri, new vscode.Position(0, 0), generatedTests);

            await vscode.workspace.applyEdit(edit);
            await this.formatDocument(uri);
            await vscode.window.showTextDocument(uri);

            // Generate test documentation if requested
            if (options.generateTestDocs) {
                await this.generateTestDocumentation(uri, generatedTests);
            }

            vscode.window.showInformationMessage('Tests generated successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    private async gatherContext(): Promise<any> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        // Cache context for 5 minutes
        const cacheKey = 'workspace-context';
        const cachedContext = this.contextCache.get(cacheKey);
        if (cachedContext && Date.now() - cachedContext.timestamp < 300000) {
            return cachedContext.data;
        }

        const context = {
            dependencies: await this.getProjectDependencies(workspaceRoot),
            configuration: await this.getProjectConfiguration(workspaceRoot),
            openFiles: this.getOpenFiles(),
            gitInfo: await this.getGitInfo(workspaceRoot),
            timestamp: Date.now()
        };

        this.contextCache.set(cacheKey, context);
        return context;
    }

    private async buildEnhancedCodeGenerationPrompt(description: string, context: any, options: CodeGenerationOptions): Promise<string> {
        let prompt = `Generate production-ready code for the following description:\n${description}\n\n`;
        
        // Add language and framework context
        if (options.language) {
            prompt += `Language: ${options.language}\n`;
            prompt += `Language Version: ${context.configuration?.languageVersion || 'latest'}\n`;
        }
        if (options.framework) {
            prompt += `Framework: ${options.framework}\n`;
            prompt += `Framework Version: ${context.configuration?.frameworkVersion || 'latest'}\n`;
        }

        // Add project context
        prompt += '\nProject Context:\n';
        prompt += `- Dependencies: ${JSON.stringify(context.dependencies)}\n`;
        prompt += `- Configuration: ${JSON.stringify(context.configuration)}\n`;
        prompt += `- Git Branch: ${context.gitInfo?.branch || 'unknown'}\n`;

        // Add requirements
        prompt += '\nRequirements:\n';
        prompt += '- Follow SOLID principles and clean code practices\n';
        prompt += '- Include proper error handling and input validation\n';
        prompt += '- Add comprehensive type definitions\n';
        prompt += '- Optimize for performance and maintainability\n';
        prompt += '- Follow project coding standards\n';

        if (options.includeComments) {
            prompt += '- Include detailed comments explaining complex logic\n';
        }
        if (options.includeTests) {
            prompt += '- Include unit tests with good coverage\n';
        }

        return prompt;
    }

    private async buildEnhancedTestGenerationPrompt(sourceCode: string, context: any, options: TestGenerationOptions): Promise<string> {
        let prompt = `Generate comprehensive tests for the following code:\n\`\`\`\n${sourceCode}\n\`\`\`\n\n`;
        
        // Add testing framework context
        if (options.framework) {
            prompt += `Test Framework: ${options.framework}\n`;
        }
        if (options.coverage) {
            prompt += `Target Coverage: ${options.coverage}%\n`;
        }

        // Add project context
        prompt += '\nProject Context:\n';
        prompt += `- Test Dependencies: ${JSON.stringify(context.dependencies)}\n`;
        prompt += `- Test Configuration: ${JSON.stringify(context.configuration?.test)}\n`;

        // Add testing requirements
        prompt += '\nTesting Requirements:\n';
        prompt += '- Cover all edge cases and error scenarios\n';
        prompt += '- Include input validation tests\n';
        prompt += '- Test error handling\n';
        prompt += '- Follow testing best practices\n';
        prompt += '- Use meaningful test descriptions\n';

        if (options.includeSnapshots) {
            prompt += '- Include snapshot tests where appropriate\n';
        }
        if (options.includeMocks) {
            prompt += '- Include mocks for external dependencies\n';
        }

        return prompt;
    }

    private async analyzeCode(code: string): Promise<CodeAnalysis> {
        // Implement code analysis using AST parsing or other methods
        return {
            complexity: this.calculateComplexity(code),
            dependencies: this.findDependencies(code),
            potentialIssues: this.findPotentialIssues(code),
            suggestions: this.generateSuggestions(code)
        };
    }

    private calculateComplexity(code: string): number {
        // Implement cyclomatic complexity calculation
        const branchingKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', '&&', '||'];
        return branchingKeywords.reduce((count, keyword) => 
            count + (code.match(new RegExp(keyword, 'g')) || []).length, 1);
    }

    private findDependencies(code: string): string[] {
        // Extract import statements and required packages
        const importRegex = /(?:import|require)\s+[{]?([^}]+)[}]?\s+from\s+['"]([^'"]+)['"]/g;
        const matches = Array.from(code.matchAll(importRegex));
        return matches.map(match => match[2]);
    }

    private findPotentialIssues(code: string): string[] {
        const issues: string[] = [];
        
        // Check for common issues
        if (code.includes('console.log')) {
            issues.push('Contains console.log statements');
        }
        if (code.includes('any')) {
            issues.push('Uses "any" type - consider using more specific types');
        }
        if (code.includes('TODO')) {
            issues.push('Contains TODO comments');
        }

        return issues;
    }

    private generateSuggestions(code: string): string[] {
        const suggestions: string[] = [];
        
        // Add improvement suggestions
        if (!code.includes('try') && !code.includes('catch')) {
            suggestions.push('Consider adding error handling');
        }
        if (!code.includes('@param') && !code.includes('@returns')) {
            suggestions.push('Add JSDoc comments for better documentation');
        }
        if (code.split('\n').some(line => line.length > 100)) {
            suggestions.push('Some lines exceed recommended length of 100 characters');
        }

        return suggestions;
    }

    private async manageDependencies(dependencies: DependencyInfo[]): Promise<void> {
        const packageJsonPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, 'package.json');
        
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            let modified = false;

            for (const dep of dependencies) {
                const target = dep.type === 'production' ? 'dependencies' : 'devDependencies';
                if (!packageJson[target]) {
                    packageJson[target] = {};
                }
                if (!packageJson[target][dep.name]) {
                    packageJson[target][dep.name] = dep.version;
                    modified = true;
                }
            }

            if (modified) {
                await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
                vscode.window.showInformationMessage('Dependencies updated. Run npm install to install new packages.');
            }
        } catch (error) {
            console.error('Error managing dependencies:', error);
        }
    }

    private async formatDocument(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.commands.executeCommand('editor.action.formatDocument', document);
        } catch (error) {
            console.error('Error formatting document:', error);
        }
    }

    private async generateDocumentation(uri: vscode.Uri, code: string): Promise<void> {
        // Implement documentation generation
        const docUri = vscode.Uri.file(uri.fsPath.replace(/\.[^.]+$/, '.md'));
        const prompt = `Generate comprehensive documentation for this code:\n\`\`\`\n${code}\n\`\`\`\n`;
        
        const response = await this.claudeAPI.chat([
            { role: 'system', content: 'Generate clear and comprehensive documentation.' },
            { role: 'user', content: prompt }
        ]);

        const documentation = response.content[0].text;
        const edit = new vscode.WorkspaceEdit();
        edit.createFile(docUri, { ignoreIfExists: true });
        edit.insert(docUri, new vscode.Position(0, 0), documentation);
        await vscode.workspace.applyEdit(edit);
    }

    private async getProjectDependencies(workspaceRoot: string): Promise<Record<string, string>> {
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            return {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
        } catch (error) {
            return {};
        }
    }

    private async getProjectConfiguration(workspaceRoot: string): Promise<any> {
        try {
            const configFiles = [
                '.eslintrc',
                'tsconfig.json',
                'jest.config.js',
                'babel.config.js'
            ];

            const config: Record<string, any> = {};
            for (const file of configFiles) {
                const filePath = path.join(workspaceRoot, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    config[file] = JSON.parse(content);
                } catch {
                    // Ignore missing config files
                }
            }
            return config;
        } catch (error) {
            return {};
        }
    }

    private getOpenFiles(): string[] {
        return vscode.workspace.textDocuments
            .filter(doc => !doc.isUntitled)
            .map(doc => doc.fileName);
    }

    private async getGitInfo(workspaceRoot: string): Promise<any> {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            const [branch, remotes] = await Promise.all([
                execAsync('git rev-parse --abbrev-ref HEAD', { cwd: workspaceRoot }),
                execAsync('git remote -v', { cwd: workspaceRoot })
            ]);

            return {
                branch: branch.stdout.trim(),
                remotes: remotes.stdout.trim()
            };
        } catch (error) {
            return {};
        }
    }
}
