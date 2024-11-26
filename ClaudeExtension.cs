using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;
using System.Threading;
using Task = System.Threading.Tasks.Task;

namespace ClaudeVSExtension
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [Guid("12345678-1234-1234-1234-123456789012")]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(ClaudeChatWindow))]
    public sealed class ClaudeExtensionPackage : AsyncPackage
    {
        protected override async Task InitializeAsync(CancellationToken cancellationToken, IProgress<ServiceProgressData> progress)
        {
            await JoinableTaskFactory.SwitchToMainThreadAsync(cancellationToken);
            await ClaudeChatWindowCommand.InitializeAsync(this);
        }
    }
}
