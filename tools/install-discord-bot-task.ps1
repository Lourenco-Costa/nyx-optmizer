$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $root 'tools\discord-bot-runner.ps1'
$taskName = 'Nyx Discord Bot'
$user = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $runner + '"')
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Days 3650)

$registered = $false
try {
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Highest
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Mantem o bot de suporte Nyx ligado no arranque do Windows e reinicia se falhar.' -Force | Out-Null
  $registered = $true
  Write-Output 'Tarefa registada no arranque do Windows (S4U).'
} catch {
  Write-Output ('Arranque sem sessao falhou: ' + $_.Exception.Message)
}

if (-not $registered) {
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Mantem o bot de suporte Nyx ligado no login do Windows e reinicia se falhar.' -Force | Out-Null
  Write-Output 'Tarefa registada no login do Windows (fallback).'
}

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 3

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName $taskName | Select-Object LastRunTime, LastTaskResult, NextRunTime
