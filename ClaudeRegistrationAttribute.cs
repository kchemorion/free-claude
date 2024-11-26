using Microsoft.VisualStudio.Shell;
using System;

namespace ClaudeVSExtension
{
    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public class ClaudeRegistrationAttribute : RegistrationAttribute
    {
        private readonly string _name;
        private readonly string _description;

        public ClaudeRegistrationAttribute(string name, string description)
        {
            _name = name;
            _description = description;
        }

        public override void Register(RegistrationContext context)
        {
            using (var key = context.CreateKey(@"Packages\{" + typeof(ClaudeExtensionPackage).GUID + @"}"))
            {
                key.SetValue(null, _name);
                key.SetValue("Description", _description);
                key.SetValue("ProductVersion", "1.0");
                key.SetValue("CompanyName", "Claude VS Extension");
                key.SetValue("MinEdition", "Standard");
                key.SetValue("ID", 1);
            }

            using (var key = context.CreateKey(@"Menus"))
            {
                key.SetValue("Package", "{" + typeof(ClaudeExtensionPackage).GUID + "}");
                key.SetValue("Resource", "Menus.ctmenu");
            }

            using (var key = context.CreateKey(@"ToolWindows\{" + typeof(ClaudeChatWindow).GUID + @"}"))
            {
                key.SetValue("Name", "Claude Chat Window");
                key.SetValue("Package", "{" + typeof(ClaudeExtensionPackage).GUID + "}");
                key.SetValue("Style", "Tabbed");
            }
        }

        public override void Unregister(RegistrationContext context)
        {
            context.RemoveKey(@"Packages\{" + typeof(ClaudeExtensionPackage).GUID + @"}");
            context.RemoveKey(@"Menus");
            context.RemoveKey(@"ToolWindows\{" + typeof(ClaudeChatWindow).GUID + @"}");
        }
    }
}
