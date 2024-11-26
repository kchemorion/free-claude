using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.TextManager.Interop;
using Microsoft.VisualStudio.ComponentModelHost;
using Microsoft.VisualStudio.Editor;
using Microsoft.VisualStudio.Text.Editor;
using Microsoft.VisualStudio.Text;
using Microsoft.VisualStudio.Language.Intellisense;
using Microsoft.VisualStudio.LanguageServices;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.Text;
using Microsoft.CodeAnalysis.FindSymbols;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.VisualStudio.Threading;
using Microsoft.VisualStudio.TeamFoundation.Git.Extensibility;
using Microsoft.VisualStudio.TestWindow.Extensibility;
using NuGet.VisualStudio;
using EnvDTE;
using EnvDTE80;

namespace ClaudeVSExtension
{
    public class VSOperations
    {
        private readonly DTE2 _dte;
        private readonly IVsEditorAdaptersFactoryService _editorFactory;
        private readonly IGitExt _gitService;
        private readonly IVsTestWindow _testWindow;
        private readonly IVsPackageInstaller _nugetInstaller;
        private readonly Workspace _workspace;
        private readonly JoinableTaskFactory _jtf;

        public VSOperations()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            _dte = Package.GetGlobalService(typeof(DTE)) as DTE2;
            
            var componentModel = Package.GetGlobalService(typeof(SComponentModel)) as IComponentModel;
            _editorFactory = componentModel.GetService<IVsEditorAdaptersFactoryService>();
            _gitService = componentModel.GetService<IGitExt>();
            _testWindow = componentModel.GetService<IVsTestWindow>();
            _nugetInstaller = componentModel.GetService<IVsPackageInstaller>();
            _workspace = componentModel.GetService<VisualStudioWorkspace>();
            _jtf = ThreadHelper.JoinableTaskFactory;
        }

        // Code Analysis and Refactoring
        public async Task<IEnumerable<string>> FindReferencesAsync(string symbolName)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            var document = _workspace.CurrentSolution.GetDocument(_workspace.GetDocumentIdInCurrentContext());
            var model = await document.GetSemanticModelAsync();
            var symbol = await SymbolFinder.FindSymbolAtPositionAsync(document, model.SyntaxTree.GetRoot().DescendantNodes()
                .OfType<IdentifierNameSyntax>()
                .First(n => n.Identifier.Text == symbolName)
                .SpanStart);

            var references = await SymbolFinder.FindReferencesAsync(symbol, document.Project.Solution);
            return references.SelectMany(r => r.Locations).Select(loc => loc.Location.GetLineSpan().ToString());
        }

        public async Task<bool> RenameSymbolAsync(string oldName, string newName)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var document = _workspace.CurrentSolution.GetDocument(_workspace.GetDocumentIdInCurrentContext());
                var model = await document.GetSemanticModelAsync();
                var symbol = await SymbolFinder.FindSymbolAtPositionAsync(document, model.SyntaxTree.GetRoot().DescendantNodes()
                    .OfType<IdentifierNameSyntax>()
                    .First(n => n.Identifier.Text == oldName)
                    .SpanStart);

                var solution = await Renamer.RenameSymbolAsync(document.Project.Solution, symbol, newName, null);
                return await _workspace.TryApplyChangesAsync(solution);
            }
            catch (Exception)
            {
                return false;
            }
        }

        // Git Operations
        public async Task<bool> GitCommitAsync(string message)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var repo = _gitService.ActiveRepositories.FirstOrDefault();
                if (repo == null) return false;

                await repo.CommitAsync(message);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<bool> GitCreateBranchAsync(string branchName)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var repo = _gitService.ActiveRepositories.FirstOrDefault();
                if (repo == null) return false;

                await repo.CreateBranchAsync(branchName);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        // Test Operations
        public async Task<bool> RunTestsAsync(string testName = null)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                if (string.IsNullOrEmpty(testName))
                {
                    await _testWindow.RunAllTestsAsync();
                }
                else
                {
                    await _testWindow.RunTestsAsync(new[] { testName });
                }
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<IEnumerable<string>> GetTestResultsAsync()
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var results = await _testWindow.GetTestResultsAsync();
                return results.Select(r => $"{r.TestName}: {r.Outcome}");
            }
            catch (Exception)
            {
                return Enumerable.Empty<string>();
            }
        }

        // NuGet Package Management
        public async Task<bool> InstallPackageAsync(string packageId, string version = null)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var project = _dte.ActiveSolutionProjects as Project;
                if (project == null) return false;

                _nugetInstaller.InstallPackage(null, project, packageId, version, false);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        // Code Generation and Analysis
        public async Task<IEnumerable<string>> GetCodeSuggestionsAsync(int line, int column)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var broker = GetComponentService<ICompletionBroker>();
                var view = GetWpfTextView();
                if (view == null) return Enumerable.Empty<string>();

                var session = broker.CreateCompletionSession(view, null, true);
                if (session == null) return Enumerable.Empty<string>();

                session.Start();
                var completions = session.CompletionSets.SelectMany(s => s.Completions);
                return completions.Select(c => c.DisplayText);
            }
            catch (Exception)
            {
                return Enumerable.Empty<string>();
            }
        }

        public async Task<bool> AddInterfaceImplementationAsync(string interfaceName)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var document = _workspace.CurrentSolution.GetDocument(_workspace.GetDocumentIdInCurrentContext());
                var model = await document.GetSemanticModelAsync();
                var currentClass = model.SyntaxTree.GetRoot().DescendantNodes()
                    .OfType<ClassDeclarationSyntax>()
                    .First();

                var interfaceSymbol = model.Compilation.GetTypeByMetadataName(interfaceName);
                if (interfaceSymbol == null) return false;

                var generator = SyntaxGenerator.GetGenerator(document);
                var implementation = generator.ImplementInterface(currentClass, interfaceSymbol);
                
                var solution = document.Project.Solution.WithDocumentSyntaxRoot(
                    document.Id, implementation);
                
                return await _workspace.TryApplyChangesAsync(solution);
            }
            catch (Exception)
            {
                return false;
            }
        }

        // Project/Solution Management
        public async Task<bool> AddProjectReferenceAsync(string referencePath)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var project = _dte.ActiveSolutionProjects as Project;
                if (project == null) return false;

                project.Object.References.Add(referencePath);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<string> GetProjectStructureAsync()
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                var structure = new System.Text.StringBuilder();
                foreach (Project project in _dte.Solution.Projects)
                {
                    structure.AppendLine($"Project: {project.Name}");
                    AddProjectItemsToStructure(project.ProjectItems, structure, "  ");
                }
                return structure.ToString();
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }

        private void AddProjectItemsToStructure(ProjectItems items, System.Text.StringBuilder builder, string indent)
        {
            foreach (ProjectItem item in items)
            {
                builder.AppendLine($"{indent}{item.Name}");
                if (item.ProjectItems != null)
                {
                    AddProjectItemsToStructure(item.ProjectItems, builder, indent + "  ");
                }
            }
        }

        // Debugging Support
        public async Task<bool> StartDebuggingAsync()
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                _dte.Debugger.Go(false);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<bool> AddBreakpointAsync(string file, int line)
        {
            await _jtf.SwitchToMainThreadAsync();
            
            try
            {
                _dte.Debugger.Breakpoints.Add(File: file, Line: line);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        // Helper methods
        private T GetComponentService<T>() where T : class
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            return Package.GetGlobalService(typeof(SComponentModel)) is IComponentModel componentModel
                ? componentModel.GetService<T>()
                : null;
        }

        private IWpfTextView GetWpfTextView()
        {
            ThreadHelper.ThrowIfNotOnUIThread();
            var textManager = Package.GetGlobalService(typeof(SVsTextManager)) as IVsTextManager;
            if (textManager == null) return null;

            IVsTextView activeView;
            textManager.GetActiveView(1, null, out activeView);
            return activeView == null ? null : _editorFactory.GetWpfTextView(activeView);
        }

        // Original methods remain unchanged...
        public async Task<string> GetCurrentFileContentAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            
            Document activeDoc = _dte.ActiveDocument;
            if (activeDoc == null) return string.Empty;

            TextDocument textDoc = activeDoc.Object("TextDocument") as TextDocument;
            if (textDoc == null) return string.Empty;

            EditPoint editPoint = textDoc.StartPoint.CreateEditPoint();
            return editPoint.GetText(textDoc.EndPoint);
        }

        public async Task<bool> ModifyCodeAsync(string filePath, int startLine, int startColumn, int endLine, int endColumn, string newText)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();

            try
            {
                var vsTextView = await GetActiveTextViewAsync();
                if (vsTextView == null) return false;

                IWpfTextView textView = _editorFactory.GetWpfTextView(vsTextView);
                if (textView == null) return false;

                ITextSnapshot snapshot = textView.TextBuffer.CurrentSnapshot;
                var startPos = new SnapshotPoint(snapshot, GetPosition(snapshot, startLine, startColumn));
                var endPos = new SnapshotPoint(snapshot, GetPosition(snapshot, endLine, endColumn));
                var span = new SnapshotSpan(startPos, endPos);

                textView.TextBuffer.Replace(span, newText);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        public async Task<ProjectItem> AddNewFileToProjectAsync(string filePath, string fileContent)
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            
            try
            {
                Project project = _dte.ActiveSolutionProjects as Project;
                if (project == null) return null;

                System.IO.File.WriteAllText(filePath, fileContent);
                return project.ProjectItems.AddFromFile(filePath);
            }
            catch (Exception)
            {
                return null;
            }
        }

        public async Task<bool> BuildSolutionAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            
            try
            {
                _dte.Solution.SolutionBuild.Build(true);
                return true;
            }
            catch (Exception)
            {
                return false;
            }
        }

        private async Task<IVsTextView> GetActiveTextViewAsync()
        {
            await ThreadHelper.JoinableTaskFactory.SwitchToMainThreadAsync();
            
            var textManager = Package.GetGlobalService(typeof(SVsTextManager)) as IVsTextManager;
            if (textManager == null) return null;

            IVsTextView activeView;
            textManager.GetActiveView(1, null, out activeView);
            return activeView;
        }

        private int GetPosition(ITextSnapshot snapshot, int line, int column)
        {
            return snapshot.GetLineFromLineNumber(Math.Max(0, line - 1)).Start.Position + Math.Max(0, column - 1);
        }
    }
}
