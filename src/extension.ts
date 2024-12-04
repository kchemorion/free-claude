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

        // Register views
        const sidebarProvider = new SidebarProvider(context.extensionUri, claudeAPI);
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                SidebarProvider.viewType,
                sidebarProvider
            )
        );

        // Register commands
        // Register commands
        context.subscriptions.push(
            vscode.commands.registerCommand('claudeAssistant.generateCode', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await codeGenerator.generateCode('', editor.document.languageId);
                }
            }),
            vscode.commands.registerCommand('claudeAssistant.generateTests', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await codeGenerator.generateTests(editor.document);
                }
            }),
            vscode.commands.registerCommand('claudeAssistant.suggestCommitMessage', async () => {
                await gitIntegration.suggestCommitMessage();
            }),
            vscode.commands.registerCommand('claudeAssistant.reviewChanges', async () => {
                await gitIntegration.reviewChanges();
            }),
            vscode.commands.registerCommand('claudeAssistant.generatePRDescription', async () => {
                await gitIntegration.generatePRDescription();
            }),
            vscode.commands.registerCommand('claudeAssistant.generateDocumentation', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await documentationGenerator.generateDocumentation(editor.document);
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