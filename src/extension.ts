import * as vscode from 'vscode';

interface ClaudeResponse {
    content: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Claude extension is now active');

    // Register the Claude API key configuration
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('claude.apiKey')) {
                // Reload the extension when API key changes
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        })
    );

    // Register the main command
    let disposable = vscode.commands.registerCommand('claude.askQuestion', async () => {
        const apiKey = vscode.workspace.getConfiguration().get('claude.apiKey');
        
        if (!apiKey) {
            const response = await vscode.window.showErrorMessage(
                'Claude API key is not set. Would you like to set it now?',
                'Yes',
                'No'
            );
            
            if (response === 'Yes') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'claude.apiKey');
            }
            return;
        }

        const question = await vscode.window.showInputBox({
            placeHolder: 'Ask Claude a question...',
            prompt: 'What would you like to ask?'
        });

        if (question) {
            try {
                const response = await askClaude(question, apiKey as string);
                
                // Create and show a new webview
                const panel = vscode.window.createWebviewPanel(
                    'claudeResponse',
                    'Claude Response',
                    vscode.ViewColumn.Two,
                    {
                        enableScripts: true
                    }
                );

                panel.webview.html = getWebviewContent(question, response.content);
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
            }
        }
    });

    context.subscriptions.push(disposable);
}

async function askClaude(question: string, apiKey: string): Promise<ClaudeResponse> {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-2',
                max_tokens: 1000,
                messages: [{
                    role: 'user',
                    content: question
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
        }

        const data = await response.json() as { content: Array<{ text: string }> };
        return {
            content: data.content[0].text
        };
    } catch (error) {
        console.error('Error calling Claude API:', error);
        throw error;
    }
}

function getWebviewContent(question: string, answer: string): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    line-height: 1.6;
                }
                .question {
                    margin-bottom: 20px;
                    padding: 10px;
                    background: var(--vscode-editor-background);
                    border-left: 4px solid var(--vscode-activityBarBadge-background);
                }
                .answer {
                    white-space: pre-wrap;
                }
                pre {
                    background: var(--vscode-editor-background);
                    padding: 10px;
                    border-radius: 4px;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <div class="question">
                <strong>Question:</strong>
                <p>${question}</p>
            </div>
            <div class="answer">
                <strong>Claude's Response:</strong>
                <p>${answer}</p>
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {}
