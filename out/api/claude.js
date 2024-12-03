"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeAPI = void 0;
const node_fetch_1 = require("node-fetch");
const vscode = require("vscode");
class ClaudeAPI {
    constructor() {
        this.retryDelays = [1000, 2000, 4000]; // Exponential backoff
        this.config = this.loadConfig();
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('claude')) {
                this.config = this.loadConfig();
            }
        });
    }
    loadConfig() {
        const config = vscode.workspace.getConfiguration('claude');
        return {
            apiKey: config.get('apiKey'),
            model: config.get('model'),
            maxRetries: config.get('maxRetries'),
            timeout: config.get('timeout')
        };
    }
    async makeRequest(endpoint, body, retry = 0) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.timeout);
            const response = await (0, node_fetch_1.default)(`https://api.anthropic.com/v1/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            return this.formatResponse(data);
        }
        catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timed out');
            }
            if (retry < this.config.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelays[retry]));
                return this.makeRequest(endpoint, body, retry + 1);
            }
            throw error;
        }
    }
    formatResponse(data) {
        // Transform the Claude API response into our internal format
        return {
            content: [{
                    text: data.content[0].text,
                    type: 'text'
                }],
            metadata: data.metadata
        };
    }
    async chat(messages, systemPrompt) {
        const body = {
            model: this.config.model,
            messages,
            system: systemPrompt,
            max_tokens: 4000,
            temperature: 0.7,
            stream: false
        };
        return this.makeRequest('messages', body);
    }
    async analyzeCode(code, context) {
        const messages = [
            {
                role: 'user',
                content: `Please analyze this code:\n\`\`\`\n${code}\n\`\`\`\n${context || ''}`
            }
        ];
        return this.chat(messages, 'You are an expert code reviewer. Focus on identifying potential issues, suggesting improvements, and explaining complex parts.');
    }
    async suggestImprovements(code) {
        const messages = [
            {
                role: 'user',
                content: `Please suggest improvements for this code:\n\`\`\`\n${code}\n\`\`\`\n`
            }
        ];
        return this.chat(messages, 'You are an expert code improver. Suggest specific, actionable improvements while maintaining the code\'s original purpose.');
    }
}
exports.ClaudeAPI = ClaudeAPI;
//# sourceMappingURL=claude.js.map