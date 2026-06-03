param(
    [string] $ProjectRoot = "",
    [string] $ReleaseRoot = "",
    [switch] $RequireCurrentCommit
)

$ErrorActionPreference = "Stop"

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
Test-RequiredPath "MANIFEST.txt" "file"
Test-RequiredPath "checksums.sha256" "file"
Test-RequiredPath "offline-images" "dir"
Test-RequiredPath "scripts\deploy_hospital_lan.ps1" "file"
Test-RequiredPath "scripts\load_offline_images.ps1" "file"
Test-RequiredPath "scripts\production_readiness_preflight.ps1" "file"
Test-RequiredPath "scripts\final_production_handoff.ps1" "file"
Test-RequiredPath "scripts\install_hospital_startup_shortcut.ps1" "file"
Test-RequiredPath "scripts\install_backup_tasks_windows.ps1" "file"
Test-RequiredPath "scripts\validate_support_packet_safety.ps1" "file"
Test-RequiredPath "scripts\validate_browser_smoke_evidence.ps1" "file"
Test-RequiredPath "scripts\validate_startup_repair_safety.ps1" "file"
Test-RequiredPath "scripts\validate_operator_manuals_safety.ps1" "file"
Test-RequiredPath "scripts\validate_backup_restore_docs_safety.ps1" "file"
Test-RequiredPath "scripts\validate_installation_docs_safety.ps1" "file"
Test-RequiredPath "scripts\validate_help_screen_safety.ps1" "file"
Test-RequiredPath "scripts\validate_system_diagnostics_safety.ps1" "file"
Test-RequiredPath "scripts\validate_ops_evidence_index.ps1" "file"
Test-RequiredPath "scripts\validate_training_safety.ps1" "file"
Test-RequiredPath "scripts\validate_double_action_safety.ps1" "file"
Test-RequiredPath "scripts\validate_installer_legacy_safety.ps1" "file"
Test-RequiredPath "scripts\validate_lan_recovery_safety.ps1" "file"
Test-RequiredPath "scripts\validate_shift_incident_recovery_safety.ps1" "file"
Test-RequiredPath "scripts\validate_final_handoff_completeness.ps1" "file"
Test-RequiredPath "scripts\validate_operations_objective_audit.ps1" "file"
Test-RequiredPath "scripts\validate_field_proof_templates.ps1" "file"
Test-RequiredPath "scripts\run_backup_worker.cmd" "file"
Test-RequiredPath "scripts\run_scheduled_backup.cmd" "file"

Test-ReleaseFileMatchesSource "docker-compose.prod.yml"
Test-ReleaseFileMatchesSource "backend\Dockerfile.prod"
Test-ReleaseFileMatchesSource "nginx\default.conf"
Test-ReleaseFileMatchesSource "scripts\collect_support_packet.ps1"
Test-ReleaseFileMatchesSource "scripts\deploy_hospital_lan.ps1"
Test-ReleaseFileMatchesSource "scripts\production_readiness_preflight.ps1"
Test-ReleaseFileMatchesSource "scripts\final_production_handoff.ps1"
Test-ReleaseFileMatchesSource "scripts\install_hospital_startup_shortcut.ps1"
Test-ReleaseFileMatchesSource "scripts\install_backup_tasks_windows.ps1"
Test-ReleaseFileMatchesSource "scripts\lib\operational_url_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\open_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\repair_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\start_hospital_services.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_support_packet_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_browser_smoke_evidence.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_startup_repair_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_operator_manuals_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_backup_restore_docs_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_installation_docs_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_help_screen_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_system_diagnostics_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_ops_evidence_index.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_training_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_double_action_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_installer_legacy_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_lan_recovery_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_shift_incident_recovery_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_final_handoff_completeness.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_operations_objective_audit.ps1"
Test-ReleaseFileMatchesSource "scripts\validate_field_proof_templates.ps1"
Test-ReleaseFileMatchesSource "scripts\run_backup_worker.cmd"
Test-ReleaseFileMatchesSource "scripts\run_scheduled_backup.cmd"

$forbiddenItems = Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -Force | Where-Object {
    $relative = Get-RelativeReleasePath $_
    $name = $_.Name

    if ($_.PSIsContainer) {
        return $relative -match '(^|/)(node_modules|install-logs|playwright-report|test-results|\.git|qa)(/|$)' -or
            $relative -match '(^|/)storage/(app/private/backups|logs)(/|$)'
    }

    return (Test-IsForbiddenEnvFile $name) -or
        $relative -match '(^|/)(install-logs|qa|test-results|playwright-report)/' -or
        $relative -match '(^|/)storage/(app/private/backups|logs)/' -or
        $relative -match '\.(sql|sql\.gz|dump|bak|log|sqlite|sqlite3|db)$'
}

foreach ($item in $forbiddenItems) {
    Add-Failure "Forbidden file or directory in offline release: $(Get-RelativeReleasePath $item)"
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
