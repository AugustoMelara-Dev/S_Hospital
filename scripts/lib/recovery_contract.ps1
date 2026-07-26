#Requires -Version 5.1

function Get-RecoverySteps {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Validation', 'Production')]
        [string]$Mode
    )

    if ($Mode -eq 'Validation') {
        return @(
            'verify-package',
            'validate-disposable'
        )
    }

    return @(
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
    )
}

function Get-RecoveryStateValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$State,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [object]$Default = $null
    )

    $property = $State.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $Default
    }

    return $property.Value
}

function Test-ProductionRecoveryAllowed {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$State
    )

    $blockers = @()

    if ((Get-RecoveryStateValue -State $State -Name 'ChecksumVerified' -Default $false) -ne $true) {
        $blockers += [pscustomobject]@{
            Code = 'CHECKSUM_NOT_VERIFIED'
            Message = 'El paquete no tiene un checksum SHA-256 verificado.'
        }
    }

    if ((Get-RecoveryStateValue -State $State -Name 'DisposableValidationPassed' -Default $false) -ne $true) {
        $blockers += [pscustomobject]@{
            Code = 'DISPOSABLE_VALIDATION_FAILED'
            Message = 'El respaldo no paso la validacion en base descartable.'
        }
    }

    $openCashSessionCount = Get-RecoveryStateValue -State $State -Name 'OpenCashSessionCount' -Default 1
    if ($null -eq $openCashSessionCount -or [int]$openCashSessionCount -ne 0) {
        $blockers += [pscustomobject]@{
            Code = 'OPEN_CASH_SESSIONS'
            Message = 'Hay cajas abiertas; deben cerrarse antes de restaurar.'
        }
    }

    if ((Get-RecoveryStateValue -State $State -Name 'PreventiveBackupSucceeded' -Default $false) -ne $true) {
        $blockers += [pscustomobject]@{
            Code = 'PREVENTIVE_BACKUP_FAILED'
            Message = 'No existe un respaldo preventivo exitoso para rollback.'
        }
    }

    return [pscustomobject]@{
        Allowed = $blockers.Count -eq 0
        Blockers = @($blockers)
    }
}
