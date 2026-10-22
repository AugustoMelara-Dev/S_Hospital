#Requires -Version 5.1
<#
.SYNOPSIS
    Restaurar base de datos Hospital desde backup SQL cifrado.

.DESCRIPTION
    Script guiado para restaurar la base de datos desde un archivo .sql.gz.enc, .sql.enc, .sql o .tar.gz.
    ADVERTENCIA: Este script sobreescribe datos. Usar solo en base de datos de PRUEBA.

.PARAMETER BackupFile
    Ruta al archivo de backup .sql.gz.enc, .sql.enc, .sql o .tar.gz

.PARAMETER ExpectedSha256
    SHA256 esperado del archivo de backup original. Obligatorio para restaurar.

.PARAMETER TargetDatabase
    Nombre de la base de datos destino (default: hospital_billing_test)

.PARAMETER UseExistingEnv
    Usa la configuracion de backend\.env existente para conexion

.EXAMPLE
    .\restore_hospital_windows.ps1 -BackupFile "C:\backups\hospital_2026-06-01.sql.gz.enc" -ExpectedSha256 "<sha256>"
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$SelfTest,

    [Parameter(Mandatory=$false)]
    [switch]$WhatIf,

    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "",

    [Parameter(Mandatory=$false)]
    [string]$ExpectedSha256 = "",

    [Parameter(Mandatory=$false)]
    [string]$TargetDatabase = "hospital_billing_test",

    [Parameter(Mandatory=$false)]
    [switch]$UseExistingEnv,

    [Parameter(Mandatory=$false)]
    [switch]$ProductionRecovery,

    [Parameter(Mandatory=$false)]
    [string]$ProductionDatabaseConfirmation = "",

    [Parameter(Mandatory=$false)]
    [string]$ProductionActionConfirmation = "",

    [Parameter(Mandatory=$false)]
    [switch]$ForceProductionRestore
)

$ErrorActionPreference = "Stop"
$recoveryContractPath = Join-Path $PSScriptRoot 'lib\recovery_contract.ps1'
if (-not (Test-Path -LiteralPath $recoveryContractPath)) {
    Write-Host '[ERROR] Falta el contrato local de recuperacion.' -ForegroundColor Red
    exit 1
}
. $recoveryContractPath
$recoveryRuntimePath = Join-Path $PSScriptRoot 'lib\recovery_runtime.ps1'
if (-not (Test-Path -LiteralPath $recoveryRuntimePath)) {
    Write-Host '[ERROR] Falta el adaptador local de recuperacion.' -ForegroundColor Red
    exit 1
}
. $recoveryRuntimePath
$recoveryValidationPath = Join-Path $PSScriptRoot 'lib\recovery_validation.ps1'
if (-not (Test-Path -LiteralPath $recoveryValidationPath)) {
    Write-Host '[ERROR] Falta el validador local de recuperacion.' -ForegroundColor Red
    exit 1
}
. $recoveryValidationPath

$recoveryDockerPath = Join-Path $PSScriptRoot 'lib\recovery_docker.ps1'
if (-not (Test-Path -LiteralPath $recoveryDockerPath)) {
    Write-Host '[ERROR] Falta el adaptador Docker de recuperacion.' -ForegroundColor Red
    exit 1
}
. $recoveryDockerPath

$recoveryOrchestratorPath = Join-Path $PSScriptRoot 'lib\recovery_orchestrator.ps1'
if (-not (Test-Path -LiteralPath $recoveryOrchestratorPath)) {
    Write-Host '[ERROR] Falta el orquestador local de recuperacion.' -ForegroundColor Red
    exit 1
}
. $recoveryOrchestratorPath



$script:ExitCode = 0
$script:DecryptedSqlPath = ""
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendEnvPath = Join-Path $projectRoot "backend\.env"
$dockerCommandAvailable = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
$runtimeResolution = Resolve-RecoveryRuntime -ProjectRoot $projectRoot -DockerComposeAvailable $dockerCommandAvailable

function Write-Step {
    param([string]$Message)
    Write-Host "[ETAPA] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    $script:ExitCode = 1
}

function Get-MySqlClient {
    $searchPaths = @(
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mariadb\bin\mysql.exe",
        "C:\Program Files\MariaDB*\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe",
        "C:\wamp64\bin\mysql\mysql*\bin\mysql.exe",
        "mysql.exe"
    )

    foreach ($path in $searchPaths) {
        if ($path -match '\*') {
            $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Sort-Object -Descending | Select-Object -First 1
            if ($found) {
                return $found.FullName
            }
        } elseif (Test-Path $path) {
            return $path
        }
    }

    $pathClient = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($pathClient) {
        return $pathClient.Source
    }

    return $null
}

function New-MySqlDefaultsFile {
    param([hashtable]$DbConfig)

    $path = [System.IO.Path]::GetTempFileName()
    $password = ([string]$DbConfig.Password).Replace('\', '\\').Replace('"', '\"')
    $content = @(
        "[client]",
        "host=$($DbConfig.Host)",
        "port=$($DbConfig.Port)",
        "user=$($DbConfig.Username)",
        "password=""$password"""
    ) -join "`n"

    Set-Content -LiteralPath $path -Value $content -Encoding ASCII -NoNewline

    try {
        $acl = Get-Acl -LiteralPath $path
        $acl.SetAccessRuleProtection($true, $false)
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $path -AclObject $acl
    } catch {
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        Write-Error "No se pudo restringir ACL del defaults file temporal. Riesgo de filtracion de credenciales abortado."
        exit 1
    }

    return $path
}

function Remove-MySqlDefaultsFile {
    param([string]$Path)

    if ($Path -and (Test-Path -LiteralPath $Path)) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
}

function Get-ConfigValue {
    param(
        [hashtable]$Config,
        [string]$Key,
        [string]$Default
    )

    if ($Config.ContainsKey($Key) -and $null -ne $Config[$Key] -and [string]$Config[$Key] -ne "") {
        return [string]$Config[$Key]
    }

    return $Default
}

function Get-DatabaseConfig {
    param([string]$EnvPath = $backendEnvPath)

    if (-not (Test-Path $EnvPath)) {
        return $null
    }

    $config = @{}
    Get-Content $EnvPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $config[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }

    return @{
        Host = Get-ConfigValue $config 'DB_HOST' '127.0.0.1'
        Port = Get-ConfigValue $config 'DB_PORT' '3306'
        Database = Get-ConfigValue $config 'DB_DATABASE' 'hospital_billing'
        Username = Get-ConfigValue $config 'DB_USERNAME' 'hospital'
        Password = Get-ConfigValue $config 'DB_PASSWORD' ''
    }
}

function Test-DisposableDatabaseName {
    param(
        [string]$Database,
        [switch]$ForceProduction
    )

    return Test-RecoveryDisposableDatabaseName -Database $Database
}

function New-DisposableDatabaseRecreateCommand {
    param([string]$Database)

    if (-not (Test-DisposableDatabaseName -Database $Database)) {
        throw "La base de datos '$Database' no es descartable y no puede recrearse."
    }

    return "DROP DATABASE IF EXISTS ``$Database``; CREATE DATABASE ``$Database`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

function Test-SafeMysqlArgument {
    param([string]$Value)

    return $Value -match '^[A-Za-z0-9_.:-]+$'
}

function Test-AllowedBackupFileFormat {
    param([string]$Path)

    return $Path -match '\.(sql|sql\.enc|sql\.gz\.enc|tar\.gz)$'
}

function Assert-SafeConnectionConfig {
    param(
        [hashtable]$Config,
        [switch]$ForceProduction
    )

    if (-not (Test-SafeMysqlArgument ([string]$Config.Host))) {
        Write-Error "Host de base de datos contiene caracteres no permitidos."
        exit 1
    }

    if ([string]$Config.Port -notmatch '^\d{1,5}$') {
        Write-Error "Puerto de base de datos invalido."
        exit 1
    }

    if (-not (Test-SafeMysqlArgument ([string]$Config.Username))) {
        Write-Error "Usuario de base de datos contiene caracteres no permitidos."
        exit 1
    }

    if (-not (Test-DisposableDatabaseName -Database ([string]$Config.Database) -ForceProduction:$ForceProduction)) {
        Write-Error "La base de datos '$($Config.Database)' no parece ser descartable de prueba."
        Write-Error "Use un nombre como 'hospital_billing_test' o 'hospital_restore_validation'. El helper no restaura sobre produccion."
        exit 1
    }
}

function Invoke-SelfTest {
    Write-Step "Ejecutando self-test de restore seguro"

    $tempEnv = Join-Path $env:TEMP "hospital-restore-selftest.env"
    Set-Content -LiteralPath $tempEnv -Value @(
        "DB_HOST=192.168.1.10",
        "DB_PORT=3307",
        "DB_DATABASE=hospital_billing",
        "DB_USERNAME=hospital_user",
        "DB_PASSWORD=secret-value"
    ) -Encoding ASCII

    $config = Get-DatabaseConfig -EnvPath $tempEnv
    Remove-Item $tempEnv -Force -ErrorAction SilentlyContinue

    if ($config.Host -ne "192.168.1.10" -or $config.Port -ne "3307" -or $config.Username -ne "hospital_user" -or $config.Password -ne "secret-value") {
        Write-Error "Self-test fallo: parseo .env incorrecto."
        exit 1
    }

    if (-not (Test-DisposableDatabaseName "hospital_restore_validation")) {
        Write-Error "Self-test fallo: base descartable valida fue rechazada."
        exit 1
    }

    foreach ($db in @("hospital_billing", "hospital_billing_production", "mysql", "hospital-prod", "hospital")) {
        if (Test-DisposableDatabaseName $db) {
            Write-Error "Self-test fallo: base insegura aceptada: $db"
            exit 1
        }
    }
    if (Test-DisposableDatabaseName -Database "hospital_billing" -ForceProduction) {
        Write-Error "Self-test fallo: ForceProductionRestore acepto la base activa."
        exit 1
    }

    $safeConfig = @{
        Host = "127.0.0.1"
        Port = "3306"
        Database = "hospital_restore_validation"
        Username = "hospital_user"
        Password = "ignored"
    }
    Assert-SafeConnectionConfig $safeConfig

    $recreateCommandBuilder = Get-Command New-DisposableDatabaseRecreateCommand -ErrorAction SilentlyContinue
    if (-not $recreateCommandBuilder) {
        Write-Error "Self-test fallo: falta el comando seguro para recrear la base descartable."
        exit 1
    }

    $recreateCommand = New-DisposableDatabaseRecreateCommand "hospital_restore_validation"
    $expectedRecreateCommand = "DROP DATABASE IF EXISTS ``hospital_restore_validation``; CREATE DATABASE ``hospital_restore_validation`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if ($recreateCommand -ne $expectedRecreateCommand) {
        Write-Error "Self-test fallo: el comando de recreacion descartable no es determinista o seguro."
        exit 1
    }

    if (-not (Test-AllowedBackupFileFormat "C:\backups\hospital-backup.sql.gz.enc")) {
        Write-Error "Self-test fallo: .sql.gz.enc valido fue rechazado."
        exit 1
    }

    if (Test-AllowedBackupFileFormat "C:\backups\hospital-backup.zip") {
        Write-Error "Self-test fallo: formato inseguro aceptado."
        exit 1
    }

    $expectedProductionSteps = @(
        'verify-package',
        'validate-disposable',
        'verify-no-open-cash',
        'create-preventive-backup',
        'enter-maintenance',
        'stop-writers',
        'restore-production',
        'run-migrations',
        'verify-health',
        'start-restore-reconciliation',
        'resume-writers',
        'leave-maintenance'
    )
    $actualProductionSteps = Get-RecoverySteps -Mode Production
    if (($expectedProductionSteps -join '|') -ne ($actualProductionSteps -join '|')) {
        Write-Error 'Self-test fallo: el contrato productivo esta incompleto o fuera de orden.'
        exit 1
    }
    if (-not (Get-Command Resolve-RecoveryRuntime -ErrorAction SilentlyContinue) -or
        -not (Get-Command Invoke-HospitalCommand -ErrorAction SilentlyContinue)) {
        Write-Error 'Self-test fallo: los adaptadores de runtime no estan disponibles.'
        exit 1
    }
    if ((Get-RecoveryCriticalTables).Count -ne 10) {
        Write-Error 'Self-test fallo: la validacion no cubre las diez tablas criticas.'
        exit 1
    }
    if (-not (Get-Command Invoke-ProductionRecovery -ErrorAction SilentlyContinue)) {
        Write-Error 'Self-test fallo: el orquestador productivo no esta disponible.'
        exit 1
    }
    if (-not (Get-Command Invoke-DockerGuardedProductionRecovery -ErrorAction SilentlyContinue)) {
        Write-Error 'Self-test fallo: la recuperacion Docker no esta disponible.'
        exit 1
    }
    if (-not (Get-Command Invoke-DockerDisposableRestore -ErrorAction SilentlyContinue) -or
        -not (Get-Command Test-DockerDisposableRestoreInput -ErrorAction SilentlyContinue)) {
        Write-Error 'Self-test fallo: la validacion descartable Docker no esta disponible.'
        exit 1
    }
    if ((Get-RecoveryActionConfirmation) -cne 'RESTAURAR') {
        Write-Error 'Self-test fallo: la frase canonica de confirmacion no es RESTAURAR.'
        exit 1
    }
    if (-not (Test-RecoveryActionConfirmation -Value 'RESTAURAR') -or
        (Test-RecoveryActionConfirmation -Value 'RESTAURAR PRODUCCION') -or
        (Test-RecoveryActionConfirmation -Value 'restaurar')) {
        Write-Error 'Self-test fallo: la validacion de la frase de confirmacion es incorrecta.'
        exit 1
    }
    if (-not (Test-RecoveryDisposableTargetDatabase -Database 'hospital_billing_test') -or
        -not (Test-RecoveryDisposableTargetDatabase -Database 'hospital_billing_test_1700000000')) {
        Write-Error 'Self-test fallo: la base descartable prefijada fue rechazada.'
        exit 1
    }
    foreach ($forbiddenTarget in @('hospital_billing', 'mysql', 'hospital_billing_prod', 'hospital_billing_testx')) {
        if (Test-RecoveryDisposableTargetDatabase -Database $forbiddenTarget) {
            Write-Error "Self-test fallo: base descartable insegura aceptada: $forbiddenTarget"
            exit 1
        }
    }




    $blockedRecovery = Test-ProductionRecoveryAllowed -State ([pscustomobject]@{})
    if ($blockedRecovery.Allowed -or $blockedRecovery.Blockers.Count -ne 4) {
        Write-Error 'Self-test fallo: la recuperacion sin preflight no fue bloqueada.'
        exit 1
    }

    if ((Get-RestoreReconciliationCommandName) -ne 'hospital:restore-reconciliation') {
        Write-Error 'Self-test fallo: el comando de reconciliacion no coincide con el contrato del backend.'
        exit 1
    }
    if ((Get-RecoveryReconciliationConfirmPhrase) -cne 'RECONCILIAR') {
        Write-Error 'Self-test fallo: la frase de reconciliacion no coincide con la del backend.'
        exit 1
    }
    if (-not (Test-RecoveryReconciliationConfirmPhrase -Value 'RECONCILIAR') -or
        (Test-RecoveryReconciliationConfirmPhrase -Value 'reconciliar')) {
        Write-Error 'Self-test fallo: la validacion de la frase de reconciliacion es incorrecta.'
        exit 1
    }
    if ((Get-RecoveryResumeConfirmation) -cne 'REANUDAR') {
        Write-Error 'Self-test fallo: la frase de reanudacion de servicio no es REANUDAR.'
        exit 1
    }
    foreach ($reconciliationFunction in @('Start-RestoreReconciliation', 'Get-RestoreReconciliationState', 'Confirm-RestoreReconciliation', 'Resume-HospitalOperations')) {
        if (-not (Get-Command $reconciliationFunction -ErrorAction SilentlyContinue)) {
            Write-Error "Self-test fallo: falta la funcion de reconciliacion $reconciliationFunction."
            exit 1
        }
    }

    Write-Success "Self-test completado. No se tocaron bases ni backups."
    exit 0
}

if ($SelfTest) {
    Invoke-SelfTest
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  RESTAURACION DE BASE DE DATOS" -ForegroundColor Magenta
Write-Host "  SISTEMA CAJA HOSPITALARIA" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

Write-Warning "ADVERTENCIA: Este proceso sobreescribe datos."
Write-Warning "Usar SOLO en base de datos de prueba o desarrollo."
Write-Host ""

if ($ForceProductionRestore) {
    Write-Error "-ForceProductionRestore ya no esta soportado. Use este helper solo con una base descartable; el restore productivo requiere el runbook manual con parada operativa."
    exit 1
}
if ($ProductionRecovery) {
    if ([string]::IsNullOrWhiteSpace($BackupFile) -or [string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        Write-Error '-ProductionRecovery requiere -BackupFile y -ExpectedSha256.'
        exit 1
    }

    if (-not $runtimeResolution.DockerReady) {
        Write-Error 'La recuperacion productiva requiere un runtime Docker completo (docker-compose.prod.yml + .env + comando docker).'
        exit 1
    }

    if ($WhatIf) {
        if (-not (Test-Path -LiteralPath $BackupFile)) {
            Write-Error "Archivo de backup no encontrado: $BackupFile"
            exit 1
        }
        $planHash = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($planHash -ne $ExpectedSha256.ToLowerInvariant()) {
            Write-Error "SHA256 del backup no coincide. Restore bloqueado."
            exit 1
        }
        $productionPlanDatabase = Get-RecoveryEnvValue -EnvPath (Join-Path $projectRoot '.env') -Name 'DB_DATABASE' -Default 'hospital_billing'
        $plan = [pscustomobject]@{
            Mode = 'Docker'
            BackupFile = [System.IO.Path]::GetFullPath($BackupFile)
            ExpectedSha256 = $ExpectedSha256.ToLowerInvariant()
            ProductionDatabase = $productionPlanDatabase
            ValidationDatabase = $TargetDatabase
            Steps = @(Get-RecoverySteps -Mode Production)
            WritesPerformed = $false
        }
        Write-Host "[RECOVERY_PLAN] $($plan | ConvertTo-Json -Depth 5 -Compress)"
        Write-Warning 'WhatIf activo: no se copio, descifro ni modifico ninguna base.'
        exit 0
    }

    try {
        $recoveryResult = Invoke-DockerGuardedProductionRecovery `
            -ProjectRoot $projectRoot `
            -BackupFile ([System.IO.Path]::GetFullPath($BackupFile)) `
            -ExpectedSha256 $ExpectedSha256 `
            -ValidationDatabase $TargetDatabase `
            -DatabaseConfirmation $ProductionDatabaseConfirmation `
            -ActionConfirmation $ProductionActionConfirmation
    } catch {
        Write-Error "Recuperacion productiva bloqueada: $($_.Exception.Message)"
        exit 1
    }

    if (-not $recoveryResult.Success) {
        Write-Error "Recuperacion productiva fallida: $($recoveryResult.Error)"
        if ($recoveryResult.RollbackAttempted) {
            Write-Warning "Rollback preventivo ejecutado: $($recoveryResult.RollbackSucceeded)"
        }
        if ($recoveryResult.MaintenanceActive) {
            Write-Warning 'El sistema permanece en mantenimiento. No intente facturar hasta revision tecnica.'
        }
        exit 1
    }

    Write-Success 'RECUPERACION PRODUCTIVA COMPLETADA'
    Write-Host "[RECOVERY_RESULT] $($recoveryResult | ConvertTo-Json -Depth 6 -Compress)"
    if ($recoveryResult.SequenceEmissionBlocked) {
        $reconciliationCommand = Get-RestoreReconciliationCommandName
        $reconciliationPhrase = Get-RecoveryReconciliationConfirmPhrase
        Write-Warning 'BLOQUEO DE CORRELATIVOS ACTIVO: el sistema no emitira facturas ni recibos hasta reconciliar.'
        Write-Warning 'La reconciliacion requiere un manifiesto externo verificado (custodia hs-backups) y doble control.'
        Write-Host '  Comando de estado:' -ForegroundColor Yellow
        Write-Host ("    {0} status --json" -f $reconciliationCommand) -ForegroundColor Cyan
        Write-Host '  Comando de confirmacion (tras obtener el manifiesto):' -ForegroundColor Yellow
        Write-Host ("    {0} confirm --manifest=<ruta> --phrase={1} --reason=<motivo> --authorized-by=<responsable>" -f $reconciliationCommand, $reconciliationPhrase) -ForegroundColor Cyan
    }
    exit 0
}

if (-not (Test-DisposableDatabaseName -Database $TargetDatabase -ForceProduction:$ForceProductionRestore)) {
    Write-Error "No se puede restaurar a '$TargetDatabase'."
    Write-Error "Use una base descartable con nombre como 'hospital_billing_test' o 'hospital_restore_validation'. El helper no restaura sobre produccion."
    exit 1
}

if ($WhatIf) {
    # Plan unico para TODOS los caminos: con o sin BackupFile, Docker o bare metal.
    # No promete, no descifra, no recrea y no importa ninguna base.
    if (-not ($runtimeResolution.DockerReady -or $runtimeResolution.BareReady)) {
        Write-Error 'WhatIf: runtime de recuperacion no resuelto.'
        foreach ($runtimeBlocker in @($runtimeResolution.Blockers)) {
            Write-Error ("  - {0}: {1}" -f $runtimeBlocker.Code, $runtimeBlocker.Message)
        }
        exit 1
    }

    $planMode = if ($runtimeResolution.DockerReady) { 'Docker' } else { 'BareMetal' }
    $planBackupFile = $null
    $planSha256 = $null

    if ($BackupFile) {
        $planBackupFile = [System.IO.Path]::GetFullPath($BackupFile)
        if (-not (Test-Path -LiteralPath $planBackupFile)) {
            Write-Error "Archivo de backup no encontrado: $planBackupFile"
            exit 1
        }
        if (-not (Test-AllowedBackupFileFormat $planBackupFile)) {
            Write-Error "Formato de backup no permitido. Use .sql.gz.enc, .sql.enc, .sql o .tar.gz."
            exit 1
        }
        if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) {
            Write-Error "Debe proporcionar -ExpectedSha256 con el hash SHA256 esperado del archivo de backup antes de restaurar."
            exit 1
        }
        if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') {
            Write-Error "ExpectedSha256 no tiene formato SHA256 valido."
            exit 1
        }
        $planSha256 = (Get-FileHash -LiteralPath $planBackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($planSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
            Write-Error "SHA256 del backup no coincide. Restore bloqueado."
            exit 1
        }
        if ($runtimeResolution.DockerReady) {
            try {
                $null = Invoke-DockerDisposableRestore `
                    -ProjectRoot $projectRoot `
                    -BackupFile $planBackupFile `
                    -ExpectedSha256 $ExpectedSha256 `
                    -TargetDatabase $TargetDatabase `
                    -WhatIf
            } catch {
                Write-Error "WhatIf Docker invalido: $($_.Exception.Message)"
                exit 1
            }
        }
    }

    if ($UseExistingEnv -and $runtimeResolution.BareReady) {
        $planConfig = Get-DatabaseConfig
        if (-not $planConfig) {
            Write-Error "No se pudo leer backend\.env"
            exit 1
        }
        $planConfig.Database = $TargetDatabase
        Assert-SafeConnectionConfig -Config $planConfig -ForceProduction:$ForceProductionRestore
    }

    $plan = [pscustomobject]@{
        Mode = $planMode
        Database = $TargetDatabase
        BackupFile = $planBackupFile
        ExpectedSha256 = $planSha256
        Steps = @(Get-RecoverySteps -Mode Validation)
        WritesPerformed = $false
    }
    Write-Host "[RECOVERY_PLAN] $($plan | ConvertTo-Json -Depth 5 -Compress)"
    Write-Warning 'WhatIf activo: validacion completada; no se creo, descifro ni modifico ninguna base.'
    exit 0
}

if (-not $UseExistingEnv -and -not $BackupFile) {
    Write-Step "Ingrese la ruta del archivo de backup (.sql.gz.enc, .sql.enc, .sql o .tar.gz)"
    $BackupFile = Read-Host "Ruta del backup"
}

if ($BackupFile) {
    $BackupFile = [System.IO.Path]::GetFullPath($BackupFile)
    if (-not (Test-Path $BackupFile)) {
        Write-Error "Archivo de backup no encontrado: $BackupFile"
        exit 1
    }

    if (-not (Test-AllowedBackupFileFormat $BackupFile)) {
        Write-Error "Formato de backup no permitido. Use .sql.gz.enc, .sql.enc, .sql o .tar.gz."
        exit 1
    }

    if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        Write-Error "Debe proporcionar -ExpectedSha256 con el hash SHA256 esperado del archivo de backup antes de restaurar."
        exit 1
    }

    if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') {
        Write-Error "ExpectedSha256 no tiene formato SHA256 valido."
        exit 1
    }

    $actualSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
        Write-Error "SHA256 del backup no coincide. Restore bloqueado."
        exit 1
    }
    Write-Success "SHA256 verificado antes del restore"
}

if ($runtimeResolution.DockerReady) {
    if (-not $BackupFile) {
        Write-Error "La validacion descartable en Docker requiere -BackupFile y -ExpectedSha256."
        exit 1
    }
    if ($runtimeResolution.BareReady) {
        Write-Warning 'Se detectaron runtimes Docker y bare metal; la validacion descartable usara Docker.'
    }

    try {
        $dockerValidation = Invoke-DockerDisposableRestore `
            -ProjectRoot $projectRoot `
            -BackupFile ([System.IO.Path]::GetFullPath($BackupFile)) `
            -ExpectedSha256 $ExpectedSha256 `
            -TargetDatabase $TargetDatabase `
            -WhatIf:$WhatIf
    } catch {
        Write-Error "Validacion descartable en Docker fallida: $($_.Exception.Message)"
        exit 1
    }

    if ($WhatIf) {
        Write-Warning 'WhatIf activo: SHA256 verificado y plan Docker validado; no se creo ni importo ninguna base.'
        exit 0
    }

    Write-Host "[RECOVERY_VALIDATION] $($dockerValidation.Validation | ConvertTo-Json -Depth 5 -Compress)"
    Write-Success "VALIDACION DESCARTABLE COMPLETADA (Docker)"
    Write-Host "Base de datos: $($dockerValidation.Database)" -ForegroundColor Green
    Write-Host "Backup: $($dockerValidation.BackupFile)" -ForegroundColor Green
    exit 0
}

if (-not $runtimeResolution.BareReady) {
    Write-Error 'Runtime de recuperacion no resuelto: no se detecto Docker completo ni php/mysql/artisan del host.'
    foreach ($runtimeBlocker in @($runtimeResolution.Blockers)) {
        Write-Error ("  - {0}: {1}" -f $runtimeBlocker.Code, $runtimeBlocker.Message)
    }
    exit 1
}

Write-Step "Buscando cliente MySQL/MariaDB..."
$mysqlExe = Get-MySqlClient
if (-not $mysqlExe) {
    Write-Error "No se encontro mysql.exe. Instale XAMPP, MariaDB o MySQL."
    Write-Error "O agregue mysql.exe al PATH del sistema."
    exit 1
}
Write-Success "Cliente encontrado: $mysqlExe"

$dbConfig = $null
if ($UseExistingEnv) {
    Write-Step "Leyendo configuracion de backend\.env..."
    $dbConfig = Get-DatabaseConfig
    if (-not $dbConfig) {
        Write-Error "No se pudo leer backend\.env"
        exit 1
    }
    $dbConfig.Database = $TargetDatabase
    Write-Success "Configuracion leida"
} else {
    Write-Step "Ingrese configuracion de base de datos:"
    $dbConfig = @{
        Host = Read-Host "Host (default: 127.0.0.1)"
        Port = Read-Host "Puerto (default: 3306)"
        Database = "hospital_billing"
        Username = Read-Host "Usuario (default: root)"
        Password = Read-Host "Password" -AsSecureString
    }
    $dbConfig.Host = if ($dbConfig.Host) { $dbConfig.Host } else { "127.0.0.1" }
    $dbConfig.Port = if ($dbConfig.Port) { $dbConfig.Port } else { "3306" }
    $dbConfig.Username = if ($dbConfig.Username) { $dbConfig.Username } else { "root" }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbConfig.Password)
    try {
        $dbConfig.Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $dbConfig.Database = $TargetDatabase
}

Write-Step "Verificando que '$($dbConfig.Database)' sea base permitida..."
Assert-SafeConnectionConfig -Config $dbConfig -ForceProduction:$ForceProductionRestore

if ($BackupFile -and $BackupFile -match '\.tar\.gz$') {
    Write-Step "Expandiendo archivo tar.gz..."
    try {
        $tempDir = Join-Path $env:TEMP "hospital_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        $details = tar -tvf $BackupFile
        foreach ($line in $details) {
            if ($line -match '^l' -or $line -match '^h' -or $line -match '\s+->\s+') {
                Write-Error "Riesgo de enlace simbolico (symlink/hardlink) detectado en el archivo tar."
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                exit 1
            }
        }
        $contents = tar -tf $BackupFile
        foreach ($file in $contents) {
            if ($file -match '\.\.' -or $file -match '^[/\\]' -or $file -match '^[a-zA-Z]:') {
                Write-Error "Riesgo de path traversal detectado en el archivo tar."
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                exit 1
            }
        }
        tar -xzf $BackupFile -C $tempDir
        $sqlFiles = Get-ChildItem $tempDir -Filter "*.sql"
        if ($sqlFiles) {
            $BackupFile = $sqlFiles[0].FullName
        } else {
            Write-Error "No se encontro archivo .sql dentro del tar.gz"
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }
        Write-Success "Archivo expandido"
    } catch {
        Write-Error "Error al expandir tar.gz: $_"
        exit 1
    }
}

if ($BackupFile -and $BackupFile -match '\.sql(\.gz)?\.enc$') {
    Write-Step "Descifrando backup cifrado a SQL temporal..."
    $artisan = Join-Path $projectRoot "backend\artisan"
    if (-not (Test-Path -LiteralPath $artisan)) {
        Write-Error "No se encontro backend\artisan para descifrar el backup con la clave local de respaldos."
        exit 1
    }

    $decryptedSql = Join-Path $env:TEMP "hospital_restore_$(Get-Date -Format 'yyyyMMddHHmmss')_$([Guid]::NewGuid().ToString('N')).sql"
    & php $artisan hospital:decrypt-backup $BackupFile $decryptedSql
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $decryptedSql)) {
        if (Test-Path -LiteralPath $decryptedSql) {
            Remove-Item -LiteralPath $decryptedSql -Force -ErrorAction SilentlyContinue
        }
        Write-Error "No se pudo descifrar el backup cifrado."
        exit 1
    }
    $script:DecryptedSqlPath = $decryptedSql
    $BackupFile = $decryptedSql
    Write-Success "Backup descifrado temporalmente para importacion controlada"
}

Write-Step "Recreando base de datos descartable '$($dbConfig.Database)'..."
$createDbCmd = New-DisposableDatabaseRecreateCommand -Database ([string]$dbConfig.Database)
$mysqlDefaultsFile = New-MySqlDefaultsFile $dbConfig

try {
    & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile -e $createDbCmd 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al recrear la base de datos descartable"
        exit 1
    }
    Write-Success "Base de datos descartable recreada y lista"

    if ($BackupFile) {
        Write-Step "Restaurando backup desde: $BackupFile"
        Write-Host "Esto puede tomar varios minutos..." -ForegroundColor Yellow

        $restoreCommand = """$mysqlExe"" --defaults-extra-file=""$mysqlDefaultsFile"" --default-character-set=utf8mb4 ""$($dbConfig.Database)"" < ""$BackupFile"" 2>&1"
        & cmd /c $restoreCommand
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error al restaurar backup"
            exit 1
        }
        Write-Success "Backup restaurado exitosamente"
    } else {
        Write-Step "Restauracion manual requerida."
        Write-Host "Ejecute el siguiente comando en una terminal:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "mysql --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) --default-character-set=utf8mb4 ""$($dbConfig.Database)"" < backup.sql" -ForegroundColor Cyan
        Write-Host ""
    }

    Write-Step "Verificando datos restaurados..."
    $tableCountCmd = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ``$($dbConfig.Database)``;"
    $tableCount = & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile --batch --skip-column-names -e $tableCountCmd 2>&1
    if ($tableCount -as [int] -gt 0) {
        Write-Success "Base de datos restaurada con $tableCount tablas"
    } else {
        Write-Warning "No se pudo verificar el conteo de tablas"
    }

    Write-Step "Verificando tablas criticas..."
    $criticalTables = Get-RecoveryCriticalTables
    $criticalTableCounts = @{}
    foreach ($table in $criticalTables) {
        $countCmd = "SELECT COUNT(*) FROM ``$($dbConfig.Database)``.``$table``;"
        $count = & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile --batch --skip-column-names -e $countCmd 2>&1
        $parsedCount = 0
        if ($LASTEXITCODE -eq 0 -and [int]::TryParse(([string]$count).Trim(), [ref]$parsedCount)) {
            $criticalTableCounts[$table] = $parsedCount
            Write-Success "  $table : $parsedCount registros"
        } else {
            Write-Warning "  $table : no verificado"
        }
    }

    $validationResult = New-RecoveryValidationResult `
        -Database ([string]$dbConfig.Database) `
        -TableCounts $criticalTableCounts
    Write-Host "[RECOVERY_VALIDATION] $($validationResult | ConvertTo-Json -Depth 5 -Compress)"
    if (-not $validationResult.Valid) {
        Write-Error 'La validacion descartable no contiene todas las tablas criticas. Restore bloqueado.'
        exit 1
    }

    Write-Host ""
    if ($script:ExitCode -eq 0) {
        Write-Success "RESTAURACION COMPLETADA"
        Write-Host ""
        Write-Host "Base de datos: $($dbConfig.Database)" -ForegroundColor Green
        Write-Host "Host: $($dbConfig.Host):$($dbConfig.Port)" -ForegroundColor Green
    } else {
        Write-Error "RESTAURACION FALLIDA - Revise los errores arriba"
    }
    Write-Host ""
} finally {
    Remove-MySqlDefaultsFile $mysqlDefaultsFile
    if ($script:DecryptedSqlPath -and (Test-Path -LiteralPath $script:DecryptedSqlPath)) {
        Remove-Item -LiteralPath $script:DecryptedSqlPath -Force -ErrorAction SilentlyContinue
    }
}

exit $script:ExitCode
