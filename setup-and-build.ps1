# Download .NET SDK installer
$dotnetUrl = "https://download.visualstudio.microsoft.com/download/pr/85473c45-8d91-48cb-ab41-86ec7abc1000/83cd0c82f0cde9a566bae4245ea5a65b/dotnet-sdk-6.0.320-win-x64.exe"
$installerPath = "$env:TEMP\dotnet-sdk-installer.exe"
Invoke-WebRequest -Uri $dotnetUrl -OutFile $installerPath

# Install .NET SDK
Write-Host "Installing .NET SDK..."
Start-Process -FilePath $installerPath -ArgumentList "/quiet" -Wait

# Refresh environment variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Install Visual Studio extension development workload
Write-Host "Installing Visual Studio SDK..."
$vsInstaller = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vs_installer.exe"
Start-Process -FilePath $vsInstaller -ArgumentList "modify --installPath ""${env:ProgramFiles}\Microsoft Visual Studio\2022\Community"" --add Microsoft.VisualStudio.Workload.VisualStudioExtension --quiet" -Wait

# Build the project
Write-Host "Building the project..."
dotnet build --configuration Release

Write-Host "Setup complete! The VSIX file should be in the bin/Release folder."
