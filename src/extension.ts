import * as vscode from 'vscode';
import { ClaudeAPI } from './api/claude';
import { CodeGenerator } from './services/codeGenerator';
import { GitIntegration } from './services/gitIntegration';
import { DocumentationGenerator } from './services/documentationGenerator';
import { SidebarProvider } from './webview/SidebarProvider';

export async function activate(context: vscode.ExtensionContext) {
    try {
        const claudeAPI = new ClaudeAPI();
        const codeGenerator = new CodeGenerator(claudeAPI);
        const gitIntegration = new GitIntegration(claudeAPI);
        const documentationGenerator = new DocumentationGenerator(claudeAPI);

        // Register sidebar provider
        const sidebarProvider = new SidebarProvider(context.extensionUri, claudeAPI);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SidebarProvider.viewType,
                sidebarProvider
            )
        );

        // Register code generation commands
        context.subscriptions.push(
            vscode.commands.registerCommand('claudeAssistant.generateCode', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                const language = editor.document.languageId;
                const prompt = await vscode.window.showInputBox({
                    prompt: 'Enter code generation prompt',
                    placeHolder: 'e.g., Create a function that sorts an array'
                });

                if (!prompt) return;

                try {
                    await codeGenerator.generateCode(prompt, language);
                } catch (error) {
                    vscode.window.showErrorMessage(`Code generation failed: ${error}`);
                }
            }),

            vscode.commands.registerCommand('claudeAssistant.generateTests', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                try {
                    await codeGenerator.generateTests(editor.document);
                } catch (error) {
                    vscode.window.showErrorMessage(`Test generation failed: ${error}`);
                }
            }),

            // Git integration commands
            vscode.commands.registerCommand('claudeAssistant.suggestCommitMessage', async () => {
                try {
                    const message = await gitIntegration.suggestCommitMessage();
                    if (message) {
                        await vscode.env.clipboard.writeText(message);
                        vscode.window.showInformationMessage('Commit message copied to clipboard');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to suggest commit message: ${error}`);
                }
            }),

            vscode.commands.registerCommand('claudeAssistant.reviewChanges', async () => {
                try {
                    await gitIntegration.reviewChanges();
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to review changes: ${error}`);
                }
            }),

            vscode.commands.registerCommand('claudeAssistant.generatePRDescription', async () => {
                try {
                    const description = await gitIntegration.generatePRDescription();
                    if (description) {
                        await vscode.env.clipboard.writeText(description);
                        vscode.window.showInformationMessage('PR description copied to clipboard');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to generate PR description: ${error}`);
                }
            }),

            // Documentation commands
            vscode.commands.registerCommand('claudeAssistant.generateDocumentation', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor');
                    return;
                }

                try {
                    await documentationGenerator.generateDocumentation(editor.document);
                } catch (error) {
                    vscode.window.showErrorMessage(`Documentation generation failed: ${error}`);
                }
            })
        );

        // Show welcome message
        vscode.window.showInformationMessage('Claude Assistant is now active! Click the Claude icon in the activity bar to start chatting.');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate extension: ${error}`);
    }
}

export function deactivate() {}
