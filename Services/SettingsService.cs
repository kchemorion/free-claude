using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Microsoft.VisualStudio.Shell;
using Microsoft.VisualStudio.Shell.Interop;
using Microsoft.VisualStudio.Shell.Settings;
using Microsoft.VisualStudio.Settings;
using Newtonsoft.Json;

namespace ClaudeVSExtension.Services
{
    public class SettingsService
    {
        private const string CollectionPath = "ClaudeVSExtension";
        private readonly WritableSettingsStore _settingsStore;
        private readonly string _encryptionKey;

        public static class DefaultSettings
        {
            public const string ClaudeApiEndpoint = "https://api.claude.ai/v1/models/3.5-sonnet/generate";
        }

        public SettingsService()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            var shellSettingsManager = new ShellSettingsManager(ServiceProvider.GlobalProvider);
            _settingsStore = shellSettingsManager.GetWritableSettingsStore(SettingsScope.UserSettings);

            // Create our settings collection if it doesn't exist
            if (!_settingsStore.CollectionExists(CollectionPath))
            {
                _settingsStore.CreateCollection(CollectionPath);
            }

            // Generate or retrieve encryption key
            _encryptionKey = GetOrCreateEncryptionKey();
        }

        public void SaveSetting(string name, string value)
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (string.IsNullOrEmpty(value))
            {
                _settingsStore.DeleteProperty(CollectionPath, name);
                return;
            }

            var encryptedValue = EncryptString(value);
            _settingsStore.SetString(CollectionPath, name, encryptedValue);
        }

        public string GetSetting(string name, string defaultValue = "")
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            if (!_settingsStore.PropertyExists(CollectionPath, name))
            {
                return defaultValue;
            }

            var encryptedValue = _settingsStore.GetString(CollectionPath, name);
            try
            {
                return DecryptString(encryptedValue);
            }
            catch
            {
                return defaultValue;
            }
        }

        private string GetOrCreateEncryptionKey()
        {
            ThreadHelper.ThrowIfNotOnUIThread();

            const string keyName = "EncryptionKey";
            if (_settingsStore.PropertyExists(CollectionPath, keyName))
            {
                return _settingsStore.GetString(CollectionPath, keyName);
            }

            var key = Convert.ToBase64String(GenerateRandomKey());
            _settingsStore.SetString(CollectionPath, keyName, key);
            return key;
        }

        private byte[] GenerateRandomKey()
        {
            using (var rng = new RNGCryptoServiceProvider())
            {
                var key = new byte[32]; // 256 bits
                rng.GetBytes(key);
                return key;
            }
        }

        private string EncryptString(string plainText)
        {
            using (var aes = Aes.Create())
            {
                aes.Key = Convert.FromBase64String(_encryptionKey);
                aes.GenerateIV();

                using (var encryptor = aes.CreateEncryptor())
                using (var msEncrypt = new MemoryStream())
                {
                    // Write IV first
                    msEncrypt.Write(aes.IV, 0, aes.IV.Length);

                    using (var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write))
                    using (var swEncrypt = new StreamWriter(csEncrypt))
                    {
                        swEncrypt.Write(plainText);
                    }

                    return Convert.ToBase64String(msEncrypt.ToArray());
                }
            }
        }

        private string DecryptString(string cipherText)
        {
            var fullCipher = Convert.FromBase64String(cipherText);

            using (var aes = Aes.Create())
            {
                aes.Key = Convert.FromBase64String(_encryptionKey);

                // Get IV from first 16 bytes
                var iv = new byte[16];
                Array.Copy(fullCipher, 0, iv, 0, iv.Length);
                aes.IV = iv;

                using (var decryptor = aes.CreateDecryptor())
                using (var msDecrypt = new MemoryStream(fullCipher, iv.Length, fullCipher.Length - iv.Length))
                using (var csDecrypt = new CryptoStream(msDecrypt, decryptor, CryptoStreamMode.Read))
                using (var srDecrypt = new StreamReader(csDecrypt))
                {
                    return srDecrypt.ReadToEnd();
                }
            }
        }
    }

    public class ExtensionSettings
    {
        public string GitHubToken { get; set; }
        public string GitHubOwner { get; set; }
        public string GitHubRepo { get; set; }
        public string SnykApiKey { get; set; }
        public string ClaudeApiKey { get; set; }
        public string ClaudeApiEndpoint { get; set; } = "https://api.claude.ai/v1/models/3.5-sonnet/generate";
    }
}
