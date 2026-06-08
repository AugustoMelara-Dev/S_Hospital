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

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
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

function Assert-AnyLiteral([string] $label, [string] $content, [string[]] $needles) {
    foreach ($needle in $needles) {
        if ($content.Contains($needle)) {
            Add-Pass $label
            return
        }
    }

    Add-Failure $label
}

$preflight = Read-RequiredFile "scripts\production_readiness_preflight.ps1"
$handoff = Read-RequiredFile "scripts\final_production_handoff.ps1"
$evidenceIndex = Read-RequiredFile "scripts\validate_ops_evidence_index.ps1"
$handoffCompleteness = Read-RequiredFile "scripts\validate_final_handoff_completeness.ps1"
$releaseWorkflow = Read-RequiredFile ".github\workflows\release.yml"
$ciDocs = Read-RequiredFile "docs\CI.md"
$operativeNotes = Read-RequiredFile "docs\OPERATIVE_NOTES_2026_06_02.md"
$auditPlan = Read-RequiredFile "docs\AUDIT_2026_06_02.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"
$releaseNotes = Read-RequiredFile "RELEASE_NOTES_v1.0.0_FINAL.md"

$finalProofPaths = @(
    "qa\LAN_CLIENT_VALIDATION_PROOF.md",
    "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md",
    "qa\FINAL_STARTUP_TASK_PROOF.md",
    "qa\FINAL_RESTORE_PROOF.md",
    "qa\FINAL_BACKUP_TASK_PROOF.md",
    "qa\FINAL_CONCURRENCY_PROOF.md",
    "qa\TRAINING_ACCEPTANCE_PROOF.md"
)

$candidateProofValidators = @(
    "scripts\validate_lan_client_proof.ps1",
    "scripts\validate_institutional_receipt_print_proof.ps1",
    "scripts\validate_final_startup_task_proof.ps1",
    "scripts\validate_final_backup_task_proof.ps1",
    "scripts\validate_training_acceptance_proof.ps1"
)

Assert-Contains "Preflight exposes AllowMissingPhysicalProof as an explicit switch" `
    $preflight '\[switch\]\s+\$AllowMissingPhysicalProof'
Assert-Literal "Preflight fails when physical proof is bypassed" `
    $preflight "Physical LAN/printer/startup/backup/training proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
Assert-Literal "Preflight warns that bypass cannot be PRODUCTION_READY" `
    $preflight "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."

foreach ($proofPath in $finalProofPaths) {
    $releasePath = $proofPath.Replace("\", "/")
    $proofFileName = Split-Path -Leaf $proofPath

    Assert-Literal "Preflight requires $proofPath" $preflight $proofPath
    Assert-Literal "Ops evidence index inspects $proofPath before PRODUCTION_READY" $evidenceIndex $proofPath
    Assert-Literal "Release workflow blocks $releasePath before release" $releaseWorkflow $releasePath
    Assert-Literal "CI docs name final proof file $proofFileName" $ciDocs $proofFileName
    Assert-Literal "Operative notes name final proof file $proofFileName" $operativeNotes $proofFileName
    Assert-Literal "Current audit plan names final proof file $proofFileName" $auditPlan $proofFileName
    Assert-Literal "Release checklist names final proof file $proofFileName" $releaseChecklist $proofFileName
    Assert-Literal "Final release notes name final proof file $proofFileName" $releaseNotes $proofFileName
}

Assert-Literal "Release workflow checks final field evidence before release" `
    $releaseWorkflow "Verify final field evidence"
Assert-Literal "Release workflow fails when a final proof file is missing" `
    $releaseWorkflow '[ ! -f "$f" ]'
Assert-Literal "Release workflow reports missing final proof files" `
    $releaseWorkflow 'is missing. Refusing to release.'
Assert-NotContains "Release workflow must not describe the stale four-proof gate" `
    $releaseWorkflow 'four (physical evidence|PROOF|proof)'
Assert-NotContains "CI docs must not describe the stale four-proof gate" `
    $ciDocs 'four (physical evidence|PROOF|proof)'
Assert-NotContains "Operative notes must not describe the stale four-proof gate" `
    $operativeNotes '(four|cuatro)\s+(physical evidence|PROOF|proof|evidencias|comprobantes)'
Assert-NotContains "Current audit plan must not describe the stale four-proof gate" `
    $auditPlan '(four|cuatro)\s+(physical evidence|PROOF|proof|evidencias|comprobantes)'
Assert-NotContains "Release checklist must not describe the stale four-proof gate" `
    $releaseChecklist '(four|cuatro)\s+(physical evidence|PROOF|proof|evidencias|comprobantes)'
Assert-NotContains "Final release notes must not describe the stale four-proof gate" `
    $releaseNotes '(four|cuatro)\s+(physical evidence|PROOF|proof|evidencias|comprobantes)'
Assert-Literal "CI docs describe required final field evidence files" `
    $ciDocs 'All required final field evidence files under `qa/`'
Assert-Literal "Operative notes describe any required final proof file generically" `
    $operativeNotes "cualquier archivo de evidencia final requerido sigue PENDING"
Assert-Literal "Current audit plan tracks seven final physical evidences" `
    $auditPlan "siete evidencias"
Assert-Literal "Release checklist treats any missing final proof as PRODUCTION_CANDIDATE" `
    $releaseChecklist "Si falta cualquier evidencia final"

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

foreach ($sensitiveEvidenceGuard in @(
    "Test-ProofDoesNotExposeSensitiveEvidence",
    "APP_KEY-like assignment",
    "DB_PASSWORD-like assignment",
    "secret-like assignment",
    "absolute Windows path",
    "absolute local Unix path",
    "raw Windows scheduled-task XML"
)) {
    Assert-Literal "Preflight rejects sensitive proof evidence: $sensitiveEvidenceGuard" `
        $preflight $sensitiveEvidenceGuard
}

foreach ($handoffGuard in @(
    'scripts\final_production_handoff.ps1',
    'scripts\validate_ops_evidence_index.ps1',
    'scripts\validate_final_handoff_completeness.ps1'
)) {
    $handoffGuardContent = Read-RequiredFile $handoffGuard
    Assert-Literal "Handoff guard redacts or rejects Unix local paths: $handoffGuard" `
        $handoffGuardContent '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'
    Assert-Literal "Handoff guard redacts or rejects raw task XML: $handoffGuard" `
        $handoffGuardContent '(?is)<(Task|Actions|Principals|Triggers|Settings)\b'
}

foreach ($candidateProofValidator in $candidateProofValidators) {
    $candidateProofValidatorContent = Read-RequiredFile $candidateProofValidator
    Assert-Literal "Candidate proof validator rejects Unix local paths: $candidateProofValidator" `
        $candidateProofValidatorContent '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'
    Assert-Literal "Candidate proof validator rejects raw task XML: $candidateProofValidator" `
        $candidateProofValidatorContent '(?is)<(Task|Actions|Principals|Triggers|Settings)\b'
    Assert-Literal "Candidate proof validator failure message names task XML: $candidateProofValidator" `
        $candidateProofValidatorContent 'task XML'
}

foreach ($requiredCheck in @(
    "/up",
    "Cashbox",
    "Invoice",
    "Payment",
    "Receipt",
    "AtStartup",
    "Backup",
    "Pendiente a Protegido",
    "media carta",
    "carta",
    "A5",
    "Disposable restore database",
    "Concurrent invoice emission",
    "supervised training acceptance",
    "Training did not use the production database",
    "Area-user role practiced"
)) {
    Assert-Literal "Preflight keeps required proof check: $requiredCheck" `
        $preflight $requiredCheck
}

foreach ($finalProofLocalMarker in @(
    "ForbiddenFinalProofPatterns",
    "Docker/MariaDB development",
    "current Docker/MariaDB development environment only",
    "Final-server restore validation.*still required",
    "installed hospital PC is still required",
    "http://127\.0\.0\.1:8000",
    "Target environment:\s*local",
    '"target_env"\s*:\s*"local"',
    "local Docker/MariaDB",
    "local validation target"
)) {
    Assert-Literal "Preflight rejects local-only final proof marker: $finalProofLocalMarker" `
        $preflight $finalProofLocalMarker
}

foreach ($gateTerm in @(
    '$allProofsCompleted',
    '$allAutomatedGuardsPassed',
    '-not $preflightSkipped',
    '$preflightExit -eq 0',
    'PRODUCTION_READY evidence gate passed'
)) {
    Assert-Literal "Final handoff keeps gate term: $gateTerm" $handoff $gateTerm
}

Assert-AnyLiteral "Final handoff keeps blocked PRODUCTION_READY term" $handoff @(
    'PRODUCTION_READY remains blocked',
    'PRODUCTION_READY sigue bloqueado'
)

Assert-Contains "Ops evidence index blocks PRODUCTION_READY with incomplete proof markers" `
    $evidenceIndex 'TODO\|PENDING\|PENDING_'
Assert-Literal "Ops evidence index requires the preflight in the handoff" `
    $evidenceIndex "production_readiness_preflight\.ps1"
Assert-Contains "Handoff completeness requires PRODUCTION_CANDIDATE until field proof is complete" `
    $handoffCompleteness 'PRODUCTION_CANDIDATE'
Assert-Contains "Release notes keep candidate status before field evidence" `
    $releaseNotes '(?m)^>\s*Estado:\s*\*\*PRODUCTION_CANDIDATE\*\*'
Assert-NotContains "Release notes must not declare PRODUCTION_READY in the status header" `
    $releaseNotes '(?m)^>\s*Estado:\s*\*\*PRODUCTION_READY\*\*'
Assert-Contains "Release notes require final handoff before tagging v1.0.0" `
    $releaseNotes 'No crear ni empujar el tag `v1\.0\.0` hasta que el handoff final declare\s+`PRODUCTION_READY`'
Assert-NotContains "Release notes tag command must not claim PRODUCTION_READY without field evidence" `
    $releaseNotes 'git tag[^\r\n]+PRODUCTION_READY \(HTTPS mandatory'

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_READY_GATE_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PRODUCTION_READY_GATE_SAFETY: YES" -ForegroundColor Green
