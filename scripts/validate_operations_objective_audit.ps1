param(
    [string] $ProjectRoot = "",
    [string] $AuditPath = "qa\OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md"
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-ObjectiveAuditText([string] $value) {
    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "(?i)/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $failures.Add((Protect-ObjectiveAuditText $message)) | Out-Null
}

function Assert-Content([string] $pattern, [string] $message) {
    if ($content -notmatch $pattern) {
        Add-Failure $message
    }
}

function Test-PhysicalProofLooksComplete([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        return $false
    }

    $proof = Get-Content -LiteralPath $path -Raw
    if ($proof.Trim().Length -lt 300) {
        return $false
    }

    return $proof -notmatch '(?i)\b(TODO|PENDING|PENDING_[A-Z_]+|REPLACE|TBD|example|template)\b|\[ \]'
}

$auditCandidate = if ([System.IO.Path]::IsPathRooted($AuditPath)) {
    $AuditPath
} else {
    Join-Path $ProjectRoot $AuditPath
}
$auditFullPath = [System.IO.Path]::GetFullPath($auditCandidate)
$rootPrefix = $ProjectRoot.TrimEnd("\") + "\"

if (-not $auditFullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    Add-Failure "La auditoria debe estar dentro de la carpeta instalada del sistema."
}

if (-not (Test-Path -LiteralPath $auditFullPath -PathType Leaf)) {
    Add-Failure "No se encontro la auditoria del objetivo: $auditFullPath"
}

if ($failures.Count -eq 0) {
    $content = Get-Content -LiteralPath $auditFullPath -Raw

    $forbiddenPatterns = @(
        @{ Pattern = ('(?i)' + 'Billing' + '\s+' + 'OS'); Message = 'Branding heredado encontrado en la auditoria.' },
        @{ Pattern = '(?i)APP_KEY\s*[:=]\s*[^\s`]+'; Message = 'La auditoria parece contener APP_KEY.' },
        @{ Pattern = '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+'; Message = 'La auditoria parece contener DB_PASSWORD.' },
        @{ Pattern = '(?i)(TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^\s`]+'; Message = 'La auditoria parece contener secretos.' },
        @{ Pattern = '(?i)[A-Z]:\\(?![\\])'; Message = 'La auditoria contiene una ruta absoluta de Windows.' },
        @{ Pattern = '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'; Message = 'La auditoria contiene una ruta absoluta local.' }
    )

    foreach ($item in $forbiddenPatterns) {
        if ($content -match $item.Pattern) {
            Add-Failure $item.Message
        }
    }

    Assert-Content '(?m)^Decision:\s*`PRODUCTION_CANDIDATE`\.' "La auditoria debe mantener Decision: PRODUCTION_CANDIDATE."
    Assert-Content '(?i)The objective is materially advanced and locally guarded, but it is not complete' "La auditoria debe declarar que el objetivo aun no esta completo."
    Assert-Content 'VALIDATED_LOCAL' "La auditoria debe separar evidencia local validada."
    Assert-Content 'PARTIAL_FIELD_BLOCKED' "La auditoria debe marcar evidencia local que aun depende de campo."
    Assert-Content 'PENDING_FINAL_FIELD' "La auditoria debe marcar pendientes finales de campo."

    $requiredRequirements = @(
        'Repository, backend, installer, database, migrations, logs, backups, manuals and tests audited',
        'Browser evidence for critical flows',
        'In-app institutional Help',
        'Human-safe support evidence',
        'First-level support quick check stays executable from the final handoff',
        'Local diagnostics',
        'Institutional installer',
        'Recovery guidance for power loss',
        'Known limitations and local blockers',
        'Safe maintenance mode during incidents',
        'Permission changes are durably audited',
        'Per-user rate limiting protects LAN cashier writes',
        'Duplicate-action protection',
        'Automatic and manual backup',
        'Backup startup without administrator rights',
        'Non-technical manuals',
        'Safe practice/training guidance',
        'Final LAN client validation',
        'Physical institutional receipt proof',
        'Offline release package',
        'Production license salt cannot be missing or weak',
        '`PRODUCTION_READY` gate and final-field blockers cannot be bypassed silently',
        'Final production environment and preflight'
    )

    foreach ($requirement in $requiredRequirements) {
        Assert-Content ([regex]::Escape($requirement)) "Falta requisito en la matriz: $requirement."
    }

    $requiredEvidence = @(
        'qa/BROWSER_SMOKE_EVIDENCE_2026_06_03.md',
        'qa/HELP_SCREEN_SAFETY_2026_06_03.md',
        'qa/SUPPORT_PACKET_SAFETY_2026_06_03.md',
        'qa/FIRST_LEVEL_SUPPORT_SAFETY_2026_06_04.md',
        'qa/FIRST_LEVEL_SUPPORT_HANDOFF_2026_06_04.md',
        'qa/FIRST_LEVEL_SUPPORT_HANDOFF_RESULT_2026_06_04.md',
        'qa/SYSTEM_DIAGNOSTICS_SAFETY_2026_06_03.md',
        'qa/INSTALLATION_DOCS_SAFETY_2026_06_03.md',
        'qa/SHIFT_INCIDENT_RECOVERY_SAFETY_2026_06_03.md',
        'qa/LAN_LOADTEST_SAFETY_2026_06_04.md',
        'qa/LAN_LOADTEST_HANDOFF_2026_06_04.md',
        'docs/DECISION_LAN_LOADTEST_HANDOFF_2026_06_04.md',
        'qa/KNOWN_LIMITATIONS_SAFETY_2026_06_03.md',
        'qa/MAINTENANCE_MODE_SAFETY_2026_06_03.md',
        'qa/PERMISSION_AUDIT_SAFETY_2026_06_03.md',
        'qa/RATE_LIMIT_SAFETY_2026_06_03.md',
        'qa/DOUBLE_ACTION_SAFETY_2026_06_03.md',
        'qa/BACKUP_WORKER_SMOKE_2026_06_03.md',
        'qa/BACKUP_STARTUP_CURRENT_USER_SAFETY_2026_06_04.md',
        'qa/OPERATOR_MANUALS_SAFETY_2026_06_03.md',
        'qa/TRAINING_SAFETY_2026_06_03.md',
        'qa/PROOF_INITIALIZATION_SAFETY_2026_06_03.md',
        'qa/OFFLINE_RELEASE_BUILDER_SELFTEST_2026_06_03.md',
        'qa/OFFLINE_RELEASE_GUARD_2026_06_03.md',
        'qa/PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md',
        'qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md',
        'qa/PRODUCTION_READY_GATE_VALIDATOR_2026_06_04.md',
        'qa/PRODUCTION_READY_GATE_HANDOFF_2026_06_04.md',
        'qa/PRODUCTION_READY_GATE_HANDOFF_RESULT_2026_06_04.md',
        'qa/PREFLIGHT_WITH_CONCURRENCY_2026_06_03.md',
        'scripts/validate_dependency_manifest.ps1',
        'scripts/validate_lan_loadtest_safety.ps1',
        'scripts/validate_first_level_support_safety.ps1',
        'scripts/validate_production_ready_gate_safety.ps1',
        'scripts/validate_final_field_blockers_safety.ps1',
        'scripts/validate_backup_startup_current_user_safety.ps1',
        'scripts/validate_production_license_salt_guard.ps1'
    )

    foreach ($evidence in $requiredEvidence) {
        Assert-Content ([regex]::Escape($evidence)) "Falta evidencia requerida en la matriz: $evidence."
        $evidencePath = Join-Path $ProjectRoot $evidence
        if (-not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
            Add-Failure "La evidencia referenciada no existe: $evidence."
        }
    }

    $requiredBlockers = @(
        'qa/LAN_CLIENT_VALIDATION_PROOF.md',
        'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
        'SistemaCajaHospitalaria-BackupWorker',
        'SistemaCajaHospitalaria-DailyBackup',
        'APP_ENV=production',
        'APP_DEBUG=false',
        'offline-release',
        'dependency manifest',
        'InitializeProofFiles',
        'bypass flags',
        'TRAINING_ACCEPTANCE_PROOF.md',
        'final backup worker smoke',
        'final restore/concurrency evidence',
        'preflight'
    )

    foreach ($blocker in $requiredBlockers) {
        Assert-Content ([regex]::Escape($blocker)) "Falta bloqueante requerido en la auditoria: $blocker."
    }

    if ((Test-PhysicalProofLooksComplete "qa\LAN_CLIENT_VALIDATION_PROOF.md") -and
        (Test-PhysicalProofLooksComplete "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md") -and
        $content -match 'PENDING_FINAL_FIELD') {
        Add-Failure "La auditoria todavia marca PENDING_FINAL_FIELD aunque la prueba LAN e impresora parecen completas; actualice el estado con preflight final."
    }
}

if ($failures.Count -gt 0) {
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "OPERATIONS_OBJECTIVE_AUDIT: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] OPERATIONS_OBJECTIVE_AUDIT: YES" -ForegroundColor Green
Write-Host "[OK] Objective requirements are traced to evidence and final-field blockers remain explicit." -ForegroundColor Green
