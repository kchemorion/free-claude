@echo off
call "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
msbuild /p:Configuration=Release /p:Platform=x64 /p:CreateVsixContainer=true ClaudeVSExtension.sln
