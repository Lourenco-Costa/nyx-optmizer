Add-Type -AssemblyName System.Drawing

function New-BorderlessIcon([string]$Path, [int]$Size) {
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Black)
  $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $scale = $Size / 512.0
  $points = [System.Drawing.Point[]]@(
    [System.Drawing.Point]::new([int](295 * $scale), [int](18 * $scale)),
    [System.Drawing.Point]::new([int](152 * $scale), [int](268 * $scale)),
    [System.Drawing.Point]::new([int](231 * $scale), [int](268 * $scale)),
    [System.Drawing.Point]::new([int](211 * $scale), [int](493 * $scale)),
    [System.Drawing.Point]::new([int](363 * $scale), [int](214 * $scale)),
    [System.Drawing.Point]::new([int](274 * $scale), [int](214 * $scale))
  )
  $g.FillPolygon($white, $points)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $white.Dispose()
  $bmp.Dispose()
}

$assets = Join-Path $PSScriptRoot '..\assets'
New-BorderlessIcon (Join-Path $assets 'icon-borderless.png') 512
New-BorderlessIcon (Join-Path $assets 'icon-borderless-256.png') 256
New-BorderlessIcon (Join-Path $assets 'nyxoperator-server-icon.png') 512

$width = 960
$height = 480
$banner = New-Object System.Drawing.Bitmap($width, $height)
$bg = [System.Drawing.Graphics]::FromImage($banner)
$bg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg.Clear([System.Drawing.Color]::Black)

$icon = [System.Drawing.Image]::FromFile((Join-Path $assets 'icon-borderless.png'))
$bg.DrawImage($icon, 55, 120, 240, 240)
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$fontSmall = New-Object System.Drawing.Font('Arial', 34, [System.Drawing.FontStyle]::Bold)
$fontLarge = New-Object System.Drawing.Font('Arial', 64, [System.Drawing.FontStyle]::Bold)
$bg.DrawString('THE BEST', $fontSmall, $white, 340, 120)
$bg.DrawString('OPTMIZER', $fontLarge, $white, 340, 175)
$bg.DrawString('NyxOperator', $fontSmall, $white, 342, 300)
$banner.Save((Join-Path $assets 'nyxoperator-banner.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$bg.Dispose()
$icon.Dispose()
$fontSmall.Dispose()
$fontLarge.Dispose()
$white.Dispose()
$banner.Dispose()

Write-Output 'Generated borderless icon, avatar icon and banner.'
