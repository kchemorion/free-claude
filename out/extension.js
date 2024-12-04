"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const claude_1 = require("./api/claude");
const codeGenerator_1 = require("./services/codeGenerator");
const gitIntegration_1 = require("./services/gitIntegration");
const documentationGenerator_1 = require("./services/documentationGenerator");
async function activate(context) {
    try {
        const claudeAPI = new claude_1.ClaudeAPI();
        const codeGenerator = new codeGenerator_1.CodeGenerator(claudeAPI);
        const gitIntegration = new gitIntegration_1.GitIntegration(claudeAPI);
        const documentationGenerator = new documentationGenerator_1.DocumentationGenerator(claudeAPI);
        // Register code generation commands
        context.subscriptions.push(vscode.commands.registerCommand('claudeAssistant.generateCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            const language = editor.document.languageId;
            const prompt = await vscode.window.showInputBox({
                prompt: 'Enter code generation prompt',
                placeHolder: 'e.g., Create a function that sorts an array'
            });
            if (!prompt)
                return;
            try {
                await codeGenerator.generateCode(prompt, language);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Code generation failed: ${error}`);
            }
        }), vscode.commands.registerCommand('claudeAssistant.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            try {
                await codeGenerator.generateTests(editor.document);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Test generation failed: ${error}`);
            }
        }), 
        // Git integration commands
        vscode.commands.registerCommand('claudeAssistant.suggestCommitMessage', async () => {
            try {
                const message = await gitIntegration.suggestCommitMessage();
                if (message) {
                    await vscode.env.clipboard.writeText(message);
                    vscode.window.showInformationMessage('Commit message copied to clipboard');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to suggest commit message: ${error}`);
            }
        }), vscode.commands.registerCommand('claudeAssistant.reviewChanges', async () => {
            try {
                await gitIntegration.reviewChanges();
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to review changes: ${error}`);
            }
        }), vscode.commands.registerCommand('claudeAssistant.generatePRDescription', async () => {
            try {
                const description = await gitIntegration.generatePRDescription();
                if (description) {
                    await vscode.env.clipboard.writeText(description);
                    vscode.window.showInformationMessage('PR description copied to clipboard');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to generate PR description: ${error}`);
            }
        }), 
        // Documentation commands
        vscode.commands.registerCommand('claudeAssistant.generateDocumentation', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor');
                return;
            }
            try {
                await documentationGenerator.generateDocumentation(editor.document);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Documentation generation failed: ${error}`);
            }
        }));
        // Create status bar item
        const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.text = "$(symbol-misc) Claude Assistant";
        statusBarItem.tooltip = "Click to show Claude Assistant commands";
        statusBarItem.command = 'workbench.action.quickOpen';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        vscode.window.showInformationMessage('Claude Assistant is now active!');
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to activate Claude Assistant: ${error}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map