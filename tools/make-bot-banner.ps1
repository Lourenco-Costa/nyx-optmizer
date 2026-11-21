Add-Type -AssemblyName System.Drawing

$width = 960
$height = 480
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::Black)

$iconPath = Join-Path $PSScriptRoot '..\assets\icon.png'
$icon = [System.Drawing.Image]::FromFile($iconPath)
$g.DrawImage($icon, 55, 120, 240, 240)

$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$fontSmall = New-Object System.Drawing.Font('Arial', 34, [System.Drawing.FontStyle]::Bold)
$fontLarge = New-Object System.Drawing.Font('Arial', 64, [System.Drawing.FontStyle]::Bold)
$g.DrawString('THE BEST', $fontSmall, $white, 340, 120)
$g.DrawString('OPTMIZER', $fontLarge, $white, 340, 175)
$g.DrawString('NyxOperator', $fontSmall, $white, 342, 300)

$out = Join-Path $PSScriptRoot '..\assets\nyxoperator-banner.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$icon.Dispose()
$fontSmall.Dispose()
$fontLarge.Dispose()
$white.Dispose()
$bmp.Dispose()
Write-Output $out
