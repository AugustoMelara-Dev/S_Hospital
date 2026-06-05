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

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

function Assert-Literal([string] $label, [string] $content, [string] $needle) {
    if (-not $content.Contains($needle)) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

$preflight = Read-RequiredFile "scripts\production_readiness_preflight.ps1"
$handoff = Read-RequiredFile "scripts\final_production_handoff.ps1"
$evidenceIndex = Read-RequiredFile "scripts\validate_ops_evidence_index.ps1"
$handoffCompleteness = Read-RequiredFile "scripts\validate_final_handoff_completeness.ps1"

Assert-Contains "Preflight exposes AllowMissingPhysicalProof as an explicit switch" `
    $preflight '\[switch\]\s+\$AllowMissingPhysicalProof'
Assert-Literal "Preflight fails when physical proof is bypassed" `
    $preflight "Physical LAN/printer proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
Assert-Literal "Preflight warns that bypass cannot be PRODUCTION_READY" `
    $preflight "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."

foreach ($proofPath in @(
    "qa\LAN_CLIENT_VALIDATION_PROOF.md",
    "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md",
    "qa\FINAL_RESTORE_PROOF.md",
    "qa\FINAL_CONCURRENCY_PROOF.md"
)) {
    Assert-Literal "Preflight requires $proofPath" $preflight $proofPath
    Assert-Literal "Ops evidence index inspects $proofPath before PRODUCTION_READY" $evidenceIndex $proofPath
}

foreach ($placeholderPattern in @(
    '\bTODO\b',
    '\bPENDING_[A-Z_]+\b',
    '\bREPLACE\b',
    '\bN/A\b',
    '\bTBD\b',
    'example',
    'template',
    'use this file',
    '\[ \]'
)) {
    Assert-Literal "Preflight rejects incomplete proof marker $placeholderPattern" `
        $preflight $placeholderPattern
}

foreach ($requiredCheck in @(
    "/up",
    "Cashbox",
    "Invoice",
    "Payment",
    "Receipt",
    "Backup",
    "media carta",
    "carta",
    "A5",
    "Disposable restore database",
    "Concurrent invoice emission"
)) {
    Assert-Literal "Preflight keeps required proof check: $requiredCheck" `
        $preflight $requiredCheck
}

foreach ($gateTerm in @(
    '$allProofsCompleted',
    '$allAutomatedGuardsPassed',
    '-not $preflightSkipped',
    '$preflightExit -eq 0',
    'PRODUCTION_READY evidence gate passed',
    'PRODUCTION_READY remains blocked'
)) {
    Assert-Literal "Final handoff keeps gate term: $gateTerm" $handoff $gateTerm
}

Assert-Contains "Ops evidence index blocks PRODUCTION_READY with incomplete proof markers" `
    $evidenceIndex 'TODO\|PENDING\|PENDING_'
Assert-Literal "Ops evidence index requires the preflight in the handoff" `
    $evidenceIndex "production_readiness_preflight\.ps1"
Assert-Contains "Handoff completeness requires PRODUCTION_CANDIDATE until field proof is complete" `
    $handoffCompleteness 'PRODUCTION_CANDIDATE'

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_READY_GATE_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PRODUCTION_READY_GATE_SAFETY: YES" -ForegroundColor Green
