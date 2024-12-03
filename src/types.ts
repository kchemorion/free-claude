import * as vscode from 'vscode';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    created: number;
    lastUpdated: number;
}

export interface FileOperation {
    type: 'create' | 'edit' | 'delete';
    path: string;
    content?: string;
}

export interface CommandExecution {
    command: string;
    args: string[];
    cwd?: string;
}

export interface Permission {
    type: 'file' | 'command';
    operation: FileOperation | CommandExecution;
    granted: boolean;
}

export interface StorageOptions {
    dbPath: string;
}
