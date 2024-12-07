import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FileRequest {
    type: 'create' | 'modify' | 'delete';
    path: string;
    content?: string;
    description?: string;
}

export interface CommandRequest {
    command: string;
    args?: any[];
    description?: string;
    severity?: 'high' | 'medium' | 'low';
}

interface PermissionSettings {
    trustedPaths: Set<string>;
    trustedPatterns: Set<string>;
    permissionCache: Map<string, boolean>;
}

export class FileManager {
    private settings: PermissionSettings = {
        trustedPaths: new Set<string>(),
        trustedPatterns: new Set<string>(),
        permissionCache: new Map<string, boolean>()
    };

    constructor(private context: vscode.ExtensionContext) {
        this.loadSettings();
    }

    private async loadSettings() {
        const trusted = this.context.globalState.get<string[]>('trustedPaths', []);
        const patterns = this.context.globalState.get<string[]>('trustedPatterns', []);
        this.settings.trustedPaths = new Set(trusted);
        this.settings.trustedPatterns = new Set(patterns);
    }

    private async saveSettings() {
        await this.context.globalState.update('trustedPaths', Array.from(this.settings.trustedPaths));
        await this.context.globalState.update('trustedPatterns', Array.from(this.settings.trustedPatterns));
    }

    async listFiles(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const files: string[] = [];
        for (const folder of workspaceFolders) {
            await this.listFilesInDirectory(folder.uri.fsPath, files);
        }
        return files;
    }

    private async listFilesInDirectory(dirPath: string, files: string[]): Promise<void> {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await this.listFilesInDirectory(fullPath, files);
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
    }

    async handleFileRequest(request: FileRequest): Promise<void> {
        const approved = await this.checkPermission(request);
        if (!approved) {
            throw new Error('File operation was denied by user');
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const fullPath = path.join(workspaceRoot, request.path);
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Invalid file path: Must be within workspace');
        }

        switch (request.type) {
            case 'create':
                if (await this.fileExists(fullPath)) {
                    const overwrite = await vscode.window.showWarningMessage(
                        `File ${request.path} already exists. Overwrite?`,
                        'Yes',
                        'No'
                    );
                    if (overwrite !== 'Yes') {
                        throw new Error('File creation cancelled: File already exists');
                    }
                }
                await this.createFile(fullPath, request.content || '');
                break;
            case 'modify':
                await this.modifyFile(fullPath, request.content || '');
                break;
            case 'delete':
                await this.deleteFile(fullPath);
                break;
            default:
                throw new Error(`Unknown file operation: ${request.type}`);
        }
    }

    private async createFile(filePath: string, content: string): Promise<void> {
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, content);
        await this.notifyFileChange(filePath);
    }

    private async modifyFile(filePath: string, content: string): Promise<void> {
        await fs.writeFile(filePath, content);
        await this.notifyFileChange(filePath);
    }

    private async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(filePath);
        await this.notifyFileChange(filePath);
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    private async notifyFileChange(filePath: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        await vscode.workspace.fs.stat(uri); // Force VS Code to refresh
    }

    public async executeCommand(request: CommandRequest): Promise<{ stdout: string; stderr: string }> {
        const approved = await this.requestCommandPermission(request);
        if (!approved) {
            throw new Error('Command execution was denied by user');
        }

        if (!request.args) {
            request.args = [];
        }

        return new Promise((resolve, reject) => {
            exec(
                `${request.command} ${request.args!.join(' ')}`,
                (error: any, stdout: string, stderr: string) => {
                    if (error && error.code !== 0) {
                        reject(new Error(`Command failed: ${error.message}`));
                    } else {
                        resolve({ stdout, stderr });
                    }
                }
            );
        });
    }

    private async checkPermission(request: FileRequest): Promise<boolean> {
        const filePath = request.path;

        // Check if path is already trusted
        if (this.settings.trustedPaths.has(filePath)) {
            return true;
        }

        // Check if path matches any trusted patterns
        if (Array.from(this.settings.trustedPatterns).some(pattern => 
            new RegExp(pattern).test(filePath))) {
            return true;
        }

        // Check permission cache
        const cacheKey = `${request.type}:${filePath}`;
        if (this.settings.permissionCache.has(cacheKey)) {
            return this.settings.permissionCache.get(cacheKey)!;
        }

        // Ask user for permission
        const message = `Claude wants to ${request.type} file: ${filePath}\n${request.description || ''}`;
        const response = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Allow Always',
            'Allow',
            'Deny'
        );

        if (response === 'Allow Always') {
            this.settings.trustedPaths.add(filePath);
            await this.saveSettings();
            return true;
        }

        const approved = response === 'Allow';
        this.settings.permissionCache.set(cacheKey, approved);
        return approved;
    }

    async requestCommandPermission(request: CommandRequest): Promise<boolean> {
        const cacheKey = `cmd:${request.command}`;
        
        if (this.settings.permissionCache.has(cacheKey)) {
            return this.settings.permissionCache.get(cacheKey)!;
        }

        const message = `Command: ${request.command} ${request.args?.join(' ') || ''}\n` +
                     `Description: ${request.description || ''}\n` +
                     `Severity: ${request.severity || 'medium'}`;

        const response = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Allow Always',
            'Allow',
            'Deny'
        );

        if (response === 'Allow Always') {
            this.settings.permissionCache.set(cacheKey, true);
            await this.saveSettings();
            return true;
        }

        const approved = response === 'Allow';
        this.settings.permissionCache.set(cacheKey, approved);
        return approved;
    }

    public async getFileContent(filePath: string): Promise<string> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            throw new Error(`Failed to read file: ${filePath}`);
        }
    }

    public async getWorkspaceFiles(pattern: string): Promise<string[]> {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
        return files.map(f => f.fsPath);
    }

    public clearPermissionCache() {
        this.settings.permissionCache.clear();
    }
}