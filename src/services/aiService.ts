import * as vscode from 'vscode';
import axios from 'axios';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError
} from "@modelcontextprotocol/sdk/types.js";
import { FileManager } from './fileManager';

export interface AIAction {
    type: 'file' | 'command' | 'ui';
    priority: 'high' | 'low';
    description: string;
    data: any;
}

export interface AIResponse {
    content: string;
    actions?: AIAction[];
    context?: {
        files?: string[];
        selection?: string;
        language?: string;
    };
}

export class AIService {
    private server: Server;
    private apiKey: string | undefined;
    private readonly capabilities = {
        tools: {
            'modify_file': {
                description: 'Create, modify or delete files in VS Code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { 
                            type: 'string', 
                            enum: ['create', 'modify', 'delete'] 
                        },
                        path: { type: 'string' },
                        content: { type: 'string' }
                    },
                    required: ['action', 'path']
                }
            },
            'execute_command': {
                description: 'Run commands in VS Code terminal',
                inputSchema: {
                    type: 'object',
                    properties: {
                        command: { type: 'string' },
                        args: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['command']
                }
            }
        }
    };

    constructor(
        private context: vscode.ExtensionContext,
        private fileManager: FileManager
    ) {
        this.server = new Server({
            name: "vscode-claude-agent",
            version: "1.0.0"
        }, {
            capabilities: this.capabilities
        });

        this.setupHandlers();
        this.loadApiKey();
    }

    private async loadApiKey() {
        this.apiKey = await this.context.secrets.get('claude.apiKey');
        if (!this.apiKey) {
            const key = await vscode.window.showInputBox({
                prompt: 'Enter your Claude API key',
                password: true
            });
            if (key) {
                await this.context.secrets.store('claude.apiKey', key);
                this.apiKey = key;
            }
        }
    }

    private setupHandlers(): void {
        // Tool handlers
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'modify_file',
                    description: 'Create, modify or delete files in VS Code',
                    inputSchema: this.capabilities.tools.modify_file.inputSchema
                },
                {
                    name: 'execute_command',
                    description: 'Run commands in VS Code terminal',
                    inputSchema: this.capabilities.tools.execute_command.inputSchema
                }
            ]
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case 'modify_file':
                        return await this.handleModifyFile(request.params.arguments);
                    case 'execute_command':
                        return await this.handleExecuteCommand(request.params.arguments);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
                }
            } catch (error) {
                if (error instanceof McpError) throw error;
                throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : String(error));
            }
        });
    }

    private async handleModifyFile(args: any): Promise<any> {
        const { action, path, content } = args;
        
        try {
            switch (action) {
                case 'create':
                case 'modify':
                    if (!content) {
                        throw new McpError(ErrorCode.InvalidParams, 'Content is required for create/modify operations');
                    }
                    await this.fileManager.handleFileRequest({ type: action, path, content });
                    break;
                case 'delete':
                    await this.fileManager.handleFileRequest({ type: action, path });
                    break;
                default:
                    throw new McpError(ErrorCode.InvalidParams, `Invalid action: ${action}`);
            }

            return {
                content: [{
                    type: 'text',
                    text: `Successfully ${action}d file: ${path}`
                }]
            };
        } catch (error) {
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : String(error));
        }
    }

    private async handleExecuteCommand(args: any): Promise<any> {
        const { command, args: commandArgs = [] } = args;
        if (!command || typeof command !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Invalid command');
        }

        try {
            const terminal = vscode.window.createTerminal('Claude Agent');
            terminal.show();
            terminal.sendText(`${command} ${commandArgs.join(' ')}`);
            
            return {
                content: [{
                    type: 'text',
                    text: `Executed command: ${command} ${commandArgs.join(' ')}`
                }]
            };
        } catch (error) {
            throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : String(error));
        }
    }

    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('AI Service MCP server running on stdio');
    }

    async stop(): Promise<void> {
        await this.server.close();
    }

    async processRequest(request: string, context?: any): Promise<AIResponse> {
        if (!this.apiKey) {
            await this.loadApiKey();
            if (!this.apiKey) {
                throw new Error('Claude API key not found. Please set your API key.');
            }
        }

        try {
            const config = vscode.workspace.getConfiguration('claude-vscode');
            const model = config.get<string>('model') || 'claude-3-opus-20240229';
            const maxTokens = config.get<number>('maxTokens') || 4000;

            const response = await axios.post('https://api.anthropic.com/v1/messages', {
                model,
                max_tokens: maxTokens,
                messages: [{
                    role: 'user',
                    content: request
                }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-01-01',
                    'x-api-key': this.apiKey
                }
            });

            return {
                content: response.data.content[0].text,
                actions: []
            };
        } catch (error) {
            console.error('Claude API error:', error);
            if (axios.isAxiosError(error)) {
                const responseData = error.response?.data;
                console.error('API Response:', responseData);
                
                if (error.response?.status === 401) {
                    this.apiKey = undefined; // Clear invalid API key
                    throw new Error('Invalid Claude API key. Please check your API key and try again.');
                }
                
                // Extract the actual error message from the API response
                const errorMessage = responseData?.error?.message || error.message;
                throw new Error(`Claude API error: ${errorMessage}`);
            }
            throw new Error(`Claude API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
