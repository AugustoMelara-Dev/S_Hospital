#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\recovery_validation.ps1')
. (Join-Path $PSScriptRoot 'lib\recovery_docker.ps1')
$dockerRecoverySource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\recovery_docker.ps1') -Raw

$script:Checks = 0

function Assert-Equal {
    param([object]$Expected, [object]$Actual, [string]$Message)
    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Esperado=[$Expected] Actual=[$Actual]"
    }
}

$fixtureRoot = Join-Path $env:TEMP "hospital-docker-recovery-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null

try {
    $backupPath = Join-Path $fixtureRoot 'hospital-backup.sql.gz.enc'
    Set-Content -LiteralPath $backupPath -Value 'encrypted-fixture'
    $checksum = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash

    $valid = Test-DockerProductionRecoveryInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_restore_validation' `
        -ProductionDatabase 'hospital_billing' `
        -DatabaseConfirmation 'hospital_billing' `
        -ActionConfirmation 'RESTAURAR'
    Assert-Equal $true $valid.Valid 'La doble confirmacion exacta debe validar'
    Assert-Equal 0 $valid.Blockers.Count 'La entrada valida no debe tener bloqueos'

    $wrongDatabase = Test-DockerProductionRecoveryInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_restore_validation' `
        -ProductionDatabase 'hospital_billing' `
        -DatabaseConfirmation 'otra_base' `
        -ActionConfirmation 'RESTAURAR'
    Assert-Equal $false $wrongDatabase.Valid 'Una base distinta debe bloquear'
    Assert-Equal 'DATABASE_CONFIRMATION_MISMATCH' $wrongDatabase.Blockers[0] 'Debe explicar confirmacion incorrecta'

    $wrongAction = Test-DockerProductionRecoveryInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_restore_validation' `
        -ProductionDatabase 'hospital_billing' `
        -DatabaseConfirmation 'hospital_billing' `
        -ActionConfirmation 'restaurar'
    Assert-Equal $false $wrongAction.Valid 'RESTAURAR distingue mayusculas'
    Assert-Equal 'ACTION_CONFIRMATION_MISMATCH' $wrongAction.Blockers[0] 'Debe explicar frase incorrecta'

    $unsafeValidation = Test-DockerProductionRecoveryInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_billing' `
        -ProductionDatabase 'hospital_billing' `
        -DatabaseConfirmation 'hospital_billing' `
        -ActionConfirmation 'RESTAURAR'
    Assert-Equal $false $unsafeValidation.Valid 'La validacion no puede usar produccion'
    Assert-Equal 'UNSAFE_VALIDATION_DATABASE' $unsafeValidation.Blockers[0] 'Debe explicar base de validacion insegura'

    $envPath = Join-Path $fixtureRoot '.env'
    Set-Content -LiteralPath $envPath -Value @(
        'DB_DATABASE=hospital_billing',
        'DB_PASSWORD='
    )
    Assert-Equal 'hospital_billing' (Get-RecoveryEnvValue $envPath 'DB_DATABASE') 'Debe leer la base activa'
    Assert-Equal 'fallback' (Get-RecoveryEnvValue $envPath 'MISSING' 'fallback') 'Debe usar default seguro'

    $cacheClearCount = [regex]::Matches($dockerRecoverySource, 'DELETE FROM cache_locks; DELETE FROM cache;').Count
    Assert-Equal 2 $cacheClearCount 'Restore y rollback deben limpiar locks transitorios restaurados'
} finally {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Docker recovery self-test passed: $script:Checks checks."
exit 0
