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
            const prompt = `Generate comprehensive documentation for this code:

${code}

Include:
1. Overview of functionality
2. API documentation
3. Usage examples
4. Parameters and return types
5. Dependencies and requirements`;

            const response = await this.claudeAPI.sendMessage(prompt);
            
            // Create documentation file
            const docUri = this.getDocumentationUri(document.uri);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(docUri, { ignoreIfExists: true });
            edit.insert(docUri, new vscode.Position(0, 0), response.content);
            
            await vscode.workspace.applyEdit(edit);
            await vscode.window.showTextDocument(docUri);
        } catch (error) {
            throw new Error(`Failed to generate documentation: ${error}`);
        }
    }

    async generateAPIDocumentation(document: vscode.TextDocument, options: APIDocumentationOptions = {}): Promise<void> {
        try {
            const code = document.getText();
            const prompt = `Generate API documentation for this code:

${code}

Include:
1. API endpoint details
2. Request/response examples
3. Authentication information
4. Parameters and return types
5. Dependencies and requirements`;

            const response = await this.claudeAPI.sendMessage(prompt);
            
            // Create API documentation file
            const docUri = this.getAPIDocumentationUri(document.uri);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(docUri, { ignoreIfExists: true });
            edit.insert(docUri, new vscode.Position(0, 0), response.content);
            
            await vscode.workspace.applyEdit(edit);
            await vscode.window.showTextDocument(docUri);
        } catch (error) {
            throw new Error(`Failed to generate API documentation: ${error}`);
        }
    }

    async generateReadme(): Promise<ReadmeSection[]> {
        try {
            const prompt = `Generate a README.md file structure with sections`;
            const response = await this.claudeAPI.sendMessage(prompt);
            
            // Convert the response into ReadmeSection array
            const sections: ReadmeSection[] = [
                {
                    title: 'Overview',
                    content: response.content,
                    order: 1
                }
            ];
            
            return sections;
        } catch (error) {
            throw new Error(`Failed to generate README: ${error}`);
        }
    }

    async generateChangelog(): Promise<ChangelogEntry[]> {
        try {
            const prompt = `Generate a changelog structure`;
            const response = await this.claudeAPI.sendMessage(prompt);
            
            // Convert the response into ChangelogEntry array
            const entries: ChangelogEntry[] = [
                {
                    version: '1.0.0',
                    date: new Date().toISOString(),
                    changes: [
                        {
                            type: 'added',
                            description: 'Initial release'
                        }
                    ]
                }
            ];
            
            return entries;
        } catch (error) {
            throw new Error(`Failed to generate changelog: ${error}`);
        }
    }

    private getDocumentationUri(sourceUri: vscode.Uri): vscode.Uri {
        const path = sourceUri.path;
        return sourceUri.with({
            path: path.replace(/\.[^.]+$/, '.md')
        });
    }

    private getAPIDocumentationUri(sourceUri: vscode.Uri): vscode.Uri {
        const path = sourceUri.path;
        return sourceUri.with({
            path: path.replace(/\.[^.]+$/, '.api.md')
        });
    }
}