import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FileChangeRequest {
    type: 'create' | 'modify' | 'delete';
    path: string;
    content?: string;
}

export interface CommandPermissionRequest {
    command: string;
    args: string[];
    description: string;
    severity: 'low' | 'medium' | 'high';
}

export class FileManager {
    constructor(private context: vscode.ExtensionContext) {}

    async handleFileChange(request: FileChangeRequest): Promise<void> {
        try {
            const change = {
                type: request.type,
                path: request.path,
                content: request.content
            };

            await this.validateChange(change);

            switch (request.type) {
                case 'create':
                    await this.createFile(change.path, change.content || '');
                    break;
                case 'modify':
                    await this.modifyFile(change.path, change.content || '');
                    break;
                case 'delete':
                    await this.deleteFile(change.path);
                    break;
                default:
                    throw new Error(`Unsupported file change type: ${request.type}`);
            }
        } catch (error) {
            throw new Error(`Failed to handle file change: ${error}`);
        }
    }

    async requestCommandPermission(request: CommandPermissionRequest): Promise<boolean> {
        const message = `Command: ${request.command} ${request.args.join(' ')}\n` +
                       `Description: ${request.description}\n` +
                       `Severity: ${request.severity}`;

        const response = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Allow',
            'Deny'
        );

        return response === 'Allow';
    }

    private async validateChange(change: FileChangeRequest): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }

        const fullPath = path.join(workspaceRoot, change.path);
        if (!fullPath.startsWith(workspaceRoot)) {
            throw new Error('Invalid file path: Must be within workspace');
        }

        if (change.type === 'create' && await this.fileExists(fullPath)) {
            const overwrite = await vscode.window.showWarningMessage(
                `File ${change.path} already exists. Overwrite?`,
                'Yes',
                'No'
            );
            if (overwrite !== 'Yes') {
                throw new Error('File creation cancelled: File already exists');
            }
        }

        if ((change.type === 'modify' || change.type === 'delete') && !await this.fileExists(fullPath)) {
            throw new Error(`File ${change.path} does not exist`);
        }
    }

    private async createFile(filePath: string, content: string): Promise<void> {
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
        await fs.writeFile(filePath, content);
    }

    private async modifyFile(filePath: string, content: string): Promise<void> {
        await fs.writeFile(filePath, content);
    }

    private async deleteFile(filePath: string): Promise<void> {
        await fs.unlink(filePath);
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    public async executeCommand(request: CommandPermissionRequest): Promise<void> {
        // Always ask for permission before executing commands
        const approved = await this.requestCommandPermission(request);
        if (!approved) {
            throw new Error('Command execution was denied by user');
        }

        // Execute the command
        const terminal = vscode.window.createTerminal('Claude Assistant');
        terminal.show();
        terminal.sendText(`${request.command} ${request.args.join(' ')}`);
    }

    public async getFileContent(filePath: string): Promise<string> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            return document.getText();
        } catch (error) {
            throw new Error(`Failed to read file: ${filePath}`);
        }
    }

    public async getSelectedCode(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            return editor.document.getText(selection);
        }
        return undefined;
    }

    public async getCurrentFileContext(): Promise<string | undefined> {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.getText();
        }
        return undefined;
    }
}
