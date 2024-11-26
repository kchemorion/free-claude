using System;
using System.Threading.Tasks;
using System.Net.Http;
using Newtonsoft.Json;
using System.IO;
using System.Diagnostics;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using System.Text.RegularExpressions;

namespace ClaudeVSExtension
{
    public class ClaudeService
    {
        private readonly HttpClient httpClient;
        private readonly VSOperations vsOps;
        private readonly Services.GitHubService githubService;
        private readonly Services.DependencyService dependencyService;
        private readonly Services.LearningService learningService;
        private readonly Services.SettingsService settingsService;
        private readonly string apiEndpoint;

        public ClaudeService()
        {
            httpClient = new HttpClient();
            settingsService = new Services.SettingsService();
            
            var apiKey = settingsService.GetSetting("ClaudeApiKey");
            if (string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException("Claude API key not configured. Please set it in Tools -> Options -> Claude VS Extension.");
            }
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            apiEndpoint = settingsService.GetSetting("ClaudeApiEndpoint", Services.SettingsService.DefaultSettings.ClaudeApiEndpoint);
            
            var package = Package.GetGlobalService(typeof(SVsServiceProvider)) as IServiceProvider;
            var vsPackage = package.GetService(typeof(ClaudeExtensionPackage)) as ClaudeExtensionPackage;
            
            vsOps = vsPackage.GetVSOperations();
            githubService = vsPackage.GetGitHubService();
            dependencyService = vsPackage.GetDependencyService();
            learningService = vsPackage.GetLearningService();
        }

        public async Task<string> GetResponseAsync(string userInput)
        {
            // Add context about the current file
            string currentFileContent = await vsOps.GetCurrentFileContentAsync();
            string contextEnhancedInput = $"Current file content:\n{currentFileContent}\n\nUser request: {userInput}";

            var request = new
            {
                messages = new[]
                {
                    new { role = "user", content = contextEnhancedInput }
                },
                model = "claude-3-sonnet-20240229",
                max_tokens = 2000
            };

            var response = await httpClient.PostAsync(apiEndpoint,
                new StringContent(JsonConvert.SerializeObject(request), System.Text.Encoding.UTF8, "application/json"));

            var responseContent = await response.Content.ReadAsStringAsync();
            dynamic result = JsonConvert.DeserializeObject(responseContent);

            return result.choices[0].message.content;
        }

        public async Task ExecuteCommandsAsync(string claudeResponse)
        {
            var commands = ExtractCommands(claudeResponse);
            foreach (var cmd in commands)
            {
                await ExecuteCommandAsync(cmd);
            }
        }

        private async Task ExecuteCommandAsync(string command)
        {
            var requestData = new
            {
                prompt = command,
                max_tokens = 2000,
                temperature = 0.7
            };

            var response = await httpClient.PostAsync(
                apiEndpoint,
                new StringContent(JsonConvert.SerializeObject(requestData), System.Text.Encoding.UTF8, "application/json")
            );

            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException($"Failed to execute command. Status code: {response.StatusCode}");
            }

            if (command.StartsWith("MODIFY_CODE:"))
            {
                var match = Regex.Match(command, @"MODIFY_CODE:(\d+):(\d+):(\d+):(\d+):(.+)");
                if (match.Success)
                {
                    int startLine = int.Parse(match.Groups[1].Value);
                    int startCol = int.Parse(match.Groups[2].Value);
                    int endLine = int.Parse(match.Groups[3].Value);
                    int endCol = int.Parse(match.Groups[4].Value);
                    string newText = match.Groups[5].Value;

                    await vsOps.ModifyCodeAsync(null, startLine, startCol, endLine, endCol, newText);
                }
            }
            else if (command.StartsWith("CREATE_FILE:"))
            {
                var parts = command.Split(new[] { ':' }, 3);
                if (parts.Length == 3)
                {
                    await vsOps.AddNewFileToProjectAsync(parts[1], parts[2]);
                }
            }
            else if (command == "BUILD_SOLUTION")
            {
                await vsOps.BuildSolutionAsync();
            }
            // Git Operations
            else if (command.StartsWith("GIT_COMMIT:"))
            {
                var message = command.Substring("GIT_COMMIT:".Length);
                await vsOps.GitCommitAsync(message);
            }
            else if (command.StartsWith("GIT_BRANCH:"))
            {
                var branchName = command.Substring("GIT_BRANCH:".Length);
                await vsOps.GitCreateBranchAsync(branchName);
            }
            // Test Operations
            else if (command == "RUN_TESTS")
            {
                await vsOps.RunTestsAsync();
            }
            else if (command.StartsWith("RUN_TEST:"))
            {
                var testName = command.Substring("RUN_TEST:".Length);
                await vsOps.RunTestsAsync(testName);
            }
            // Package Management
            else if (command.StartsWith("INSTALL_PACKAGE:"))
            {
                var parts = command.Split(':');
                if (parts.Length >= 2)
                {
                    string version = parts.Length > 2 ? parts[2] : null;
                    await vsOps.InstallPackageAsync(parts[1], version);
                }
            }
            // Code Analysis and Refactoring
            else if (command.StartsWith("RENAME_SYMBOL:"))
            {
                var parts = command.Split(':');
                if (parts.Length == 3)
                {
                    await vsOps.RenameSymbolAsync(parts[1], parts[2]);
                }
            }
            else if (command.StartsWith("IMPLEMENT_INTERFACE:"))
            {
                var interfaceName = command.Substring("IMPLEMENT_INTERFACE:".Length);
                await vsOps.AddInterfaceImplementationAsync(interfaceName);
            }
            // Project Management
            else if (command.StartsWith("ADD_REFERENCE:"))
            {
                var reference = command.Substring("ADD_REFERENCE:".Length);
                await vsOps.AddProjectReferenceAsync(reference);
            }
            // Debugging
            else if (command == "START_DEBUG")
            {
                await vsOps.StartDebuggingAsync();
            }
            else if (command.StartsWith("ADD_BREAKPOINT:"))
            {
                var parts = command.Split(':');
                if (parts.Length == 3)
                {
                    await vsOps.AddBreakpointAsync(parts[1], int.Parse(parts[2]));
                }
            }
            // GitHub Operations
            else if (command.StartsWith("ANALYZE_REPOS:"))
            {
                var topic = command.Substring("ANALYZE_REPOS:".Length);
                var results = await githubService.AnalyzeRelatedRepositoriesAsync(topic);
                ShowOutput($"Found {results.Count()} related repositories");
            }
            else if (command.StartsWith("SUGGEST_CONTRIBUTIONS:"))
            {
                var level = (SkillLevel)Enum.Parse(typeof(SkillLevel), command.Substring("SUGGEST_CONTRIBUTIONS:".Length));
                var suggestions = await githubService.SuggestContributionsAsync(level);
                ShowOutput($"Found {suggestions.Count()} contribution opportunities");
            }
            else if (command.StartsWith("FIND_IMPLEMENTATIONS:"))
            {
                var pattern = command.Substring("FIND_IMPLEMENTATIONS:".Length);
                var implementations = await githubService.FindSimilarImplementationsAsync(pattern);
                ShowOutput($"Found {implementations.Count()} similar implementations");
            }
            // Dependency Operations
            else if (command.StartsWith("ANALYZE_SECURITY:"))
            {
                var parts = command.Split(':');
                var packageId = parts[1];
                var version = parts.Length > 2 ? parts[2] : null;
                var analysis = await dependencyService.AnalyzeSecurityImpactAsync(packageId, version);
                ShowOutput($"Security Impact Score: {analysis.ImpactScore}");
            }
            else if (command.StartsWith("SUGGEST_ALTERNATIVES:"))
            {
                var packageId = command.Substring("SUGGEST_ALTERNATIVES:".Length);
                var alternatives = await dependencyService.SuggestAlternativesAsync(packageId);
                ShowOutput($"Found {alternatives.Count()} alternative packages");
            }
            else if (command.StartsWith("PREDICT_BREAKING_CHANGES:"))
            {
                var parts = command.Split(':');
                if (parts.Length == 4)
                {
                    var analysis = await dependencyService.PredictBreakingChangesAsync(parts[1], parts[2], parts[3]);
                    ShowOutput($"Estimated migration effort: {analysis.EstimatedEffort.TotalHours} hours");
                }
            }
            // Learning Operations
            else if (command.StartsWith("GENERATE_DOCS:"))
            {
                var code = command.Substring("GENERATE_DOCS:".Length);
                var docs = await learningService.GenerateInteractiveDocsAsync(code);
                ShowOutput($"Generated documentation for {docs.Methods.Count()} methods");
            }
            else if (command.StartsWith("CREATE_TUTORIAL:"))
            {
                var diff = command.Substring("CREATE_TUTORIAL:".Length);
                var tutorial = await learningService.CreateTutorialFromChangesAsync(diff);
                ShowOutput($"Created tutorial: {tutorial.Title}");
            }
            else if (command.StartsWith("SUGGEST_LEARNING_PATH:"))
            {
                var profileJson = command.Substring("SUGGEST_LEARNING_PATH:".Length);
                var profile = JsonConvert.DeserializeObject<ContributorProfile>(profileJson);
                var path = await learningService.SuggestLearningPathAsync(profile);
                ShowOutput($"Created learning path with {path.Modules.Count()} modules");
            }
        }

        private string[] ExtractCommands(string response)
        {
            var commands = new System.Collections.Generic.List<string>();
            var matches = Regex.Matches(response, @"\[\[COMMAND\]\](.*?)\[\[/COMMAND\]\]", RegexOptions.Singleline);
            
            foreach (Match match in matches)
            {
                commands.Add(match.Groups[1].Value.Trim());
            }
            
            return commands.ToArray();
        }

        private void ShowOutput(string message)
        {
            var outputWindow = Package.GetGlobalService(typeof(SVsOutputWindow)) as IVsOutputWindow;
            Guid generalPaneGuid = VSConstants.GUID_OutWindowGeneralPane;
            IVsOutputWindowPane generalPane;
            outputWindow.GetPane(ref generalPaneGuid, out generalPane);
            generalPane.OutputString(message + Environment.NewLine);
            generalPane.Activate();
        }
    }
}
