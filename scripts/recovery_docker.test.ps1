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

    $oldConsolePhrase = Test-DockerProductionRecoveryInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_restore_validation' `
        -ProductionDatabase 'hospital_billing' `
        -DatabaseConfirmation 'hospital_billing' `
        -ActionConfirmation 'RESTAURAR PRODUCCION'
    Assert-Equal $false $oldConsolePhrase.Valid 'La frase vieja de la consola debe bloquear'
    Assert-Equal 'ACTION_CONFIRMATION_MISMATCH' $oldConsolePhrase.Blockers[0] 'Debe explicar la frase vieja incorrecta'
    Assert-Equal 'RESTAURAR' (Get-RecoveryActionConfirmation) 'La frase compartida debe ser RESTAURAR'

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

    $validDisposable = Test-DockerDisposableRestoreInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_billing_test' `
        -ProductionDatabase 'hospital_billing'
    Assert-Equal $true $validDisposable.Valid 'La validacion descartable Docker debe aceptar el destino seguro'

    $unsafeDisposable = Test-DockerDisposableRestoreInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_billing' `
        -ProductionDatabase 'hospital_billing'
    Assert-Equal $false $unsafeDisposable.Valid 'El destino productivo debe bloquear la validacion'
    Assert-Equal 'UNSAFE_VALIDATION_DATABASE' $unsafeDisposable.Blockers[0] 'Debe explicar destino inseguro'

    $collidesWithProduction = Test-DockerDisposableRestoreInput `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -ValidationDatabase 'hospital_restore_2026' `
        -ProductionDatabase 'hospital_restore_2026'
    Assert-Equal $false $collidesWithProduction.Valid 'El destino no puede ser la base productiva configurada'
    Assert-Equal $true ($collidesWithProduction.Blockers -contains 'VALIDATION_DATABASE_MATCHES_PRODUCTION') 'Debe explicar colision con produccion'

    $recoveryComposeFile = Join-Path $fixtureRoot 'docker-compose.prod.yml'
    $recoveryEnvFile = Join-Path $fixtureRoot '.env'
    Set-Content -LiteralPath $recoveryComposeFile -Value 'services: {}'
    Set-Content -LiteralPath $recoveryEnvFile -Value @('DB_DATABASE=hospital_billing')

    $whatIfPlan = Invoke-DockerDisposableRestore `
        -ProjectRoot $fixtureRoot `
        -BackupFile $backupPath `
        -ExpectedSha256 $checksum `
        -TargetDatabase 'hospital_billing_test' `
        -WhatIf
    Assert-Equal $true $whatIfPlan.Success 'WhatIf debe devolver un plan valido'
    Assert-Equal $true $whatIfPlan.WhatIf 'WhatIf debe marcarse como simulacion'
    Assert-Equal 'hospital_billing_test' $whatIfPlan.Database 'WhatIf debe conservar el destino descartable'

    $whatIfBlocked = $false
    try {
        Invoke-DockerDisposableRestore `
            -ProjectRoot $fixtureRoot `
            -BackupFile $backupPath `
            -ExpectedSha256 $checksum `
            -TargetDatabase 'hospital_billing' `
            -WhatIf | Out-Null
    } catch {
        $whatIfBlocked = $true
    }
    Assert-Equal $true $whatIfBlocked 'WhatIf no debe aceptar una base productiva'

    $cacheClearCount = [regex]::Matches($dockerRecoverySource, 'DELETE FROM cache_locks; DELETE FROM cache;').Count
    Assert-Equal 2 $cacheClearCount 'Restore y rollback deben limpiar locks transitorios restaurados'

    # Guarda de daemon: sin daemon no se simula un drill real.
    $script:DaemonInvocations = @()
    $daemonUp = Test-RecoveryDockerDaemonAvailable -Invoker {
        param([string]$FilePath, [string[]]$Arguments)
        $script:DaemonInvocations += @($Arguments -join ' ')
        return 0
    }
    Assert-Equal $true $daemonUp 'El daemon disponible debe detectarse'
    Assert-Equal $true ($script:DaemonInvocations[0] -match 'version --format') 'La deteccion debe preguntar por el servidor Docker'
    $daemonDown = Test-RecoveryDockerDaemonAvailable -Invoker {
        param([string]$FilePath, [string[]]$Arguments)
        return 1
    }
    Assert-Equal $false $daemonDown 'Un daemon caido debe reportarse'
    $daemonThrows = Test-RecoveryDockerDaemonAvailable -Invoker {
        param([string]$FilePath, [string[]]$Arguments)
        throw 'sin docker'
    }
    Assert-Equal $false $daemonThrows 'Un invocador que falla no debe dar el daemon por disponible'

    # Limpieza acotada: jamas acepta la base productiva ni nombres no habilitados.
    foreach ($forbiddenDatabase in @('hospital_billing', 'mysql', 'hospital_billing_prod', 'hospital')) {
        $cleanupRejected = $false
        try {
            Remove-DockerDisposableDatabase -ProjectRoot $fixtureRoot -Database $forbiddenDatabase | Out-Null
        } catch {
            $cleanupRejected = $true
        }
        Assert-Equal $true $cleanupRejected "La limpieza debe rechazar $forbiddenDatabase"
    }

    $cleanupFunction = [regex]::Match($dockerRecoverySource, '(?s)function Remove-DockerDisposableDatabase.*?(?=function )').Value
    Assert-Equal $true ($cleanupFunction -match 'DROP DATABASE IF EXISTS') 'La limpieza debe limitarse a DROP DATABASE IF EXISTS'
    Assert-Equal $true ($cleanupFunction -match 'Test-RecoveryDisposableTargetDatabase') 'La limpieza debe validar el prefijo descartable'

    # HS-RESTORE-SEQUENCE: el bloqueo va antes de reabrir writers y no aplica al disposable.
    $productionFunction = [regex]::Match($dockerRecoverySource, '(?s)function Invoke-DockerGuardedProductionRecovery.*$').Value
    $blockIndex = $productionFunction.IndexOf('Start-RestoreReconciliation')
    $writersIndex = $productionFunction.IndexOf('Start-HospitalWriters')
    Assert-Equal $true ($blockIndex -ge 0) 'La recuperacion productiva debe bloquear correlativos'
    Assert-Equal $true ($blockIndex -lt $writersIndex) 'El bloqueo debe ejecutarse antes de reanudar writers'

    $disposableFunction = [regex]::Match($dockerRecoverySource, '(?s)function Invoke-DockerDisposableRestore.*?(?=function )').Value
    Assert-Equal $false ($disposableFunction -match 'Start-RestoreReconciliation') 'La validacion descartable no debe tocar el bloqueo productivo'
    Assert-Equal $true ($disposableFunction -match 'Get-DockerDatabaseIntegrity') 'La validacion descartable debe ejecutar integridad'
    Assert-Equal $true ($disposableFunction -match 'Get-DockerDatabaseFingerprint') 'La validacion descartable debe tomar huella del original'
    Assert-Equal $true ($disposableFunction -match 'Test-RecoveryFingerprintUnchanged') 'La validacion descartable debe probar que el original no cambio'

    $daemonGuardCount = [regex]::Matches($dockerRecoverySource, 'Test-RecoveryDockerDaemonAvailable').Count
    Assert-Equal $true ($daemonGuardCount -ge 3) 'Ambos caminos de recuperacion deben exigir daemon antes de escribir'
} finally {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Docker recovery self-test passed: $script:Checks checks."
exit 0
