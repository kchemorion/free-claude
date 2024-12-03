import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { ClaudeAPI } from './api/claude';
import { StorageService } from './services/storage';
import { FileManager } from './services/fileManager';
import { ChatPanel } from './webview/ChatPanel';
import { Message, CommandPermissionRequest, FileChangeRequest } from './types';

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude AI Assistant is now active');

    // Initialize services
    const storageService = new StorageService(context);
    const fileManager = new FileManager(context);
    const claudeAPI = new ClaudeAPI();
    let currentConversationId: string | undefined;

    // Register commands
    let disposables: vscode.Disposable[] = [];

    disposables.push(
        vscode.commands.registerCommand('claude.openChat', () => {
            ChatPanel.createOrShow(context.extensionUri);
        })
    );

    disposables.push(
        vscode.commands.registerCommand('claude.analyzeCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = selection.isEmpty
                ? document.getText()
                : document.getText(selection);

            try {
                const analysis = await claudeAPI.analyzeCode(text);
                ChatPanel.createOrShow(context.extensionUri);
                if (ChatPanel.currentPanel) {
                    ChatPanel.currentPanel.addMessage({
                        id: uuidv4(),
                        role: 'assistant',
                        content: analysis,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to analyze code: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );

    disposables.push(
        vscode.commands.registerCommand('claude.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = selection.isEmpty
                ? document.getText()
                : document.getText(selection);

            try {
                const explanation = await claudeAPI.explainCode(text);
                ChatPanel.createOrShow(context.extensionUri);
                if (ChatPanel.currentPanel) {
                    ChatPanel.currentPanel.addMessage({
                        id: uuidv4(),
                        role: 'assistant',
                        content: explanation,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to explain code: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );

    disposables.push(
        vscode.commands.registerCommand('claude.suggestImprovements', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found');
                return;
            }

            const document = editor.document;
            const selection = editor.selection;
            const text = selection.isEmpty
                ? document.getText()
                : document.getText(selection);

            try {
                const suggestions = await claudeAPI.suggestImprovements(text);
                ChatPanel.createOrShow(context.extensionUri);
                if (ChatPanel.currentPanel) {
                    ChatPanel.currentPanel.addMessage({
                        id: uuidv4(),
                        role: 'assistant',
                        content: suggestions,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to suggest improvements: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );

    disposables.push(
        vscode.commands.registerCommand('claude.sendMessage', async (text: string) => {
            if (!currentConversationId) {
                currentConversationId = uuidv4();
                await storageService.createConversation({
                    id: currentConversationId,
                    title: text.slice(0, 50) + '...',
                    messages: [],
                    created: Date.now(),
                    lastUpdated: Date.now()
                });
            }

            const userMessage: Message = {
                id: uuidv4(),
                role: 'user',
                content: text,
                timestamp: Date.now()
            };

            // Add context if there's selected code
            const selectedCode = await fileManager.getSelectedCode();
            if (selectedCode) {
                userMessage.metadata = {
                    selectedCode
                };
            }

            // Save user message
            await storageService.saveMessage(currentConversationId, userMessage);
            if (ChatPanel.currentPanel) {
                ChatPanel.currentPanel.addMessage(userMessage);
            }

            try {
                // Show loading indicator
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Claude is thinking...",
                    cancellable: false
                }, async () => {
                    const messages = (await storageService.getConversation(currentConversationId!))?.messages || [];
                    const response = await claudeAPI.chat(
                        messages.map(m => ({ role: m.role, content: m.content })),
                        'You are Claude, an AI assistant integrated into VS Code. You can help with coding tasks, answer questions, and suggest improvements. You can also request to modify files or run commands, but you must always ask for permission first.'
                    );

                    const assistantMessage: Message = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: response.content[0].text,
                        timestamp: Date.now()
                    };

                    // Handle any file change or command requests
                    if (response.metadata) {
                        if (response.metadata.fileChanges) {
                            for (const change of response.metadata.fileChanges) {
                                try {
                                    await fileManager.handleFileRequest(change);
                                } catch (error) {
                                    vscode.window.showErrorMessage(`Failed to apply file change: ${error.message}`);
                                }
                            }
                        }

                        if (response.metadata.commands) {
                            for (const command of response.metadata.commands) {
                                try {
                                    await fileManager.executeCommand(command);
                                } catch (error) {
                                    vscode.window.showErrorMessage(`Failed to execute command: ${error.message}`);
                                }
                            }
                        }
                    }

                    // Save assistant message
                    await storageService.saveMessage(currentConversationId!, assistantMessage);
                    if (ChatPanel.currentPanel) {
                        ChatPanel.currentPanel.addMessage(assistantMessage);
                    }
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                vscode.window.showErrorMessage(`Error: ${errorMessage}`);
            }
        })
    );

    disposables.push(
        vscode.commands.registerCommand('claude.clearHistory', async () => {
            if (currentConversationId) {
                await storageService.deleteConversation(currentConversationId);
                currentConversationId = undefined;
                vscode.window.showInformationMessage('Chat history cleared');
                ChatPanel.createOrShow(context.extensionUri);
            }
        })
    );

    context.subscriptions.push(...disposables);
}

export function deactivate() {
    // Clean up resources
}
