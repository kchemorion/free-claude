import * as vscode from 'vscode';
import * as path from 'path';
import { Message } from '../types';
import * as MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];
    private markdown: MarkdownIt;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri
    ) {
        this._panel = panel;
        this.markdown = new MarkdownIt({
            highlight: (str, lang) => {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(str, { language: lang }).value;
                    } catch (error) {
                        console.error(error);
                    }
                }
                return ''; // use external default escaping
            }
        });

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'sendMessage':
                        // Handle sending message to Claude
                        vscode.commands.executeCommand('claude.sendMessage', message.text);
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'claudeChat',
            'Claude Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media'),
                    vscode.Uri.joinPath(extensionUri, 'out')
                ]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri);
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

    public addMessage(message: Message) {
        // Convert message content to HTML using markdown-it
        const html = this.markdown.render(message.content);
        
        // Post message to webview
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: {
                ...message,
                content: html
            }
        });
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Claude Chat</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .chat-container {
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        padding: 1rem;
                    }
                    .messages {
                        flex-grow: 1;
                        overflow-y: auto;
                        margin-bottom: 1rem;
                        padding: 1rem;
                    }
                    .message {
                        margin-bottom: 1rem;
                        padding: 0.5rem;
                        border-radius: 4px;
                    }
                    .message.user {
                        background-color: var(--vscode-editor-selectionBackground);
                        margin-left: 2rem;
                    }
                    .message.assistant {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        margin-right: 2rem;
                    }
                    .input-container {
                        display: flex;
                        padding: 1rem;
                        background-color: var(--vscode-editor-background);
                        border-top: 1px solid var(--vscode-editor-lineHighlightBorder);
                    }
                    #messageInput {
                        flex-grow: 1;
                        margin-right: 0.5rem;
                        padding: 0.5rem;
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                    }
                    button {
                        padding: 0.5rem 1rem;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    pre {
                        background-color: var(--vscode-editor-background);
                        padding: 1rem;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                </style>
            </head>
            <body>
                <div class="chat-container">
                    <div class="messages" id="messages"></div>
                    <div class="input-container">
                        <input type="text" id="messageInput" placeholder="Type your message...">
                        <button id="sendButton">Send</button>
                    </div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const messagesContainer = document.getElementById('messages');
                    const messageInput = document.getElementById('messageInput');
                    const sendButton = document.getElementById('sendButton');

                    // Handle sending messages
                    function sendMessage() {
                        const text = messageInput.value;
                        if (text) {
                            vscode.postMessage({
                                command: 'sendMessage',
                                text: text
                            });
                            messageInput.value = '';
                        }
                    }

                    sendButton.addEventListener('click', sendMessage);
                    messageInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            sendMessage();
                        }
                    });

                    // Handle receiving messages
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'addMessage':
                                const messageDiv = document.createElement('div');
                                messageDiv.className = \`message \${message.message.role}\`;
                                messageDiv.innerHTML = message.message.content;
                                messagesContainer.appendChild(messageDiv);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
