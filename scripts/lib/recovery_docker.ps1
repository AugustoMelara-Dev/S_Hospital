#Requires -Version 5.1

function Get-RecoveryEnvValue {
    param(
        [string]$EnvPath,
        [string]$Name,
        [string]$Default = ''
    )

    if (-not (Test-Path -LiteralPath $EnvPath)) {
        return $Default
    }

    $match = Get-Content -LiteralPath $EnvPath |
        Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
        Select-Object -Last 1
    if (-not $match) {
        return $Default
    }

    return (($match -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

function Invoke-RecoveryDockerCompose {
    param(
        [string]$ComposeFile,
        [string]$EnvFile,
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $allArguments = @(
        'compose',
        '-f', $ComposeFile,
        '--env-file', $EnvFile
    ) + $Arguments
    $output = & docker @allArguments 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "Docker Compose fallo en una operacion de recuperacion (codigo $exitCode)."
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output | ForEach-Object { [string]$_ })
    }
}

function Get-RecoveryNumericOutput {
    param([object]$Result)

    $candidate = @($Result.Output |
        ForEach-Object { ([string]$_).Trim() } |
        Where-Object { $_ -match '^\d+$' } |
        Select-Object -Last 1)
    if ($candidate.Count -ne 1) {
        throw 'MySQL no devolvio un conteo numerico verificable.'
    }

    return [int]$candidate[0]
}

function Test-DockerProductionRecoveryInput {
    param(
        [string]$BackupFile,
        [string]$ExpectedSha256,
        [string]$ValidationDatabase,
        [string]$ProductionDatabase,
        [string]$DatabaseConfirmation,
        [string]$ActionConfirmation
    )

    $blockers = @()

    if (-not (Test-Path -LiteralPath $BackupFile)) {
        $blockers += 'BACKUP_NOT_FOUND'
    }
    if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') {
        $blockers += 'INVALID_CHECKSUM'
    }
    if (-not (Test-RecoveryDisposableDatabaseName -Database $ValidationDatabase)) {
        $blockers += 'UNSAFE_VALIDATION_DATABASE'
    }
    if ($ProductionDatabase -notmatch '^[A-Za-z0-9_]+$' -or
        $ProductionDatabase -in @('mysql', 'information_schema', 'performance_schema', 'sys')) {
        $blockers += 'UNSAFE_PRODUCTION_DATABASE'
    }
    if ($DatabaseConfirmation -cne $ProductionDatabase) {
        $blockers += 'DATABASE_CONFIRMATION_MISMATCH'
    }
    if ($ActionConfirmation -cne 'RESTAURAR') {
        $blockers += 'ACTION_CONFIRMATION_MISMATCH'
    }

    return [pscustomobject]@{
        Valid = $blockers.Count -eq 0
        Blockers = @($blockers)
    }
}

function Invoke-DockerGuardedProductionRecovery {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot,
        [string]$BackupFile,
        [string]$ExpectedSha256,
        [string]$ValidationDatabase,
        [string]$DatabaseConfirmation = '',
        [string]$ActionConfirmation = ''
    )

    $composeFile = Join-Path $ProjectRoot 'docker-compose.prod.yml'
    $envFile = Join-Path $ProjectRoot '.env'
    $productionDatabase = Get-RecoveryEnvValue -EnvPath $envFile -Name 'DB_DATABASE' -Default 'hospital_billing'

    if ([string]::IsNullOrWhiteSpace($DatabaseConfirmation)) {
        $DatabaseConfirmation = Read-Host "Escriba el nombre de la base activa ($productionDatabase)"
    }
    if ([string]::IsNullOrWhiteSpace($ActionConfirmation)) {
        $ActionConfirmation = Read-Host 'Escriba RESTAURAR para continuar'
    }

    $inputCheck = Test-DockerProductionRecoveryInput `
        -BackupFile $BackupFile `
        -ExpectedSha256 $ExpectedSha256 `
        -ValidationDatabase $ValidationDatabase `
        -ProductionDatabase $productionDatabase `
        -DatabaseConfirmation $DatabaseConfirmation `
        -ActionConfirmation $ActionConfirmation
    if (-not $inputCheck.Valid) {
        throw "Recuperacion productiva bloqueada: $($inputCheck.Blockers -join ', ')."
    }

    if (-not (Test-Path -LiteralPath $composeFile) -or -not (Test-Path -LiteralPath $envFile)) {
        throw 'Faltan docker-compose.prod.yml o .env.'
    }

    $actualSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash
    if ($actualSha256 -cne $ExpectedSha256.ToUpperInvariant()) {
        throw 'El checksum SHA-256 del paquete no coincide.'
    }

    $dockerVersion = & docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose no esta disponible: $dockerVersion"
    }

    $token = [Guid]::NewGuid().ToString('N')
    $encryptedContainerPath = "/tmp/hospital-recovery-$token.enc"
    $sqlBackendPath = "/tmp/hospital-recovery-$token.sql"
    $sqlMysqlPath = "/tmp/hospital-recovery-$token.sql"
    $preventiveBackendPath = "/tmp/hospital-preventive-$token.sql"
    $preventiveMysqlPath = "/tmp/hospital-preventive-$token.sql"
    $hostSqlPath = Join-Path $env:TEMP "hospital-recovery-$token.sql"
    $hostPreventivePath = Join-Path $env:TEMP "hospital-preventive-$token.sql"
    $maintenanceActive = $false
    $writersStopped = $false
    $replacementStarted = $false
    $preventiveReady = $false

    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
    $appClient = 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD"'

    try {
        Write-Step 'Copiando y descifrando el paquete dentro del backend local'
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'cp', $BackupFile, "backend:$encryptedContainerPath"
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan',
            'hospital:decrypt-backup', $encryptedContainerPath, $sqlBackendPath
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'cp', "backend:$sqlBackendPath", $hostSqlPath
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'cp', $hostSqlPath, "mysql:$sqlMysqlPath"
        ) | Out-Null

        Write-Step "Validando el paquete en la base descartable $ValidationDatabase"
        $recreateValidationSql = "DROP DATABASE IF EXISTS ``$ValidationDatabase``; CREATE DATABASE ``$ValidationDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient -e '$recreateValidationSql'"
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient '$ValidationDatabase' < '$sqlMysqlPath'"
        ) | Out-Null

        $tableCounts = @{}
        foreach ($table in (Get-RecoveryCriticalTables)) {
            $countResult = Invoke-RecoveryDockerCompose $composeFile $envFile @(
                'exec', '-T', 'mysql', 'sh', '-lc',
                "$rootClient -N -B '$ValidationDatabase' -e 'SELECT COUNT(*) FROM ``$table``;'"
            )
            $tableCounts[$table] = Get-RecoveryNumericOutput $countResult
        }
        $validationResult = New-RecoveryValidationResult `
            -Database $ValidationDatabase `
            -TableCounts $tableCounts
        if (-not $validationResult.Valid) {
            throw 'El paquete no paso la validacion de tablas criticas.'
        }

        Write-Step 'Verificando que no existan cajas abiertas'
        $openCashResult = Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$appClient -N -B `"$productionDatabase`" -e `"SELECT COUNT(*) FROM cash_register_sessions WHERE status = 'open';`""
        )
        if ((Get-RecoveryNumericOutput $openCashResult) -ne 0) {
            throw 'Hay cajas abiertas. Cierre todas las cajas antes de restaurar.'
        }

        Write-Step 'Creando respaldo preventivo para rollback'
        $backupResult = Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan',
            'hospital:backup', '--type=manual', '--json'
        )
        $backupJsonLine = $backupResult.Output |
            Where-Object { $_.Trim().StartsWith('{') } |
            Select-Object -Last 1
        $preventive = $backupJsonLine | ConvertFrom-Json
        if ($preventive.status -ne 'success' -or
            [string]$preventive.checksum_sha256 -notmatch '^[a-f0-9]{64}$' -or
            [string]$preventive.filename -notmatch '^[A-Za-z0-9_.-]+\.sql\.gz\.enc$') {
            throw 'El respaldo preventivo no devolvio evidencia valida.'
        }

        $preventiveEncryptedPath = "/var/www/html/storage/app/private/backups/$($preventive.filename)"
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan',
            'hospital:decrypt-backup', $preventiveEncryptedPath, $preventiveBackendPath
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'cp', "backend:$preventiveBackendPath", $hostPreventivePath
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'cp', $hostPreventivePath, "mysql:$preventiveMysqlPath"
        ) | Out-Null
        $preventiveReady = $true

        Write-Step 'Activando mantenimiento y deteniendo procesos escritores'
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan',
            'hospital:maintenance', 'on',
            '--message=Restauracion local en progreso'
        ) | Out-Null
        $maintenanceActive = $true
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'stop', 'queue-worker', 'realtime-worker', 'scheduler'
        ) | Out-Null
        $writersStopped = $true

        Write-Step 'Sustituyendo la base productiva'
        $replacementStarted = $true
        $recreateProductionSql = "DROP DATABASE IF EXISTS ``$productionDatabase``; CREATE DATABASE ``$productionDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient -e '$recreateProductionSql'"
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient '$productionDatabase' < '$sqlMysqlPath'"
        ) | Out-Null

        Write-Step 'Ejecutando migraciones y verificaciones de salud'
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan', 'migrate', '--force'
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan', 'hospital:audit-catalog-rules'
        ) | Out-Null

        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'up', '-d', 'queue-worker', 'realtime-worker', 'scheduler'
        ) | Out-Null
        $writersStopped = $false
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan', 'hospital:maintenance', 'off'
        ) | Out-Null
        $maintenanceActive = $false

        return [pscustomobject]@{
            Success = $true
            Validation = $validationResult
            PreventiveBackupId = $preventive.backup_log_id
            PreventiveChecksum = $preventive.checksum_sha256
            RollbackAttempted = $false
        }
    } catch {
        $failure = $_
        $rollbackAttempted = $false
        $rollbackSucceeded = $false

        if ($replacementStarted -and $preventiveReady) {
            $rollbackAttempted = $true
            try {
                Write-Warning 'La recuperacion fallo; ejecutando rollback preventivo.'
                $recreateProductionSql = "DROP DATABASE IF EXISTS ``$productionDatabase``; CREATE DATABASE ``$productionDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                Invoke-RecoveryDockerCompose $composeFile $envFile @(
                    'exec', '-T', 'mysql', 'sh', '-lc',
                    "$rootClient -e '$recreateProductionSql'"
                ) | Out-Null
                Invoke-RecoveryDockerCompose $composeFile $envFile @(
                    'exec', '-T', 'mysql', 'sh', '-lc',
                    "$rootClient '$productionDatabase' < '$preventiveMysqlPath'"
                ) | Out-Null
                $rollbackSucceeded = $true
            } catch {
                $rollbackSucceeded = $false
            }
        }

        return [pscustomobject]@{
            Success = $false
            Error = [string]$failure.Exception.Message
            MaintenanceActive = $maintenanceActive
            WritersStopped = $writersStopped
            RollbackAttempted = $rollbackAttempted
            RollbackSucceeded = $rollbackSucceeded
        }
    } finally {
        Remove-Item -LiteralPath $hostSqlPath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $hostPreventivePath -Force -ErrorAction SilentlyContinue
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'rm', '-f',
            $encryptedContainerPath, $sqlBackendPath, $preventiveBackendPath
        ) -AllowFailure | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'rm', '-f',
            $sqlMysqlPath, $preventiveMysqlPath
        ) -AllowFailure | Out-Null
    }
}
