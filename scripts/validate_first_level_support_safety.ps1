param(
    [string] $ProjectRoot = "",
    [switch] $IncludeFieldProofs,
    [switch] $SelfTest
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

$requiredGuards = @(
    "validate_operator_manuals_safety.ps1",
    "validate_shift_incident_recovery_safety.ps1",
    "validate_training_safety.ps1",
    "validate_support_packet_safety.ps1",
    "validate_final_field_blockers_safety.ps1"
)

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Get-GuardPath([string] $scriptName) {
    return Join-Path (Join-Path $ProjectRoot "scripts") $scriptName
}

function Assert-GuardExists([string] $scriptName) {
    $path = Get-GuardPath $scriptName
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found scripts\$scriptName"
    } else {
        Add-Failure "Missing scripts\$scriptName"
    }
}

function Invoke-Guard([string] $scriptName, [string[]] $extraArgs = @()) {
    $path = Get-GuardPath $scriptName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Cannot run missing scripts\$scriptName"
        return
    }

    Write-Host ""
    Write-Host "== scripts\$scriptName ==" -ForegroundColor Cyan
    $arguments = @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        $path,
        "-ProjectRoot",
        $ProjectRoot
    ) + $extraArgs

    & powershell.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "scripts\$scriptName failed with exit code $LASTEXITCODE"
    }
}

if ($SelfTest) {
    foreach ($scriptName in $requiredGuards) {
        Assert-GuardExists $scriptName
    }

    $ownContent = Get-Content -LiteralPath $PSCommandPath -Raw
    $dangerousPatterns = @(
        ('migrate' + ':fresh'),
        ('DROP' + '\s+' + 'DATABASE'),
        ('docker' + '\s+compose\s+down\s+-v'),
        ('Remove-Item' + '\s+.*backend'),
        ('git' + '\s+reset')
    )

    foreach ($dangerousPattern in $dangerousPatterns) {
        if ($ownContent -match $dangerousPattern) {
            Add-Failure "Quick support guard contains destructive pattern: $dangerousPattern"
        }
    }

    if ($ownContent -notmatch '-IncludeFieldProofs') {
        Add-Failure "Quick support guard must keep final-field proof validation behind -IncludeFieldProofs."
    } else {
        Add-Pass "Final-field proof validation remains opt-in"
    }

    if ($failures.Count -gt 0) {
        Write-Host ""
        Write-Host "FIRST_LEVEL_SUPPORT_SAFETY_SELFTEST: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "FIRST_LEVEL_SUPPORT_SAFETY_SELFTEST: YES" -ForegroundColor Green
    return
}

Invoke-Guard "validate_operator_manuals_safety.ps1"
Invoke-Guard "validate_shift_incident_recovery_safety.ps1"
Invoke-Guard "validate_training_safety.ps1"
Invoke-Guard "validate_support_packet_safety.ps1"
Invoke-Guard "validate_final_field_blockers_safety.ps1" @("-SelfTest")

if ($IncludeFieldProofs) {
    Invoke-Guard "validate_final_field_blockers_safety.ps1"
} else {
    Write-Host ""
    Write-Host "[INFO] Final-field proof live validation was skipped. Run with -IncludeFieldProofs on the final server when physical evidence is ready." -ForegroundColor Yellow
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "FIRST_LEVEL_SUPPORT_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "FIRST_LEVEL_SUPPORT_SAFETY: YES" -ForegroundColor Green
