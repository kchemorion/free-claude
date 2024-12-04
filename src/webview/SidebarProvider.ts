import * as vscode from 'vscode';
import { ClaudeAPI } from '../api/claude';
import { FileManager } from '../services/fileManager';
import { marked } from 'marked';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeAssistant.chatView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly claudeAPI: ClaudeAPI,
        private readonly fileManager: FileManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                // In the message handler section:
                case 'sendMessage': {
                    try {
                        const response = await this.claudeAPI.sendMessage(data.text);
                        
                        // Handle file operations
                        if (response.parsed.fileOperations.length > 0) {
                            const shouldExecute = await vscode.window.showWarningMessage(
                                'Claude wants to create/modify files. Allow?',
                                'Yes', 'No'
                            );
                            
                            if (shouldExecute === 'Yes') {
                                for (const operation of response.parsed.fileOperations) {
                                    await this.fileManager.handleFileRequest(operation);
                                }
                            }
                        }

                        // Handle command execution for shell/bash blocks
                        const shellCommands = response.parsed.codeBlocks.filter(
                            block => ['bash', 'shell', 'sh'].includes(block.language.toLowerCase())
                        );

                        if (shellCommands.length > 0) {
                            const shouldExecute = await vscode.window.showWarningMessage(
                                'Claude wants to execute shell commands. Allow?',
                                'Yes', 'No'
                            );

                            if (shouldExecute === 'Yes') {
                                for (const command of shellCommands) {
                                    await this.fileManager.executeCommand({
                                        command: command.code,
                                        args: [],
                                        description: 'Execute shell command from Claude',
                                        severity: 'medium'
                                    });
                                }
                            }
                        }

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
                case 'fileOperation': {
                    try {
                        await this.fileManager.handleFileRequest(data.request);
                        webviewView.webview.postMessage({
                            command: 'fileOperationResult',
                            success: true
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            command: 'error',
                            text: `File operation failed: ${error}`
                        });
                    }
                    break;
                }
                case 'executeCommand': {
                    try {
                        await this.fileManager.executeCommand(data.request);
                        webviewView.webview.postMessage({
                            command: 'commandResult',
                            success: true
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            command: 'error',
                            text: `Command execution failed: ${error}`
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
                    #chat-container {
                        margin-bottom: 80px;
                        overflow-y: auto;
                        max-height: calc(100vh - 120px);
                    }
                    #input-container {
                        position: fixed;
                        bottom: 20px;
                        left: 20px;
                        right: 20px;
                        display: flex;
                        gap: 10px;
                        background: var(--vscode-editor-background);
                        padding: 10px;
                        border-top: 1px solid var(--vscode-input-border);
                    }
                    #message-input {
                        flex-grow: 1;
                        padding: 8px;
                        border: 1px solid var(--vscode-input-border);
                        background-color: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border-radius: 4px;
                    }
                    button {
                        padding: 8px 16px;
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
                        background-color: var(--vscode-textBlockQuote-background);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                    }
                    code {
                        font-family: var(--vscode-editor-font-family);
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

                    // Handle file operations
                    window.handleFileOperation = async (request) => {
                        vscode.postMessage({
                            command: 'fileOperation',
                            request: request
                        });
                    };

                    // Handle command execution
                    window.executeCommand = async (request) => {
                        vscode.postMessage({
                            command: 'executeCommand',
                            request: request
                        });
                    };

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
                            case 'fileOperationResult':
                                addMessage(\`File operation \${message.success ? 'succeeded' : 'failed'}\`);
                                break;
                            case 'commandResult':
                                addMessage(\`Command execution \${message.success ? 'succeeded' : 'failed'}\`);
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