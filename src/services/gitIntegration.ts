import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

export class GitIntegration {
    constructor(private claudeAPI: ClaudeAPI) {}

    async suggestCommitMessage(): Promise<string> {
        try {
            const { stdout: diff } = await exec('git diff --cached');
            if (!diff) {
                throw new Error('No staged changes found');
            }

            const prompt = `Suggest a commit message for these changes:

${diff}

Requirements:
1. Follow conventional commits format
2. Be concise but descriptive
3. Include scope if relevant
4. Include breaking change footer if needed`;

            const response = await this.claudeAPI.sendMessage(prompt);
            return response.content.trim();
        } catch (error) {
            throw new Error(`Failed to suggest commit message: ${error}`);
        }
    }

    async reviewChanges(): Promise<void> {
        try {
            const { stdout: diff } = await exec('git diff');
            if (!diff) {
                throw new Error('No changes found');
            }

            const prompt = `Review these code changes and provide feedback:

${diff}

Requirements:
1. Identify potential issues
2. Suggest improvements
3. Point out security concerns
4. Comment on code style`;

            const response = await this.claudeAPI.sendMessage(prompt);
            
            // Create and show review panel
            const panel = vscode.window.createWebviewPanel(
                'codeReview',
                'Code Review',
                vscode.ViewColumn.Two,
                { enableScripts: true }
            );

            panel.webview.html = this.generateReviewHtml(response.content);
        } catch (error) {
            throw new Error(`Failed to review changes: ${error}`);
        }
    }

    async generatePRDescription(): Promise<string> {
        try {
            const { stdout: diff } = await exec('git diff main...HEAD');
            if (!diff) {
                throw new Error('No changes found');
            }

            const prompt = `Generate a Pull Request description for these changes:

${diff}

Requirements:
1. Include a clear title
2. Describe the changes
3. List key modifications
4. Mention any breaking changes
5. Include testing instructions`;

            const response = await this.claudeAPI.sendMessage(prompt);
            return response.content.trim();
        } catch (error) {
            throw new Error(`Failed to generate PR description: ${error}`);
        }
    }

    private generateReviewHtml(content: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .review-section {
                        margin-bottom: 20px;
                        padding: 10px;
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 4px;
                    }
                    .review-title {
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    pre {
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                </style>
            </head>
            <body>
                <div class="review-section">
                    <div class="review-title">Code Review Feedback</div>
                    <pre>${content}</pre>
                </div>
            </body>
            </html>
        `;
    }
}