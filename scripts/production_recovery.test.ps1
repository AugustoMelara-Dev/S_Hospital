#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$contractPath = Join-Path $PSScriptRoot 'lib\recovery_contract.ps1'
$orchestratorPath = Join-Path $PSScriptRoot 'lib\recovery_orchestrator.ps1'
. $contractPath

if (-not (Test-Path -LiteralPath $orchestratorPath)) {
    throw "Falta el orquestador productivo: $orchestratorPath"
}
. $orchestratorPath

$script:Checks = 0

function Assert-Equal {
    param([object]$Expected, [object]$Actual, [string]$Message)
    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Esperado=[$Expected] Actual=[$Actual]"
    }
}

function Assert-Sequence {
    param([object[]]$Expected, [object[]]$Actual, [string]$Message)
    $script:Checks++
    if (($Expected -join '|') -ne ($Actual -join '|')) {
        throw "$Message. Esperado=[$($Expected -join ', ')] Actual=[$($Actual -join ', ')]"
    }
}

function New-FakeOperations {
    param(
        [int]$OpenCashSessions = 0,
        [bool]$PreventiveBackupSucceeded = $true,
        [bool]$RestoreSucceeded = $true,
        [bool]$MigrationsSucceeded = $true,
        [bool]$HealthSucceeded = $true,
        [bool]$RollbackSucceeded = $true
    )

    $global:RecoveryTestCalls = @()
    return [pscustomobject]@{
        VerifyPackage = {
            $global:RecoveryTestCalls += 'verify-package'
            return $true
        }
        ValidateDisposable = {
            $global:RecoveryTestCalls += 'validate-disposable'
            return $true
        }
        GetOpenCashSessionCount = {
            $global:RecoveryTestCalls += 'verify-no-open-cash'
            return $OpenCashSessions
        }.GetNewClosure()
        CreatePreventiveBackup = {
            $global:RecoveryTestCalls += 'create-preventive-backup'
            return [pscustomobject]@{
                Succeeded = $PreventiveBackupSucceeded
                PackageReference = 'preventive-package'
            }
        }.GetNewClosure()
        EnterMaintenance = {
            $global:RecoveryTestCalls += 'enter-maintenance'
            return $true
        }
        StopWriters = {
            $global:RecoveryTestCalls += 'stop-writers'
            return $true
        }
        RestoreProduction = {
            $global:RecoveryTestCalls += 'restore-production'
            return $RestoreSucceeded
        }.GetNewClosure()
        RunMigrations = {
            $global:RecoveryTestCalls += 'run-migrations'
            return $MigrationsSucceeded
        }.GetNewClosure()
        VerifyHealth = {
            $global:RecoveryTestCalls += 'verify-health'
            return $HealthSucceeded
        }.GetNewClosure()
        StartWriters = {
            $global:RecoveryTestCalls += 'resume-writers'
            return $true
        }
        ExitMaintenance = {
            $global:RecoveryTestCalls += 'leave-maintenance'
            return $true
        }
        Rollback = {
            param([string]$PackageReference)
            $global:RecoveryTestCalls += "rollback:$PackageReference"
            return $RollbackSucceeded
        }.GetNewClosure()
    }
}

$openCash = Invoke-ProductionRecovery -Operations (New-FakeOperations -OpenCashSessions 1)
Assert-Equal $false $openCash.Success 'Una caja abierta debe bloquear'
Assert-Equal 'OPEN_CASH_SESSIONS' $openCash.Blockers[0].Code 'Debe explicar cajas abiertas'
Assert-Sequence @(
    'verify-package',
    'validate-disposable',
    'verify-no-open-cash'
) $global:RecoveryTestCalls 'Debe bloquear antes del respaldo preventivo'

$backupFailure = Invoke-ProductionRecovery -Operations (New-FakeOperations -PreventiveBackupSucceeded $false)
Assert-Equal $false $backupFailure.Success 'El respaldo preventivo fallido debe bloquear'
Assert-Equal 'PREVENTIVE_BACKUP_FAILED' $backupFailure.Blockers[0].Code 'Debe explicar respaldo fallido'
Assert-Equal $false ($global:RecoveryTestCalls -contains 'enter-maintenance') 'No debe entrar en mantenimiento'

$restoreFailure = Invoke-ProductionRecovery -Operations (New-FakeOperations -RestoreSucceeded $false)
Assert-Equal $false $restoreFailure.Success 'Un restore fallido debe fallar'
Assert-Equal $true $restoreFailure.RollbackAttempted 'Debe intentar rollback'
Assert-Equal $true ($global:RecoveryTestCalls -contains 'rollback:preventive-package') 'Debe usar el paquete preventivo'
Assert-Equal $true $restoreFailure.MaintenanceActive 'Debe mantener la app cerrada'

$healthFailure = Invoke-ProductionRecovery -Operations (New-FakeOperations -HealthSucceeded $false)
Assert-Equal $false $healthFailure.Success 'Un health check fallido debe fallar'
Assert-Equal $true $healthFailure.RollbackAttempted 'Health fallido debe ejecutar rollback'
Assert-Equal $true $healthFailure.MaintenanceActive 'Health fallido no debe levantar mantenimiento'
Assert-Equal $false ($global:RecoveryTestCalls -contains 'leave-maintenance') 'No debe salir de mantenimiento'

$success = Invoke-ProductionRecovery -Operations (New-FakeOperations)
Assert-Equal $true $success.Success 'El flujo seguro debe completar'
Assert-Equal $false $success.MaintenanceActive 'El exito debe levantar mantenimiento'
Assert-Equal $false $success.RollbackAttempted 'El exito no necesita rollback'
Assert-Sequence @(
    'verify-package',
    'validate-disposable',
    'verify-no-open-cash',
    'create-preventive-backup',
    'enter-maintenance',
    'stop-writers',
    'restore-production',
    'run-migrations',
    'verify-health',
    'resume-writers',
    'leave-maintenance'
) $global:RecoveryTestCalls 'El flujo exitoso debe seguir el contrato exacto'

Write-Host "Production recovery self-test passed: $script:Checks checks."
exit 0
