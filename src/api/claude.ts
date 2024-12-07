import * as vscode from 'vscode';
import axios from 'axios';

interface CodeBlock {
    language: string;
    code: string;
    fileName?: string;
}

interface FileOperation {
    type: 'create' | 'modify' | 'delete';
    path: string;
    content?: string;
    description: string;
}

interface ParsedResponse {
    text: string;
    codeBlocks: CodeBlock[];
    fileOperations: FileOperation[];
}

export interface ClaudeResponse {
    content: string;
    parsed: ParsedResponse;
    error?: string;
}

export class ClaudeAPI {
    private apiKey: string | undefined;
    private readonly baseURL: string = 'https://api.anthropic.com/v1';
    private readonly model: string = 'claude-3-sonnet-20240229';

    constructor() {
        this.loadApiKey();
    }

    private loadApiKey() {
        const config = vscode.workspace.getConfiguration('claudeAssistant');
        this.apiKey = config.get('apiKey');
    }

    private async ensureApiKey(): Promise<boolean> {
        if (!this.apiKey) {
            const response = await vscode.window.showErrorMessage(
                'Claude API key not configured. Would you like to configure it now?',
                'Yes',
                'No'
            );

            if (response === 'Yes') {
                const key = await vscode.window.showInputBox({
                    prompt: 'Enter your Claude API key',
                    password: true
                });

                if (key) {
                    await vscode.workspace.getConfiguration('claudeAssistant').update('apiKey', key, true);
                    this.apiKey = key;
                    return true;
                }
                return false;
            }
            return false;
        }
        return true;
    }

    async sendMessage(message: string): Promise<ClaudeResponse> {
        try {
            if (!await this.ensureApiKey()) {
                return {
                    content: "⚠️ Claude API key not configured. Please configure the API key to continue.",
                    parsed: { text: "", codeBlocks: [], fileOperations: [] }
                };
            }

            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: this.model,
                    max_tokens: 4096,
                    messages: [{
                        role: "user",
                        content: message
                    }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                }
            );

            const content = response.data.content[0].text;
            return {
                content,
                parsed: this.parseResponse(content)
            };
        } catch (error: any) {
            console.error('Claude API error:', error);
            let errorMessage = 'Failed to communicate with Claude API. ';
            
            if (error.response?.status === 401) {
                errorMessage += 'Invalid API key. Please check your API key configuration.';
                // Clear invalid API key
                await vscode.workspace.getConfiguration('claudeAssistant').update('apiKey', undefined, true);
                this.apiKey = undefined;
            } else {
                errorMessage += error.message || 'Unknown error occurred.';
            }

            return {
                content: `⚠️ ${errorMessage}`,
                parsed: { text: "", codeBlocks: [], fileOperations: [] },
                error: errorMessage
            };
        }
    }

    private parseResponse(content: string): ParsedResponse {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const codeBlocks: CodeBlock[] = [];
        const fileOperations: FileOperation[] = [];
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            const language = match[1]?.toLowerCase() || 'text';
            const code = match[2].trim();
            
            codeBlocks.push({ language, code });
        }

        return {
            text: content.replace(codeBlockRegex, '').trim(),
            codeBlocks,
            fileOperations
        };
    }
}