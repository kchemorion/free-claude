import * as vscode from 'vscode';
import { ClaudeAPI } from './api/claude';
import { CodeGenerator } from './services/codeGenerator';
import { GitIntegration } from './services/gitIntegration';
import { DocumentationGenerator } from './services/documentationGenerator';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize configuration
    const config = vscode.workspace.getConfiguration('claudeAssistant');
    const apiKey = config.get<string>('apiKey');
    
    if (!apiKey) {
        const response = await vscode.window.showWarningMessage(
            'Claude API key not found. Would you like to set it now?',
            'Yes', 'No'
        );
        if (response === 'Yes') {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Claude API key',
                password: true
            });
            if (key) {
                await config.update('apiKey', key, true);
            }
        }
        return;
    }

    // Initialize services
    const claudeAPI = new ClaudeAPI(apiKey);
    const codeGenerator = new CodeGenerator(claudeAPI);
    const gitIntegration = new GitIntegration(claudeAPI);
    const documentationGenerator = new DocumentationGenerator(claudeAPI);

    // Register status bar items
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = "$(symbol-misc) Claude AI";
    statusBarItem.tooltip = "Claude AI Assistant";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    const commands = [
        // Code Generation Commands
        vscode.commands.registerCommand('claude.generateCode', async () => {
            try {
                statusBarItem.text = "$(loading~spin) Generating code...";
                const description = await vscode.window.showInputBox({
                    prompt: 'Describe the code you want to generate',
                    placeHolder: 'e.g., A function that sorts an array using quicksort'
                });
                if (!description) return;

                const options = await vscode.window.showQuickPick([
                    { label: 'TypeScript', language: 'typescript' },
                    { label: 'JavaScript', language: 'javascript' },
                    { label: 'Python', language: 'python' },
                    { label: 'Java', language: 'java' },
                    { label: 'Go', language: 'go' }
                ], {
                    placeHolder: 'Select the programming language'
                });
                if (!options) return;

                await codeGenerator.generateCode(description, {
                    language: options.language,
                    includeComments: true,
                    includeTests: true,
                    generateDocs: true
                });
                
                vscode.window.showInformationMessage('Code generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        }),

        vscode.commands.registerCommand('claude.generateTests', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    throw new Error('No active editor');
                }

                statusBarItem.text = "$(loading~spin) Generating tests...";
                await codeGenerator.generateTests(editor.document, {
                    framework: 'jest',
                    coverage: 80,
                    includeSnapshots: true,
                    includeMocks: true
                });

                vscode.window.showInformationMessage('Tests generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate tests: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        }),

        // Git Integration Commands
        vscode.commands.registerCommand('claude.suggestCommitMessage', async () => {
            try {
                statusBarItem.text = "$(loading~spin) Suggesting commit message...";
                const suggestion = await gitIntegration.suggestCommitMessage();
                
                const message = await vscode.window.showQuickPick([
                    { label: suggestion.message, description: 'Suggested message' },
                    { label: 'Custom message', description: 'Enter your own message' }
                ]);

                if (message?.label === 'Custom message') {
                    const customMessage = await vscode.window.showInputBox({
                        prompt: 'Enter commit message',
                        value: suggestion.message
                    });
                    if (customMessage) {
                        await vscode.commands.executeCommand('git.commit', customMessage);
                    }
                } else if (message) {
                    await vscode.commands.executeCommand('git.commit', message.label);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to suggest commit message: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        }),

        vscode.commands.registerCommand('claude.reviewChanges', async () => {
            try {
                statusBarItem.text = "$(loading~spin) Reviewing changes...";
                const comments = await gitIntegration.reviewChanges();
                
                // Create and show review panel
                const panel = vscode.window.createWebviewPanel(
                    'codeReview',
                    'Code Review',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = generateReviewHtml(comments);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to review changes: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        }),

        vscode.commands.registerCommand('claude.generatePRDescription', async () => {
            try {
                statusBarItem.text = "$(loading~spin) Generating PR description...";
                const description = await gitIntegration.generatePRDescription();
                
                // Create and show PR description panel
                const panel = vscode.window.createWebviewPanel(
                    'prDescription',
                    'Pull Request Description',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = generatePRDescriptionHtml(description);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate PR description: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        }),

        // Documentation Commands
        vscode.commands.registerCommand('claude.generateDocumentation', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    throw new Error('No active editor');
                }

                statusBarItem.text = "$(loading~spin) Generating documentation...";
                await documentationGenerator.generateDocumentation(editor.document);
                vscode.window.showInformationMessage('Documentation generated successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate documentation: ${error}`);
            } finally {
                statusBarItem.text = "$(symbol-misc) Claude AI";
            }
        })
    ];

    context.subscriptions.push(...commands);

    // Register code actions
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        {
            provideCodeActions(document, range, context, token) {
                const actions: vscode.CodeAction[] = [];
                
                // Add code generation action
                const generateAction = new vscode.CodeAction(
                    'Generate code with Claude AI',
                    vscode.CodeActionKind.RefactorRewrite
                );
                generateAction.command = {
                    title: 'Generate code',
                    command: 'claude.generateCode'
                };
                actions.push(generateAction);

                // Add test generation action
                const testAction = new vscode.CodeAction(
                    'Generate tests with Claude AI',
                    vscode.CodeActionKind.RefactorRewrite
                );
                testAction.command = {
                    title: 'Generate tests',
                    command: 'claude.generateTests'
                };
                actions.push(testAction);

                return actions;
            }
        }
    );
    context.subscriptions.push(codeActionProvider);
}

function generateReviewHtml(comments: any[]): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .comment { margin-bottom: 20px; padding: 10px; border-radius: 5px; }
                .error { background-color: #ffe6e6; }
                .warning { background-color: #fff3e6; }
                .info { background-color: #e6f3ff; }
                .file { font-weight: bold; }
                .message { margin-top: 5px; }
                .suggestion { margin-top: 5px; font-style: italic; }
            </style>
        </head>
        <body>
            <h2>Code Review Comments</h2>
            ${comments.map(comment => `
                <div class="comment ${comment.severity}">
                    <div class="file">${comment.file}:${comment.line}</div>
                    <div class="message">${comment.message}</div>
                    ${comment.suggestion ? `<div class="suggestion">Suggestion: ${comment.suggestion}</div>` : ''}
                </div>
            `).join('')}
        </body>
        </html>
    `;
}

function generatePRDescriptionHtml(description: any): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                .section { margin-bottom: 20px; }
                .section-title { font-weight: bold; margin-bottom: 10px; }
                .reviewers, .labels { display: flex; gap: 5px; flex-wrap: wrap; }
                .reviewer, .label { 
                    padding: 5px 10px; 
                    border-radius: 15px; 
                    background-color: #e6f3ff;
                }
            </style>
        </head>
        <body>
            <div class="title">${description.title}</div>
            <div class="section">
                <div class="section-title">Description</div>
                <div>${description.body}</div>
            </div>
            <div class="section">
                <div class="section-title">Reviewers</div>
                <div class="reviewers">
                    ${description.reviewers.map(r => `<div class="reviewer">@${r}</div>`).join('')}
                </div>
            </div>
            <div class="section">
                <div class="section-title">Labels</div>
                <div class="labels">
                    ${description.labels.map(l => `<div class="label">${l}</div>`).join('')}
                </div>
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {}
