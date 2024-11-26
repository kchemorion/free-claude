using System;
using System.Windows.Forms;
using Microsoft.VisualStudio.Shell;

namespace ClaudeVSExtension
{
    public partial class SettingsDialog : Form
    {
        private readonly Services.SettingsService _settingsService;

        public SettingsDialog()
        {
            InitializeComponent();
            _settingsService = new Services.SettingsService();
            LoadSettings();
        }

        private void InitializeComponent()
        {
            this.SuspendLayout();
            
            // Form settings
            this.Text = "Claude VS Extension Settings";
            this.Size = new System.Drawing.Size(500, 400);
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.StartPosition = FormStartPosition.CenterParent;

            // Create layout
            var layout = new TableLayoutPanel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(10),
                RowCount = 7,
                ColumnCount = 2
            };

            // Add controls for each setting
            AddSettingControl(layout, 0, "GitHub Token:", "GitHubToken", true);
            AddSettingControl(layout, 1, "GitHub Owner:", "GitHubOwner", false);
            AddSettingControl(layout, 2, "GitHub Repo:", "GitHubRepo", false);
            AddSettingControl(layout, 3, "Snyk API Key:", "SnykApiKey", true);
            AddSettingControl(layout, 4, "Claude API Key:", "ClaudeApiKey", true);
            AddSettingControl(layout, 5, "Claude API Endpoint:", "ClaudeApiEndpoint", false);

            // Add save button
            var buttonPanel = new FlowLayoutPanel
            {
                Dock = DockStyle.Bottom,
                FlowDirection = FlowDirection.RightToLeft,
                Height = 40,
                Padding = new Padding(0, 5, 0, 0)
            };

            var saveButton = new Button
            {
                Text = "Save",
                DialogResult = DialogResult.OK,
                Width = 75
            };
            saveButton.Click += SaveButton_Click;

            var cancelButton = new Button
            {
                Text = "Cancel",
                DialogResult = DialogResult.Cancel,
                Width = 75,
                Margin = new Padding(0, 0, 10, 0)
            };

            buttonPanel.Controls.Add(saveButton);
            buttonPanel.Controls.Add(cancelButton);

            this.Controls.Add(layout);
            this.Controls.Add(buttonPanel);

            this.AcceptButton = saveButton;
            this.CancelButton = cancelButton;

            this.ResumeLayout(false);
        }

        private void AddSettingControl(TableLayoutPanel layout, int row, string label, string settingName, bool isSecret)
        {
            layout.Controls.Add(new Label { Text = label, Anchor = AnchorStyles.Left }, 0, row);

            var textBox = new TextBox
            {
                Name = settingName,
                Dock = DockStyle.Fill,
                UseSystemPasswordChar = isSecret
            };

            layout.Controls.Add(textBox, 1, row);
        }

        private void LoadSettings()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            foreach (Control control in this.Controls[0].Controls)
            {
                if (control is TextBox textBox)
                {
                    textBox.Text = _settingsService.GetSetting(textBox.Name);
                }
            }
        }

        private void SaveButton_Click(object sender, EventArgs e)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            foreach (Control control in this.Controls[0].Controls)
            {
                if (control is TextBox textBox)
                {
                    _settingsService.SaveSetting(textBox.Name, textBox.Text);
                }
            }

            this.DialogResult = DialogResult.OK;
            this.Close();
        }
    }
}
