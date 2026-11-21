param([switch]$KeepWork)

$ErrorActionPreference = 'Stop'

$root        = Split-Path -Parent $PSScriptRoot
$dist        = Join-Path $root 'dist'
$work        = Join-Path $dist 'work'
$stage       = Join-Path $work 'app'
$payloadZip  = Join-Path $work 'payload.zip'
$setupExe    = Join-Path $dist 'SantosOptimizerSetup.exe'
$src         = Join-Path $root 'tools\installer'
$common      = Join-Path $src 'Common.cs'
$setup       = Join-Path $src 'Setup.cs'
$uninstall   = Join-Path $src 'Uninstall.cs'
$manifest    = Join-Path $src 'app.manifest'
$icon        = Join-Path $root 'assets\icon.ico'
$logo        = Join-Path $root 'assets\icon-256.png'
$electron    = Join-Path $root 'node_modules\electron\dist'
$rcedit      = Join-Path $root 'node_modules\rcedit\bin\rcedit-x64.exe'

$fw          = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$csc         = Join-Path $fw 'csc.exe'
$compression = Join-Path $fw 'System.IO.Compression.dll'
$compressionFs = Join-Path $fw 'System.IO.Compression.FileSystem.dll'

foreach ($required in @($csc, $compression, $compressionFs, $rcedit, $icon, $logo, $electron)) {
    if (-not (Test-Path $required)) { throw "Falta um recurso necessario: $required" }
}

Write-Host '1/6  A limpar a area de trabalho...'
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path $dist -Force | Out-Null

Write-Host '2/6  A preparar a aplicacao (Electron)...'
Copy-Item (Join-Path $electron '*') $stage -Recurse -Force
Rename-Item (Join-Path $stage 'electron.exe') 'SantosOptimizer.exe'

$resources = Join-Path $stage 'resources'
$appFolder = Join-Path $resources 'app'
New-Item -ItemType Directory -Path $appFolder -Force | Out-Null
Copy-Item (Join-Path $root 'package.json') $appFolder -Force
Copy-Item (Join-Path $root 'src') $appFolder -Recurse -Force
Copy-Item (Join-Path $root 'assets') $appFolder -Recurse -Force
Remove-Item (Join-Path $resources 'default_app.asar') -Force -ErrorAction SilentlyContinue

Write-Host '3/6  A aplicar marca ao executavel...'
& $rcedit (Join-Path $stage 'SantosOptimizer.exe') `
    --set-icon $icon `
    --set-version-string CompanyName 'Santos' `
    --set-version-string ProductName 'Santos Optimizer and Tweaks' `
    --set-version-string FileDescription 'Santos Optimizer and Tweaks' `
    --set-version-string LegalCopyright '(c) 2026 Santos' `
    --set-file-version '1.0.0.0' `
    --set-product-version '1.0.0.0' | Out-Null

Write-Host '4/6  A compilar o desinstalador...'
& $csc /nologo /target:winexe /platform:anycpu /optimize+ "/win32icon:$icon" "/win32manifest:$manifest" `
    "/out:$(Join-Path $stage 'Uninstall.exe')" "/r:$compression" "/r:$compressionFs" $common $uninstall
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o desinstalador.' }

Write-Host '5/6  A comprimir o pacote...'
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $payloadZip) { Remove-Item $payloadZip -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stage,
    $payloadZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false)

Write-Host '6/6  A compilar e a montar o instalador...'
if (Test-Path $setupExe) { Remove-Item $setupExe -Force }
& $csc /nologo /target:winexe /platform:anycpu /optimize+ "/win32icon:$icon" "/win32manifest:$manifest" `
    "/resource:$logo,logo.png" "/out:$setupExe" "/r:$compression" "/r:$compressionFs" $common $setup
if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar o instalador.' }

& $rcedit $setupExe `
    --set-version-string CompanyName 'Santos' `
    --set-version-string ProductName 'Santos Optimizer and Tweaks - Instalacao' `
    --set-version-string FileDescription 'Santos Optimizer and Tweaks - Instalacao' `
    --set-version-string LegalCopyright '(c) 2026 Santos' `
    --set-file-version '1.0.0.0' `
    --set-product-version '1.0.0.0' | Out-Null

$zipBytes = [System.IO.File]::ReadAllBytes($payloadZip)
$stream = [System.IO.File]::Open($setupExe, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write)
try {
    $stream.Write($zipBytes, 0, $zipBytes.Length)
    $size = [System.BitConverter]::GetBytes([int64]$zipBytes.Length)
    $stream.Write($size, 0, 8)
    $magic = [System.Text.Encoding]::ASCII.GetBytes('SOTZ')
    $stream.Write($magic, 0, 4)
}
finally {
    $stream.Close()
}

$setupInfo = Get-Item $setupExe
$hash = (Get-FileHash $setupExe -Algorithm SHA256).Hash

Write-Host ''
Write-Host ("Instalador: {0}" -f $setupExe)
Write-Host ("Tamanho:    {0:N1} MB" -f ($setupInfo.Length / 1MB))
Write-Host ("SHA256:     {0}" -f $hash)

if (-not $KeepWork) {
    Remove-Item $work -Recurse -Force
    Write-Host 'Temporarios removidos.'
}
