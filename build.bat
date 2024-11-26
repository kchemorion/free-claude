@echo off
set VSWHERE="%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq tokens=*" %%i in (`%VSWHERE% -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe`) do (
  set MSBUILD="%%i"
)
%MSBUILD% /t:Clean,Build /p:Configuration=Release /p:Platform=AnyCPU /p:DeployExtension=false ClaudeVSExtension.csproj
pause
