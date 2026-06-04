param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Assert-Contains([string] $content, [string] $needle, [string] $message) {
    if ($content.Contains($needle)) {
        Add-Pass $message
    } else {
        Add-Failure $message
    }
}

function Assert-Matches([string] $content, [string] $pattern, [string] $message) {
    if ($content -match $pattern) {
        Add-Pass $message
    } else {
        Add-Failure $message
    }
}

$builderPath = Join-Path $ProjectRoot "scripts\make_offline_release.ps1"
if (-not (Test-Path -LiteralPath $builderPath -PathType Leaf)) {
    Add-Failure "Missing scripts\make_offline_release.ps1"
} else {
    Add-Pass "Found scripts\make_offline_release.ps1"
}

$builder = if (Test-Path -LiteralPath $builderPath -PathType Leaf) {
    Get-Content -LiteralPath $builderPath -Raw
} else {
    ""
}

Assert-Contains $builder '$script:ReleaseFinalRoot = $ReleaseRoot' "Builder keeps final release path separate from staging path"
Assert-Contains $builder '$script:ReleaseStagingRoot' "Builder defines a staging release path"
Assert-Contains $builder '.staging-' "Builder creates a named staging directory"
Assert-Contains $builder 'function Remove-StagingRelease' "Builder has staging cleanup helper"
Assert-Matches $builder 'function Write-Fail[\s\S]*?Remove-StagingRelease[\s\S]*?exit 1' "Builder cleans staging before failing"
Assert-Contains $builder '$releaseBackupRoot' "Builder creates a temporary backup path before final swap"
Assert-Contains $builder 'Move-Item -LiteralPath $script:ReleaseFinalRoot -Destination $releaseBackupRoot' "Builder moves previous release to backup before publishing"
Assert-Contains $builder 'Move-Item -LiteralPath $ReleaseRoot -Destination $script:ReleaseFinalRoot' "Builder publishes staged release after validation"
Assert-Matches $builder 'catch[\s\S]*?Move-Item -LiteralPath \$releaseBackupRoot -Destination \$script:ReleaseFinalRoot' "Builder restores previous release if publish fails"

$guardIndex = $builder.IndexOf('Ejecutando guard de artefacto offline.')
$publishIndex = $builder.IndexOf('Publicando paquete offline verificado.')
if ($guardIndex -ge 0 -and $publishIndex -gt $guardIndex) {
    Add-Pass "Builder runs offline release guard before publishing final release"
} else {
    Add-Failure "Builder must run offline release guard before publishing final release"
}

if ($builder -match 'Remove-Item\s+-LiteralPath\s+\$script:ReleaseFinalRoot\s+-Recurse\s+-Force') {
    Add-Failure "Builder must not delete the previous final release before the staged release is ready to publish."
} else {
    Add-Pass "Builder avoids deleting the previous final release before publish"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OFFLINE_RELEASE_STAGING_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OFFLINE_RELEASE_STAGING_SAFETY: YES" -ForegroundColor Green
