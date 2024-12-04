"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeAPI = void 0;
const vscode = require("vscode");
const axios_1 = require("axios");
class ClaudeAPI {
    constructor() {
        this.baseURL = 'https://api.anthropic.com/v1';
        const config = vscode.workspace.getConfiguration('claudeAssistant');
        this.apiKey = config.get('apiKey') || '';
        this.model = config.get('model') || 'claude-2';
        if (!this.apiKey) {
            throw new Error('Claude API key not configured. Please set claudeAssistant.apiKey in settings.');
        }
    }
    async sendMessage(prompt) {
        try {
            const response = await axios_1.default.post(`${this.baseURL}/messages`, {
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 4000
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });
            return {
                content: response.data.content[0].text
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                const message = error.response?.data?.error?.message || error.message;
                throw new Error(`Claude API error: ${message}`);
            }
            throw error;
        }
    }
}
exports.ClaudeAPI = ClaudeAPI;
//# sourceMappingURL=claude.js.map