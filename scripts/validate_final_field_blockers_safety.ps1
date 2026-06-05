param(
    [string] $ProjectRoot = "",
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

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Test-ContainsAllTerms([string] $content, [string[]] $terms) {
    foreach ($term in $terms) {
        if ($content -notmatch [regex]::Escape($term)) {
            return $false
        }
    }

    return $true
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required final-field proof file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-ContainsTerms([string] $label, [string] $content, [string[]] $terms) {
    foreach ($term in $terms) {
        if ($content -notmatch [regex]::Escape($term)) {
            Add-Failure "$label must mention '$term'."
        }
    }
}

function Assert-PendingProof([string] $label, [string] $content, [string[]] $requiredTerms) {
    if ($content -notmatch '(?i)PENDING|pendiente|Falta') {
        Add-Failure "$label must remain explicitly pending until real field evidence exists."
    } else {
        Add-Pass "$label remains explicitly pending"
    }

    Assert-ContainsTerms $label $content $requiredTerms
    Assert-ContainsTerms $label $content @(
        "PRODUCTION_CANDIDATE",
        "PRODUCTION_READY"
    )
}

function Assert-LocalProofScope([string] $label, [string] $content, [string[]] $localMarkers) {
    Assert-ContainsTerms $label $content $localMarkers

    if ($content -match '(?im)^\s*-\s*Decision\s*:\s*`?PRODUCTION_READY`?') {
        Add-Failure "$label must not declare PRODUCTION_READY."
    } else {
        Add-Pass "$label does not declare PRODUCTION_READY"
    }
}

if ($SelfTest) {
    $printerCompletePending = @"
Estado actual: PENDING_HARDWARE_VALIDATION.
Falta imprimir recibo media carta.
Falta imprimir recibo carta.
Falta imprimir recibo A5.
Falta validar reimpresion.
Falta confirmar escala 100%, margenes minimos y encabezados/pies.
Debe quedar PRODUCTION_CANDIDATE, no PRODUCTION_READY.
"@
    $printerMissingPageSize = $printerCompletePending -replace "Falta imprimir recibo A5.`r?`n", ""

    if (Test-ContainsAllTerms $printerCompletePending @("media carta", "carta", "A5")) {
        Add-Pass "SelfTest accepts printer proof that preserves all required institutional paper blockers"
    } else {
        Add-Failure "SelfTest failed to accept a complete pending printer blocker list."
    }

    if (Test-ContainsAllTerms $printerMissingPageSize @("media carta", "carta", "A5")) {
        Add-Failure "SelfTest failed to reject printer proof missing A5 blocker."
    } else {
        Add-Pass "SelfTest rejects printer proof missing required institutional paper blockers"
    }

    if ($failures.Count -gt 0) {
        Write-Host ""
        Write-Host "FINAL_FIELD_BLOCKERS_SAFETY_SELFTEST: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "FINAL_FIELD_BLOCKERS_SAFETY_SELFTEST: YES" -ForegroundColor Green
    return
}

$lanProof = Read-RequiredFile "qa\LAN_CLIENT_VALIDATION_PROOF.md"
$printerProof = Read-RequiredFile "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
$backupTaskProof = Read-RequiredFile "qa\FINAL_BACKUP_TASK_PROOF.md"
$restoreProof = Read-RequiredFile "qa\FINAL_RESTORE_PROOF.md"
$concurrencyProof = Read-RequiredFile "qa\FINAL_CONCURRENCY_PROOF.md"

Assert-PendingProof "LAN client proof" $lanProof @(
    "segunda computadora",
    "PC cliente",
    "IP fija",
    "login",
    "caja",
    "factura",
    "pago",
    "recibo",
    "historial",
    "reportes",
    "backup"
)

Assert-PendingProof "Institutional receipt print proof" $printerProof @(
    "media carta",
    "carta",
    "A5",
    "reimpresion",
    "escala 100%",
    "margenes",
    "encabezados"
)

Assert-PendingProof "Final backup task proof" $backupTaskProof @(
    "SistemaCajaHospitalaria-BackupWorker",
    "SistemaCajaHospitalaria-DailyBackup",
    "worker",
    "UI administrativa",
    "pending",
    "success",
    "PRODUCTION_CANDIDATE"
)

Assert-LocalProofScope "Final restore proof" $restoreProof @(
    "Docker/MariaDB development",
    "Final-server restore validation",
    "installed hospital PC"
)

Assert-LocalProofScope "Final concurrency proof" $concurrencyProof @(
    "http://127.0.0.1:8000",
    "Target environment: local",
    "local Docker/MariaDB"
)

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "FINAL_FIELD_BLOCKERS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "FINAL_FIELD_BLOCKERS_SAFETY: YES" -ForegroundColor Green
