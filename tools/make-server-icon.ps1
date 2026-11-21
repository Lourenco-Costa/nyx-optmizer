Add-Type -AssemblyName System.Drawing

$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Black)

$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$ring = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 10)
$g.DrawEllipse($ring, 30, 30, 452, 452)

$g.FillRectangle($white, 142, 120, 34, 272)
$g.FillRectangle($white, 336, 120, 34, 272)

$points = [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(176, 120),
  [System.Drawing.Point]::new(216, 120),
  [System.Drawing.Point]::new(336, 392),
  [System.Drawing.Point]::new(296, 392)
)
$g.FillPolygon($white, $points)

$out = Join-Path $PSScriptRoot '..\assets\nyxoperator-server-icon.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$ring.Dispose()
$white.Dispose()
$bmp.Dispose()
Write-Output $out
