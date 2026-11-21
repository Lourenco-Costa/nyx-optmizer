using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SantosSetup
{
    internal sealed class StepReport
    {
        public int Percent;
        public string Text;
        public int Step;

        public StepReport(int percent, string text, int step)
        {
            Percent = percent;
            Text = text;
            Step = step;
        }
    }

    internal static class ShellLink
    {
        public static void Create(string linkPath, string targetPath, string workingDirectory)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType == null) return;
                object shell = Activator.CreateInstance(shellType);
                object link = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { linkPath });
                Type linkType = link.GetType();
                linkType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { targetPath });
                linkType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { workingDirectory });
                linkType.InvokeMember("IconLocation", BindingFlags.SetProperty, null, link, new object[] { targetPath + ",0" });
                linkType.InvokeMember("Description", BindingFlags.SetProperty, null, link, new object[] { Brand.Product });
                linkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
            }
            catch
            {
                // Atalhos sao um extra: se falharem, a instalacao continua.
            }
        }
    }

    internal static class RegistryWriter
    {
        public static void Write(string directory, int sizeKb)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(Brand.RegistryKey))
                {
                    if (key == null) return;
                    string exe = Path.Combine(directory, Brand.ExeName);
                    string uninstaller = Path.Combine(directory, Brand.UninstallerName);

                    key.SetValue("DisplayName", Brand.Product);
                    key.SetValue("DisplayVersion", Brand.Version);
                    key.SetValue("Publisher", Brand.Company);
                    key.SetValue("InstallLocation", directory);
                    key.SetValue("DisplayIcon", exe + ",0");
                    key.SetValue("UninstallString", "\"" + uninstaller + "\"");
                    key.SetValue("QuietUninstallString", "\"" + uninstaller + "\" /quiet");
                    key.SetValue("HelpLink", "https://santos.local");
                    key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                    key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    if (sizeKb > 0) key.SetValue("EstimatedSize", sizeKb, RegistryValueKind.DWord);
                }
            }
            catch
            {
            }
        }

        public static string ReadInstallLocation()
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(Brand.RegistryKey))
                {
                    if (key == null) return null;
                    string location = key.GetValue("InstallLocation") as string;
                    if (!string.IsNullOrEmpty(location) && Directory.Exists(location)) return location;
                }
            }
            catch
            {
            }
            return null;
        }
    }

    internal static class PayloadStore
    {
        public static string ExtractToTemp()
        {
            string exe = Assembly.GetExecutingAssembly().Location;
            using (FileStream fs = new FileStream(exe, FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                if (fs.Length < 64) throw new InvalidDataException("O instalador esta incompleto.");

                fs.Seek(-12, SeekOrigin.End);
                byte[] tail = new byte[12];
                ReadExact(fs, tail, 12);

                if (tail[8] != (byte)'S' || tail[9] != (byte)'O' || tail[10] != (byte)'T' || tail[11] != (byte)'Z')
                    throw new InvalidDataException("O pacote do instalador esta danificado.");

                long size = BitConverter.ToInt64(tail, 0);
                long start = fs.Length - 12 - size;
                if (size <= 0 || start <= 0) throw new InvalidDataException("O pacote do instalador esta danificado.");

                string temp = Path.Combine(Path.GetTempPath(), "santos_payload_" + Guid.NewGuid().ToString("N") + ".zip");
                fs.Seek(start, SeekOrigin.Begin);

                using (FileStream output = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    byte[] buffer = new byte[262144];
                    long left = size;
                    while (left > 0)
                    {
                        int want = (int)Math.Min(buffer.Length, left);
                        int read = fs.Read(buffer, 0, want);
                        if (read <= 0) break;
                        output.Write(buffer, 0, read);
                        left -= read;
                    }
                }
                return temp;
            }
        }

        private static void ReadExact(Stream stream, byte[] buffer, int count)
        {
            int offset = 0;
            while (offset < count)
            {
                int read = stream.Read(buffer, offset, count - offset);
                if (read <= 0) throw new EndOfStreamException();
                offset += read;
            }
        }
    }

    internal static class InstallEngine
    {
        public static void Run(string targetDir, bool shortcuts, bool registry, bool launch, Action<StepReport> report)
        {
            Directory.CreateDirectory(targetDir);
            report(new StepReport(2, "A preparar a instala\u00e7\u00e3o\u2026", 0));

            foreach (Process process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Brand.ExeName)))
            {
                try
                {
                    process.Kill();
                    process.WaitForExit(4000);
                }
                catch
                {
                }
            }

            string payload = PayloadStore.ExtractToTemp();
            long installed = 0;
            try
            {
                using (FileStream fs = new FileStream(payload, FileMode.Open, FileAccess.Read, FileShare.Read))
                using (ZipArchive zip = new ZipArchive(fs, ZipArchiveMode.Read))
                {
                    long total = 0;
                    foreach (ZipArchiveEntry entry in zip.Entries) total += entry.Length;
                    if (total <= 0) total = 1;

                    long done = 0;
                    int last = -1;
                    string root = Path.GetFullPath(targetDir);
                    if (!root.EndsWith(Path.DirectorySeparatorChar.ToString())) root += Path.DirectorySeparatorChar;

                    foreach (ZipArchiveEntry entry in zip.Entries)
                    {
                        string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                        string destination = Path.GetFullPath(Path.Combine(targetDir, relative));

                        if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;

                        if (entry.Name.Length == 0)
                        {
                            Directory.CreateDirectory(destination);
                            continue;
                        }

                        Directory.CreateDirectory(Path.GetDirectoryName(destination));
                        using (Stream input = entry.Open())
                        using (FileStream output = new FileStream(destination, FileMode.Create, FileAccess.Write, FileShare.None))
                        {
                            byte[] buffer = new byte[131072];
                            int read;
                            while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                output.Write(buffer, 0, read);
                                done += read;
                                int percent = 4 + (int)(78.0 * done / total);
                                if (percent != last)
                                {
                                    last = percent;
                                    report(new StepReport(percent, "A copiar ficheiros\u2026", 0));
                                }
                            }
                        }
                        installed += entry.Length;
                    }
                }
            }
            finally
            {
                try
                {
                    File.Delete(payload);
                }
                catch
                {
                }
            }

            report(new StepReport(84, "A criar atalhos\u2026", 1));
            if (shortcuts)
            {
                string exe = Path.Combine(targetDir, Brand.ExeName);
                ShellLink.Create(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Brand.Product + ".lnk"), exe, targetDir);

                string programs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Brand.Product);
                Directory.CreateDirectory(programs);
                ShellLink.Create(Path.Combine(programs, Brand.Product + ".lnk"), exe, targetDir);
                ShellLink.Create(Path.Combine(programs, "Desinstalar " + Brand.Product + ".lnk"), Path.Combine(targetDir, Brand.UninstallerName), targetDir);
            }

            report(new StepReport(92, "A registar no sistema\u2026", 2));
            if (registry) RegistryWriter.Write(targetDir, (int)Math.Min(int.MaxValue, installed / 1024));

            report(new StepReport(98, "A finalizar\u2026", 3));
            Thread.Sleep(340);
            report(new StepReport(100, "Conclu\u00eddo", 3));

            if (launch)
            {
                try
                {
                    Process.Start(new ProcessStartInfo(Path.Combine(targetDir, Brand.ExeName))
                    {
                        WorkingDirectory = targetDir,
                        UseShellExecute = true
                    });
                }
                catch
                {
                }
            }
        }
    }

    internal sealed class SetupForm : Form
    {
        private const float W = 840f;
        private const float H = 520f;
        private const float RailW = 276f;
        private const float ContentX = 312f;
        private const float ContentR = 804f;
        private const float ContentW = ContentR - ContentX;

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr handle, int message, int wParam, int lParam);

        private float scale = 1f;
        private Image logo;
        private System.Windows.Forms.Timer anim;
        private float time;
        private float panelT = 1f;
        private int panel;
        private float progressShown;
        private float progressTarget;
        private string stepText = "A preparar a instala\u00e7\u00e3o\u2026";
        private int stepIndex;
        private bool installing;
        private bool failed;
        private string errorText = string.Empty;
        private float hoverInstall;
        private float hoverCancel;
        private float hoverClose;
        private float hoverChange;
        private float hoverOpen;
        private float hoverFinish;
        private float hoverDesktop;
        private float hoverLaunch;
        private float checkT;
        private bool desktopShortcut = true;
        private bool launchApp = true;
        private bool updating;
        private string targetDir = Brand.DefaultDir();
        private PointF mouse = new PointF(-500f, -500f);

        private RectangleF rClose;
        private RectangleF rInstall;
        private RectangleF rCancel;
        private RectangleF rChange;
        private RectangleF rOpen;
        private RectangleF rFinish;
        private RectangleF rDesktop;
        private RectangleF rLaunch;

        private Font fEyebrow;
        private Font fTitle;
        private Font fBody;
        private Font fSmall;
        private Font fLabel;
        private Font fBtn;
        private Font fPercent;
        private Font fBrand;
        private Font fTiny;

        public SetupForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Brand.Bg;
            Text = Brand.Product + " \u2014 Instala\u00e7\u00e3o";
            KeyPreview = true;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);

            logo = U.LoadLogo();

            fEyebrow = new Font("Segoe UI", 9.5f, FontStyle.Bold, GraphicsUnit.Pixel);
            fTitle = new Font("Segoe UI", 27f, FontStyle.Bold, GraphicsUnit.Pixel);
            fBody = new Font("Segoe UI", 11.5f, FontStyle.Regular, GraphicsUnit.Pixel);
            fSmall = new Font("Segoe UI", 10.5f, FontStyle.Regular, GraphicsUnit.Pixel);
            fLabel = new Font("Segoe UI", 11.3f, FontStyle.Regular, GraphicsUnit.Pixel);
            fBtn = new Font("Segoe UI", 12.2f, FontStyle.Bold, GraphicsUnit.Pixel);
            fPercent = new Font("Segoe UI", 29f, FontStyle.Bold, GraphicsUnit.Pixel);
            fBrand = new Font("Segoe UI", 15.5f, FontStyle.Bold, GraphicsUnit.Pixel);
            fTiny = new Font("Segoe UI", 9.6f, FontStyle.Regular, GraphicsUnit.Pixel);

            updating = RegistryWriter.ReadInstallLocation() != null;
            if (updating) targetDir = RegistryWriter.ReadInstallLocation();

            anim = new System.Windows.Forms.Timer();
            anim.Interval = 16;
            anim.Tick += delegate { Animate(); };
            anim.Start();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams parameters = base.CreateParams;
                parameters.ClassStyle |= 0x20000;
                return parameters;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            using (Graphics g = CreateGraphics()) scale = Math.Max(1f, g.DpiX / 96f);
            ClientSize = new Size((int)Math.Round(W * scale), (int)Math.Round(H * scale));
            ApplyRegion();
        }

        private void ApplyRegion()
        {
            Region previous = Region;
            using (GraphicsPath path = U.Round(new RectangleF(0f, 0f, ClientSize.Width, ClientSize.Height), 18f * scale))
            {
                Region = new Region(path);
            }
            if (previous != null) previous.Dispose();
        }

        private void Animate()
        {
            time += 0.016f;
            panelT = Math.Min(1f, panelT + 0.07f);
            progressShown += (progressTarget - progressShown) * 0.14f;
            if (Math.Abs(progressTarget - progressShown) < 0.4f) progressShown = progressTarget;
            if (panel == 2) checkT = Math.Min(1f, checkT + 0.028f);

            hoverInstall = U.Ease(hoverInstall, rInstall.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverCancel = U.Ease(hoverCancel, rCancel.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverClose = U.Ease(hoverClose, rClose.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverChange = U.Ease(hoverChange, rChange.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverOpen = U.Ease(hoverOpen, rOpen.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverFinish = U.Ease(hoverFinish, rFinish.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverDesktop = U.Ease(hoverDesktop, rDesktop.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverLaunch = U.Ease(hoverLaunch, rLaunch.Contains(mouse) ? 1f : 0f, 0.22f);

            bool over = rClose.Contains(mouse);
            if (panel == 0)
            {
                over = over || rInstall.Contains(mouse) || rCancel.Contains(mouse) || rChange.Contains(mouse) ||
                       rDesktop.Contains(mouse) || rLaunch.Contains(mouse);
            }
            else if (panel == 2)
            {
                over = over || rOpen.Contains(mouse) || rFinish.Contains(mouse);
            }
            Cursor = over ? Cursors.Hand : Cursors.Default;

            Invalidate();
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            mouse = new PointF(e.X / scale, e.Y / scale);
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            mouse = new PointF(-500f, -500f);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left) return;

            PointF point = new PointF(e.X / scale, e.Y / scale);
            mouse = point;

            if (rClose.Contains(point))
            {
                RequestClose();
                return;
            }

            if (panel == 0)
            {
                if (rInstall.Contains(point)) { BeginInstall(); return; }
                if (rCancel.Contains(point)) { Close(); return; }
                if (rChange.Contains(point)) { PickFolder(); return; }
                if (rDesktop.Contains(point)) { desktopShortcut = !desktopShortcut; return; }
                if (rLaunch.Contains(point)) { launchApp = !launchApp; return; }
            }
            else if (panel == 2)
            {
                if (rOpen.Contains(point)) { LaunchApp(); return; }
                if (rFinish.Contains(point)) { Close(); return; }
            }

            ReleaseCapture();
            SendMessage(Handle, 0xA1, 0x2, 0);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Escape && !installing) Close();
            if (e.KeyCode == Keys.Enter && panel == 0) BeginInstall();
        }

        private void RequestClose()
        {
            if (!installing) { Close(); return; }
            DialogResult result = MessageBox.Show(this,
                "A instala\u00e7\u00e3o est\u00e1 em curso. Fechar agora pode deixar ficheiros incompletos.\r\n\r\nFechar mesmo assim?",
                Brand.Product, MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (result == DialogResult.Yes) Close();
        }

        private void PickFolder()
        {
            using (FolderBrowserDialog dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Escolhe a pasta onde instalar o " + Brand.Product;
                dialog.SelectedPath = targetDir;
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog(this) == DialogResult.OK) targetDir = dialog.SelectedPath;
            }
        }

        private void BeginInstall()
        {
            installing = true;
            failed = false;
            errorText = string.Empty;
            GoPanel(1);
            progressShown = 0f;
            progressTarget = 2f;
            stepIndex = 0;
            stepText = "A preparar a instala\u00e7\u00e3o\u2026";

            Thread worker = new Thread(delegate()
            {
                try
                {
                    InstallEngine.Run(targetDir, desktopShortcut, true, launchApp, Report);
                }
                catch (Exception error)
                {
                    Fail(error.Message);
                }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void Report(StepReport report)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    progressTarget = report.Percent;
                    stepText = report.Text;
                    stepIndex = report.Step;
                    if (report.Percent >= 100)
                    {
                        installing = false;
                        checkT = 0f;
                        GoPanel(2);
                    }
                });
            }
            catch
            {
            }
        }

        private void Fail(string message)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    installing = false;
                    failed = true;
                    errorText = message;
                    GoPanel(0);
                });
            }
            catch
            {
            }
        }

        private void GoPanel(int next)
        {
            panel = next;
            panelT = 0f;
            if (next == 2) checkT = 0f;
        }

        private void LaunchApp()
        {
            try
            {
                string exe = Path.Combine(targetDir, Brand.ExeName);
                if (File.Exists(exe))
                {
                    Process.Start(new ProcessStartInfo(exe) { WorkingDirectory = targetDir, UseShellExecute = true });
                }
            }
            catch
            {
            }
            Close();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            try
            {
                Graphics g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.ScaleTransform(scale, scale);

                DrawBackdrop(g);
                DrawRail(g);
                DrawContent(g);
                DrawClose(g);

                U.StrokeRound(g, new RectangleF(0.5f, 0.5f, W - 1f, H - 1f), 18f, U.A(Color.White, 22), 1f);
            }
            catch (Exception error)
            {
                try
                {
                    File.AppendAllText(Path.Combine(Path.GetTempPath(), "santos-setup-error.log"), error.ToString() + "\r\n");
                }
                catch
                {
                }
            }
        }

        private void DrawBackdrop(Graphics g)
        {
            g.Clear(Brand.Bg);
            U.Glow(g, new RectangleF(-160f, -220f, 640f, 560f), Brand.Accent, 46);
            U.Glow(g, new RectangleF(520f, 250f, 560f, 480f), Brand.Accent2, 24);
        }

        private void DrawRail(Graphics g)
        {
            using (LinearGradientBrush brush = new LinearGradientBrush(
                new RectangleF(0f, 0f, RailW, H), U.A(Brand.Accent, 26), U.A(Brand.Accent2, 4), 62f))
            {
                g.FillRectangle(brush, new RectangleF(0f, 0f, RailW, H));
            }
            using (Pen pen = new Pen(U.A(Color.White, 12), 1f))
            {
                g.DrawLine(pen, RailW, 0f, RailW, H);
            }

            U.DrawLogo(g, logo, new RectangleF(32f, 32f, 46f, 46f), 13f);

            U.Text(g, "SANTOS", fBrand, Brand.Text, new RectangleF(92f, 30f, 170f, 20f));
            U.Text(g, "OPTIMIZER", fBrand, Brand.Accent2, new RectangleF(92f, 49f, 170f, 20f));
            U.Text(g, "and Tweaks", fTiny, Brand.Muted, new RectangleF(92f, 69f, 170f, 16f));

            U.Text(g, "O teu Windows,\r\nmais r\u00e1pido.", fSmall, U.A(Brand.Text, 170), new RectangleF(32f, 104f, 210f, 40f),
                StringAlignment.Near, StringAlignment.Near, true);

            string[] features = new string[] { "Tweaks de desempenho", "Limpeza profunda", "Interface premium" };
            for (int i = 0; i < features.Length; i++)
            {
                float y = 168f + i * 34f;
                U.FillRound(g, new RectangleF(32f, y, 22f, 22f), 11f, U.A(Brand.Accent, 28));
                U.Tick(g, 32f, y, 22f, Brand.Accent2, 1.7f);
                U.Text(g, features[i], fSmall, Brand.Muted, new RectangleF(64f, y + 3f, 190f, 18f));
            }

            U.Text(g, "Vers\u00e3o " + Brand.Version, fTiny, U.A(Brand.Muted, 150), new RectangleF(32f, H - 58f, 200f, 16f));
            U.Text(g, "\u00a9 2026 Santos", fTiny, U.A(Brand.Muted, 120), new RectangleF(32f, H - 42f, 200f, 16f));
        }

        private void DrawClose(Graphics g)
        {
            rClose = new RectangleF(W - 50f, 16f, 34f, 30f);
            if (hoverClose > 0.01f)
            {
                U.FillRound(g, rClose, 9f, U.A(Brand.Danger, (int)(210f * hoverClose)));
            }
            Color color = hoverClose > 0.5f ? Color.White : U.A(Brand.Muted, 200);
            using (Pen pen = new Pen(color, 1.6f))
            {
                g.DrawLine(pen, rClose.X + 12f, rClose.Y + 10f, rClose.Right - 12f, rClose.Bottom - 10f);
                g.DrawLine(pen, rClose.Right - 12f, rClose.Y + 10f, rClose.X + 12f, rClose.Bottom - 10f);
            }
        }

        private void DrawContent(Graphics g)
        {
            float offset = (1f - panelT) * 18f;
            GraphicsState state = g.Save();
            g.TranslateTransform(0f, offset);

            if (panel == 0) DrawWelcome(g);
            else if (panel == 1) DrawProgress(g);
            else DrawDone(g);

            g.Restore(state);

            if (panelT < 1f)
            {
                int alpha = (int)((1f - panelT) * 240f);
                using (SolidBrush brush = new SolidBrush(U.A(Brand.Bg, alpha)))
                {
                    g.FillRectangle(brush, new RectangleF(RailW + 1f, 0f, W - RailW - 1f, H));
                }
            }
        }

        private void DrawWelcome(Graphics g)
        {
            U.Text(g, updating ? "ATUALIZA\u00c7\u00c3O" : "INSTALA\u00c7\u00c3O R\u00c1PIDA", fEyebrow, U.A(Brand.Accent2, 230),
                new RectangleF(ContentX, 66f, ContentW, 16f));

            U.Text(g, updating ? "Atualizar instala\u00e7\u00e3o" : "Pronto para instalar", fTitle, Brand.Text,
                new RectangleF(ContentX, 84f, ContentW, 38f));

            U.Text(g,
                "Vamos colocar o Otimizador neste PC. Leva menos de um minuto, sem reiniciar e sem tocar nas tuas defini\u00e7\u00f5es.",
                fBody, Brand.Muted, new RectangleF(ContentX, 130f, ContentW - 10f, 42f), StringAlignment.Near, StringAlignment.Near, true);

            RectangleF card = new RectangleF(ContentX, 182f, ContentW, 66f);
            U.FillRound(g, card, 14f, U.A(Color.White, 9));
            U.StrokeRound(g, card, 14f, U.A(Color.White, 16), 1f);

            U.FillRound(g, new RectangleF(ContentX + 14f, card.Y + 16f, 34f, 34f), 10f, U.A(Brand.Accent, 34));
            using (Pen pen = new Pen(Brand.Accent2, 1.5f))
            {
                pen.LineJoin = LineJoin.Round;
                RectangleF folder = new RectangleF(ContentX + 22f, card.Y + 26f, 18f, 14f);
                GraphicsPath path = new GraphicsPath();
                path.AddLine(folder.X, folder.Bottom, folder.X, folder.Y + 3f);
                path.AddLine(folder.X, folder.Y + 3f, folder.X + 7f, folder.Y + 3f);
                path.AddLine(folder.X + 7f, folder.Y + 3f, folder.X + 9f, folder.Y + 6f);
                path.AddLine(folder.X + 9f, folder.Y + 6f, folder.Right, folder.Y + 6f);
                path.AddLine(folder.Right, folder.Y + 6f, folder.Right, folder.Bottom);
                path.CloseFigure();
                g.DrawPath(pen, path);
                path.Dispose();
            }

            U.Text(g, "Pasta de instala\u00e7\u00e3o", fTiny, U.A(Brand.Muted, 220), new RectangleF(ContentX + 60f, card.Y + 14f, 220f, 14f));
            U.Text(g, U.Shorten(targetDir, 62), fLabel, Brand.Text, new RectangleF(ContentX + 60f, card.Y + 30f, ContentW - 160f, 20f));

            rChange = new RectangleF(ContentR - 82f, card.Y + 24f, 68f, 20f);
            U.Text(g, "Alterar", fLabel, hoverChange > 0.4f ? Color.White : Brand.Accent2, rChange, StringAlignment.Far, StringAlignment.Center, false);

            rDesktop = new RectangleF(ContentX + 2f, 268f, ContentW, 24f);
            DrawCheck(g, rDesktop.X, rDesktop.Y, desktopShortcut, hoverDesktop, "Criar atalho no Ambiente de Trabalho");

            rLaunch = new RectangleF(ContentX + 2f, 300f, ContentW, 24f);
            DrawCheck(g, rLaunch.X, rLaunch.Y, launchApp, hoverLaunch, "Abrir o Otimizador quando terminar");

            U.Text(g, "N\u00e3o precisa de administrador \u00b7 Os teus dados ficam intactos", fTiny, U.A(Brand.Muted, 160),
                new RectangleF(ContentX, 344f, ContentW, 16f));

            if (!string.IsNullOrEmpty(errorText))
            {
                U.Text(g, U.Shorten(errorText, 130), fTiny, Brand.Danger, new RectangleF(ContentX, 366f, ContentW, 16f));
            }

            rInstall = new RectangleF(ContentX, 424f, 188f, 48f);
            rCancel = new RectangleF(ContentX + 200f, 424f, 110f, 48f);
            DrawButton(g, rInstall, updating ? "Atualizar agora" : "Instalar agora", true, false, hoverInstall);
            DrawButton(g, rCancel, "Cancelar", false, false, hoverCancel);
        }

        private void DrawProgress(Graphics g)
        {
            U.Text(g, "A INSTALAR", fEyebrow, U.A(Brand.Accent2, 230), new RectangleF(ContentX, 66f, ContentW - 160f, 16f));
            U.Text(g, "A instalar\u2026", fTitle, Brand.Text, new RectangleF(ContentX, 84f, ContentW - 170f, 38f));
            U.Text(g, stepText, fBody, Brand.Muted, new RectangleF(ContentX, 130f, ContentW - 170f, 20f));

            string percent = ((int)Math.Round(progressShown)).ToString() + "%";
            U.Text(g, percent, fPercent, Brand.Text, new RectangleF(ContentR - 150f, 76f, 150f, 44f), StringAlignment.Far, StringAlignment.Center, false);

            RectangleF track = new RectangleF(ContentX, 166f, ContentW, 12f);
            U.FillRound(g, track, 6f, U.A(Color.White, 16));

            float filled = track.Width * Math.Max(0f, Math.Min(100f, progressShown)) / 100f;
            if (filled > 1f)
            {
                RectangleF fill = new RectangleF(track.X, track.Y, Math.Max(filled, 12f), track.Height);
                GraphicsState state = g.Save();
                using (GraphicsPath clip = U.Round(fill, 6f))
                {
                    g.SetClip(clip);
                }
                using (LinearGradientBrush brush = new LinearGradientBrush(fill, Brand.Accent, Brand.Accent2, 0f))
                {
                    g.FillRectangle(brush, fill);
                }

                float sweep = track.X + (time * 120f) % (track.Width + 160f) - 160f;
                RectangleF shine = new RectangleF(sweep, track.Y, 120f, track.Height);
                using (LinearGradientBrush brush = new LinearGradientBrush(shine, Color.Transparent, Color.Transparent, 0f))
                {
                    ColorBlend blend = new ColorBlend(3);
                    blend.Colors = new Color[] { U.A(Color.White, 0), U.A(Color.White, 90), U.A(Color.White, 0) };
                    blend.Positions = new float[] { 0f, 0.5f, 1f };
                    brush.InterpolationColors = blend;
                    g.FillRectangle(brush, shine);
                }
                g.Restore(state);
            }

            string[] steps = new string[] { "Copiar ficheiros", "Criar atalhos", "Registar no sistema", "Concluir" };
            for (int i = 0; i < steps.Length; i++)
            {
                float y = 212f + i * 38f;
                bool done = progressShown >= 99.5f || stepIndex > i;
                bool active = !done && stepIndex == i;
                RectangleF dot = new RectangleF(ContentX, y, 16f, 16f);

                if (done)
                {
                    U.FillRound(g, dot, 8f, Brand.Success);
                    U.Tick(g, dot.X + 1f, dot.Y + 1f, 14f, Color.FromArgb(9, 20, 15), 1.8f);
                }
                else if (active)
                {
                    int pulse = (int)(40f + 55f * (float)Math.Abs(Math.Sin(time * 2.2f)));
                    U.Glow(g, new RectangleF(dot.X - 12f, dot.Y - 12f, 40f, 40f), Brand.Accent, pulse);
                    using (Pen pen = new Pen(Brand.Accent2, 1.6f)) g.DrawEllipse(pen, dot);
                    U.FillRound(g, new RectangleF(dot.X + 5f, dot.Y + 5f, 6f, 6f), 3f, Brand.Accent2);
                }
                else
                {
                    using (Pen pen = new Pen(U.A(Color.White, 34), 1.4f)) g.DrawEllipse(pen, dot);
                }

                Color label = done ? Brand.Text : active ? Brand.Text : U.A(Brand.Muted, 190);
                U.Text(g, steps[i], fLabel, label, new RectangleF(ContentX + 30f, y - 1f, 280f, 20f));

                if (done) U.Text(g, "conclu\u00eddo", fTiny, U.A(Brand.Success, 210), new RectangleF(ContentR - 110f, y + 1f, 110f, 16f), StringAlignment.Far, StringAlignment.Near, false);
                else if (active) U.Text(g, "a decorrer", fTiny, U.A(Brand.Accent2, 210), new RectangleF(ContentR - 110f, y + 1f, 110f, 16f), StringAlignment.Far, StringAlignment.Near, false);
            }

            U.Text(g, "Podes continuar a usar o PC. N\u00e3o \u00e9 preciso reiniciar.", fTiny, U.A(Brand.Muted, 150),
                new RectangleF(ContentX, 380f, ContentW, 16f));
        }

        private void DrawDone(Graphics g)
        {
            float pop = U.EaseOutBack(Math.Max(0f, Math.Min(1f, checkT)));
            float size = 54f * pop;
            RectangleF circle = new RectangleF(ContentX + (54f - size) / 2f, 78f + (54f - size) / 2f, size, size);

            U.Glow(g, new RectangleF(circle.X - 34f, circle.Y - 34f, circle.Width + 68f, circle.Height + 68f), Brand.Success,
                (int)(70f * checkT));

            if (size > 1f)
            {
                using (SolidBrush brush = new SolidBrush(U.A(Brand.Success, (int)(255f * Math.Min(1f, checkT * 1.4f)))))
                {
                    g.FillEllipse(brush, circle);
                }
            }

            if (checkT > 0.35f)
            {
                float tick = Math.Min(1f, (checkT - 0.35f) / 0.55f);
                using (Pen pen = new Pen(Color.FromArgb(9, 20, 15), 3.2f))
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    pen.LineJoin = LineJoin.Round;
                    PointF a = new PointF(ContentX + 15f, 106f);
                    PointF b = new PointF(ContentX + 24f, 115f);
                    PointF c = new PointF(ContentX + 40f, 95f);
                    PointF mid = new PointF(a.X + (b.X - a.X) * tick, a.Y + (b.Y - a.Y) * tick);
                    if (tick < 0.5f)
                    {
                        g.DrawLine(pen, a, mid);
                    }
                    else
                    {
                        g.DrawLines(pen, new PointF[]
                        {
                            a, b,
                            new PointF(b.X + (c.X - b.X) * ((tick - 0.5f) * 2f), b.Y + (c.Y - b.Y) * ((tick - 0.5f) * 2f))
                        });
                    }
                }
            }

            U.Text(g, "INSTALA\u00c7\u00c3O CONCLU\u00cdDA", fEyebrow, U.A(Brand.Success, 230), new RectangleF(ContentX, 150f, ContentW, 16f));
            U.Text(g, updating ? "Tudo atualizado" : "Tudo pronto", fTitle, Brand.Text, new RectangleF(ContentX, 168f, ContentW, 38f));
            U.Text(g,
                "O Otimizador est\u00e1 instalado e os atalhos foram criados. A avalia\u00e7\u00e3o Pro de 7 dias come\u00e7a no primeiro arranque.",
                fBody, Brand.Muted, new RectangleF(ContentX, 214f, ContentW - 10f, 42f), StringAlignment.Near, StringAlignment.Near, true);

            U.Text(g, "Pasta: " + U.Shorten(targetDir, 58), fTiny, U.A(Brand.Muted, 170), new RectangleF(ContentX, 268f, ContentW, 16f));

            rOpen = new RectangleF(ContentX, 424f, 196f, 48f);
            rFinish = new RectangleF(ContentX + 208f, 424f, 120f, 48f);
            DrawButton(g, rOpen, "Abrir Otimizador", true, false, hoverOpen);
            DrawButton(g, rFinish, "Concluir", false, false, hoverFinish);
        }

        private void DrawButton(Graphics g, RectangleF rect, string label, bool primary, bool danger, float hover)
        {
            float lift = hover * 2.2f;
            RectangleF area = new RectangleF(rect.X, rect.Y - lift, rect.Width, rect.Height);

            if (primary)
            {
                U.Glow(g, new RectangleF(area.X - 16f, area.Y - 6f, area.Width + 32f, area.Height + 24f), Brand.Accent,
                    (int)(26f + 44f * hover));

                using (LinearGradientBrush brush = new LinearGradientBrush(area, Brand.Accent, Brand.Accent2, 0f))
                using (GraphicsPath path = U.Round(area, 12f))
                {
                    g.FillPath(brush, path);
                }
                using (LinearGradientBrush highlight = new LinearGradientBrush(
                    new RectangleF(area.X, area.Y, area.Width, area.Height * 0.6f),
                    U.A(Color.White, 46), U.A(Color.White, 0), 90f))
                using (GraphicsPath path = U.Round(new RectangleF(area.X, area.Y, area.Width, area.Height * 0.6f), 12f))
                {
                    g.FillPath(highlight, path);
                }
                U.Text(g, label, fBtn, Color.White, area, StringAlignment.Center, StringAlignment.Center, false);
            }
            else
            {
                U.FillRound(g, area, 12f, U.A(Color.White, 10 + (int)(12f * hover)));
                U.StrokeRound(g, area, 12f, danger ? U.A(Brand.Danger, 120) : U.A(Color.White, 26 + (int)(18f * hover)), 1f);
                U.Text(g, label, fBtn, danger ? Color.FromArgb(255, 186, 186) : Brand.Text, area,
                    StringAlignment.Center, StringAlignment.Center, false);
            }
        }

        private void DrawCheck(Graphics g, float x, float y, bool on, float hover, string label)
        {
            RectangleF box = new RectangleF(x, y + 1f, 18f, 18f);
            if (on)
            {
                using (LinearGradientBrush brush = new LinearGradientBrush(box, Brand.Accent, Brand.Accent2, 0f))
                using (GraphicsPath path = U.Round(box, 5f))
                {
                    g.FillPath(brush, path);
                }
                U.Tick(g, box.X + 1f, box.Y + 1f, 16f, Color.White, 2f);
            }
            else
            {
                U.FillRound(g, box, 5f, U.A(Color.White, 10));
                U.StrokeRound(g, box, 5f, U.A(Color.White, 30 + (int)(24f * hover)), 1f);
            }
            U.Text(g, label, fLabel, Brand.Text, new RectangleF(x + 28f, y - 1f, ContentW - 28f, 22f));
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (anim != null) anim.Dispose();
                if (logo != null) logo.Dispose();
                if (fEyebrow != null) fEyebrow.Dispose();
                if (fTitle != null) fTitle.Dispose();
                if (fBody != null) fBody.Dispose();
                if (fSmall != null) fSmall.Dispose();
                if (fLabel != null) fLabel.Dispose();
                if (fBtn != null) fBtn.Dispose();
                if (fPercent != null) fPercent.Dispose();
                if (fBrand != null) fBrand.Dispose();
                if (fTiny != null) fTiny.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                if (Has(args, "--verify")) Environment.Exit(Verify());
                if (Has(args, "--install"))
                {
                    Environment.Exit(QuietInstall(args));
                }

                Application.Run(new SetupForm());
            }
            catch (Exception error)
            {
                try
                {
                    File.AppendAllText(Path.Combine(Path.GetTempPath(), "santos-setup-error.log"), error.ToString() + "\r\n");
                }
                catch
                {
                }
                MessageBox.Show("N\u00e3o foi possivel abrir o instalador.\r\n\r\n" + error.Message, Brand.Product,
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private static bool Has(string[] args, string flag)
        {
            foreach (string arg in args)
            {
                if (string.Equals(arg, flag, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static string Value(string[] args, string prefix)
        {
            foreach (string arg in args)
            {
                if (arg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) return arg.Substring(prefix.Length).Trim('"');
            }
            return null;
        }

        private static int Verify()
        {
            string payload = PayloadStore.ExtractToTemp();
            string temp = Path.Combine(Path.GetTempPath(), "santos_verify_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(temp);

            int files = 0;
            long bytes = 0;
            using (FileStream fs = new FileStream(payload, FileMode.Open, FileAccess.Read))
            using (ZipArchive zip = new ZipArchive(fs, ZipArchiveMode.Read))
            {
                string root = Path.GetFullPath(temp);
                if (!root.EndsWith(Path.DirectorySeparatorChar.ToString())) root += Path.DirectorySeparatorChar;

                foreach (ZipArchiveEntry entry in zip.Entries)
                {
                    string relative = entry.FullName.Replace('/', Path.DirectorySeparatorChar);
                    string destination = Path.GetFullPath(Path.Combine(temp, relative));
                    if (!destination.StartsWith(root, StringComparison.OrdinalIgnoreCase)) continue;

                    if (entry.Name.Length == 0)
                    {
                        Directory.CreateDirectory(destination);
                        continue;
                    }
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    entry.ExtractToFile(destination, true);
                    files++;
                    bytes += entry.Length;
                }
            }

            bool exe = File.Exists(Path.Combine(temp, Brand.ExeName));
            bool main = File.Exists(Path.Combine(temp, "resources", "app", "src", "main", "main.js"));
            bool uninstaller = File.Exists(Path.Combine(temp, Brand.UninstallerName));

            File.WriteAllText(Path.Combine(Path.GetTempPath(), "santos-verify.txt"),
                string.Format("files={0}\r\nbytes={1}\r\nexe={2}\r\nmain={3}\r\nuninstaller={4}\r\n", files, bytes, exe, main, uninstaller));

            try { Directory.Delete(temp, true); } catch { }
            try { File.Delete(payload); } catch { }
            return exe && main && uninstaller ? 0 : 1;
        }

        private static int QuietInstall(string[] args)
        {
            string directory = Value(args, "--dir=") ?? Brand.DefaultDir();
            bool shortcuts = !Has(args, "--noshortcuts");
            bool registry = !Has(args, "--noregistry");
            bool launch = Has(args, "--launch");

            try
            {
                InstallEngine.Run(directory, shortcuts, registry, launch, delegate(StepReport report) { });
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "santos-install.txt"), "ok\r\n" + directory + "\r\n");
                return 0;
            }
            catch (Exception error)
            {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "santos-install.txt"), "erro\r\n" + error + "\r\n");
                return 1;
            }
        }
    }
}
