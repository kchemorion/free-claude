using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.VisualStudio;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;

namespace ClaudeVSExtension
{
    [PackageRegistration(UseManagedResourcesOnly = true)]
    [Guid("1b45e42d-5c31-4f2d-8d47-5f3d49a7f343")]
    public sealed class ClaudeExtensionPackage : Package
    {
        public const string PackageGuidString = "1b45e42d-5c31-4f2d-8d47-5f3d49a7f343";

        protected override void Initialize()
        {
            base.Initialize();
        }
    }
}
