using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace SantosSetup
{
    internal static class UninstallEngine
    {
        public static void Run(string directory, Action<int, string> report)
        {
            report(6, "A fechar o Otimizador\u2026");
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

            report(20, "A remover atalhos\u2026");
            TryDelete(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), Brand.Product + ".lnk"));
            TryDeleteTree(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Brand.Product));

            report(36, "A limpar o registo\u2026");
            try { Registry.CurrentUser.DeleteSubKeyTree(Brand.RegistryKey, false); } catch { }
            try { Registry.CurrentUser.DeleteSubKeyTree(@"Software\Santos", false); } catch { }

            report(52, "A remover ficheiros\u2026");
            string self = Path.GetFullPath(Assembly.GetExecutingAssembly().Location);
            string[] entries;
            try
            {
                entries = Directory.GetFileSystemEntries(directory);
            }
            catch
            {
                entries = new string[0];
            }

            int total = Math.Max(1, entries.Length);
            int index = 0;
            foreach (string entry in entries)
            {
                index++;
                if (string.Equals(Path.GetFullPath(entry), self, StringComparison.OrdinalIgnoreCase)) continue;
                try
                {
                    if (Directory.Exists(entry)) Directory.Delete(entry, true);
                    else File.Delete(entry);
                }
                catch
                {
                }
                report(52 + (int)(38.0 * index / total), "A remover ficheiros\u2026");
            }

            report(94, "A finalizar\u2026");
            try
            {
                ProcessStartInfo info = new ProcessStartInfo("cmd.exe",
                    "/c ping -n 3 127.0.0.1 >nul & rmdir /s /q \"" + directory + "\"");
                info.CreateNoWindow = true;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                info.UseShellExecute = false;
                Process.Start(info);
            }
            catch
            {
            }
            report(100, "Removido");
        }

        private static void TryDelete(string path)
        {
            try
            {
                if (File.Exists(path)) File.Delete(path);
            }
            catch
            {
            }
        }

        private static void TryDeleteTree(string path)
        {
            try
            {
                if (Directory.Exists(path)) Directory.Delete(path, true);
            }
            catch
            {
            }
        }
    }

    internal sealed class UninstallForm : Form
    {
        private const float W = 700f;
        private const float H = 420f;

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
        private string stepText = "A remover\u2026";
        private bool removing;
        private float hoverRemove;
        private float hoverCancel;
        private float hoverClose;
        private float doneAt = -1f;
        private PointF mouse = new PointF(-500f, -500f);
        private RectangleF rClose;
        private RectangleF rRemove;
        private RectangleF rCancel;

        private Font fEyebrow;
        private Font fTitle;
        private Font fBody;
        private Font fSmall;
        private Font fBtn;
        private Font fBrand;
        private Font fTiny;

        public UninstallForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Brand.Bg;
            Text = "Desinstalar " + Brand.Product;
            KeyPreview = true;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);

            logo = U.LoadLogo();

            fEyebrow = new Font("Segoe UI", 9.5f, FontStyle.Bold, GraphicsUnit.Pixel);
            fTitle = new Font("Segoe UI", 25f, FontStyle.Bold, GraphicsUnit.Pixel);
            fBody = new Font("Segoe UI", 11.5f, FontStyle.Regular, GraphicsUnit.Pixel);
            fSmall = new Font("Segoe UI", 10.5f, FontStyle.Regular, GraphicsUnit.Pixel);
            fBtn = new Font("Segoe UI", 12.2f, FontStyle.Bold, GraphicsUnit.Pixel);
            fBrand = new Font("Segoe UI", 15f, FontStyle.Bold, GraphicsUnit.Pixel);
            fTiny = new Font("Segoe UI", 9.6f, FontStyle.Regular, GraphicsUnit.Pixel);

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

            hoverRemove = U.Ease(hoverRemove, rRemove.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverCancel = U.Ease(hoverCancel, rCancel.Contains(mouse) ? 1f : 0f, 0.22f);
            hoverClose = U.Ease(hoverClose, rClose.Contains(mouse) ? 1f : 0f, 0.22f);

            Cursor = rClose.Contains(mouse) || (panel == 0 && (rRemove.Contains(mouse) || rCancel.Contains(mouse)))
                ? Cursors.Hand
                : Cursors.Default;

            if (panel == 2 && doneAt > 0f && time - doneAt > 2.6f) Close();

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
                if (!removing) Close();
                return;
            }

            if (panel == 0)
            {
                if (rRemove.Contains(point)) { Begin(); return; }
                if (rCancel.Contains(point)) { Close(); return; }
            }

            ReleaseCapture();
            SendMessage(Handle, 0xA1, 0x2, 0);
        }

        private void Begin()
        {
            removing = true;
            panel = 1;
            panelT = 0f;
            progressShown = 0f;
            progressTarget = 4f;

            string directory = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);

            Thread worker = new Thread(delegate()
            {
                try
                {
                    UninstallEngine.Run(directory, Report);
                }
                catch
                {
                    Report(100, "Conclu\u00eddo");
                }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        private void Report(int percent, string text)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke((MethodInvoker)delegate
                {
                    progressTarget = percent;
                    stepText = text;
                    if (percent >= 100)
                    {
                        removing = false;
                        panel = 2;
                        panelT = 0f;
                        doneAt = time;
                    }
                });
            }
            catch
            {
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            try
            {
                Graphics g = e.Graphics;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
                g.ScaleTransform(scale, scale);

                g.Clear(Brand.Bg);
                U.Glow(g, new RectangleF(-140f, -180f, 620f, 520f), Brand.Danger, 30);
                U.Glow(g, new RectangleF(380f, 200f, 520f, 420f), Brand.Accent, 26);

                DrawBrand(g);
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

        private void DrawBrand(Graphics g)
        {
            U.DrawLogo(g, logo, new RectangleF(40f, 32f, 44f, 44f), 12f);
            U.Text(g, "SANTOS", fBrand, Brand.Text, new RectangleF(98f, 32f, 220f, 20f));
            U.Text(g, "OPTIMIZER", fBrand, Brand.Accent2, new RectangleF(98f, 51f, 220f, 20f));
            U.Text(g, "and Tweaks", fTiny, Brand.Muted, new RectangleF(98f, 70f, 220f, 16f));
        }

        private void DrawClose(Graphics g)
        {
            rClose = new RectangleF(W - 50f, 16f, 34f, 30f);
            if (hoverClose > 0.01f) U.FillRound(g, rClose, 9f, U.A(Brand.Danger, (int)(210f * hoverClose)));
            Color color = hoverClose > 0.5f ? Color.White : U.A(Brand.Muted, 200);
            using (Pen pen = new Pen(color, 1.6f))
            {
                g.DrawLine(pen, rClose.X + 12f, rClose.Y + 10f, rClose.Right - 12f, rClose.Bottom - 10f);
                g.DrawLine(pen, rClose.Right - 12f, rClose.Y + 10f, rClose.X + 12f, rClose.Bottom - 10f);
            }
        }

        private void DrawContent(Graphics g)
        {
            float offset = (1f - panelT) * 16f;
            GraphicsState state = g.Save();
            g.TranslateTransform(0f, offset);

            if (panel == 0) DrawConfirm(g);
            else if (panel == 1) DrawProgress(g);
            else DrawDone(g);

            g.Restore(state);

            if (panelT < 1f)
            {
                int alpha = (int)((1f - panelT) * 235f);
                using (SolidBrush brush = new SolidBrush(U.A(Brand.Bg, alpha)))
                {
                    g.FillRectangle(brush, new RectangleF(0f, 96f, W, H - 96f));
                }
            }
        }

        private void DrawConfirm(Graphics g)
        {
            U.Text(g, "DESINSTALAR", fEyebrow, U.A(Brand.Danger, 225), new RectangleF(40f, 128f, 400f, 16f));
            U.Text(g, "Remover do computador?", fTitle, Brand.Text, new RectangleF(40f, 146f, W - 80f, 36f));
            U.Text(g,
                "Vamos remover o Otimizador, os atalhos e os registos de instala\u00e7\u00e3o. A tua licen\u00e7a e defini\u00e7\u00f5es ficam guardadas.",
                fBody, Brand.Muted, new RectangleF(40f, 192f, W - 80f, 40f), StringAlignment.Near, StringAlignment.Near, true);
            U.Text(g, "Podes voltar a instalar quando quiseres.", fSmall, U.A(Brand.Muted, 170), new RectangleF(40f, 238f, W - 80f, 20f));

            rRemove = new RectangleF(40f, 330f, 168f, 46f);
            rCancel = new RectangleF(220f, 330f, 112f, 46f);
            DrawDangerButton(g, rRemove, "Remover", hoverRemove);
            DrawGhostButton(g, rCancel, "Cancelar", hoverCancel);
        }

        private void DrawProgress(Graphics g)
        {
            U.Text(g, "A REMOVER", fEyebrow, U.A(Brand.Danger, 225), new RectangleF(40f, 128f, 400f, 16f));
            U.Text(g, "A remover\u2026", fTitle, Brand.Text, new RectangleF(40f, 146f, W - 80f, 36f));
            U.Text(g, stepText, fBody, Brand.Muted, new RectangleF(40f, 192f, W - 80f, 20f));

            RectangleF track = new RectangleF(40f, 224f, W - 80f, 12f);
            U.FillRound(g, track, 6f, U.A(Color.White, 16));

            float filled = track.Width * Math.Max(0f, Math.Min(100f, progressShown)) / 100f;
            if (filled > 1f)
            {
                RectangleF fill = new RectangleF(track.X, track.Y, Math.Max(filled, 12f), track.Height);
                GraphicsState state = g.Save();
                using (GraphicsPath clip = U.Round(fill, 6f)) g.SetClip(clip);
                using (LinearGradientBrush brush = new LinearGradientBrush(fill, Brand.Danger, Brand.Accent, 0f))
                {
                    g.FillRectangle(brush, fill);
                }
                float sweep = track.X + (time * 120f) % (track.Width + 160f) - 160f;
                RectangleF shine = new RectangleF(sweep, track.Y, 120f, track.Height);
                using (LinearGradientBrush brush = new LinearGradientBrush(shine, Color.Transparent, Color.Transparent, 0f))
                {
                    ColorBlend blend = new ColorBlend(3);
                    blend.Colors = new Color[] { U.A(Color.White, 0), U.A(Color.White, 80), U.A(Color.White, 0) };
                    blend.Positions = new float[] { 0f, 0.5f, 1f };
                    brush.InterpolationColors = blend;
                    g.FillRectangle(brush, shine);
                }
                g.Restore(state);
            }

            U.Text(g, ((int)Math.Round(progressShown)).ToString() + "%", fSmall, U.A(Brand.Text, 210),
                new RectangleF(W - 120f, 244f, 80f, 18f), StringAlignment.Far, StringAlignment.Near, false);
            U.Text(g, "N\u00e3o feches esta janela.", fTiny, U.A(Brand.Muted, 150), new RectangleF(40f, 268f, W - 80f, 16f));
        }

        private void DrawDone(Graphics g)
        {
            float pop = U.EaseOutBack(Math.Max(0f, Math.Min(1f, panelT)));
            float size = 52f * pop;
            RectangleF circle = new RectangleF(40f + (52f - size) / 2f, 124f + (52f - size) / 2f, size, size);
            U.Glow(g, new RectangleF(circle.X - 30f, circle.Y - 30f, circle.Width + 60f, circle.Height + 60f), Brand.Success, (int)(60f * panelT));
            if (size > 1f)
            {
                using (SolidBrush brush = new SolidBrush(Brand.Success)) g.FillEllipse(brush, circle);
                U.Tick(g, circle.X + 11f, circle.Y + 11f, 30f, Color.FromArgb(9, 20, 15), 2.8f);
            }

            U.Text(g, "PRONTO", fEyebrow, U.A(Brand.Success, 225), new RectangleF(108f, 132f, 400f, 16f));
            U.Text(g, "Removido", fTitle, Brand.Text, new RectangleF(108f, 150f, W - 148f, 36f));
            U.Text(g, "Obrigado por teres usado o Santos Optimizer. Os teus dados ficaram guardados.",
                fBody, Brand.Muted, new RectangleF(40f, 214f, W - 80f, 40f), StringAlignment.Near, StringAlignment.Near, true);
            U.Text(g, "A fechar\u2026", fTiny, U.A(Brand.Muted, 150), new RectangleF(40f, 330f, W - 80f, 16f));
        }

        private void DrawDangerButton(Graphics g, RectangleF rect, string label, float hover)
        {
            float lift = hover * 2.2f;
            RectangleF area = new RectangleF(rect.X, rect.Y - lift, rect.Width, rect.Height);
            U.Glow(g, new RectangleF(area.X - 14f, area.Y - 6f, area.Width + 28f, area.Height + 22f), Brand.Danger, (int)(22f + 40f * hover));
            using (LinearGradientBrush brush = new LinearGradientBrush(area, Color.FromArgb(255, 96, 96), Color.FromArgb(226, 74, 120), 0f))
            using (GraphicsPath path = U.Round(area, 12f))
            {
                g.FillPath(brush, path);
            }
            U.Text(g, label, fBtn, Color.White, area, StringAlignment.Center, StringAlignment.Center, false);
        }

        private void DrawGhostButton(Graphics g, RectangleF rect, string label, float hover)
        {
            float lift = hover * 2.2f;
            RectangleF area = new RectangleF(rect.X, rect.Y - lift, rect.Width, rect.Height);
            U.FillRound(g, area, 12f, U.A(Color.White, 10 + (int)(12f * hover)));
            U.StrokeRound(g, area, 12f, U.A(Color.White, 26 + (int)(18f * hover)), 1f);
            U.Text(g, label, fBtn, Brand.Text, area, StringAlignment.Center, StringAlignment.Center, false);
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
                if (fBtn != null) fBtn.Dispose();
                if (fBrand != null) fBrand.Dispose();
                if (fTiny != null) fTiny.Dispose();
            }
            base.Dispose(disposing);
        }
    }

    internal static class UninstallProgram
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            foreach (string arg in args)
            {
                if (string.Equals(arg, "/quiet", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, "--quiet", StringComparison.OrdinalIgnoreCase))
                {
                    string directory = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
                    UninstallEngine.Run(directory, delegate(int percent, string text) { });
                    return;
                }
            }

            Application.Run(new UninstallForm());
        }
    }
}
