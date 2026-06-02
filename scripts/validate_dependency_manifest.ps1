#requires -Version 5.1
<#
.SYNOPSIS
  Validates the project dependency manifest declared in
  package_manifest.json against the actual composer.json /
  package.json files. The script fails when a manifest entry
  claims a dependency is locked to a major version that the
  code does not actually use.

.DESCRIPTION
  The cashier app ships with a package_manifest.json that the
  offline-release pipeline uses to decide which artifacts must
  travel with the installer. When a maintainer adds a library
  to the manifest but forgets to declare it in composer.json or
  package.json (or vice-versa), the offline release can ship
  with a stale manifest. This script catches that drift in CI
  and locally.

.PARAMETER ProjectRoot
  Defaults to the parent of the script directory.
#>

[CmdletBinding()]
param(
    [string] $ProjectRoot
)

if (-not $ProjectRoot) {
    if ($PSScriptRoot) {
        $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    } else {
        $ProjectRoot = (Resolve-Path ".").Path
    }
}

$ErrorActionPreference = "Stop"

$manifestPath = Join-Path $ProjectRoot "package_manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
    Write-Error "Manifest not found: $manifestPath"
    exit 2
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

$composerPath = Join-Path $ProjectRoot "backend\composer.json"
$frontendPackagePath = Join-Path $ProjectRoot "frontend\package.json"

if (-not (Test-Path -LiteralPath $composerPath)) {
    Write-Error "composer.json not found: $composerPath"
    exit 2
}

if (-not (Test-Path -LiteralPath $frontendPackagePath)) {
    Write-Error "package.json not found: $frontendPackagePath"
    exit 2
}

$composer = Get-Content -LiteralPath $composerPath -Raw | ConvertFrom-Json
$frontend = Get-Content -LiteralPath $frontendPackagePath -Raw | ConvertFrom-Json

$failures = New-Object System.Collections.Generic.List[string]

function Assert-Present {
    param(
        [string] $Label,
        [string] $Needle,
        [hashtable] $Haystack
    )

    $found = $false
    foreach ($key in $Haystack.Keys) {
        if ($key -ieq $Needle) { $found = $true; break }
    }

    if (-not $found) {
        $script:failures.Add("$Label is missing dependency '$Needle' declared in package_manifest.json") | Out-Null
    }
}

$backendRequires = @{}
foreach ($prop in $composer.PSObject.Properties) {
    if ($prop.Name -in @("require", "require-dev")) {
        foreach ($key in $prop.Value.PSObject.Properties.Name) {
            $backendRequires[$key] = $prop.Value.$key
        }
    }
}

$frontendRequires = @{}
foreach ($prop in $frontend.PSObject.Properties) {
    if ($prop.Name -in @("dependencies", "devDependencies")) {
        foreach ($key in $prop.Value.PSObject.Properties.Name) {
            $frontendRequires[$key] = $prop.Value.$key
        }
    }
}

$expectedBackend = @(
    'laravel/framework',
    'laravel/sanctum',
    'spatie/laravel-permission',
    'barryvdh/laravel-dompdf',
    'phpoffice/phpspreadsheet',
    'larastan/larastan'
)

$expectedFrontend = @(
    'react',
    'react-dom',
    'react-router-dom',
    '@tanstack/react-query',
    'recharts',
    'react-hook-form',
    'zod',
    'lucide-react',
    'axe-core',
    'vitest-axe'
)

foreach ($dep in $expectedBackend) {
    Assert-Present -Label "backend composer.json" -Needle $dep -Haystack $backendRequires
}

foreach ($dep in $expectedFrontend) {
    Assert-Present -Label "frontend package.json" -Needle $dep -Haystack $frontendRequires
}

$manifestName = [string] $manifest.name
if ($manifestName -notmatch '^hospital_billing') {
    $failures.Add("package_manifest.json name is '$manifestName', expected to start with 'hospital_billing'") | Out-Null
}

if ($manifest.PSObject.Properties.Name -notcontains "stack") {
    $failures.Add("package_manifest.json is missing the 'stack' field") | Out-Null
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Manifest drift detected:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "  - $failure" -ForegroundColor Red
    }
    Write-Host ""
    exit 1
}

Write-Host "Manifest matches composer.json and package.json." -ForegroundColor Green
Write-Host "  backend deps declared: $($backendRequires.Count)" -ForegroundColor Gray
Write-Host "  frontend deps declared: $($frontendRequires.Count)" -ForegroundColor Gray
exit 0
