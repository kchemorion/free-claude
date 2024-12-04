"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeGenerator = void 0;
const vscode = require("vscode");
class CodeGenerator {
    constructor(claudeAPI) {
        this.claudeAPI = claudeAPI;
    }
    async generateCode(prompt, language) {
        try {
            const generationPrompt = `Generate code in ${language} for the following request:
${prompt}

Requirements:
1. Include necessary imports
2. Add comprehensive comments
3. Follow best practices for ${language}
4. Make the code production-ready`;
            const response = await this.claudeAPI.sendMessage(generationPrompt);
            // Extract code from response
            const codeMatch = response.content.match(/```(?:\w+)?\n([\s\S]*?)```/);
            if (!codeMatch) {
                throw new Error('No code found in the response');
            }
            const code = codeMatch[1].trim();
            // Insert code at cursor position
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, code);
                });
            }
        }
        catch (error) {
            throw new Error(`Failed to generate code: ${error}`);
        }
    }
    async generateTests(document) {
        try {
            const code = document.getText();
            const language = document.languageId;
            const testPrompt = `Generate comprehensive tests for this ${language} code:

${code}

Requirements:
1. Use appropriate testing framework
2. Include edge cases
3. Add test descriptions
4. Follow testing best practices`;
            const response = await this.claudeAPI.sendMessage(testPrompt);
            // Extract test code from response
            const testCodeMatch = response.content.match(/```(?:\w+)?\n([\s\S]*?)```/);
            if (!testCodeMatch) {
                throw new Error('No test code found in the response');
            }
            const testCode = testCodeMatch[1].trim();
            // Create test file
            const testFilePath = this.getTestFilePath(document.uri);
            const edit = new vscode.WorkspaceEdit();
            edit.createFile(testFilePath, { ignoreIfExists: true });
            edit.insert(testFilePath, new vscode.Position(0, 0), testCode);
            await vscode.workspace.applyEdit(edit);
            await vscode.window.showTextDocument(testFilePath);
        }
        catch (error) {
            throw new Error(`Failed to generate tests: ${error}`);
        }
    }
    getTestFilePath(sourceUri) {
        const path = sourceUri.path;
        const extension = path.split('.').pop();
        return sourceUri.with({
            path: path.replace(new RegExp(`\\.${extension}$`), `.test.${extension}`)
        });
    }
}
exports.CodeGenerator = CodeGenerator;
//# sourceMappingURL=codeGenerator.js.map