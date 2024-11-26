# Free-Claude

A Visual Studio extension that integrates Claude AI functionality directly into your development environment.

## Features

- Claude Chat Window accessible from the Tools menu
- Interactive AI assistance while coding
- Context-aware code suggestions and explanations

## Requirements

- Visual Studio 2022 (Community, Professional, or Enterprise)
- .NET Framework 4.7.2
- Windows operating system

## Installation

1. Download the latest VSIX package from the releases page
2. Close all instances of Visual Studio
3. Double-click the VSIX file to install
4. Restart Visual Studio

## Building from Source

### Prerequisites

- Visual Studio 2022
- Visual Studio SDK
- .NET Framework 4.7.2 SDK

### Build Steps

1. Clone the repository
2. Open `ClaudeVSExtension.sln` in Visual Studio
3. Build the solution in Release configuration
4. The VSIX package will be generated in the `bin/Release` directory

Alternatively, use the provided build scripts:
- `build-vsix.bat` - Full build script
- `build-vsix-minimal.bat` - Minimal build script for troubleshooting

## Project Structure

- `ClaudeExtensionPackage.cs` - Main package class with VS integration
- `ClaudeChatWindow.cs` - Chat window implementation
- `ClaudeService.cs` - Claude AI service integration
- `VSOperations.cs` - Visual Studio operations and utilities

## Dependencies

- Microsoft.VisualStudio.SDK (17.0.32112.339)
- Microsoft.VSSDK.BuildTools (17.0.5232)
- Newtonsoft.Json (13.0.1)

## Known Issues

- Memory constraints during VSCT compilation
- Package registration challenges during build

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
