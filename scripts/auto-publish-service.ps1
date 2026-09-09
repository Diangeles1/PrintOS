<#
.SYNOPSIS
  Registra / remove / inspeciona o "PrintOS Auto Publisher" como Tarefa
  Agendada do Windows: inicia no logon, roda escondido, reinicia se cair.

.EXAMPLE
  pwsh scripts/auto-publish-service.ps1 -Install
  pwsh scripts/auto-publish-service.ps1 -Install -IntervalSec 120
  pwsh scripts/auto-publish-service.ps1 -Status
  pwsh scripts/auto-publish-service.ps1 -Start
  pwsh scripts/auto-publish-service.ps1 -Stop
  pwsh scripts/auto-publish-service.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$Status,
  [switch]$Start,
  [switch]$Stop,
  [int]$IntervalSec = 300
)

$ErrorActionPreference = 'Stop'
$TaskName = 'PrintOS Auto Publisher'
$repo = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot 'auto-publish.ps1'
$logFile = Join-Path $PSScriptRoot '.auto-publish.log'

function Test-Task { [bool](Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) }

if ($Uninstall) {
  if (Test-Task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "removida: $TaskName"
  } else {
    Write-Host "nao existe: $TaskName"
  }
  return
}

if ($Start) {
  if (-not (Test-Task)) { Write-Error "nao instalada. Rode -Install antes."; exit 1 }
  Start-ScheduledTask -TaskName $TaskName
  Write-Host "iniciada."
  return
}

if ($Stop) {
  if (-not (Test-Task)) { Write-Error "nao instalada."; exit 1 }
  Stop-ScheduledTask -TaskName $TaskName
  Write-Host "parada."
  return
}

if ($Status) {
  if (-not (Test-Task)) { Write-Host "nao instalada."; return }
  $t = Get-ScheduledTask -TaskName $TaskName
  $i = Get-ScheduledTaskInfo -TaskName $TaskName
  [pscustomobject]@{
    Tarefa          = $TaskName
    Estado          = $t.State
    UltimaExecucao  = $i.LastRunTime
    UltimoResultado = ('0x{0:X}' -f $i.LastTaskResult)
    ProximaExecucao = $i.NextRunTime
  } | Format-List
  if (Test-Path $logFile) {
    Write-Host "--- ultimas 20 linhas de $logFile ---"
    Get-Content $logFile -Tail 20
  } else {
    Write-Host "(sem log ainda em $logFile)"
  }
  return
}

# ---- padrao: instalar --------------------------------------------------------
if (-not $Install) {
  Write-Host "Use uma acao: -Install | -Uninstall | -Status | -Start | -Stop"
  Write-Host "Ex.: pwsh scripts/auto-publish-service.ps1 -Install -IntervalSec 300"
  return
}

$ps = (Get-Command powershell.exe -ErrorAction SilentlyContinue)
if (-not $ps) { $ps = (Get-Command pwsh -ErrorAction SilentlyContinue) }
if (-not $ps) { Write-Error 'PowerShell nao encontrado.'; exit 1 }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node nao encontrado no PATH. Instale o Node 20+ antes.'
  exit 1
}

$argument = "-WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File `"$launcher`" --interval=$IntervalSec"
$action = New-ScheduledTaskAction -Execute $ps.Source -Argument $argument -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 2) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -Hidden
$principal = New-ScheduledTaskPrincipal -UserId ("{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME) `
  -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force `
  -Description 'Commita, sincroniza e da push do PrintOS no GitHub em ciclo continuo (pausa se o CI falhar).' | Out-Null

Write-Host "instalada: $TaskName  (inicia no logon, ciclo ${IntervalSec}s)"
Write-Host "iniciar agora:  pwsh scripts/auto-publish-service.ps1 -Start"
Write-Host "ver status:     pwsh scripts/auto-publish-service.ps1 -Status"
Write-Host "log:            $logFile"
