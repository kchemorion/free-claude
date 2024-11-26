@echo off
set VSWHERE="%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`%VSWHERE% -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`) do (
  set MSBUILD="%%i"
)

%MSBUILD% ClaudeVSExtension.csproj /t:Clean,Build /p:Configuration=Release /p:Platform="Any CPU" /p:OutputPath=bin\Release\ /p:DeployExtension=false /p:ZipPackageCompressionLevel=normal /p:GeneratePkgDefFile=true /p:RegisterOutputPackage=true /p:CreateVsixContainer=true /v:minimal
