using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace ClaudeVSExtension
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [ProvideAutoLoad(UIContextGuids80.SolutionExists, PackageAutoLoadFlags.BackgroundLoad)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(ClaudeChatWindow))]
    [InstalledProductRegistration("#110", "#112", "1.0", IconResourceID = 400)]
    [Guid(PackageGuidString)]
    [ProvideBindingPath]
    public sealed class ClaudeExtensionPackage : AsyncPackage
    {
        public const string PackageGuidString = "12345678-1234-1234-1234-123456789012";

        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            await ClaudeChatWindowCommand.InitializeAsync(this);
        }
    }
}