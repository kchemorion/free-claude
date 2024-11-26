using Microsoft.VisualStudio.Shell;
using System.Runtime.InteropServices;

namespace ClaudeVSExtension
{
    [ProvideBindingPath]
    [ProvideAutoLoad(Microsoft.VisualStudio.Shell.Interop.UIContextGuids80.SolutionExists, PackageAutoLoadFlags.BackgroundLoad)]
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [InstalledProductRegistration("#110", "#112", "1.0", IconResourceID = 400)]
    [ProvideMenuResource("Menus.ctmenu", 1)]
    [ProvideToolWindow(typeof(ClaudeChatWindow))]
    [Guid("12345678-1234-1234-1234-123456789012")]
    public class RegistrationAttributes { }
