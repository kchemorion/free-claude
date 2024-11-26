@echo off
set MSBUILD="C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
%MSBUILD% /t:Clean;Build /p:Configuration=Release;Platform=AnyCPU;DeployExtension=false;VSCTCompilerIncludeWildcard=false;VSCTCompilerAlwaysIncludeAllImagesInVSIX=false;UseVSHostingProcess=false /m:1 ClaudeVSExtension.csproj
