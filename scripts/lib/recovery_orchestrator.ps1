#Requires -Version 5.1

function Invoke-RecoveryOperation {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Operations,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [object[]]$Arguments = @()
    )

    $property = $Operations.PSObject.Properties[$Name]
    if ($null -eq $property -or $property.Value -isnot [scriptblock]) {
        throw "Falta la operacion de recuperacion: $Name"
    }

    return & $property.Value @Arguments
}

function New-ProductionRecoveryResult {
    param(
        [bool]$Success,
        [object[]]$Blockers = @(),
        [bool]$MaintenanceActive = $false,
        [bool]$RollbackAttempted = $false,
        [bool]$RollbackSucceeded = $false
    )

    return [pscustomobject]@{
        Success = $Success
        Blockers = @($Blockers)
        MaintenanceActive = $MaintenanceActive
        RollbackAttempted = $RollbackAttempted
        RollbackSucceeded = $RollbackSucceeded
    }
}

function New-RecoveryBlocker {
    param([string]$Code, [string]$Message)
    return [pscustomobject]@{
        Code = $Code
        Message = $Message
    }
}

function Invoke-ProductionRecovery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Operations
    )

    if ((Invoke-RecoveryOperation -Operations $Operations -Name 'VerifyPackage') -ne $true) {
        return New-ProductionRecoveryResult -Success $false -Blockers @(
            (New-RecoveryBlocker 'CHECKSUM_NOT_VERIFIED' 'El paquete no paso la verificacion SHA-256.')
        )
    }

    if ((Invoke-RecoveryOperation -Operations $Operations -Name 'ValidateDisposable') -ne $true) {
        return New-ProductionRecoveryResult -Success $false -Blockers @(
            (New-RecoveryBlocker 'DISPOSABLE_VALIDATION_FAILED' 'El paquete no paso la validacion descartable.')
        )
    }

    $openCashSessionCount = [int](Invoke-RecoveryOperation -Operations $Operations -Name 'GetOpenCashSessionCount')
    if ($openCashSessionCount -ne 0) {
        return New-ProductionRecoveryResult -Success $false -Blockers @(
            (New-RecoveryBlocker 'OPEN_CASH_SESSIONS' 'Hay cajas abiertas.')
        )
    }

    $preventiveBackup = Invoke-RecoveryOperation -Operations $Operations -Name 'CreatePreventiveBackup'
    if ($null -eq $preventiveBackup -or $preventiveBackup.Succeeded -ne $true) {
        return New-ProductionRecoveryResult -Success $false -Blockers @(
            (New-RecoveryBlocker 'PREVENTIVE_BACKUP_FAILED' 'No se pudo crear el respaldo preventivo.')
        )
    }

    $maintenanceActive = $false
    $replacementStarted = $false
    $failureCode = $null
    $failureMessage = $null

    try {
        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'EnterMaintenance') -ne $true) {
            return New-ProductionRecoveryResult -Success $false -Blockers @(
                (New-RecoveryBlocker 'MAINTENANCE_FAILED' 'No se pudo activar mantenimiento.')
            )
        }
        $maintenanceActive = $true

        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'StopWriters') -ne $true) {
            return New-ProductionRecoveryResult `
                -Success $false `
                -MaintenanceActive $true `
                -Blockers @((New-RecoveryBlocker 'STOP_WRITERS_FAILED' 'No se pudieron detener los procesos escritores.'))
        }

        $replacementStarted = $true
        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'RestoreProduction') -ne $true) {
            $failureCode = 'RESTORE_FAILED'
            $failureMessage = 'La sustitucion de la base productiva fallo.'
            throw $failureMessage
        }

        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'RunMigrations') -ne $true) {
            $failureCode = 'MIGRATIONS_FAILED'
            $failureMessage = 'Las migraciones posteriores al restore fallaron.'
            throw $failureMessage
        }

        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'VerifyHealth') -ne $true) {
            $failureCode = 'HEALTH_CHECK_FAILED'
            $failureMessage = 'La verificacion de salud posterior al restore fallo.'
            throw $failureMessage
        }

        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'StartWriters') -ne $true) {
            return New-ProductionRecoveryResult `
                -Success $false `
                -MaintenanceActive $true `
                -Blockers @((New-RecoveryBlocker 'START_WRITERS_FAILED' 'No se pudieron reanudar los procesos escritores.'))
        }

        if ((Invoke-RecoveryOperation -Operations $Operations -Name 'ExitMaintenance') -ne $true) {
            return New-ProductionRecoveryResult `
                -Success $false `
                -MaintenanceActive $true `
                -Blockers @((New-RecoveryBlocker 'EXIT_MAINTENANCE_FAILED' 'No se pudo desactivar mantenimiento.'))
        }
        $maintenanceActive = $false

        return New-ProductionRecoveryResult -Success $true
    } catch {
        if (-not $replacementStarted) {
            return New-ProductionRecoveryResult `
                -Success $false `
                -MaintenanceActive $maintenanceActive `
                -Blockers @((New-RecoveryBlocker 'RECOVERY_FAILED' 'La recuperacion fallo antes de sustituir la base.'))
        }

        $rollbackSucceeded = $false
        try {
            $rollbackSucceeded = (Invoke-RecoveryOperation `
                -Operations $Operations `
                -Name 'Rollback' `
                -Arguments @([string]$preventiveBackup.PackageReference)) -eq $true
        } catch {
            $rollbackSucceeded = $false
        }

        return New-ProductionRecoveryResult `
            -Success $false `
            -MaintenanceActive $true `
            -RollbackAttempted $true `
            -RollbackSucceeded $rollbackSucceeded `
            -Blockers @((New-RecoveryBlocker $failureCode $failureMessage))
    }
}
