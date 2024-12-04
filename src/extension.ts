import * as vscode from 'vscode';
import { ClaudeAPI } from './api/claude';
import { CodeGenerator } from './services/codeGenerator';
import { GitIntegration } from './services/gitIntegration';
import { DocumentationGenerator } from './services/documentationGenerator';
import { SidebarProvider } from './webview/SidebarProvider';

export async function activate(context: vscode.ExtensionContext) {
    try {
        const config = vscode.workspace.getConfiguration('claude');
        const model = config.get('model') || 'claude-3-sonnet-20240229';
        const isClaudeThree = model.startsWith('claude-3');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': isClaudeThree ? '2024-02-29' : '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: isClaudeThree ? 4096 : 1000,
                messages: [{
                    role: 'user',
                    content: question
                }]
            })
        );

        // Show welcome message
        vscode.window.showInformationMessage('Claude Assistant is now active! Click the Claude icon in the activity bar to start chatting.');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to activate extension: ${error}`);
    }
}

export function deactivate() {}
