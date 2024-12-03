import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface APIResponse {
    id: string;
    content: string;
    role: 'assistant';
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}

export class ClaudeAPI {
    private apiKey: string | undefined;
    private model: string;
    private maxRetries: number;
    private timeout: number;

    constructor() {
        this.apiKey = vscode.workspace.getConfiguration('claude').get('apiKey');
        this.model = vscode.workspace.getConfiguration('claude').get('model') || 'claude-2.1';
        this.maxRetries = vscode.workspace.getConfiguration('claude').get('maxRetries') || 3;
        this.timeout = vscode.workspace.getConfiguration('claude').get('timeout') || 30000;
    }

    private async makeRequest(messages: Message[]): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Claude API key not configured. Please set it in VS Code settings.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                    max_tokens: 4000
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data: APIResponse = await response.json();
            return data.content;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timed out');
                }
                throw error;
            }
            throw new Error('Unknown error occurred');
        }
    }

    private async retryRequest(messages: Message[]): Promise<string> {
        let lastError: Error | null = null;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                return await this.makeRequest(messages);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (i < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        throw lastError || new Error('Request failed after all retries');
    }

    public async sendMessage(content: string): Promise<string> {
        return this.retryRequest([{ role: 'user', content }]);
    }

    public async analyzeCode(code: string): Promise<string> {
        const prompt = `Please analyze this code and provide insights about its structure, potential issues, and suggestions for improvement:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }

    public async explainCode(code: string): Promise<string> {
        const prompt = `Please explain what this code does in a clear and concise way:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }

    public async suggestImprovements(code: string): Promise<string> {
        const prompt = `Please suggest improvements for this code, including better practices, optimizations, and potential bug fixes:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }
}
