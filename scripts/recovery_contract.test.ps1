#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$contractPath = Join-Path $PSScriptRoot 'lib\recovery_contract.ps1'

if (-not (Test-Path -LiteralPath $contractPath)) {
    throw "Falta el contrato de recuperacion: $contractPath"
}

. $contractPath

$script:Checks = 0

function Assert-Equal {
    param(
        [object]$Expected,
        [object]$Actual,
        [string]$Message
    )

    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Esperado=[$Expected] Actual=[$Actual]"
    }
}

function Assert-Sequence {
    param(
        [string[]]$Expected,
        [string[]]$Actual,
        [string]$Message
    )

    $script:Checks++
    if (($Expected -join '|') -ne ($Actual -join '|')) {
        throw "$Message. Esperado=[$($Expected -join ', ')] Actual=[$($Actual -join ', ')]"
    }
}

$productionSteps = Get-RecoverySteps -Mode Production
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
) $productionSteps 'El orden productivo debe ser determinista'

Assert-Sequence @(
    'verify-package',
    'validate-disposable'
) (Get-RecoverySteps -Mode Validation) 'La validacion no debe incluir reemplazo productivo'

$allowed = Test-ProductionRecoveryAllowed -State ([pscustomobject]@{
    ChecksumVerified = $true
    DisposableValidationPassed = $true
    OpenCashSessionCount = 0
    PreventiveBackupSucceeded = $true
})
Assert-Equal $true $allowed.Allowed 'El estado seguro debe permitir recuperacion'
Assert-Equal 0 $allowed.Blockers.Count 'El estado seguro no debe tener bloqueos'

$cases = @(
    @{
        State = [pscustomobject]@{
            ChecksumVerified = $false
            DisposableValidationPassed = $true
            OpenCashSessionCount = 0
            PreventiveBackupSucceeded = $true
        }
        Code = 'CHECKSUM_NOT_VERIFIED'
    },
    @{
        State = [pscustomobject]@{
            ChecksumVerified = $true
            DisposableValidationPassed = $false
            OpenCashSessionCount = 0
            PreventiveBackupSucceeded = $true
        }
        Code = 'DISPOSABLE_VALIDATION_FAILED'
    },
    @{
        State = [pscustomobject]@{
            ChecksumVerified = $true
            DisposableValidationPassed = $true
            OpenCashSessionCount = 1
            PreventiveBackupSucceeded = $true
        }
        Code = 'OPEN_CASH_SESSIONS'
    },
    @{
        State = [pscustomobject]@{
            ChecksumVerified = $true
            DisposableValidationPassed = $true
            OpenCashSessionCount = 0
            PreventiveBackupSucceeded = $false
        }
        Code = 'PREVENTIVE_BACKUP_FAILED'
    }
)

foreach ($case in $cases) {
    $result = Test-ProductionRecoveryAllowed -State $case.State
    Assert-Equal $false $result.Allowed "El bloqueo $($case.Code) debe impedir recuperacion"
    Assert-Sequence @($case.Code) @($result.Blockers.Code) "Debe reportar el bloqueo $($case.Code)"
}

Write-Host "Recovery contract self-test passed: $script:Checks checks."
exit 0
