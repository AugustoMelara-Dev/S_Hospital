param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Get-PowerShellHostCommand {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        return (Get-Command pwsh).Source
    }

    if (Get-Command powershell.exe -ErrorAction SilentlyContinue) {
        return (Get-Command powershell.exe).Source
    }

    if (Get-Command powershell -ErrorAction SilentlyContinue) {
        return (Get-Command powershell).Source
    }

    throw 'No se encontro un host PowerShell para ejecutar pruebas de hardening.'
}

$billingWord = 'bill' + 'ing'
$legacyProjectName = 'S' + '_Hospital'
$demoWord = 'Demo'
$colon = ':'

$forbiddenVisibleTerms = @(
    ('Hospital ' + $billingWord + ' OS'),
    ($billingWord + ' OS'),
    ($billingWord + '-os'),
    ($billingWord + 'os'),
    ($legacyProjectName),
    ('Hospital ' + $demoWord),
    ('DEMO' + '-CAI'),
    ('Development' + $demoWord + 'Seeder')
)

$destructiveCommands = @(
    ('migrate' + $colon + 'fresh'),
    ('migrate' + $colon + 'reset'),
    ('migrate' + $colon + 'rollback'),
    ('db' + $colon + 'wipe'),
    'docker volume rm',
    'docker compose down -v'
)

$targets = @()
$targetFiles = @(
    'setup.bat',
    'scripts\release_setup.bat',
    'scripts\deploy_hospital_lan.ps1',
    'scripts\install_hospital_os.ps1',
    'scripts\install_backup_tasks_windows.ps1',
    'scripts\install_hospital_startup_shortcut.ps1',
    'scripts\start_hospital_services.ps1',
    'scripts\open_hospital_system.ps1',
    'scripts\repair_hospital_system.ps1',
    'scripts\refresh_lan_ip.ps1',
    'scripts\run_backup_worker.cmd',
    'scripts\run_scheduled_backup.cmd'
)

foreach ($relative in $targetFiles) {
    $candidate = Join-Path $Root $relative
    if (Test-Path $candidate) {
        $targets += (Get-Item $candidate)
    }
}

if ($targets.Count -eq 0) {
    Write-Error 'No se encontraron scripts de instalacion para validar.'
    exit 2
}

$findings = @()

foreach ($target in $targets) {
    $content = Get-Content -Raw -Path $target.FullName

    foreach ($term in $forbiddenVisibleTerms) {
        if ($content -match [regex]::Escape($term)) {
            $findings += [pscustomobject]@{
                File = $target.FullName
                Type = 'branding'
                Pattern = $term
            }
        }
    }

    foreach ($command in $destructiveCommands) {
        if ($content -match [regex]::Escape($command)) {
            $findings += [pscustomobject]@{
                File = $target.FullName
                Type = 'destructive-command'
                Pattern = $command
            }
        }
    }
}

if ($findings.Count -gt 0) {
    Write-Host 'Instalador no apto para entrega:'
    $findings | Format-Table -AutoSize | Out-String | Write-Host
    exit 1
}

$powerShellHost = Get-PowerShellHostCommand
& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\test_backup_task_envfile_hardening.ps1')
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\test_lan_deploy_hardening.ps1')
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $powerShellHost -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\test_physical_receipt_print_proof_safety.ps1') -Root $Root
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if (Test-Path -LiteralPath (Join-Path $Root 'frontend\scripts\run-release-e2e.mjs') -PathType Leaf) {
    & $powerShellHost -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'scripts\test_release_e2e_golden_sqlite_safety.ps1') -Root $Root
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} else {
    Write-Host '[OK] Release E2E golden SQLite safety skipped: frontend source runner is not included in this package.'
}

Write-Host 'Validacion de instalador completada sin hallazgos.'
