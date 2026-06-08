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

function Assert-FieldBlockersIndex([string] $content) {
    Assert-ContainsTerms "Final field blockers index" $content @(
        "PRODUCTION_CANDIDATE",
        "PRODUCTION_READY",
        "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md",
        "qa\FINAL_STARTUP_TASK_PROOF.md",
        "qa\FINAL_BACKUP_TASK_PROOF.md",
        "qa\FINAL_RESTORE_PROOF.md",
        "qa\FINAL_CONCURRENCY_PROOF.md",
        "qa\TRAINING_ACCEPTANCE_PROOF.md",
        "segunda computadora",
        "media carta",
        "carta",
        "A5",
        "SistemaCajaHospitalaria-StackAutostart",
        "AtStartup",
        "SistemaCajaHospitalaria-BackupWorker",
        "SistemaCajaHospitalaria-DailyBackup",
        "base descartable",
        "ambiente aislado",
        "usuario de area",
        "sin QR",
        "barcode",
        "-AllowMissingPhysicalProof",
        "-AllowPendingFinalField",
        "-SkipPreflight"
    )

    if ($content -match '(?im)^Estado actual:\s*`?PRODUCTION_READY`?') {
        Add-Failure "Final field blockers index must not declare PRODUCTION_READY while field evidence is pending."
    } else {
        Add-Pass "Final field blockers index keeps candidate status"
    }
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
    $backupCompletePending = @"
Decision: PENDING_FINAL_FIELD.
Falta instalar SistemaCajaHospitalaria-BackupWorker.
Falta instalar SistemaCajaHospitalaria-DailyBackup.
Falta observar la tarea continua de respaldos.
Falta crear respaldo desde la UI administrativa.
Falta confirmar Pendiente a Protegido.
Debe quedar PRODUCTION_CANDIDATE, no PRODUCTION_READY.
"@
    $backupLegacyStatus = @"
Decision: PENDING_FINAL_FIELD.
Falta instalar SistemaCajaHospitalaria-BackupWorker.
Falta instalar SistemaCajaHospitalaria-DailyBackup.
Falta observar worker.
Falta crear backup desde la UI administrativa.
Falta confirmar estado tecnico obsoleto.
Debe quedar PRODUCTION_CANDIDATE, no PRODUCTION_READY.
"@
    $trainingCompletePending = @"
Decision: PENDING_FINAL_FIELD.
Falta completar capacitacion supervisada del rol cajero.
Falta completar capacitacion supervisada del rol supervisor.
Falta completar capacitacion supervisada del rol administrador.
Falta completar capacitacion supervisada del rol usuario de area.
Falta confirmar que la capacitacion no uso datos reales de pacientes ni la base de produccion.
Debe quedar PRODUCTION_CANDIDATE, no PRODUCTION_READY.
"@
    $trainingMissingAreaRole = @"
Decision: PENDING_FINAL_FIELD.
Falta completar capacitacion supervisada del rol cajero.
Falta completar capacitacion supervisada del rol supervisor.
Falta completar capacitacion supervisada del rol administrador.
Falta confirmar que la capacitacion no uso datos reales de pacientes ni la base de produccion.
Debe quedar PRODUCTION_CANDIDATE, no PRODUCTION_READY.
"@

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

    if (Test-ContainsAllTerms $backupCompletePending @("tarea continua de respaldos", "respaldo", "Pendiente", "Protegido")) {
        Add-Pass "SelfTest accepts final backup proof that preserves visible backup-state blockers"
    } else {
        Add-Failure "SelfTest failed to accept current backup blocker wording."
    }

    if (Test-ContainsAllTerms $backupLegacyStatus @("tarea continua de respaldos", "respaldo", "Pendiente", "Protegido")) {
        Add-Failure "SelfTest failed to reject legacy backup worker/status wording."
    } else {
        Add-Pass "SelfTest rejects legacy backup worker/status wording"
    }

    if (Test-ContainsAllTerms $trainingCompletePending @("rol cajero", "rol supervisor", "rol administrador", "rol usuario de area", "base de produccion")) {
        Add-Pass "SelfTest accepts training proof that preserves all required role blockers"
    } else {
        Add-Failure "SelfTest failed to accept current training blocker wording."
    }

    if (Test-ContainsAllTerms $trainingMissingAreaRole @("rol cajero", "rol supervisor", "rol administrador", "rol usuario de area", "base de produccion")) {
        Add-Failure "SelfTest failed to reject training proof missing area-user blocker."
    } else {
        Add-Pass "SelfTest rejects training proof missing area-user blocker"
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
$startupTaskProof = Read-RequiredFile "qa\FINAL_STARTUP_TASK_PROOF.md"
$backupTaskProof = Read-RequiredFile "qa\FINAL_BACKUP_TASK_PROOF.md"
$restoreProof = Read-RequiredFile "qa\FINAL_RESTORE_PROOF.md"
$concurrencyProof = Read-RequiredFile "qa\FINAL_CONCURRENCY_PROOF.md"
$trainingProof = Read-RequiredFile "qa\TRAINING_ACCEPTANCE_PROOF.md"
$fieldBlockersIndex = Read-RequiredFile "docs\FINAL_FIELD_BLOCKERS.md"

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
    "respaldo",
    "Pendiente",
    "Protegido"
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

Assert-PendingProof "Final startup task proof" $startupTaskProof @(
    "SistemaCajaHospitalaria-StackAutostart",
    "AtStartup",
    "arranque",
    "reinicio",
    "/up",
    "login",
    "PRODUCTION_CANDIDATE"
)

Assert-PendingProof "Final backup task proof" $backupTaskProof @(
    "SistemaCajaHospitalaria-BackupWorker",
    "SistemaCajaHospitalaria-DailyBackup",
    "tarea continua de respaldos",
    "UI administrativa",
    "Pendiente",
    "Protegido",
    "PRODUCTION_CANDIDATE"
)

Assert-PendingProof "Training acceptance proof" $trainingProof @(
    "rol cajero",
    "rol supervisor",
    "rol administrador",
    "rol usuario de area",
    "datos reales de pacientes",
    "base",
    "produccion",
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

Assert-FieldBlockersIndex $fieldBlockersIndex

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "FINAL_FIELD_BLOCKERS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "FINAL_FIELD_BLOCKERS_SAFETY: YES" -ForegroundColor Green
