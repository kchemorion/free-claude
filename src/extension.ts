import * as vscode from 'vscode';
import { AIService } from './services/aiService';
import { FileManager } from './services/fileManager';
import { ChatPanel } from './webview/ChatPanel';

export function activate(context: vscode.ExtensionContext) {
    const fileManager = new FileManager(context);
    const aiService = new AIService(context, fileManager);

    let disposable = vscode.commands.registerCommand('claude-vscode.openChat', () => {
        ChatPanel.createOrShow(context, aiService, fileManager);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Clean up resources
}