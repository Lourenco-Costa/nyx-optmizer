using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;

namespace SantosSetup
{
    internal static class Brand
    {
        public const string Product = "Santos Optimizer and Tweaks";
        public const string Short = "Santos Optimizer";
        public const string Company = "Santos";
        public const string Version = "1.0.0";
        public const string ExeName = "SantosOptimizer.exe";
        public const string UninstallerName = "Uninstall.exe";
        public const string RegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\SantosOptimizer";

        public static readonly Color Bg = Color.FromArgb(7, 8, 12);
        public static readonly Color Text = Color.FromArgb(238, 241, 248);
        public static readonly Color Muted = Color.FromArgb(138, 141, 161);
        public static readonly Color Accent = Color.FromArgb(124, 92, 255);
        public static readonly Color Accent2 = Color.FromArgb(34, 211, 238);
        public static readonly Color Success = Color.FromArgb(61, 220, 151);
        public static readonly Color Danger = Color.FromArgb(255, 107, 107);

        public static string DefaultDir()
        {
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(Path.Combine(local, "Programs"), Product);
        }
    }

    internal static class U
    {
        public static Color A(Color color, int alpha)
        {
            return Color.FromArgb(Math.Max(0, Math.Min(255, alpha)), color);
        }

        public static GraphicsPath Round(RectangleF rect, float radius)
        {
            GraphicsPath path = new GraphicsPath();
            float d = Math.Min(radius * 2f, Math.Min(rect.Width, rect.Height));
            if (d <= 0.2f)
            {
                path.AddRectangle(rect);
                return path;
            }
            path.AddArc(rect.X, rect.Y, d, d, 180f, 90f);
            path.AddArc(rect.Right - d, rect.Y, d, d, 270f, 90f);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0f, 90f);
            path.AddArc(rect.X, rect.Bottom - d, d, d, 90f, 90f);
            path.CloseFigure();
            return path;
        }

        public static void FillRound(Graphics g, RectangleF rect, float radius, Color color)
        {
            using (SolidBrush brush = new SolidBrush(color))
            using (GraphicsPath path = Round(rect, radius))
            {
                g.FillPath(brush, path);
            }
        }

        public static void FillRound(Graphics g, RectangleF rect, float radius, Brush brush)
        {
            using (GraphicsPath path = Round(rect, radius))
            {
                g.FillPath(brush, path);
            }
        }

        public static void StrokeRound(Graphics g, RectangleF rect, float radius, Color color, float width)
        {
            using (GraphicsPath path = Round(rect, radius))
            using (Pen pen = new Pen(color, width))
            {
                g.DrawPath(pen, path);
            }
        }

        public static void Glow(Graphics g, RectangleF area, Color color, int alpha)
        {
            if (alpha <= 0 || area.Width <= 1f || area.Height <= 1f) return;
            using (GraphicsPath path = new GraphicsPath())
            {
                path.AddEllipse(area);
                using (PathGradientBrush brush = new PathGradientBrush(path))
                {
                    brush.CenterColor = Color.FromArgb(alpha, color);
                    brush.SurroundColors = new Color[] { Color.FromArgb(0, color) };
                    g.FillEllipse(brush, area);
                }
            }
        }

        public static void Text(Graphics g, string value, Font font, Color color, RectangleF rect,
            StringAlignment align, StringAlignment line, bool wrap)
        {
            using (StringFormat format = new StringFormat())
            {
                format.Alignment = align;
                format.LineAlignment = line;
                format.Trimming = StringTrimming.EllipsisCharacter;
                if (!wrap)
                {
                    format.FormatFlags |= StringFormatFlags.NoWrap;
                }
                using (SolidBrush brush = new SolidBrush(color))
                {
                    g.DrawString(value, font, brush, rect, format);
                }
            }
        }

        public static void Text(Graphics g, string value, Font font, Color color, RectangleF rect)
        {
            Text(g, value, font, color, rect, StringAlignment.Near, StringAlignment.Near, false);
        }

        public static Image LoadLogo()
        {
            try
            {
                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("logo.png"))
                {
                    if (stream == null) return null;
                    using (MemoryStream memory = new MemoryStream())
                    {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            memory.Write(buffer, 0, read);
                        }
                        memory.Position = 0;
                        return Image.FromStream(memory);
                    }
                }
            }
            catch
            {
                return null;
            }
        }

        public static void DrawLogo(Graphics g, Image logo, RectangleF rect, float radius)
        {
            if (logo == null) return;
            GraphicsState state = g.Save();
            using (GraphicsPath path = Round(rect, radius))
            {
                g.SetClip(path);
                InterpolationMode previous = g.InterpolationMode;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(logo, rect);
                g.InterpolationMode = previous;
            }
            g.Restore(state);
        }

        public static void Tick(Graphics g, float x, float y, float size, Color color, float width)
        {
            using (Pen pen = new Pen(color, width))
            {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                pen.LineJoin = LineJoin.Round;
                g.DrawLines(pen, new PointF[]
                {
                    new PointF(x + size * 0.20f, y + size * 0.52f),
                    new PointF(x + size * 0.42f, y + size * 0.74f),
                    new PointF(x + size * 0.82f, y + size * 0.26f)
                });
            }
        }

        public static string Shorten(string value, int max)
        {
            if (string.IsNullOrEmpty(value) || value.Length <= max) return value;
            return value.Substring(0, Math.Max(1, max - 1)) + "\u2026";
        }

        public static float Ease(float current, float target, float speed)
        {
            return current + (target - current) * speed;
        }

        public static float EaseOutBack(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float p = t - 1f;
            return 1f + c3 * p * p * p + c1 * p * p;
        }
    }
}
