using System;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.VisualStudio.Shell;
using Task = System.Threading.Tasks.Task;

namespace ClaudeVSExtension
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid(PackageGuidString)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(ClaudeChatWindow))]
    public sealed class ClaudeExtensionPackage : AsyncPackage
    {
        public const string PackageGuidString = "1b45e42d-5c31-4f2d-8d47-5f3d49a7f343";

        private VSOperations _vsOperations;
        private Services.GitHubService _githubService;
        private Services.DependencyService _dependencyService;
        private Services.LearningService _learningService;
        private Services.SettingsService _settingsService;

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);

            _vsOperations = new VSOperations();
            _settingsService = new Services.SettingsService();
            
            // Initialize services with configuration from settings
            _githubService = new Services.GitHubService(
                token: _settingsService.GetSetting("GitHubToken"),
                owner: _settingsService.GetSetting("GitHubOwner"),
                repo: _settingsService.GetSetting("GitHubRepo")
            );

            _dependencyService = new Services.DependencyService(
                snykApiKey: _settingsService.GetSetting("SnykApiKey")
            );

            // Add settings command
            var commandService = await GetServiceAsync(typeof(IMenuCommandService)) as OleMenuCommandService;
            if (commandService != null)
            {
                var menuCommandID = new CommandID(CommandSet, 0x0200);
                var menuItem = new MenuCommand(ShowSettingsDialog, menuCommandID);
                commandService.AddCommand(menuItem);
            }

            await ClaudeChatWindowCommand.InitializeAsync(this);
        }

        private void ShowSettingsDialog(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var dialog = new SettingsDialog();
            dialog.ShowDialog();
        }

        public VSOperations GetVSOperations()
        {
            return _vsOperations;
        }

        public Services.GitHubService GetGitHubService()
        {
            return _githubService;
        }

        public Services.DependencyService GetDependencyService()
        {
            return _dependencyService;
        }

        public Services.LearningService GetLearningService()
        {
            return _learningService;
        }

        public Services.SettingsService GetSettingsService()
        {
            return _settingsService;
        }
    }
}
