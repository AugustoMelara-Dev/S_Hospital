#Requires -Version 5.1
# Adaptador Docker de recuperacion. Ejecuta TODO dentro de contenedores:
#   docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan ...
#   docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql sh -lc 'mariadb ...'
# No requiere PHP ni clientes SQL del host.

$recoveryRuntimeLibrary = Join-Path $PSScriptRoot 'recovery_runtime.ps1'
if (Test-Path -LiteralPath $recoveryRuntimeLibrary) {
    . $recoveryRuntimeLibrary
}

function Get-RecoveryDockerProcessInvoker {
    # Invoker para los helpers de runtime (mantenimiento y writers):
    # ejecuta docker directamente y falla cerrado sin salida ruidosa.
    return {
        param([string]$FilePath, [string[]]$Arguments)
        & $FilePath @Arguments 2>&1 | Out-Null
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            throw "Docker Compose fallo en una operacion de recuperacion (codigo $exitCode)."
        }
        return [int]$exitCode
    }
}

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

function Invoke-DockerCountQuery {
    # Ejecuta un SELECT COUNT(*) aislado dentro del contenedor mysql. No usa
    # clientes del host. El SQL llega por here-doc para no depender del quoting
    # de sh y nunca se interpola un nombre de base no validado.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$Database,

        [Parameter(Mandatory = $true)]
        [string]$Sql,

        [switch]$AllowFailure
    )

    if ($Database -notmatch '^[A-Za-z0-9_]+$') {
        throw 'Nombre de base no valido para un conteo de recuperacion.'
    }

    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
    $hereDoc = "$rootClient -N -B '$Database' <<'HOSPITAL_SQL'`n$Sql`nHOSPITAL_SQL"
    $result = Invoke-RecoveryDockerCompose $ComposeFile $EnvFile @(
        'exec', '-T', 'mysql', 'sh', '-lc', $hereDoc
    ) -AllowFailure:$AllowFailure

    if ([int]$result.ExitCode -ne 0) {
        if ($AllowFailure) { return $null }
        throw "El conteo de recuperacion fallo en la base '$Database' (codigo $($result.ExitCode))."
    }

    return Get-RecoveryNumericOutput $result
}

function Get-DockerDatabaseFingerprint {
    # Huella exacta de las tablas criticas de una base. Devuelve $null si la
    # base no existe o no responde: el llamador debe tratarlo como no verificado.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    $counts = @{}
    foreach ($table in (Get-RecoveryCriticalTables)) {
        if ($table -notmatch '^[A-Za-z0-9_]+$') {
            throw 'Nombre de tabla critica no valido.'
        }

        $value = Invoke-DockerCountQuery `
            -ComposeFile $ComposeFile `
            -EnvFile $EnvFile `
            -Database $Database `
            -Sql "SELECT COUNT(*) FROM ``$table``;" `
            -AllowFailure
        if ($null -eq $value) {
            return $null
        }
        $counts[$table] = $value
    }

    return New-RecoveryDatabaseFingerprint -TableCounts $counts
}

function Get-DockerDatabaseIntegrity {
    # Ejecuta el contrato de integridad (relaciones, dinero, metadatos) sobre la
    # base descartable y devuelve el resultado estructurado.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComposeFile,

        [Parameter(Mandatory = $true)]
        [string]$EnvFile,

        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    $measurements = @{}
    foreach ($check in (Get-RecoveryIntegrityChecks)) {
        $sql = Format-RecoveryIntegritySql -Template $check.Sql -Database $Database
        $value = Invoke-DockerCountQuery `
            -ComposeFile $ComposeFile `
            -EnvFile $EnvFile `
            -Database $Database `
            -Sql $sql `
            -AllowFailure
        $measurements[$check.Name] = $value
    }

    return New-RecoveryIntegrityResult -Database $Database -Measurements $measurements
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
    if (-not (Test-RecoveryActionConfirmation -Value $ActionConfirmation)) {
        $blockers += 'ACTION_CONFIRMATION_MISMATCH'
    }

    return [pscustomobject]@{
        Valid = $blockers.Count -eq 0
        Blockers = @($blockers)
    }
}

function Test-DockerDisposableRestoreInput {
    param(
        [string]$BackupFile,
        [string]$ExpectedSha256,
        [string]$ValidationDatabase,
        [string]$ProductionDatabase = ''
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
    if (-not [string]::IsNullOrWhiteSpace($ProductionDatabase) -and
        $ValidationDatabase -ceq $ProductionDatabase) {
        $blockers += 'VALIDATION_DATABASE_MATCHES_PRODUCTION'
    }

    return [pscustomobject]@{
        Valid = $blockers.Count -eq 0
        Blockers = @($blockers)
    }
}

function Invoke-DockerDisposableRestore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$BackupFile,

        [Parameter(Mandatory = $true)]
        [string]$ExpectedSha256,

        [string]$TargetDatabase = 'hospital_billing_test',

        [switch]$WhatIf
    )

    $composeFile = Join-Path $ProjectRoot 'docker-compose.prod.yml'
    $envFile = Join-Path $ProjectRoot '.env'
    if (-not (Test-Path -LiteralPath $composeFile) -or -not (Test-Path -LiteralPath $envFile)) {
        throw 'Faltan docker-compose.prod.yml o .env.'
    }

    $productionDatabase = Get-RecoveryEnvValue -EnvPath $envFile -Name 'DB_DATABASE' -Default 'hospital_billing'
    $inputCheck = Test-DockerDisposableRestoreInput `
        -BackupFile $BackupFile `
        -ExpectedSha256 $ExpectedSha256 `
        -ValidationDatabase $TargetDatabase `
        -ProductionDatabase $productionDatabase
    if (-not $inputCheck.Valid) {
        throw "Validacion descartable bloqueada: $($inputCheck.Blockers -join ', ')."
    }

    $actualSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash
    if ($actualSha256 -cne $ExpectedSha256.ToUpperInvariant()) {
        throw 'El checksum SHA-256 del paquete no coincide.'
    }

    $backupFormat = $null
    if ($BackupFile -match '\.sql\.gz\.enc$' -or $BackupFile -match '\.sql\.enc$') {
        $backupFormat = 'Encrypted'
    } elseif ($BackupFile -match '\.sql$') {
        $backupFormat = 'Plain'
    } else {
        throw 'Formato no soportado para validacion Docker. Use .sql.gz.enc, .sql.enc o .sql.'
    }

    $resolvedBackup = [System.IO.Path]::GetFullPath($BackupFile)
    if ($WhatIf) {
        return [pscustomobject]@{
            Success = $true
            WhatIf = $true
            Database = $TargetDatabase
            BackupFile = $resolvedBackup
        }
    }

    $dockerVersion = & docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose no esta disponible: $dockerVersion"
    }
    if (-not (Test-RecoveryDockerDaemonAvailable)) {
        throw 'El daemon Docker no responde; la validacion descartable no puede ejecutarse.'
    }

    $token = [Guid]::NewGuid().ToString('N')
    $encryptedContainerPath = "/tmp/hospital-validate-$token.enc"
    $sqlBackendPath = "/tmp/hospital-validate-$token.sql"
    $sqlMysqlPath = "/tmp/hospital-validate-$token.sql"
    $hostSqlPath = Join-Path $env:TEMP "hospital-validate-$token.sql"

    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'

    # Huella del sistema original ANTES de tocar la base descartable. La prueba
    # de no-escritura compara contra la huella tomada al terminar.
    $productionFingerprintBefore = Get-DockerDatabaseFingerprint `
        -ComposeFile $composeFile `
        -EnvFile $envFile `
        -Database $productionDatabase

    try {
        if ($backupFormat -eq 'Encrypted') {
            Invoke-RecoveryDockerCompose $composeFile $envFile @(
                'cp', $resolvedBackup, "backend:$encryptedContainerPath"
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
        } else {
            Invoke-RecoveryDockerCompose $composeFile $envFile @(
                'cp', $resolvedBackup, "mysql:$sqlMysqlPath"
            ) | Out-Null
        }

        $recreateValidationSql = "DROP DATABASE IF EXISTS ``$TargetDatabase``; CREATE DATABASE ``$TargetDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient -e '$recreateValidationSql'"
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient '$TargetDatabase' < '$sqlMysqlPath'"
        ) | Out-Null

        $tableCounts = @{}
        foreach ($table in (Get-RecoveryCriticalTables)) {
            $countResult = Invoke-RecoveryDockerCompose $composeFile $envFile @(
                'exec', '-T', 'mysql', 'sh', '-lc',
                "$rootClient -N -B '$TargetDatabase' -e 'SELECT COUNT(*) FROM ``$table``;'"
            )
            $tableCounts[$table] = Get-RecoveryNumericOutput $countResult
        }

        $validationResult = New-RecoveryValidationResult `
            -Database $TargetDatabase `
            -TableCounts $tableCounts
        if (-not $validationResult.Valid) {
            throw 'El paquete no paso la validacion de tablas criticas.'
        }

        $integrityResult = Get-DockerDatabaseIntegrity `
            -ComposeFile $composeFile `
            -EnvFile $envFile `
            -Database $TargetDatabase
        if (-not $integrityResult.Valid) {
            throw "El paquete restaurado no paso la integridad: $($integrityResult.BlockingFailures -join ', ')."
        }

        $productionFingerprintAfter = Get-DockerDatabaseFingerprint `
            -ComposeFile $composeFile `
            -EnvFile $envFile `
            -Database $productionDatabase
        $productionComparison = Test-RecoveryFingerprintUnchanged `
            -Before $productionFingerprintBefore `
            -After $productionFingerprintAfter
        if ($productionComparison.Verified -and -not $productionComparison.Unchanged) {
            throw "La validacion escribio en la base original '$productionDatabase': $($productionComparison.ChangedTables -join ', ')."
        }

        return [pscustomobject]@{
            Success = $true
            WhatIf = $false
            Database = $TargetDatabase
            BackupFile = $resolvedBackup
            Validation = $validationResult
            Integrity = $integrityResult
            ProductionDatabase = $productionDatabase
            ProductionFingerprintVerified = [bool]$productionComparison.Verified
            ProductionFingerprintUnchanged = [bool]$productionComparison.Unchanged
        }
    } finally {
        Remove-Item -LiteralPath $hostSqlPath -Force -ErrorAction SilentlyContinue
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'rm', '-f', $encryptedContainerPath, $sqlBackendPath
        ) -AllowFailure | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'rm', '-f', $sqlMysqlPath
        ) -AllowFailure | Out-Null
    }
}

function Test-RecoveryDockerDaemonAvailable {
    # El runtime de recuperacion exige daemon, no solo el cliente. Sin daemon,
    # un drill real es BLOQUEADO_EXTERNO y no debe simularse.
    [CmdletBinding()]
    param(
        [scriptblock]$Invoker = $null
    )

    $runner = $Invoker
    if ($null -eq $runner) {
        $runner = {
            param([string]$FilePath, [string[]]$Arguments)
            & $FilePath @Arguments 2>&1 | Out-Null
            return [int]$LASTEXITCODE
        }
    }

    try {
        $exitCode = & $runner 'docker' @('version', '--format', '{{.Server.Version}}')
    } catch {
        return $false
    }

    return ([int]$exitCode -eq 0)
}

function Remove-DockerDisposableDatabase {
    # Limpieza acotada: elimina UNICAMENTE la base descartable indicada. Nunca
    # acepta la base productiva ni nombres fuera del prefijo habilitado.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    if (-not (Test-RecoveryDisposableTargetDatabase -Database $Database)) {
        throw "Limpieza rechazada: '$Database' no es una base descartable habilitada."
    }

    $composeFile = Join-Path $ProjectRoot 'docker-compose.prod.yml'
    $envFile = Join-Path $ProjectRoot '.env'
    if (-not (Test-Path -LiteralPath $composeFile) -or -not (Test-Path -LiteralPath $envFile)) {
        throw 'Faltan docker-compose.prod.yml o .env.'
    }

    $productionDatabase = Get-RecoveryEnvValue -EnvPath $envFile -Name 'DB_DATABASE' -Default 'hospital_billing'
    if ($Database -ceq $productionDatabase) {
        throw 'Limpieza rechazada: la base descartable coincide con la base productiva configurada.'
    }

    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
    Invoke-RecoveryDockerCompose $composeFile $envFile @(
        'exec', '-T', 'mysql', 'sh', '-lc',
        "$rootClient -e 'DROP DATABASE IF EXISTS ``$Database``;'"
    ) | Out-Null

    return [pscustomobject]@{
        Dropped = $true
        Database = $Database
        ProductionDatabase = $productionDatabase
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
        $ActionConfirmation = Read-Host "Escriba $(Get-RecoveryActionConfirmation) para continuar"
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

    $recoveryRuntime = Resolve-RecoveryRuntime -ProjectRoot $ProjectRoot -DockerComposeAvailable $true
    if (-not $recoveryRuntime.DockerReady) {
        throw 'El runtime Docker no esta completo para la recuperacion productiva.'
    }
    $dockerProcessInvoker = Get-RecoveryDockerProcessInvoker

    $actualSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash
    if ($actualSha256 -cne $ExpectedSha256.ToUpperInvariant()) {
        throw 'El checksum SHA-256 del paquete no coincide.'
    }

    $dockerVersion = & docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose no esta disponible: $dockerVersion"
    }
    if (-not (Test-RecoveryDockerDaemonAvailable)) {
        throw 'El daemon Docker no responde; la recuperacion productiva no puede ejecutarse.'
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
    $sequenceEmissionBlocked = $false

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
        Enter-HospitalMaintenance -Runtime $recoveryRuntime -Invoker $dockerProcessInvoker | Out-Null
        $maintenanceActive = $true
        Stop-HospitalWriters -Runtime $recoveryRuntime -Invoker $dockerProcessInvoker | Out-Null
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

        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'mysql', 'sh', '-lc',
            "$rootClient '$productionDatabase' -e 'DELETE FROM cache_locks; DELETE FROM cache;'"
        ) | Out-Null
        Write-Step 'Ejecutando migraciones y verificaciones de salud'
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan', 'migrate', '--force'
        ) | Out-Null
        Invoke-RecoveryDockerCompose $composeFile $envFile @(
            'exec', '-T', 'backend', 'php', 'artisan', 'hospital:audit-catalog-rules'
        ) | Out-Null

        Write-Step 'Bloqueando la emision de correlativos hasta reconciliar el restore'
        # HS-RESTORE-SEQUENCE: la copia restaurada puede ser anterior a recibos
        # ya emitidos; el bloqueo se activa ANTES de reanudar writers. Si falla,
        # la excepcion dispara el rollback y el sistema queda en mantenimiento.
        Start-RestoreReconciliation -Runtime $recoveryRuntime -Invoker $dockerProcessInvoker | Out-Null
        $sequenceEmissionBlocked = $true

        Start-HospitalWriters -Runtime $recoveryRuntime -Invoker $dockerProcessInvoker | Out-Null
        $writersStopped = $false
        Exit-HospitalMaintenance -Runtime $recoveryRuntime -Invoker $dockerProcessInvoker | Out-Null
        $maintenanceActive = $false

        return [pscustomobject]@{
            Success = $true
            Validation = $validationResult
            PreventiveBackupId = $preventive.backup_log_id
            PreventiveChecksum = $preventive.checksum_sha256
            SequenceEmissionBlocked = $sequenceEmissionBlocked
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
                Invoke-RecoveryDockerCompose $composeFile $envFile @(
                    'exec', '-T', 'mysql', 'sh', '-lc',
                    "$rootClient '$productionDatabase' -e 'DELETE FROM cache_locks; DELETE FROM cache;'"
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
            SequenceEmissionBlocked = $sequenceEmissionBlocked
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
