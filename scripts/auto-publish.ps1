# PrintOS Auto Publisher — inicia em primeiro plano (Ctrl+C encerra com seguranca).
#
#   pwsh scripts/auto-publish.ps1
#   pwsh scripts/auto-publish.ps1 --once --dry-run
#   pwsh scripts/auto-publish.ps1 --interval=120
#
# Tudo depois do nome do script eh repassado pro auto-publish.mjs.

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error 'Node nao encontrado no PATH. Instale o Node 20+ e tente de novo.'
  exit 1
}

& $node.Source (Join-Path $PSScriptRoot 'auto-publish.mjs') @args
exit $LASTEXITCODE
