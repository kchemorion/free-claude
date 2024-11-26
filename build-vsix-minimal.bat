@echo off
set DEVENV="C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\devenv.com"
%DEVENV% /Build Release ClaudeVSExtension.sln /Project ClaudeVSExtension.csproj
