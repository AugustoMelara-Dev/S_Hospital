#Requires -Version 5.1
<#
.SYNOPSIS
    Rejects a native payload that still contains laboratory/QA data or a
    concrete hospital identity.

.DESCRIPTION
    H-03/H-14 delivery guard. Runs against a built payload (default:
    artifacts/native-payload). It inspects file names everywhere and text
    contents only in bounded backend/scripts roots, so large binaries and the
    vendor tree are never read.

    The forbidden tokens are assembled at runtime on purpose: this script is
    copied into the payload and must not reintroduce the literals it forbids.
#>
param(
    [string] $PayloadRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$script:Checks = 0
function Assert-PayloadHygiene {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) { throw $Message }
}

$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$explicitRoot = $PSBoundParameters.ContainsKey('PayloadRoot')
if (-not $explicitRoot) {
    $PayloadRoot = Join-Path $projectRoot 'artifacts\native-payload'
}

if (-not (Test-Path -LiteralPath $PayloadRoot -PathType Container)) {
    if ($explicitRoot) {
        throw "Native payload not found: $PayloadRoot"
    }
    Write-Host "[ SKIP ] Native payload not found: $PayloadRoot (build it before release)."
    exit 0
}

$PayloadRoot = (Resolve-Path -LiteralPath $PayloadRoot).Path

# Tokens split so this guard can ship inside the payload without matching itself.
$validacion = 'valid' + 'acion'
$identityTokens = @(
    ('Hospital ' + 'General'),
    ('San ' + 'Isidro'),
    ('To' + 'coa')
)
$forbiddenTokens = @(
    ('Development' + 'Validation' + 'Seeder'),
    ('Development' + 'Seeder'),
    ('admin.' + $validacion),
    ('supervisor.' + $validacion),
    ('cajero.' + $validacion),
    ('azb.' + 'qa.'),
    ('EU' + 'PC-'),
    ('A' + 'ZB-'),
    ('VALID' + 'ACION-CAI'),
    ('Password' + '123!'),
    ('hospital-' + 'san-' + 'isidro.local'),
    ('APP_' + 'KEY=base64:'),
    ('DB_' + 'PASSWORD='),
    ('MAIL_' + 'PASSWORD=')
)

$forbiddenFileNames = @(
    ('Development' + 'Validation' + 'Seeder.php'),
    ('Development' + 'Seeder.php'),
    'DatabaseSeeder.php'
)

$allFiles = @(Get-ChildItem -LiteralPath $PayloadRoot -Recurse -Force -File)
Assert-PayloadHygiene ($allFiles.Count -gt 0) 'The payload is empty.'

foreach ($file in $allFiles) {
    Assert-PayloadHygiene (-not ($file.Name -like '.env*')) "Environment file leaked into payload: $($file.FullName)"
    Assert-PayloadHygiene ($forbiddenFileNames -notcontains $file.Name) "Development seeder leaked into payload: $($file.FullName)"
    Assert-PayloadHygiene (-not ($file.Name -match ('\.' + $validacion))) "Validation fixture leaked into payload: $($file.FullName)"
    Assert-PayloadHygiene (-not ($file.Name -match ('^azb\.qa\.'))) "QA fixture leaked into payload: $($file.FullName)"
}

$requiredSeeder = Join-Path $PayloadRoot 'app\backend\database\seeders\ProductionInstallationSeeder.php'
Assert-PayloadHygiene (Test-Path -LiteralPath $requiredSeeder -PathType Leaf) "Missing production installer seeder: $requiredSeeder"

$releasePath = Join-Path $PayloadRoot 'native-release.json'
Assert-PayloadHygiene (Test-Path -LiteralPath $releasePath -PathType Leaf) "Missing native release metadata: $releasePath"
$release = Get-Content -LiteralPath $releasePath -Raw | ConvertFrom-Json
Assert-PayloadHygiene ($release.product -eq 'S_Hospital') "native-release.json product must be S_Hospital, got '$($release.product)'."

$qaRoots = @(
    (Join-Path $PayloadRoot 'app\backend\database'),
    (Join-Path $PayloadRoot 'app\backend\app'),
    (Join-Path $PayloadRoot 'app\backend\config'),
    (Join-Path $PayloadRoot 'app\backend\routes'),
    (Join-Path $PayloadRoot 'app\backend\bootstrap'),
    (Join-Path $PayloadRoot 'app\backend\resources'),
    (Join-Path $PayloadRoot 'app\backend\public')
) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }

$identityRoots = @(
    (Join-Path $PayloadRoot 'app\backend\database'),
    (Join-Path $PayloadRoot 'scripts')
) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }

$textExtensions = @('.php', '.json', '.txt', '.csv', '.md', '.ps1', '.yml', '.yaml', '.xml', '.ini', '.conf', '.html', '.webmanifest')
$maxTextBytes = 2MB
$scannedFiles = 0

$candidateFiles = @()
foreach ($root in (@($qaRoots) + @($identityRoots))) {
    $candidateFiles += @(Get-ChildItem -LiteralPath $root -Recurse -Force -File)
}
$candidateFiles = @($candidateFiles | Sort-Object -Property FullName -Unique)

foreach ($file in $candidateFiles) {
    if (-not ($textExtensions -contains $file.Extension.ToLowerInvariant())) { continue }
    if ($file.Length -gt $maxTextBytes) { continue }

    $relative = $file.FullName.Substring($PayloadRoot.Length).TrimStart('\')
    if ($relative -match '^app\\backend\\public\\(build|assets)\\' ) { continue }

    $text = [IO.File]::ReadAllText($file.FullName)
    $scannedFiles++

    $isQaRoot = $false
    foreach ($root in $qaRoots) {
        if ($file.FullName.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
            $isQaRoot = $true
            break
        }
    }

    if ($isQaRoot) {
        foreach ($token in $forbiddenTokens) {
            Assert-PayloadHygiene (
                $text.IndexOf($token, [StringComparison]::OrdinalIgnoreCase) -lt 0
            ) "Forbidden token '$token' found in payload file: $relative"
        }
    }

    $isIdentityRoot = $false
    foreach ($root in $identityRoots) {
        if ($file.FullName.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
            $isIdentityRoot = $true
            break
        }
    }

    if ($isIdentityRoot) {
        foreach ($token in $identityTokens) {
            Assert-PayloadHygiene (
                $text.IndexOf($token, [StringComparison]::OrdinalIgnoreCase) -lt 0
            ) "Concrete hospital identity '$token' found in payload file: $relative"
        }
    }
}

Write-Host ("[ OK ] Native payload hygiene: {0} files inspected, {1} text files scanned, {2} checks." -f $allFiles.Count, $scannedFiles, $script:Checks)
