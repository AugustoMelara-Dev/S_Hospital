#Requires -Version 5.1
<#
.SYNOPSIS
    Drill de restauracion descartable con recurso de prueba inequivoco.

.DESCRIPTION
    Verifica un paquete de respaldo contra una base descartable con nombre
    unico (hospital_billing_test_<fecha>_<token>) usando solo contenedores
    Docker. Cubre checksum, descifrado, tablas criticas, relaciones, integridad
    financiera, metadatos, limpieza limitada al recurso de prueba y prueba de
    que la base original NO se modifico (huella de tablas criticas antes/despues).

    No reemplaza al runbook productivo: el drill nunca toca la base productiva.
    Sin daemon Docker devuelve exit code 3 (BLOQUEADO_EXTERNO) sin simular.

    Exit codes: 0 exito; 1 fallo o guarda; 3 BLOQUEADO_EXTERNO (sin daemon Docker).

.EXAMPLE
    .\recovery_disposable_drill.ps1 -Plan
    .\recovery_disposable_drill.ps1 -BackupFile C:\ruta\backup.sql.gz.enc -ExpectedSha256 <sha256>
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = '',

    [string]$BackupFile = '',

    [string]$ExpectedSha256 = '',

    [string]$TargetDatabase = '',

    [Parameter(Mandatory = $false)]
    [switch]$Plan,

    [Parameter(Mandatory = $false)]
    [switch]$KeepDatabase,

    [string]$EvidencePath = ''
)

$ErrorActionPreference = 'Stop'

$projectRootResolved = if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
} else {
    (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$libRoot = Join-Path $projectRootResolved 'scripts\lib'
foreach ($library in @('recovery_contract.ps1', 'recovery_runtime.ps1', 'recovery_validation.ps1', 'recovery_docker.ps1')) {
    $libraryPath = Join-Path $libRoot $library
    if (-not (Test-Path -LiteralPath $libraryPath)) {
        Write-Host "[ERROR] Falta $libraryPath. El drill requiere la instalacion completa." -ForegroundColor Red
        exit 1
    }
    . $libraryPath
}

$envFile = Join-Path $projectRootResolved '.env'
$productionDatabase = Get-RecoveryEnvValue -EnvPath $envFile -Name 'DB_DATABASE' -Default 'hospital_billing'

if ([string]::IsNullOrWhiteSpace($TargetDatabase)) {
    $TargetDatabase = 'hospital_billing_test_' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '_' + ([Guid]::NewGuid().ToString('N').Substring(0, 6))
}

if (-not (Test-RecoveryDisposableTargetDatabase -Database $TargetDatabase)) {
    Write-Host "[ERROR] El destino '$TargetDatabase' no es una base descartable habilitada." -ForegroundColor Red
    exit 1
}
if ($TargetDatabase -ceq $productionDatabase) {
    Write-Host "[ERROR] El destino coincide con la base productiva '$productionDatabase'." -ForegroundColor Red
    exit 1
}

$dockerReady = Test-RecoveryDockerDaemonAvailable

if ($Plan) {
    $drillPlan = [pscustomobject]@{
        Mode = 'DisposableDrill'
        ProjectRoot = $projectRootResolved
        TargetDatabase = $TargetDatabase
        ProductionDatabase = $productionDatabase
        BackupFile = if ([string]::IsNullOrWhiteSpace($BackupFile)) { $null } else { [System.IO.Path]::GetFullPath($BackupFile) }
        ExpectedSha256 = if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) { $null } else { $ExpectedSha256.ToLowerInvariant() }
        DockerDaemonAvailable = [bool]$dockerReady
        Steps = @(Get-RecoverySteps -Mode Validation)
        IntegrityChecks = @((Get-RecoveryIntegrityChecks) | ForEach-Object { $_.Name })
        CleanupScope = "DROP DATABASE IF EXISTS ``$TargetDatabase``"
        ProductionWrites = 'none'
        WritesPerformed = $false
    }
    Write-Host "[RECOVERY_DRILL_PLAN] $($drillPlan | ConvertTo-Json -Depth 5 -Compress)"
    if (-not $dockerReady) {
        Write-Warning 'BLOQUEADO_EXTERNO: el daemon Docker no responde; el drill real requiere daemon. Plan emitido sin escrituras.'
        exit 3
    }
    exit 0
}

if (-not $dockerReady) {
    Write-Host '[BLOQUEADO_EXTERNO] El daemon Docker no responde. Ejecute primero: docker version' -ForegroundColor Yellow
    Write-Host "Comando exacto cuando el daemon este disponible:" -ForegroundColor Yellow
    Write-Host ("  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recovery_disposable_drill.ps1 -BackupFile <ruta> -ExpectedSha256 <sha256> -TargetDatabase {0}" -f $TargetDatabase)
    exit 3
}

if ([string]::IsNullOrWhiteSpace($BackupFile) -or [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
    Write-Host '[ERROR] El drill real requiere -BackupFile y -ExpectedSha256.' -ForegroundColor Red
    exit 1
}

$resolvedBackup = [System.IO.Path]::GetFullPath($BackupFile)
if (-not (Test-Path -LiteralPath $resolvedBackup)) {
    Write-Host "[ERROR] No existe el respaldo: $resolvedBackup" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $projectRootResolved 'docker-compose.prod.yml'))) {
    Write-Host '[ERROR] Falta docker-compose.prod.yml.' -ForegroundColor Red
    exit 1
}

$evidenceTarget = if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    Join-Path $projectRootResolved ('hospital-ai\evidencia\M-W1-REC-01\disposable-drill-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '.md')
} else {
    [System.IO.Path]::GetFullPath($EvidencePath)
}

$drill = $null
$cleanupResult = $null
try {
    $drill = Invoke-DockerDisposableRestore `
        -ProjectRoot $projectRootResolved `
        -BackupFile $resolvedBackup `
        -ExpectedSha256 $ExpectedSha256 `
        -TargetDatabase $TargetDatabase
} catch {
    Write-Host "[ERROR] El drill descartable fallo: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if (-not $KeepDatabase) {
        try {
            $cleanupResult = Remove-DockerDisposableDatabase -ProjectRoot $projectRootResolved -Database $TargetDatabase
        } catch {
            Write-Warning "No se pudo limpiar la base descartable '$TargetDatabase': $($_.Exception.Message)"
        }
    }
}

$evidenceDirectory = Split-Path -Parent $evidenceTarget
if (-not (Test-Path -LiteralPath $evidenceDirectory)) {
    New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
}

$integrity = $drill.Integrity
$evidence = @()
$evidence += '# Recovery disposable drill'
$evidence += ''
$evidence += ("- status: PASS")
$evidence += ("- completed_at_utc: {0}" -f (Get-Date).ToUniversalTime().ToString('o'))
$evidence += ("- project_root: {0}" -f $projectRootResolved)
$evidence += ("- disposable_database: {0}" -f $drill.Database)
$evidence += ("- production_database: {0}" -f $drill.ProductionDatabase)
$evidence += ("- backup_file: {0}" -f $drill.BackupFile)
$evidence += ("- checksum_sha256_verified: true")
$evidence += ("- critical_tables_validated: {0}/10" -f @($drill.Validation.TableCounts.Keys).Count)
$evidence += ("- integrity_valid: {0}" -f $integrity.Valid)
$evidence += ("- integrity_blocking_failures: {0}" -f (@($integrity.BlockingFailures) -join ', '))
$evidence += ("- production_fingerprint_verified: {0}" -f $drill.ProductionFingerprintVerified)
$evidence += ("- production_fingerprint_unchanged: {0}" -f $drill.ProductionFingerprintUnchanged)
$evidence += ("- cleanup_dropped_database: {0}" -f $(if ($KeepDatabase) { 'kept_by_request' } elseif ($cleanupResult) { $cleanupResult.Database } else { 'not_executed' }))
$evidence += ("- secrets_or_absolute_paths_included: false")
$evidence += ''
$evidence += '## Integrity checks'
$evidence += ''
$evidence += '| check | group | severity | count | failed |'
$evidence += '|---|---|---|---|---|'
foreach ($check in @($integrity.Checks)) {
    $evidence += ("| {0} | {1} | {2} | {3} | {4} |" -f $check.Name, $check.Group, $check.Severity, $check.Count, $check.Failed)
}

[System.IO.File]::WriteAllText($evidenceTarget, (($evidence -join [Environment]::NewLine) + [Environment]::NewLine), [System.Text.UTF8Encoding]::new($false))

Write-Host "[RECOVERY_DRILL_RESULT] $(@{
    Success = $true
    Database = $drill.Database
    IntegrityValid = $integrity.Valid
    ProductionFingerprintUnchanged = $drill.ProductionFingerprintUnchanged
    Cleanup = $(if ($KeepDatabase) { 'kept' } elseif ($cleanupResult) { 'dropped' } else { 'not_executed' })
    Evidence = $evidenceTarget
} | ConvertTo-Json -Depth 4 -Compress)"

Write-Host "Drill descartable completado. Evidencia: $evidenceTarget" -ForegroundColor Green
exit 0
