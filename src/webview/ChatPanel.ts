import * as vscode from 'vscode';
import { AIService, AIResponse } from '../services/aiService';
import { marked } from 'marked';
import { FileManager } from '../services/fileManager';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private static readonly viewType = 'claudeChat';
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private messages: Message[] = [];

    private constructor(
        private readonly _context: vscode.ExtensionContext,
        private readonly _aiService: AIService,
        private readonly _fileManager: FileManager
    ) {
        this._panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Claude Chat',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this._getWebviewContent();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        await this._handleUserMessage(message.text);
                        break;
                    case 'clearConversation':
                        this.clearConversation();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(context: vscode.ExtensionContext, aiService: AIService, fileManager: FileManager): ChatPanel {
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            return ChatPanel.currentPanel;
        }

        ChatPanel.currentPanel = new ChatPanel(context, aiService, fileManager);
        return ChatPanel.currentPanel;
    }

    public dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    public reveal() {
        this._panel.reveal(vscode.ViewColumn.Two);
    }

    private async _handleUserMessage(text: string) {
        try {
            // Add user message
            const userMessage: Message = {
                role: 'user',
                content: text,
                timestamp: Date.now()
            };
            this.messages.push(userMessage);
            this.updateWebview();

            // Get active editor context
            const editor = vscode.window.activeTextEditor;
            const context = {
                files: await this._fileManager.listFiles(),
                selection: editor?.document.getText(editor.selection),
                language: editor?.document.languageId
            };

            // Process with AI service
            const response = await this._aiService.processRequest(text, context);

            // Add assistant message
            const assistantMessage: Message = {
                role: 'assistant',
                content: response.content,
                timestamp: Date.now()
            };
            this.messages.push(assistantMessage);
            
            // Update webview
            this.updateWebview();

        } catch (error) {
            console.error('Error handling user message:', error);
            await this._postMessage({
                type: 'error',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    private updateWebview() {
        this._panel.webview.postMessage({
            command: 'updateState',
            messages: this.messages.map(msg => ({
                ...msg,
                content: marked(msg.content)
            }))
        });
    }

    private async _postMessage(message: any) {
        await this._panel.webview.postMessage(message);
    }

    private clearConversation() {
        this.messages = [];
        this.updateWebview();
    }

    private _getWebviewContent() {
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'main.js')
        );
        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'style.css')
        );

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Claude Chat</title>
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div id="chat-container">
                    <div id="messages"></div>
                    <div id="input-container">
                        <textarea id="user-input" placeholder="Type your message..."></textarea>
                        <button id="send-button">Send</button>
                        <button id="clear-button">Clear</button>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}