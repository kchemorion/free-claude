"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeAPI = void 0;
const vscode = require("vscode");
class ClaudeAPI {
    constructor() {
        this.apiKey = vscode.workspace.getConfiguration('claude').get('apiKey');
        this.model = vscode.workspace.getConfiguration('claude').get('model') || 'claude-2.1';
        this.maxRetries = vscode.workspace.getConfiguration('claude').get('maxRetries') || 3;
        this.timeout = vscode.workspace.getConfiguration('claude').get('timeout') || 30000;
    }
    async makeRequest(messages) {
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
            const data = await response.json();
            return data.content;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw new Error('Request timed out');
                }
                throw error;
            }
            throw new Error('Unknown error occurred');
        }
    }
    async retryRequest(messages) {
        let lastError = null;
        for (let i = 0; i < this.maxRetries; i++) {
            try {
                return await this.makeRequest(messages);
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                if (i < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }
        throw lastError || new Error('Request failed after all retries');
    }
    async sendMessage(content) {
        return this.retryRequest([{ role: 'user', content }]);
    }
    async analyzeCode(code) {
        const prompt = `Please analyze this code and provide insights about its structure, potential issues, and suggestions for improvement:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }
    async explainCode(code) {
        const prompt = `Please explain what this code does in a clear and concise way:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }
    async suggestImprovements(code) {
        const prompt = `Please suggest improvements for this code, including better practices, optimizations, and potential bug fixes:

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }
}
exports.ClaudeAPI = ClaudeAPI;
//# sourceMappingURL=claude.js.map