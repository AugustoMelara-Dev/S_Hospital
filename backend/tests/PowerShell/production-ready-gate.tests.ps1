# =============================================================================
# Tests for the production-ready evidence gate
# =============================================================================
# This test is intentionally static. It protects the final handoff/preflight
# contract without requiring a running server, printer, LAN client or secrets.
# =============================================================================
param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        $failures.Add("Missing required file: $relativePath") | Out-Null
        return ""
    }

    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        $failures.Add($label) | Out-Null
    }
}

function Assert-Literal([string] $label, [string] $content, [string] $needle) {
    if (-not $content.Contains($needle)) {
        $failures.Add($label) | Out-Null
    }
}

$preflight = Read-RequiredFile "scripts\production_readiness_preflight.ps1"
$handoff = Read-RequiredFile "scripts\final_production_handoff.ps1"
$evidenceIndex = Read-RequiredFile "scripts\validate_ops_evidence_index.ps1"
$handoffCompleteness = Read-RequiredFile "scripts\validate_final_handoff_completeness.ps1"

Assert-Contains "Preflight must expose AllowMissingPhysicalProof only as a blocking bypass flag" `
    $preflight '\[switch\]\s+\$AllowMissingPhysicalProof'
Assert-Literal "Preflight must fail when physical proof is bypassed" `
    $preflight "Physical LAN/printer proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
Assert-Literal "Preflight must warn that bypass cannot be PRODUCTION_READY" `
    $preflight "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."

foreach ($proofPath in @(
    "qa\LAN_CLIENT_VALIDATION_PROOF.md",
    "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md",
    "qa\FINAL_RESTORE_PROOF.md",
    "qa\FINAL_CONCURRENCY_PROOF.md"
)) {
    Assert-Literal "Preflight must require $proofPath" $preflight $proofPath
    Assert-Literal "Ops evidence index must inspect $proofPath before PRODUCTION_READY" $evidenceIndex $proofPath
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
    Assert-Literal "Preflight must reject incomplete proof marker $placeholderPattern" `
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
    "80mm",
    "58mm",
    "Disposable restore database",
    "Concurrent invoice emission"
)) {
    Assert-Literal "Preflight must keep required proof check: $requiredCheck" `
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
    Assert-Literal "Final handoff must keep gate term: $gateTerm" $handoff $gateTerm
}

Assert-Contains "Ops evidence index must block PRODUCTION_READY with incomplete proof markers" `
    $evidenceIndex 'TODO\|PENDING\|PENDING_'
Assert-Literal "Ops evidence index must require the preflight in the handoff" `
    $evidenceIndex "production_readiness_preflight\.ps1"
Assert-Contains "Handoff completeness must require PRODUCTION_CANDIDATE until field proof is complete" `
    $handoffCompleteness 'PRODUCTION_CANDIDATE'

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "FAIL: $failure" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "PRODUCTION_READY_GATE_TESTS: NO ($($failures.Count) issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host "PRODUCTION_READY_GATE_TESTS: YES" -ForegroundColor Green
