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
    private readonly apiKey: string;
    private readonly baseURL: string = 'https://api.anthropic.com/v1';
    private readonly model: string = 'claude-3-sonnet-20240229';

    constructor() {
        const config = vscode.workspace.getConfiguration('claudeAssistant');
        this.apiKey = config.get('apiKey') || '';
        
        if (!this.apiKey) {
            throw new Error('Claude API key not configured. Please set claudeAssistant.apiKey in settings.');
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
            const fileName = this.inferFileName(language, code);
            
            codeBlocks.push({ language, code, fileName });
            
            // Create file operation for code blocks that should become files
            if (fileName && this.shouldCreateFile(language)) {
                fileOperations.push({
                    type: 'create',
                    path: fileName,
                    content: code,
                    description: `Create ${language} file from code block`
                });
            }
        }

        return {
            text: content,
            codeBlocks,
            fileOperations
        };
    }

    private shouldCreateFile(language: string): boolean {
        const fileLanguages = ['javascript', 'typescript', 'python', 'java', 'html', 'css', 'jsx', 'tsx'];
        return fileLanguages.includes(language.toLowerCase());
    }

    private inferFileName(language: string, code: string): string | undefined {
        const extensionMap: Record<string, string> = {
            javascript: '.js',
            typescript: '.ts',
            python: '.py',
            java: '.java',
            html: '.html',
            css: '.css',
            jsx: '.jsx',
            tsx: '.tsx'
        };

        const ext = extensionMap[language.toLowerCase()];
        if (!ext) return undefined;

        // Try to infer name from code content
        let fileName = 'new_file';
        
        if (language === 'javascript' || language === 'typescript') {
            const classMatch = code.match(/class\s+(\w+)/);
            const componentMatch = code.match(/function\s+(\w+)/);
            if (classMatch) fileName = classMatch[1];
            else if (componentMatch) fileName = componentMatch[1];
        }

        return `${fileName}${ext}`;
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

            const content = response.data.content[0].text;
            const parsed = this.parseResponse(content);

            return {
                content,
                parsed
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