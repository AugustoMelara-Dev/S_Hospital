param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

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
    'scripts\install_hospital_os.ps1',
    'scripts\install_hospital_startup_shortcut.ps1',
    'scripts\start_hospital_services.ps1',
    'scripts\open_hospital_system.ps1',
    'scripts\repair_hospital_system.ps1'
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

Write-Host 'Validacion de instalador completada sin hallazgos.'
