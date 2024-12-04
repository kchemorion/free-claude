# Claude AI Assistant for VS Code

A powerful VS Code extension that integrates Claude AI directly into your development environment, providing intelligent code assistance, analysis, and chat capabilities.

## Features

- 🤖 **Intelligent Chat Interface**: Chat with Claude directly from VS Code's sidebar
- 📝 **Context-Aware Code Understanding**: Claude understands your current code context
- 🔍 **Code Analysis**: Get detailed analysis of your code with a single click
- 💡 **Smart Suggestions**: Receive intelligent code improvement suggestions
- 🛠️ **File Operations**: Claude can help create, edit, and manage files (with your permission)
- 📋 **Command Execution**: Run commands safely through Claude (with your permission)
- 💾 **Persistent Chat History**: Your conversations are saved for future reference
- ✨ **Markdown Support**: Rich text formatting with syntax highlighting

## Commands

- `Claude: Open Chat` - Opens the Claude chat interface
- `Claude: Analyze Code` - Analyzes the current file
- `Claude: Explain Code` - Explains the selected code
- `Claude: Suggest Improvements` - Suggests improvements for selected code
- `Claude: Clear History` - Clears the current chat history

## Requirements

- VS Code version 1.85.0 or higher
- Claude API key from Anthropic

## Setup

1. Install the extension
2. Open VS Code settings
3. Search for "Claude"
4. Enter your Claude API key
5. Optional: Configure other settings like model type and timeout

## Configuration

- `claude.apiKey`: Your Claude API key
- `claude.model`: Claude model to use (claude-3-5-sonnet-20240229.1, claude-3-5-sonnet-20240229.0, claude-instant)
- `claude.maxRetries`: Maximum number of API call retries
- `claude.timeout`: API call timeout in milliseconds

## Security

- All file operations require explicit user permission
- Command execution requires user approval
- API key is stored securely in VS Code's secret storage

## Development

### Prerequisites

- Node.js 14.x or higher
- npm or yarn

### Building

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run compile
   ```

### Testing

Run the tests:
```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Thanks to Anthropic for the Claude AI API
- Icons from VS Code's icon set
