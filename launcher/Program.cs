// WaMaX IDE Single Executable Launcher & First-Install Wizard
// Built with native Windows Forms & .NET Framework

using System;
using System.IO;
using System.Net;
using System.Drawing;
using System.Diagnostics;
using System.Windows.Forms;
using System.Threading;

namespace WaMaXLauncher
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            string configDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".wamax");
            string configFile = Path.Combine(configDir, "config.json");

            if (!Directory.Exists(configDir))
            {
                Directory.CreateDirectory(configDir);
            }

            // Check if config exists and memory path is configured
            string memoryPath = "";
            bool needsSetup = true;

            if (File.Exists(configFile))
            {
                try
                {
                    string json = File.ReadAllText(configFile);
                    int idx = json.IndexOf("\"dataPath\":");
                    if (idx != -1)
                    {
                        int start = json.IndexOf("\"", idx + 11) + 1;
                        int end = json.IndexOf("\"", start);
                        if (start > 0 && end > start)
                        {
                            memoryPath = json.Substring(start, end - start).Replace("\\\\", "\\");
                            if (Directory.Exists(memoryPath))
                            {
                                needsSetup = false;
                            }
                        }
                    }
                }
                catch { }
            }

            // If user passed --setup or needsSetup is true, show Setup Form
            if (needsSetup || (args.Length > 0 && args[0] == "--setup"))
            {
                using (SetupForm form = new SetupForm(appDir, configFile, memoryPath))
                {
                    if (form.ShowDialog() != DialogResult.OK)
                    {
                        return; // User cancelled setup
                    }
                    memoryPath = form.SelectedMemoryPath;
                }
            }

            // Run process supervisor and launch WaMaX IDE
            Application.Run(new TrayContext(appDir, memoryPath));
        }
    }

    public class SetupForm : Form
    {
        public string SelectedMemoryPath { get; private set; }
        private string appDir;
        private string configFile;

        private TextBox txtPath;
        private Label lblOllamaStatus;
        private Button btnInstallOllama;
        private ProgressBar prgOllama;

        public SetupForm(string appDir, string configFile, string existingPath)
        {
            this.appDir = appDir;
            this.configFile = configFile;

            // Default suggested memory path: D:\WaMaX-Storage if D: exists, else %USERPROFILE%\WaMaX-Storage
            if (string.IsNullOrEmpty(existingPath))
            {
                if (Directory.Exists("D:\\"))
                    existingPath = "D:\\WaMaX-Storage";
                else
                    existingPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "WaMaX-Storage");
            }
            this.SelectedMemoryPath = existingPath;

            InitUI();
            CheckOllama();
        }

        private void InitUI()
        {
            this.Text = "WaMaX IDE — First Install Setup & Storage Configuration";
            this.Size = new Size(620, 480);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(13, 17, 23);
            this.ForeColor = Color.FromArgb(201, 209, 217);

            // Title
            Label lblTitle = new Label();
            lblTitle.Text = "WaMaX IDE Setup";
            lblTitle.Font = new Font("Segoe UI", 16, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(34, 211, 238);
            lblTitle.Location = new Point(24, 20);
            lblTitle.AutoSize = true;
            this.Controls.Add(lblTitle);

            Label lblSubtitle = new Label();
            lblSubtitle.Text = "Configure your AI Memory, Model Storage & Engine in 1-Click.";
            lblSubtitle.Font = new Font("Segoe UI", 9);
            lblSubtitle.ForeColor = Color.FromArgb(139, 148, 158);
            lblSubtitle.Location = new Point(26, 54);
            lblSubtitle.AutoSize = true;
            this.Controls.Add(lblSubtitle);

            // Section 1: Memory Path Selector
            GroupBox grpMemory = new GroupBox();
            grpMemory.Text = " 1. AI Memory, Rules & Models Storage Location ";
            grpMemory.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            grpMemory.ForeColor = Color.White;
            grpMemory.Location = new Point(24, 90);
            grpMemory.Size = new Size(556, 120);

            Label lblMemDesc = new Label();
            lblMemDesc.Text = "Choose the directory where AI memories, custom rules, brains, and model checkpoints will be stored (protects data during updates and keeps C: drive clean):";
            lblMemDesc.Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
            lblMemDesc.ForeColor = Color.FromArgb(139, 148, 158);
            lblMemDesc.Location = new Point(14, 26);
            lblMemDesc.Size = new Size(528, 36);
            grpMemory.Controls.Add(lblMemDesc);

            txtPath = new TextBox();
            txtPath.Text = this.SelectedMemoryPath;
            txtPath.Location = new Point(16, 70);
            txtPath.Size = new Size(410, 24);
            txtPath.BackColor = Color.FromArgb(22, 27, 34);
            txtPath.ForeColor = Color.White;
            txtPath.Font = new Font("Consolas", 9.5f);
            grpMemory.Controls.Add(txtPath);

            Button btnBrowse = new Button();
            btnBrowse.Text = "Browse...";
            btnBrowse.Location = new Point(434, 68);
            btnBrowse.Size = new Size(106, 28);
            btnBrowse.BackColor = Color.FromArgb(33, 38, 45);
            btnBrowse.ForeColor = Color.White;
            btnBrowse.FlatStyle = FlatStyle.Flat;
            btnBrowse.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select Folder for WaMaX AI Memory & Models";
                    fbd.SelectedPath = txtPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtPath.Text = fbd.SelectedPath;
                    }
                }
            };
            grpMemory.Controls.Add(btnBrowse);
            this.Controls.Add(grpMemory);

            // Section 2: Ollama Auto Detection & Installer
            GroupBox grpOllama = new GroupBox();
            grpOllama.Text = " 2. Local AI Engine (Ollama) ";
            grpOllama.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            grpOllama.ForeColor = Color.White;
            grpOllama.Location = new Point(24, 224);
            grpOllama.Size = new Size(556, 130);

            lblOllamaStatus = new Label();
            lblOllamaStatus.Text = "Checking local Ollama installation...";
            lblOllamaStatus.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            lblOllamaStatus.ForeColor = Color.FromArgb(201, 209, 217);
            lblOllamaStatus.Location = new Point(14, 28);
            lblOllamaStatus.Size = new Size(528, 22);
            grpOllama.Controls.Add(lblOllamaStatus);

            btnInstallOllama = new Button();
            btnInstallOllama.Text = "⚡ Auto-Download & Install Ollama (1-Click)";
            btnInstallOllama.Location = new Point(16, 56);
            btnInstallOllama.Size = new Size(320, 32);
            btnInstallOllama.BackColor = Color.FromArgb(16, 185, 129);
            btnInstallOllama.ForeColor = Color.White;
            btnInstallOllama.FlatStyle = FlatStyle.Flat;
            btnInstallOllama.Font = new Font("Segoe UI", 9, FontStyle.Bold);
            btnInstallOllama.Visible = false;
            btnInstallOllama.Click += (s, e) => InstallOllama();
            grpOllama.Controls.Add(btnInstallOllama);

            prgOllama = new ProgressBar();
            prgOllama.Location = new Point(16, 94);
            prgOllama.Size = new Size(524, 18);
            prgOllama.Visible = false;
            grpOllama.Controls.Add(prgOllama);

            this.Controls.Add(grpOllama);

            // Bottom Actions
            Button btnSaveAndLaunch = new Button();
            btnSaveAndLaunch.Text = "Save Configuration & Launch WaMaX IDE (1-Click)";
            btnSaveAndLaunch.Location = new Point(220, 376);
            btnSaveAndLaunch.Size = new Size(360, 42);
            btnSaveAndLaunch.BackColor = Color.FromArgb(6, 182, 212);
            btnSaveAndLaunch.ForeColor = Color.Black;
            btnSaveAndLaunch.FlatStyle = FlatStyle.Flat;
            btnSaveAndLaunch.Font = new Font("Segoe UI", 10, FontStyle.Bold);
            btnSaveAndLaunch.Cursor = Cursors.Hand;
            btnSaveAndLaunch.Click += (s, e) =>
            {
                SaveAndConfirm();
            };
            this.Controls.Add(btnSaveAndLaunch);
        }

        private void CheckOllama()
        {
            bool hasOllama = false;
            string localOllamaPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "Ollama", "ollama.exe");

            if (File.Exists(localOllamaPath))
            {
                hasOllama = true;
            }
            else
            {
                try
                {
                    Process p = new Process();
                    p.StartInfo.FileName = "ollama";
                    p.StartInfo.Arguments = "--version";
                    p.StartInfo.CreateNoWindow = true;
                    p.StartInfo.UseShellExecute = false;
                    p.Start();
                    p.WaitForExit(1000);
                    hasOllama = (p.ExitCode == 0);
                }
                catch { }
            }

            if (hasOllama)
            {
                lblOllamaStatus.Text = "✓ Ollama engine detected and ready on your system.";
                lblOllamaStatus.ForeColor = Color.FromArgb(52, 211, 153);
                btnInstallOllama.Visible = false;
            }
            else
            {
                lblOllamaStatus.Text = "Ollama is not yet installed. Click below to install it silently:";
                lblOllamaStatus.ForeColor = Color.FromArgb(251, 191, 36);
                btnInstallOllama.Visible = true;
            }
        }

        private void InstallOllama()
        {
            btnInstallOllama.Enabled = false;
            prgOllama.Visible = true;
            prgOllama.Value = 10;
            lblOllamaStatus.Text = "Downloading Ollama installer from official source...";

            Thread t = new Thread(() =>
            {
                string tempInstaller = Path.Combine(Path.GetTempPath(), "OllamaSetup.exe");
                try
                {
                    using (WebClient client = new WebClient())
                    {
                        client.DownloadProgressChanged += (s, pe) =>
                        {
                            this.Invoke((MethodInvoker)delegate { prgOllama.Value = pe.ProgressPercentage; });
                        };
                        client.DownloadFile("https://ollama.com/download/OllamaSetup.exe", tempInstaller);
                    }

                    this.Invoke((MethodInvoker)delegate
                    {
                        lblOllamaStatus.Text = "Running silent installation...";
                    });

                    Process installer = Process.Start(tempInstaller, "/silent");
                    installer.WaitForExit(60000);

                    this.Invoke((MethodInvoker)delegate
                    {
                        prgOllama.Value = 100;
                        CheckOllama();
                    });
                }
                catch (Exception ex)
                {
                    this.Invoke((MethodInvoker)delegate
                    {
                        lblOllamaStatus.Text = "Install error: " + ex.Message;
                        lblOllamaStatus.ForeColor = Color.FromArgb(248, 113, 113);
                        btnInstallOllama.Enabled = true;
                    });
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        private void SaveAndConfirm()
        {
            string chosen = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(chosen))
            {
                MessageBox.Show("Please enter a valid folder path.", "WaMaX IDE", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                if (!Directory.Exists(chosen))
                {
                    Directory.CreateDirectory(chosen);
                }

                // Subfolders for memories, models, backups
                Directory.CreateDirectory(Path.Combine(chosen, "data"));
                Directory.CreateDirectory(Path.Combine(chosen, "models"));
                Directory.CreateDirectory(Path.Combine(chosen, "backups"));

                string json = string.Format("{{\n  \"dataPath\": \"{0}\",\n  \"updatedAt\": \"{1}\"\n}}",
                    chosen.Replace("\\", "\\\\"),
                    DateTime.UtcNow.ToString("o"));

                File.WriteAllText(configFile, json);

                this.SelectedMemoryPath = chosen;
                this.DialogResult = DialogResult.OK;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("Could not create folder: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    public class TrayContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private Process serverProcess;
        private string appDir;
        private string memoryPath;

        public TrayContext(string appDir, string memoryPath)
        {
            this.appDir = appDir;
            this.memoryPath = memoryPath;

            InitTray();
            StartServerAndBrowser();
        }

        private void InitTray()
        {
            ContextMenu menu = new ContextMenu();
            menu.MenuItems.Add("Open WaMaX IDE in Browser", (s, e) => Process.Start("http://localhost:3001"));
            menu.MenuItems.Add("Open Memory & Storage Folder", (s, e) => Process.Start("explorer.exe", memoryPath));
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("Re-configure Storage...", (s, e) =>
            {
                Process.Start(Application.ExecutablePath, "--setup");
            });
            menu.MenuItems.Add("-");
            menu.MenuItems.Add("Exit WaMaX IDE", (s, e) => ExitApp());

            trayIcon = new NotifyIcon();
            trayIcon.Text = "WaMaX IDE (Running on port 3001)";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.ContextMenu = menu;
            trayIcon.Visible = true;
            trayIcon.DoubleClick += (s, e) => Process.Start("http://localhost:3001");
        }

        private void StartServerAndBrowser()
        {
            Thread t = new Thread(() =>
            {
                try
                {
                    // Start Ollama serve if not running
                    try
                    {
                        Process ollamaProc = new Process();
                        ollamaProc.StartInfo.FileName = "ollama";
                        ollamaProc.StartInfo.Arguments = "serve";
                        ollamaProc.StartInfo.CreateNoWindow = true;
                        ollamaProc.StartInfo.UseShellExecute = false;
                        ollamaProc.Start();
                    }
                    catch { }

                    // Launch node server/index.js
                    ProcessStartInfo psi = new ProcessStartInfo();
                    psi.FileName = "node";
                    psi.Arguments = "server/index.js";
                    psi.WorkingDirectory = appDir;
                    psi.CreateNoWindow = true;
                    psi.UseShellExecute = false;
                    psi.EnvironmentVariables["WAMAX_DATA_DIR"] = Path.Combine(memoryPath, "data");
                    psi.EnvironmentVariables["OLLAMA_MODELS"] = Path.Combine(memoryPath, "models");

                    serverProcess = Process.Start(psi);

                    // Wait for server to become responsive on localhost:3001
                    for (int i = 0; i < 20; i++)
                    {
                        Thread.Sleep(500);
                        try
                        {
                            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:3001/api/health");
                            req.Timeout = 1000;
                            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                            {
                                if (resp.StatusCode == HttpStatusCode.OK) break;
                            }
                        }
                        catch { }
                    }

                    // Open default browser
                    Process.Start("http://localhost:3001");
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Error starting WaMaX backend: " + ex.Message, "WaMaX IDE", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        private void ExitApp()
        {
            if (serverProcess != null && !serverProcess.HasExited)
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = string.Format("/pid {0} /T /F", serverProcess.Id),
                        CreateNoWindow = true,
                        UseShellExecute = false
                    }).WaitForExit(3000);
                }
                catch { }
            }

            trayIcon.Visible = false;
            Application.Exit();
        }
    }
}
