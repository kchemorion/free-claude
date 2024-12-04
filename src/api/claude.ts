import * as vscode from 'vscode';
import axios from 'axios';

interface ClaudeResponse {
    content: string;
    error?: string;
}

export class ClaudeAPI {
    private readonly apiKey: string;
    private readonly baseURL: string = 'https://api.anthropic.com/v1';
    private readonly model: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('claudeAssistant');
        this.apiKey = config.get('apiKey') || '';
        this.model = config.get('model') || 'claude-3-5-sonnet-20240229';

        if (!this.apiKey) {
            throw new Error('Claude API key not configured. Please set claudeAssistant.apiKey in settings.');
        }
    }

    async sendMessage(prompt: string): Promise<ClaudeResponse> {
        try {
            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 4000
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.apiKey,
                        'anthropic-version': '2023-06-01'
                    }
                }
            );

            return {
                content: response.data.content[0].text
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(`Claude API error: ${message}`);
            }
            throw error;
        }
    }
}
