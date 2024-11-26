using Microsoft.VisualStudio.Shell;
using System;

namespace ClaudeVSExtension
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = false, Inherited = true)]
    public sealed class VSPackageRegistrationAttribute : RegistrationAttribute
    {
        private readonly string _packageId;

        public VSPackageRegistrationAttribute()
        {
            _packageId = typeof(ClaudeExtensionPackage).GUID.ToString("B");
        }

        public override void Register(RegistrationContext context)
        {
            using (var key = context.CreateKey($@"Packages\{_packageId}"))
            {
                key.SetValue(null, typeof(ClaudeExtensionPackage).FullName);
                key.SetValue("InprocServer32", context.InprocServerPath);
                key.SetValue("Class", typeof(ClaudeExtensionPackage).FullName);
                key.SetValue("CodeBase", context.CodeBase);
                key.SetValue("ID", 1);
                key.SetValue("MinEdition", "Professional");
                key.SetValue("ProductVersion", "1.0");
                key.SetValue("ProductName", "Claude VS Extension");
                key.SetValue("CompanyName", "Claude");
            }

            using (var key = context.CreateKey($@"Services\{_packageId}"))
            {
                key.SetValue(null, _packageId);
                key.SetValue("Name", "Claude VS Extension Service");
            }

            using (var key = context.CreateKey($@"ToolWindows\{typeof(ClaudeChatWindow).GUID:B}"))
            {
                key.SetValue(null, typeof(ClaudeChatWindow).FullName);
                key.SetValue("Package", _packageId);
                key.SetValue("Name", "Claude Chat Window");
            }
        }

        public override void Unregister(RegistrationContext context)
        {
            context.RemoveKey($@"Packages\{_packageId}");
            context.RemoveKey($@"Services\{_packageId}");
            context.RemoveKey($@"ToolWindows\{typeof(ClaudeChatWindow).GUID:B}");
        }
    }
}
