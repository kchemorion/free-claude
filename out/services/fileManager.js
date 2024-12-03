"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const vscode = require("vscode");
const path = require("path");
class FileManager {
    constructor(context) {
        this.context = context;
    }
    async handleFileRequest(request) {
        // Always ask for permission before making file changes
        const approved = await this.requestPermission({
            action: request.action,
            path: request.path,
            description: request.description
        });
        if (!approved) {
            throw new Error('File change request was denied by user');
        }
        switch (request.action) {
            case 'create':
                await this.createFile(request.path, request.content || '');
                break;
            case 'edit':
                await this.editFile(request.path, request.content || '');
                break;
            case 'delete':
                await this.deleteFile(request.path);
                break;
        }
    }
    async requestPermission(details) {
        const message = `Claude wants to ${details.action} file: ${details.path}\n${details.description}`;
        const response = await vscode.window.showWarningMessage(message, { modal: true }, 'Allow', 'Deny');
        return response === 'Allow';
    }
    async createFile(filePath, content) {
        const uri = vscode.Uri.file(filePath);
        const workspaceEdit = new vscode.WorkspaceEdit();
        // Create parent directories if they don't exist
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(filePath)));
        workspaceEdit.createFile(uri, { overwrite: true });
        workspaceEdit.insert(uri, new vscode.Position(0, 0), content);
        await vscode.workspace.applyEdit(workspaceEdit);
    }
    async editFile(filePath, content) {
        const document = await vscode.workspace.openTextDocument(filePath);
        const workspaceEdit = new vscode.WorkspaceEdit();
        // Replace entire file content
        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
        workspaceEdit.replace(document.uri, fullRange, content);
        await vscode.workspace.applyEdit(workspaceEdit);
    }
    async deleteFile(filePath) {
        const uri = vscode.Uri.file(filePath);
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.deleteFile(uri, { recursive: true });
        await vscode.workspace.applyEdit(workspaceEdit);
    }
    async executeCommand(request) {
        // Always ask for permission before executing commands
        const message = `Claude wants to run command: ${request.command} ${request.args.join(' ')}\n` +
            `Description: ${request.description}\n` +
            `Risk Level: ${request.risk}`;
        const response = await vscode.window.showWarningMessage(message, { modal: true }, 'Allow', 'Deny');
        if (response !== 'Allow') {
            throw new Error('Command execution was denied by user');
        }
        // Execute the command
        const terminal = vscode.window.createTerminal('Claude Assistant');
        terminal.show();
        terminal.sendText(`${request.command} ${request.args.join(' ')}`);
    }
    async getFileContent(filePath) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            return document.getText();
        }
        catch (error) {
            throw new Error(`Failed to read file: ${filePath}`);
        }
    }
    async getSelectedCode() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            return editor.document.getText(selection);
        }
        return undefined;
    }
    async getCurrentFileContext() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.getText();
        }
        return undefined;
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=fileManager.js.map