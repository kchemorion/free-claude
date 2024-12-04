import * as vscode from 'vscode';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: {
        selectedCode?: string;
        fileChanges?: FileChangeRequest[];
        commands?: CommandPermissionRequest[];
    };
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    created: number;
    lastUpdated: number;
}

export interface FileChangeRequest {
    type: 'create' | 'edit' | 'delete';
    path: string;
    content?: string;
    description: string;
}

export interface CommandPermissionRequest {
    command: string;
    args: string[];
    description: string;
}

// Code Generation Types
export interface CodeGenerationOptions {
    language?: string;
    framework?: string;
    testFramework?: string;
    includeTests?: boolean;
    includeComments?: boolean;
}

export interface TestGenerationOptions {
    framework?: string;
    coverage?: number;
    includeSnapshots?: boolean;
    includeMocks?: boolean;
}

// Git Integration Types
export interface GitDiff {
    path: string;
    additions: number;
    deletions: number;
    content: string;
}

export interface CommitSuggestion {
    message: string;
    description?: string;
    type?: string;
    scope?: string;
    breaking?: boolean;
}

export interface PRDescription {
    title: string;
    description: string;
    reviewers?: string[];
    labels?: string[];
}

export interface CodeOwnerSuggestion {
    path: string;
    owners: string[];
    explanation: string;
}

// Documentation Types
export interface DocumentationOptions {
    format?: 'markdown' | 'jsdoc' | 'docstring';
    includeExamples?: boolean;
    includeTypes?: boolean;
    includeReturns?: boolean;
}

export interface APIDocumentationOptions extends DocumentationOptions {
    includeEndpoints?: boolean;
    includeRequestResponse?: boolean;
    includeAuthentication?: boolean;
}

export interface ReadmeSection {
    title: string;
    content: string;
    order: number;
}

export interface ChangelogEntry {
    version: string;
    date: string;
    changes: {
        type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
        description: string;
    }[];
}

// Service Interfaces
export interface ICodeGenerator {
    generateCode(description: string, options?: CodeGenerationOptions): Promise<void>;
    generateTests(document: vscode.TextDocument, options?: TestGenerationOptions): Promise<void>;
}

export interface IGitIntegration {
    suggestCommitMessage(): Promise<CommitSuggestion>;
    reviewChanges(): Promise<GitDiff[]>;
    generatePRDescription(): Promise<PRDescription>;
    suggestCodeOwners(): Promise<CodeOwnerSuggestion[]>;
}

export interface IDocumentationGenerator {
    generateDocumentation(document: vscode.TextDocument, options?: DocumentationOptions): Promise<void>;
    generateAPIDocumentation(document: vscode.TextDocument, options?: APIDocumentationOptions): Promise<void>;
    generateReadme(): Promise<ReadmeSection[]>;
    generateChangelog(): Promise<ChangelogEntry[]>;
}
