param(
    [string] $ProjectRoot = "",
    [string] $ReleaseRoot = "",
    [switch] $RequireCurrentCommit,
    [switch] $SelfTest
)

$ErrorActionPreference = "Stop"

$script:OfflineReleaseCriticalDocs = @(
    "docs\00_README.md",
    "docs\RELEASE_CHECKLIST.md",
    "docs\manuales\GUIA_INSTALACION_OPERATIVA.md",
    "docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md",
    "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md",
    "docs\manuales\MANUAL_ADMINISTRADOR.md",
    "docs\manuales\MANUAL_CAJERO.md",
    "docs\manuales\MANUAL_SUPERVISOR.md",
    "docs\manuales\MANUAL_USUARIO_AREA.md"
)

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ($ReleaseRoot -eq "") {
    $ReleaseRoot = Join-Path $ProjectRoot "offline-release"
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-ReleaseText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    foreach ($path in @($ProjectRoot, $ReleaseRoot)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $protected = $protected -replace [regex]::Escape($path), "%PROJECT_ROOT%"
            $protected = $protected -replace [regex]::Escape(($path -replace "\\", "/")), "%PROJECT_ROOT%"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-ReleaseText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-ReleaseText $message)" -ForegroundColor Green
}

function Test-RequiredPath([string] $relativePath, [string] $kind) {
    $path = Join-Path $ReleaseRoot $relativePath
    if ($kind -eq "dir") {
        if (Test-Path -LiteralPath $path -PathType Container) {
            Add-Pass "Found $relativePath"
        } else {
            Add-Failure "Missing required release directory: $relativePath"
        }
        return
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
    } else {
        Add-Failure "Missing required release file: $relativePath"
    }
}

function Get-RelativeReleasePath([System.IO.FileSystemInfo] $item) {
    $root = [System.IO.Path]::GetFullPath($ReleaseRoot).TrimEnd("\") + "\"
    $full = [System.IO.Path]::GetFullPath($item.FullName)
    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $full.Substring($root.Length) -replace "\\", "/"
    }

    return $item.FullName -replace "\\", "/"
}

function Test-IsForbiddenEnvFile([string] $name) {
    if ($name -notmatch '(?i)^\.env(\.|$)') {
        return $false
    }

    return $name -notmatch '(?i)(^\.env\.example$|^\.env\..*\.example$|^\.env\.sample$|^\.env\.dist$)'
}

function Test-ReleaseFileMatchesSource([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $release = Join-Path $ReleaseRoot $relativePath

    if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or
        -not (Test-Path -LiteralPath $release -PathType Leaf)) {
        return
    }

    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $releaseHash = (Get-FileHash -LiteralPath $release -Algorithm SHA256).Hash

    if ($sourceHash -eq $releaseHash) {
        Add-Pass "$relativePath matches versioned source"
    } else {
        Add-Failure "$relativePath in offline release differs from versioned source. Regenerate offline-release before handoff."
    }
}

function Test-ReleaseSetupLauncher() {
    $source = Join-Path $ProjectRoot "scripts\release_setup.bat"
    $release = Join-Path $ReleaseRoot "setup.bat"

    if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or
        -not (Test-Path -LiteralPath $release -PathType Leaf)) {
        return
    }

    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $releaseHash = (Get-FileHash -LiteralPath $release -Algorithm SHA256).Hash

    if ($sourceHash -eq $releaseHash) {
        Add-Pass "setup.bat matches scripts\release_setup.bat"
    } else {
        Add-Failure "setup.bat in offline release differs from scripts\release_setup.bat. Regenerate offline-release before handoff."
    }

    $content = Get-Content -LiteralPath $release -Raw
    if ($content -notmatch 'cd /d "%~dp0"') {
        Add-Failure "setup.bat must switch to its own folder before launching the installer."
    } else {
        Add-Pass "setup.bat runs from its own folder"
    }

    if ($content -notmatch "powershell\s+-NoProfile\s+-ExecutionPolicy\s+Bypass") {
        Add-Failure "setup.bat must launch PowerShell with -NoProfile."
    } else {
        Add-Pass "setup.bat launches PowerShell with -NoProfile"
    }

    if ($content -notmatch "scripts\\deploy_hospital_lan\.ps1") {
        Add-Failure "setup.bat must delegate to scripts\deploy_hospital_lan.ps1."
    } else {
        Add-Pass "setup.bat delegates to supported LAN installer"
    }

    if ($content -match "install_hospital_os\.ps1") {
        Add-Failure "setup.bat must not invoke the deprecated installer."
    } else {
        Add-Pass "setup.bat does not invoke deprecated installer"
    }

    if ($content -match ('Billing' + '\s+' + 'OS') -or $content -match '(?i)\bdemo\b|demostracion') {
        Add-Failure "setup.bat must use institutional production wording, not legacy/demo wording."
    } else {
        Add-Pass "setup.bat avoids legacy/demo wording"
    }

    if ($content -notmatch "Sistema de Caja Hospitalaria") {
        Add-Failure "setup.bat must use institutional system wording."
    } else {
        Add-Pass "setup.bat uses institutional wording"
    }
}

function Test-IsAllowedProofTemplate([string] $relativePath) {
    $normalized = $relativePath -replace "\\", "/"

    foreach ($templateName in @(
        "LAN_CLIENT_VALIDATION_PROOF.example.md",
        "INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md",
        "FINAL_STARTUP_TASK_PROOF.example.md",
        "FINAL_RESTORE_PROOF.example.md",
        "FINAL_BACKUP_TASK_PROOF.example.md",
        "FINAL_CONCURRENCY_PROOF.example.md",
        "TRAINING_ACCEPTANCE_PROOF.example.md"
    )) {
        if ($normalized -eq "qa/$templateName") {
            return $true
        }
    }

    return $false
}

function Test-IsForbiddenReleaseArtifactName([string] $relativePath) {
    $normalized = $relativePath -replace "\\", "/"
    $forbiddenNamePatterns = @(
        ('Bill' + 'ing_OS'),
        ('Hospital_Bill' + 'ing_OS'),
        ('Bill' + 'ing OS'),
        'THERMAL_PRINTER_PROOF',
        'receipt-preview-80mm',
        'receipt-preview-58mm',
        'thermal-printer',
        'thermal_printer',
        'impresora-termica',
        'impresora_termica',
        'recibo-termico',
        'recibo_termico'
    )

    foreach ($pattern in $forbiddenNamePatterns) {
        if ($normalized -match [regex]::Escape($pattern)) {
            return $true
        }
    }

    return $false
}

if ($SelfTest) {
    $allowedTemplates = @(
        "qa\LAN_CLIENT_VALIDATION_PROOF.example.md",
        "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md",
        "qa\FINAL_STARTUP_TASK_PROOF.example.md",
        "qa\FINAL_RESTORE_PROOF.example.md",
        "qa\FINAL_BACKUP_TASK_PROOF.example.md",
        "qa\FINAL_CONCURRENCY_PROOF.example.md",
        "qa\TRAINING_ACCEPTANCE_PROOF.example.md"
    )

    foreach ($relativePath in $allowedTemplates) {
        if (-not (Test-IsAllowedProofTemplate $relativePath)) {
            Write-Host "[FAIL] SelfTest FAILED: expected allowed proof template $relativePath." -ForegroundColor Red
            exit 1
        }
    }

    $forbiddenQaPaths = @(
        "qa\FINAL_STARTUP_TASK_PROOF.md",
        "qa\FINAL_RESTORE_PROOF.md",
        "qa\FINAL_BACKUP_TASK_PROOF.md",
        "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "qa\support-packets\MANIFIESTO.md",
        "qa\random.example.md",
        "qa\browser-smoke-2026-06-03\rc-e2e-mocked-report.json"
    )

    foreach ($relativePath in $forbiddenQaPaths) {
        if (Test-IsAllowedProofTemplate $relativePath) {
            Write-Host "[FAIL] SelfTest FAILED: expected forbidden QA path $relativePath." -ForegroundColor Red
            exit 1
        }
    }

    foreach ($relativePath in @(
        ("docs/00_Flujo_Agentic_Codex_Hospital_" + "Bill" + "ing_OS.docx"),
        "qa/screenshots/full-qa/25-receipt-preview-58mm.png",
        "qa/THERMAL_PRINTER_PROOF.example.md"
    )) {
        if (-not (Test-IsForbiddenReleaseArtifactName $relativePath)) {
            Write-Host "[FAIL] SelfTest FAILED: expected forbidden artifact name $relativePath." -ForegroundColor Red
            exit 1
        }
    }

    foreach ($relativePath in @(
        "docs/00_Flujo_Agentic_Codex_Sistema_Caja_Hospitalaria.docx",
        "qa/screenshots/full-qa/25-receipt-preview-institutional.png",
        "qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md"
    )) {
        if (Test-IsForbiddenReleaseArtifactName $relativePath) {
            Write-Host "[FAIL] SelfTest FAILED: expected allowed artifact name $relativePath." -ForegroundColor Red
            exit 1
        }
    }

    foreach ($relativePath in @("docs/superpowers/plans/old.md", "docs/documento_interno.docx")) {
        $isForbiddenReleaseDoc = $relativePath -match '(^|/)docs/superpowers(/|$)' -or
            $relativePath -match '(^|/)docs/[^/]+\.docx$'
        if (-not $isForbiddenReleaseDoc) {
            Write-Host "[FAIL] SelfTest FAILED: expected forbidden release doc $relativePath." -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "[OK] SelfTest passed. Only final-field qa/*.example.md templates are allowed in offline release." -ForegroundColor Green
    return
}

try {
    $ReleaseRoot = (Resolve-Path -LiteralPath $ReleaseRoot).Path
} catch {
    Add-Failure "Offline release directory does not exist: $ReleaseRoot"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OFFLINE_RELEASE_CLEAN: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host "Checking offline release: $(Protect-ReleaseText $ReleaseRoot)"

Test-RequiredPath "setup.bat" "file"
Test-RequiredPath "docker-compose.prod.yml" "file"
Test-RequiredPath "backend\Dockerfile.prod" "file"
Test-RequiredPath "nginx\default.conf" "file"
Test-RequiredPath "nginx\hospital-common.conf" "file"
Test-RequiredPath "MANIFEST.txt" "file"
Test-RequiredPath "checksums.sha256" "file"
Test-RequiredPath "offline-images" "dir"
Test-RequiredPath "scripts\assert_offline_release_clean.ps1" "file"
Test-RequiredPath "scripts\deploy_hospital_lan.ps1" "file"
Test-RequiredPath "scripts\init_production_proofs.ps1" "file"
Test-RequiredPath "scripts\load_offline_images.ps1" "file"
Test-RequiredPath "scripts\make_offline_release.ps1" "file"
Test-RequiredPath "scripts\production_readiness_preflight.ps1" "file"
Test-RequiredPath "scripts\final_production_handoff.ps1" "file"
Test-RequiredPath "scripts\install_hospital_startup_shortcut.ps1" "file"
Test-RequiredPath "scripts\install_stack_autostart_windows.ps1" "file"
Test-RequiredPath "scripts\install_backup_startup_current_user.ps1" "file"
Test-RequiredPath "scripts\install_backup_tasks_windows.ps1" "file"
Test-RequiredPath "scripts\restore_hospital_windows.ps1" "file"
Test-RequiredPath "scripts\validate_support_packet_safety.ps1" "file"
Test-RequiredPath "scripts\validate_browser_smoke_evidence.ps1" "file"
Test-RequiredPath "scripts\validate_dependency_manifest.ps1" "file"
Test-RequiredPath "scripts\validate_startup_repair_safety.ps1" "file"
Test-RequiredPath "scripts\validate_operator_manuals_safety.ps1" "file"
Test-RequiredPath "scripts\validate_backup_restore_docs_safety.ps1" "file"
Test-RequiredPath "scripts\validate_backup_startup_current_user_safety.ps1" "file"
Test-RequiredPath "scripts\validate_installation_docs_safety.ps1" "file"
Test-RequiredPath "scripts\validate_help_screen_safety.ps1" "file"
Test-RequiredPath "scripts\validate_system_diagnostics_safety.ps1" "file"
Test-RequiredPath "scripts\validate_known_limitations_safety.ps1" "file"
Test-RequiredPath "scripts\validate_ops_evidence_index.ps1" "file"
Test-RequiredPath "scripts\validate_final_startup_task_proof.ps1" "file"
Test-RequiredPath "scripts\validate_final_backup_task_proof.ps1" "file"
Test-RequiredPath "scripts\validate_training_acceptance_proof.ps1" "file"
Test-RequiredPath "scripts\validate_training_safety.ps1" "file"
Test-RequiredPath "scripts\validate_double_action_safety.ps1" "file"
Test-RequiredPath "scripts\validate_installer_legacy_safety.ps1" "file"
Test-RequiredPath "scripts\validate_lan_client.ps1" "file"
Test-RequiredPath "scripts\validate_lan_client_proof.ps1" "file"
Test-RequiredPath "scripts\validate_lan_loadtest_safety.ps1" "file"
Test-RequiredPath "scripts\validate_lan_recovery_safety.ps1" "file"
Test-RequiredPath "scripts\validate_institutional_receipt_print_proof.ps1" "file"
Test-RequiredPath "scripts\validate_maintenance_mode_safety.ps1" "file"
Test-RequiredPath "scripts\validate_new_invoice_maintainability.ps1" "file"
Test-RequiredPath "scripts\validate_shift_incident_recovery_safety.ps1" "file"
Test-RequiredPath "scripts\validate_final_handoff_completeness.ps1" "file"
Test-RequiredPath "scripts\validate_handoff_guard_coverage.ps1" "file"
Test-RequiredPath "scripts\validate_offline_release_staging_safety.ps1" "file"
Test-RequiredPath "scripts\validate_operations_objective_audit.ps1" "file"
Test-RequiredPath "scripts\validate_permission_audit_safety.ps1" "file"
Test-RequiredPath "scripts\validate_rate_limit_safety.ps1" "file"
Test-RequiredPath "scripts\validate_realtime_own_event_safety.ps1" "file"
Test-RequiredPath "scripts\validate_restore_windows_safety.ps1" "file"
Test-RequiredPath "scripts\validate_production_ready_gate_safety.ps1" "file"
Test-RequiredPath "scripts\validate_production_license_salt_guard.ps1" "file"
Test-RequiredPath "scripts\validate_field_proof_templates.ps1" "file"
Test-RequiredPath "scripts\validate_final_field_blockers_safety.ps1" "file"
Test-RequiredPath "scripts\validate_proof_initialization_safety.ps1" "file"
Test-RequiredPath "scripts\validate_first_level_support_safety.ps1" "file"
Test-RequiredPath "scripts\run_backup_worker.cmd" "file"
Test-RequiredPath "scripts\run_scheduled_backup.cmd" "file"
Test-RequiredPath "scripts\run_backup_scheduler_loop.ps1" "file"
Test-RequiredPath "scripts\start_backup_automation.cmd" "file"
Test-RequiredPath "qa\LAN_CLIENT_VALIDATION_PROOF.example.md" "file"
Test-RequiredPath "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md" "file"
Test-RequiredPath "qa\FINAL_STARTUP_TASK_PROOF.example.md" "file"
Test-RequiredPath "qa\FINAL_RESTORE_PROOF.example.md" "file"
Test-RequiredPath "qa\FINAL_BACKUP_TASK_PROOF.example.md" "file"
Test-RequiredPath "qa\FINAL_CONCURRENCY_PROOF.example.md" "file"
Test-RequiredPath "qa\TRAINING_ACCEPTANCE_PROOF.example.md" "file"
foreach ($criticalDoc in $script:OfflineReleaseCriticalDocs) {
    Test-RequiredPath $criticalDoc "file"
}

Test-ReleaseFileMatchesSource "docker-compose.prod.yml"
Test-ReleaseFileMatchesSource "backend\Dockerfile.prod"
Test-ReleaseFileMatchesSource "nginx\default.conf"
Test-ReleaseFileMatchesSource "nginx\hospital-common.conf"
Test-ReleaseFileMatchesSource "scripts\assert_offline_release_clean.ps1"
Test-ReleaseFileMatchesSource "scripts\collect_support_packet.ps1"
Test-ReleaseFileMatchesSource "scripts\deploy_hospital_lan.ps1"
Test-ReleaseFileMatchesSource "scripts\init_production_proofs.ps1"
Test-ReleaseFileMatchesSource "scripts\make_offline_release.ps1"
Test-ReleaseFileMatchesSource "scripts\production_readiness_preflight.ps1"
Test-ReleaseFileMatchesSource "scripts\final_production_handoff.ps1"
Test-ReleaseFileMatchesSource "scripts\install_hospital_startup_shortcut.ps1"
Test-ReleaseFileMatchesSource "scripts\install_stack_autostart_windows.ps1"
Test-ReleaseFileMatchesSource "scripts\install_backup_startup_current_user.ps1"
Test-ReleaseFileMatchesSource "scripts\install_backup_tasks_windows.ps1"
Test-ReleaseFileMatchesSource "scripts\lib\operational_url_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\open_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\repair_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\restore_hospital_windows.ps1"
Test-ReleaseFileMatchesSource "scripts\run_backup_scheduler_loop.ps1"
Test-ReleaseFileMatchesSource "scripts\start_hospital_services.ps1"
Test-ReleaseFileMatchesSource "scripts\start_backup_automation.cmd"
Test-ReleaseFileMatchesSource "scripts\validate_support_packet_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_browser_smoke_evidence.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_dependency_manifest.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_startup_repair_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_operator_manuals_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_backup_restore_docs_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_backup_startup_current_user_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_installation_docs_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_help_screen_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_system_diagnostics_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_ops_evidence_index.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_final_startup_task_proof.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_final_backup_task_proof.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_training_acceptance_proof.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_training_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_double_action_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_installer_legacy_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_lan_client.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_lan_client_proof.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_lan_loadtest_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_lan_recovery_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_institutional_receipt_print_proof.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_maintenance_mode_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_new_invoice_maintainability.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_known_limitations_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_shift_incident_recovery_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_final_handoff_completeness.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_handoff_guard_coverage.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_offline_release_staging_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_operations_objective_audit.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_permission_audit_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_rate_limit_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_realtime_own_event_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_restore_windows_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_production_ready_gate_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_production_license_salt_guard.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_field_proof_templates.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_final_field_blockers_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_proof_initialization_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_first_level_support_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\run_backup_worker.cmd"
Test-ReleaseFileMatchesSource "scripts\run_scheduled_backup.cmd"
Test-ReleaseSetupLauncher
Test-ReleaseFileMatchesSource "qa\LAN_CLIENT_VALIDATION_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\FINAL_STARTUP_TASK_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\FINAL_RESTORE_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\FINAL_BACKUP_TASK_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\FINAL_CONCURRENCY_PROOF.example.md"
Test-ReleaseFileMatchesSource "qa\TRAINING_ACCEPTANCE_PROOF.example.md"
foreach ($criticalDoc in $script:OfflineReleaseCriticalDocs) {
    Test-ReleaseFileMatchesSource $criticalDoc
}

$forbiddenItems = Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -Force | Where-Object {
    $relative = Get-RelativeReleasePath $_
    $name = $_.Name

    if ($_.PSIsContainer) {
        return (Test-IsForbiddenReleaseArtifactName $relative) -or
            $relative -match '(^|/)(node_modules|install-logs|playwright-report|test-results|\.git)(/|$)' -or
            $relative -match '(^|/)docs/superpowers(/|$)' -or
            $relative -match '(^|/)storage/(app/private/backups|logs)(/|$)'
    }

    return (Test-IsForbiddenReleaseArtifactName $relative) -or
        (Test-IsForbiddenEnvFile $name) -or
        $relative -match '(^|/)docs/[^/]+\.docx$' -or
        $relative -match '(^|/)(install-logs|test-results|playwright-report)/' -or
        ($relative -match '(^|/)qa/' -and -not (Test-IsAllowedProofTemplate $relative)) -or
        $relative -match '(^|/)storage/(app/private/backups|logs)/' -or
        $relative -match '\.(sql|sql\.gz|dump|bak|log|sqlite|sqlite3|db)$'
}

foreach ($item in $forbiddenItems) {
    Add-Failure "Forbidden file or directory in offline release: $(Get-RelativeReleasePath $item)"
}

$releaseDocsRoot = Join-Path $ReleaseRoot "docs"
if (Test-Path -LiteralPath $releaseDocsRoot -PathType Container) {
    $forbiddenReleaseDocPattern = '(?i)Billing\s+OS|thermal printer|impresora termica|impresora térmica|recibo termico|recibo térmico|\b80mm\b|\b58mm\b|demo premium|demo vendible|phase-12c-catalog-barcode|barcode_qr_reference'
    Get-ChildItem -LiteralPath $releaseDocsRoot -Recurse -File |
        Where-Object { $_.Extension -match '^\.(md|html|txt)$' } |
        ForEach-Object {
            $content = Get-Content -LiteralPath $_.FullName -Raw
            if ($content -match $forbiddenReleaseDocPattern) {
                Add-Failure "Release documentation contains legacy product wording: $(Get-RelativeReleasePath $_)"
            }
            if ($content -match '[\x00-\x08\x0B\x0C\x0E-\x1F]') {
                Add-Failure "Release documentation contains control characters: $(Get-RelativeReleasePath $_)"
            }
        }
}

$manifestPath = Join-Path $ReleaseRoot "MANIFEST.txt"
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $stalePattern = '(?i)(deben regenerarse|must regenerate|regenerate before|cambios locales|stale|preparacion RC|NOTA RC)'
    if ($manifest -match $stalePattern) {
        Add-Failure "MANIFEST.txt contains stale or candidate-only release wording."
    } else {
        Add-Pass "MANIFEST.txt has no stale release wording"
    }

    if ($RequireCurrentCommit) {
        $head = (& git -C $ProjectRoot rev-parse HEAD 2>$null).Trim()
        $shortHead = (& git -C $ProjectRoot rev-parse --short HEAD 2>$null).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
            Add-Failure "Cannot determine current Git commit for manifest validation."
        } elseif ($manifest -match [regex]::Escape($head) -or $manifest -match [regex]::Escape($shortHead)) {
            Add-Pass "MANIFEST.txt references current commit $shortHead"
        } else {
            Add-Failure "MANIFEST.txt must reference current commit $shortHead before release handoff."
        }
    }
}

$imagesDir = Join-Path $ReleaseRoot "offline-images"
if (Test-Path -LiteralPath $imagesDir -PathType Container) {
    $imageFiles = @(Get-ChildItem -LiteralPath $imagesDir -Filter "*.tar" -File)
    if ($imageFiles.Count -eq 0) {
        Add-Failure "offline-images contains no Docker image tar files."
    } else {
        Add-Pass "offline-images contains $($imageFiles.Count) Docker image tar file(s)"
    }

    $checksumPath = Join-Path $ReleaseRoot "checksums.sha256"
    $checksumContent = if (Test-Path -LiteralPath $checksumPath -PathType Leaf) {
        Get-Content -LiteralPath $checksumPath -Raw
    } else {
        ""
    }

    foreach ($image in $imageFiles) {
        $relative = "offline-images/$($image.Name)"
        $sidecar = "$($image.FullName).sha256"
        $actualHash = (Get-FileHash -LiteralPath $image.FullName -Algorithm SHA256).Hash

        if (-not (Test-Path -LiteralPath $sidecar -PathType Leaf)) {
            Add-Failure "Missing checksum sidecar for $relative"
        } else {
            $sidecarHash = (Get-Content -LiteralPath $sidecar -Raw).Trim().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)[0]
            if ($sidecarHash -ne $actualHash) {
                Add-Failure "Checksum sidecar does not match $relative"
            }
        }

        $checksumPattern = "(?im)^\s*$([regex]::Escape($actualHash))\s+$([regex]::Escape($relative))\s*$"
        if ($checksumContent -notmatch $checksumPattern) {
            Add-Failure "checksums.sha256 does not match $relative"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OFFLINE_RELEASE_CLEAN: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OFFLINE_RELEASE_CLEAN: YES" -ForegroundColor Green
