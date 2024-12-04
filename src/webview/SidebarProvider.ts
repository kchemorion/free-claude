import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import { marked } from 'marked';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeAssistant.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly claudeAPI: ClaudeAPI
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'sendMessage': {
                    try {
                        const response = await this.claudeAPI.sendMessage(data.text);
                        webviewView.webview.postMessage({
                            command: 'receiveMessage',
                            text: this.formatMarkdown(response.content)
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            command: 'error',
                            text: `Error: ${error}`
                        });
                    }
                    break;
                }
            }
        });
    }

    private formatMarkdown(text: string): string {
        return marked(text, {
            gfm: true,
            breaks: true,
            sanitize: true
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Claude Assistant</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .message {
                        margin-bottom: 20px;
                        padding: 10px;
                        border-radius: 4px;
                    }
                    .user-message {
                        background-color: var(--vscode-textBlockQuote-background);
                    }
                    .assistant-message {
                        background-color: var(--vscode-editor-selectionBackground);
                    }
                    #input-container {
                        position: fixed;
                        bottom: 20px;
                        left: 20px;
                        right: 20px;
                        display: flex;
                        gap: 10px;
                    }
                    #message-input {
                        flex-grow: 1;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 4px;
                    }
                    #send-button {
                        padding: 8px 16px;
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    #send-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    pre {
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
                    }
                    #chat-container {
                        margin-bottom: 80px;
                    }
                </style>
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-container">
                    <input type="text" id="message-input" placeholder="Type your message...">
                    <button id="send-button">Send</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const chatContainer = document.getElementById('chat-container');
                    const messageInput = document.getElementById('message-input');
                    const sendButton = document.getElementById('send-button');

                    function addMessage(text, isUser = false) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${isUser ? 'user-message' : 'assistant-message'}\`;
                        messageDiv.innerHTML = text;
                        chatContainer.appendChild(messageDiv);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                    }

                    function sendMessage() {
                        const text = messageInput.value.trim();
                        if (text) {
                            addMessage(text, true);
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

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'receiveMessage':
                                addMessage(message.text);
                                break;
                            case 'error':
                                addMessage(\`Error: \${message.text}\`);
                                break;
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }
}
