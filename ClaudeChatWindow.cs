using System;
using System.Runtime.InteropServices;
using Microsoft.VisualStudio.Shell;
using System.Windows.Controls;
using System.Windows;
using System.Threading.Tasks;

namespace ClaudeVSExtension
{
    [PackageRegistration(UseManagedResourcesOnly = true, AllowsBackgroundLoading = true)]
    [ProvideToolWindow(typeof(ClaudeChatWindow))]
    [Guid("87654321-4321-4321-4321-210987654321")]
    public class ClaudeChatWindow : ToolWindowPane
    {
        private TextBox chatInput;
        private TextBox chatHistory;
        private Button sendButton;
        private ClaudeService claudeService;

        public ClaudeChatWindow() : base(null)
        {
            this.Caption = "Claude Assistant";
            
            // Create UI
            var grid = new Grid();
            grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            // Chat history
            chatHistory = new TextBox
            {
                IsReadOnly = true,
                TextWrapping = TextWrapping.Wrap,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto
            };
            Grid.SetRow(chatHistory, 0);
            grid.Children.Add(chatHistory);

            // Input area
            var inputPanel = new StackPanel { Orientation = Orientation.Horizontal };
            Grid.SetRow(inputPanel, 1);

            chatInput = new TextBox
            {
                Width = 300,
                Height = 50,
                TextWrapping = TextWrapping.Wrap,
                AcceptsReturn = true
            };
            inputPanel.Children.Add(chatInput);

            sendButton = new Button
            {
                Content = "Send",
                Width = 70,
                Height = 30,
                Margin = new Thickness(5, 0, 0, 0)
            };
            sendButton.Click += SendButton_Click;
            inputPanel.Children.Add(sendButton);

            grid.Children.Add(inputPanel);

            this.Content = grid;

            // Initialize Claude service
            claudeService = new ClaudeService();
        }

        private async Task SendMessageAsync()
        {
            if (string.IsNullOrWhiteSpace(chatInput.Text))
                return;

            string userMessage = chatInput.Text;
            chatHistory.Text += $"\nYou: {userMessage}\n";
            chatInput.Text = string.Empty;

            try
            {
                string response = await claudeService.GetResponseAsync(userMessage);
                chatHistory.Text += $"Claude: {response}\n";

                // Execute any commands in the response
                await claudeService.ExecuteCommandsAsync(response);
            }
            catch (Exception ex)
            {
                chatHistory.Text += $"Error: {ex.Message}\n";
                // Log the error or show a message box for serious errors
                MessageBox.Show($"An error occurred: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void SendButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                await SendMessageAsync();
            }
            catch (Exception ex)
            {
                // Handle any unhandled exceptions from SendMessageAsync
                MessageBox.Show($"A critical error occurred: {ex.Message}", "Critical Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
