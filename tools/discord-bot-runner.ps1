$ErrorActionPreference = 'Continue'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$logDir = Join-Path $root 'tools'
$logPath = Join-Path $logDir 'discord-bot.log'
$node = Join-Path $root 'tools\node\node.exe'
$bot = Join-Path $root 'tools\discord-autorole.js'

while ($true) {
  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] a iniciar o bot de suporte"

  & $node $bot *>> $logPath
  $exitCode = $LASTEXITCODE

  Add-Content -Path $logPath -Value "[$(Get-Date -Format o)] bot terminou (codigo $exitCode); a reiniciar em 5 segundos"
  Start-Sleep -Seconds 5
}
