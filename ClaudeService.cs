using System;
using System.Threading.Tasks;
using System.Net.Http;
using Newtonsoft.Json;
using System.IO;
using System.Diagnostics;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace ClaudeVSExtension
{
    public class ClaudeService
    {
        private readonly HttpClient httpClient;
        private const string API_ENDPOINT = "https://api.claude.ai/v1/models/3.5-sonnet/generate";
        private const string API_KEY = "";

        public ClaudeService()
        {
            httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {API_KEY}");
        }

        public async Task<string> GetResponseAsync(string userInput)
        {
            var request = new
            {
                messages = new[]
                {
                    new { role = "user", content = userInput }
                },
                model = "claude-3-sonnet-20240229",
                max_tokens = 1000
            };

            var response = await httpClient.PostAsync(API_ENDPOINT,
                new StringContent(JsonConvert.SerializeObject(request), System.Text.Encoding.UTF8, "application/json"));

            var responseContent = await response.Content.ReadAsStringAsync();
            dynamic result = JsonConvert.DeserializeObject(responseContent);

            return result.choices[0].message.content;
        }

        public async Task ExecuteCommandsAsync(string claudeResponse)
        {
            // Parse commands from Claude's response
            // This is a simplified example - you'd want more robust parsing and validation
            if (claudeResponse.Contains("[[COMMAND]]"))
            {
                var commandStart = claudeResponse.IndexOf("[[COMMAND]]") + 10;
                var commandEnd = claudeResponse.IndexOf("[[/COMMAND]]");
                var command = claudeResponse.Substring(commandStart, commandEnd - commandStart).Trim();

                // Execute file system operations
                if (command.StartsWith("CREATE_FILE:"))
                {
                    var parts = command.Split(':');
                    await File.WriteAllTextAsync(parts[1], parts[2]);
                }
                else if (command.StartsWith("EXECUTE_CODE:"))
                {
                    var code = command.Substring("EXECUTE_CODE:".Length);
                    await ExecuteCodeAsync(code);
                }
                // Add more command types as needed
            }
        }

        private async Task ExecuteCodeAsync(string code)
        {
            // IMPORTANT: Implement proper security validation before executing any code
            
            // This is a very basic example - you'd want much more robust implementation
            // and security measures in a production environment
            try
            {
                // Create a temporary file with the code
                string tempFile = Path.GetTempFileName() + ".cs";
                await File.WriteAllTextAsync(tempFile, code);

                // Compile and execute
                var startInfo = new ProcessStartInfo
                {
                    FileName = "dotnet",
                    Arguments = $"run {tempFile}",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = Process.Start(startInfo))
                {
                    string output = await process.StandardOutput.ReadToEndAsync();
                    string error = await process.StandardError.ReadToEndAsync();

                    if (!string.IsNullOrEmpty(error))
                    {
                        throw new Exception($"Code execution error: {error}");
                    }

                    // Handle output as needed
                    await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
                    var outputWindow = Package.GetGlobalService(typeof(SVsOutputWindow)) as IVsOutputWindow;
                    Guid generalPaneGuid = VSConstants.GUID_OutWindowDebugPane;
                    outputWindow.GetPane(ref generalPaneGuid, out IVsOutputWindowPane generalPane);
                    generalPane.OutputString($"Code execution result: {output}\n");
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to execute code: {ex.Message}");
            }
        }
    }
}
