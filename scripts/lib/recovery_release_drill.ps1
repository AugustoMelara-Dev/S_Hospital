Set-StrictMode -Version Latest

function Test-RecoveryDrillIsolation {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $SourceDatabase,
        [Parameter(Mandatory = $true)]
        [string] $TargetDatabase,
        [Parameter(Mandatory = $true)]
        [string] $ConfiguredProductionDatabase,
        [Parameter(Mandatory = $true)]
        [string] $EvidencePath
    )

    $blockers = New-Object System.Collections.Generic.List[string]
    $projectPattern = '\As_hospital_recovery_[a-z0-9][a-z0-9_-]{5,48}\z'
    $databasePattern = '\A[a-z0-9_]{8,64}\z'

    if ($ComposeProject -cnotmatch $projectPattern) {
        $blockers.Add('Compose project must use the s_hospital_recovery_ isolation prefix.')
    }

    foreach ($database in @($SourceDatabase, $TargetDatabase)) {
        if ($database -cnotmatch $databasePattern -or $database -notmatch 'recovery') {
            $blockers.Add("Database '$database' is not an explicit recovery database.")
        }
    }

    if ($SourceDatabase.Equals($TargetDatabase, [System.StringComparison]::OrdinalIgnoreCase)) {
        $blockers.Add('Recovery source and target databases must be different.')
    }

    foreach ($database in @($SourceDatabase, $TargetDatabase)) {
        if ($database.Equals($ConfiguredProductionDatabase, [System.StringComparison]::OrdinalIgnoreCase)) {
            $blockers.Add("Recovery drill refuses the configured production database '$ConfiguredProductionDatabase'.")
        }
    }

    if (
        [System.IO.Path]::IsPathRooted($EvidencePath) -or
        $EvidencePath.Contains('..') -or
        $EvidencePath.Contains('/') -or
        -not $EvidencePath.StartsWith('qa\', [System.StringComparison]::OrdinalIgnoreCase) -or
        -not $EvidencePath.EndsWith('.md', [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        $blockers.Add('Recovery evidence path must be a relative Markdown file under qa\.')
    }

    return [pscustomobject]@{
        Allowed = $blockers.Count -eq 0
        Blockers = @($blockers)
    }
}

function Invoke-RecoveryDrillDocker {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    Write-Host "[recovery-drill] $Label"
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& docker @Arguments 2>&1)
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $exitCode = $LASTEXITCODE
    $text = @($output | ForEach-Object { [string] $_ })

    if ($exitCode -ne 0) {
        $safeTail = ($text | Select-Object -Last 40) -join [Environment]::NewLine
        throw "$Label failed with exit code $exitCode. $safeTail"
    }

    return $text
}

function Get-RecoveryDrillComposeArguments {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    return @('compose', '-p', $ComposeProject) + $Arguments
}

function Initialize-RecoveryDrillBackendImage {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject
    )

    $targetImage = "$ComposeProject-backend:latest"
    $availableImages = Invoke-RecoveryDrillDocker `
        -Label 'Inspect local Docker images for offline recovery drill' `
        -Arguments @('image', 'ls', '--format', '{{.Repository}}:{{.Tag}}')
    $sourceImage = @(
        's_hospital-backend:latest',
        's_hospital-backend-dev:latest'
    ) | Where-Object { $availableImages -contains $_ } | Select-Object -First 1

    if ([string]::IsNullOrWhiteSpace($sourceImage)) {
        throw 'Recovery drill requires a local S_Hospital backend image; build the normal local stack once while installation media is available.'
    }

    Invoke-RecoveryDrillDocker `
        -Label 'Tag local backend image for isolated recovery project' `
        -Arguments @('image', 'tag', $sourceImage, $targetImage) | Out-Null

    return $targetImage
}

function ConvertFrom-RecoveryBackupJson {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Output
    )

    foreach ($line in @($Output | Select-Object -Last 20)) {
        $candidate = $line.Trim()
        if (-not ($candidate.StartsWith('{') -and $candidate.EndsWith('}'))) {
            continue
        }

        try {
            $result = $candidate | ConvertFrom-Json
            if ($null -ne $result.status) {
                return $result
            }
        } catch {
            continue
        }
    }

    throw 'Backup command did not emit a machine-readable JSON result.'
}

function Invoke-RecoveryDrillMysql {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $Command,
        [string] $Label = 'Run isolated MariaDB command'
    )

    return Invoke-RecoveryDrillDocker `
        -Label $Label `
        -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
            'exec', '-T', 'mysql', 'sh', '-lc', $Command
        ))
}

function Reset-RecoveryDrillDatabase {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $Database,
        [Parameter(Mandatory = $true)]
        [string] $SqlContainerPath
    )

    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
    Invoke-RecoveryDrillMysql `
        -ComposeProject $ComposeProject `
        -Label "Recreate isolated database $Database" `
        -Command "$rootClient -e 'DROP DATABASE IF EXISTS $Database; CREATE DATABASE $Database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON $Database.* TO hospital_recovery; FLUSH PRIVILEGES;'"
    Invoke-RecoveryDrillMysql `
        -ComposeProject $ComposeProject `
        -Label "Import isolated database $Database" `
        -Command "$rootClient $Database < $SqlContainerPath"
}

function Copy-RecoveryDrillSqlToMysql {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $BackendPath,
        [Parameter(Mandatory = $true)]
        [string] $HostPath,
        [Parameter(Mandatory = $true)]
        [string] $MysqlPath
    )

    Invoke-RecoveryDrillDocker `
        -Label 'Copy decrypted SQL from isolated backend' `
        -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
            'cp', "backend:$BackendPath", $HostPath
        ))
    Invoke-RecoveryDrillDocker `
        -Label 'Stage decrypted SQL in isolated MariaDB' `
        -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
            'cp', $HostPath, "mysql:$MysqlPath"
        ))
}

function Get-RecoveryDrillCriticalTableCount {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $Database
    )

    $criticalTables = @(
        'users', 'roles', 'permissions', 'services', 'invoices',
        'invoice_items', 'payments', 'cash_register_sessions',
        'cash_movements', 'backup_logs'
    )
    $rootClient = 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"'
    $output = Invoke-RecoveryDrillMysql `
        -ComposeProject $ComposeProject `
        -Label "List critical tables in $Database" `
        -Command "$rootClient -N $Database -e 'SHOW TABLES;'"
    $presentTables = @($output | ForEach-Object { ([string] $_).Trim() })
    $value = @($criticalTables | Where-Object { $presentTables -contains $_ }).Count

    return $value
}

function Invoke-IsolatedRecoveryDrill {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ProjectRoot,
        [Parameter(Mandatory = $true)]
        [string] $ComposeProject,
        [Parameter(Mandatory = $true)]
        [string] $SourceDatabase,
        [Parameter(Mandatory = $true)]
        [string] $TargetDatabase,
        [Parameter(Mandatory = $true)]
        [string] $ConfiguredProductionDatabase,
        [Parameter(Mandatory = $true)]
        [string] $EvidencePath
    )

    $isolation = Test-RecoveryDrillIsolation `
        -ComposeProject $ComposeProject `
        -SourceDatabase $SourceDatabase `
        -TargetDatabase $TargetDatabase `
        -ConfiguredProductionDatabase $ConfiguredProductionDatabase `
        -EvidencePath $EvidencePath
    if (-not $isolation.Allowed) {
        throw ($isolation.Blockers -join ' ')
    }

    $absoluteEvidencePath = Join-Path $ProjectRoot $EvidencePath
    $evidenceDirectory = Split-Path -Parent $absoluteEvidencePath
    $token = [Guid]::NewGuid().ToString('N')
    $sourceBackendSql = "/tmp/recovery-source-$token.sql"
    $sourceMysqlSql = "/tmp/recovery-source-$token.sql"
    $sourceHostSql = Join-Path $env:TEMP "recovery-source-$token.sql"
    $preventiveBackendSql = "/tmp/recovery-preventive-$token.sql"
    $preventiveMysqlSql = "/tmp/recovery-preventive-$token.sql"
    $preventiveHostSql = Join-Path $env:TEMP "recovery-preventive-$token.sql"
    $sourceBackup = $null
    $preventiveBackup = $null
    $rollbackSucceeded = $false
    $successfulRecovery = $false
    $criticalTableCount = 0
    $drillBackendImage = $null

    try {
        $drillBackendImage = Initialize-RecoveryDrillBackendImage `
            -ComposeProject $ComposeProject
        Invoke-RecoveryDrillDocker `
            -Label 'Start isolated MariaDB and backend' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'up', '-d', '--no-build', '--wait', '--wait-timeout', '240', 'mysql', 'backend'
            ))

        Invoke-RecoveryDrillDocker `
            -Label 'Create isolated source schema and seed data' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', '-e', 'HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1',
                'backend', 'php', 'artisan', 'migrate:fresh', '--seed', '--force'
            ))

        $sourceBackupOutput = Invoke-RecoveryDrillDocker `
            -Label 'Create scheduled encrypted backup' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', 'backend', 'php', 'artisan',
                'hospital:backup', '--type=scheduled', '--json'
            ))
        $sourceBackup = ConvertFrom-RecoveryBackupJson -Output $sourceBackupOutput
        if ($sourceBackup.status -ne 'success') {
            throw "Scheduled backup failed with code $($sourceBackup.code)."
        }

        $sourcePackagePath = Join-Path $ProjectRoot "backend\storage\app\private\backups\$($sourceBackup.filename)"
        if (-not (Test-Path -LiteralPath $sourcePackagePath)) {
            throw 'Scheduled encrypted backup package was not published.'
        }
        $calculatedSourceChecksum = (Get-FileHash -LiteralPath $sourcePackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($calculatedSourceChecksum -ne ([string] $sourceBackup.checksum_sha256).ToLowerInvariant()) {
            throw 'Scheduled encrypted backup checksum did not match its command result.'
        }

        Invoke-RecoveryDrillDocker `
            -Label 'Decrypt scheduled backup inside isolated backend' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', 'backend', 'php', 'artisan', 'hospital:decrypt-backup',
                "/var/www/html/storage/app/private/backups/$($sourceBackup.filename)",
                $sourceBackendSql
            ))
        Copy-RecoveryDrillSqlToMysql `
            -ComposeProject $ComposeProject `
            -BackendPath $sourceBackendSql `
            -HostPath $sourceHostSql `
            -MysqlPath $sourceMysqlSql

        Reset-RecoveryDrillDatabase `
            -ComposeProject $ComposeProject `
            -Database $TargetDatabase `
            -SqlContainerPath $sourceMysqlSql
        Invoke-RecoveryDrillMysql `
            -ComposeProject $ComposeProject `
            -Label 'Create rollback marker in isolated target' `
            -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" ' + $TargetDatabase + " -e 'CREATE TABLE recovery_drill_marker (id INT PRIMARY KEY); INSERT INTO recovery_drill_marker VALUES (1);'")

        Invoke-RecoveryDrillDocker `
            -Label 'Clear cached source database configuration' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', '-e', "DB_DATABASE=$TargetDatabase",
                'backend', 'php', 'artisan', 'config:clear'
            ))
        Invoke-RecoveryDrillMysql `
            -ComposeProject $ComposeProject `
            -Label 'Clear restored transient cache before preventive backup' `
            -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" ' + $TargetDatabase + " -e 'DELETE FROM cache_locks; DELETE FROM cache;'")
        try {
            $preventiveOutput = Invoke-RecoveryDrillDocker `
                -Label 'Create preventive encrypted backup' `
                -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                    'exec', '-T', '-e', "DB_DATABASE=$TargetDatabase", 'backend', 'php', 'artisan',
                    'hospital:backup', '--type=manual', '--json'
                ))
        } catch {
            $diagnosticOutput = Invoke-RecoveryDrillMysql `
                -ComposeProject $ComposeProject `
                -Label 'Read sanitized preventive backup diagnostic' `
                -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N ' + $TargetDatabase + " -e 'SELECT error_message FROM backup_logs ORDER BY id DESC LIMIT 1;'")
            $diagnostic = (($diagnosticOutput | Select-Object -Last 1) -as [string]).Trim()
            throw "Preventive backup failed: $diagnostic"
        }
        $preventiveBackup = ConvertFrom-RecoveryBackupJson -Output $preventiveOutput
        if ($preventiveBackup.status -ne 'success') {
            throw "Preventive backup failed with code $($preventiveBackup.code)."
        }

        $preventivePackagePath = Join-Path $ProjectRoot "backend\storage\app\private\backups\$($preventiveBackup.filename)"
        $calculatedPreventiveChecksum = (Get-FileHash -LiteralPath $preventivePackagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($calculatedPreventiveChecksum -ne ([string] $preventiveBackup.checksum_sha256).ToLowerInvariant()) {
            throw 'Preventive encrypted backup checksum did not match its command result.'
        }

        Invoke-RecoveryDrillDocker `
            -Label 'Decrypt preventive backup inside isolated backend' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', 'backend', 'php', 'artisan', 'hospital:decrypt-backup',
                "/var/www/html/storage/app/private/backups/$($preventiveBackup.filename)",
                $preventiveBackendSql
            ))
        Copy-RecoveryDrillSqlToMysql `
            -ComposeProject $ComposeProject `
            -BackendPath $preventiveBackendSql `
            -HostPath $preventiveHostSql `
            -MysqlPath $preventiveMysqlSql

        Reset-RecoveryDrillDatabase `
            -ComposeProject $ComposeProject `
            -Database $TargetDatabase `
            -SqlContainerPath $sourceMysqlSql

        Write-Host '[recovery-drill] Inject expected health-check failure and exercise rollback'
        Reset-RecoveryDrillDatabase `
            -ComposeProject $ComposeProject `
            -Database $TargetDatabase `
            -SqlContainerPath $preventiveMysqlSql
        Invoke-RecoveryDrillMysql `
            -ComposeProject $ComposeProject `
            -Label 'Clear restored transient cache after rollback' `
            -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" ' + $TargetDatabase + " -e 'DELETE FROM cache_locks; DELETE FROM cache;'")
        $markerOutput = Invoke-RecoveryDrillMysql `
            -ComposeProject $ComposeProject `
            -Label 'Verify rollback marker' `
            -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N ' + $TargetDatabase + " -e 'SELECT COUNT(*) FROM recovery_drill_marker;'")
        $rollbackSucceeded = (($markerOutput | Select-Object -Last 1) -as [string]).Trim() -eq '1'
        if (-not $rollbackSucceeded) {
            throw 'Injected health failure did not restore the preventive backup.'
        }

        Reset-RecoveryDrillDatabase `
            -ComposeProject $ComposeProject `
            -Database $TargetDatabase `
            -SqlContainerPath $sourceMysqlSql
        Invoke-RecoveryDrillMysql `
            -ComposeProject $ComposeProject `
            -Label 'Clear restored transient cache after successful recovery' `
            -Command ('mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" ' + $TargetDatabase + " -e 'DELETE FROM cache_locks; DELETE FROM cache;'")
        Invoke-RecoveryDrillDocker `
            -Label 'Run migrations against recovered target' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', '-e', "DB_DATABASE=$TargetDatabase",
                'backend', 'php', 'artisan', 'migrate', '--force'
            ))
        Invoke-RecoveryDrillDocker `
            -Label 'Audit institutional catalog rules after recovery' `
            -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                'exec', '-T', '-e', "DB_DATABASE=$TargetDatabase",
                'backend', 'php', 'artisan', 'hospital:audit-catalog-rules'
            ))

        $criticalTableCount = Get-RecoveryDrillCriticalTableCount `
            -ComposeProject $ComposeProject `
            -Database $TargetDatabase
        if ($criticalTableCount -ne 10) {
            throw "Recovered target contains $criticalTableCount of 10 critical tables."
        }
        $successfulRecovery = $true

        if (-not (Test-Path -LiteralPath $evidenceDirectory)) {
            New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
        }
        $timestamp = (Get-Date).ToUniversalTime().ToString('o')
        $evidence = @"
# Recovery certification

- status: PASS
- completed_at_utc: $timestamp
- compose_project: $ComposeProject
- source_database: $SourceDatabase
- target_database: $TargetDatabase
- backup_identifier: $($sourceBackup.filename)
- backup_checksum_sha256: $($sourceBackup.checksum_sha256)
- critical_tables_validated: $criticalTableCount/10
- preventive_backup_status: $($preventiveBackup.status)
- rollback_succeeded: $($rollbackSucceeded.ToString().ToLowerInvariant())
- recovery_succeeded: $($successfulRecovery.ToString().ToLowerInvariant())
- secrets_or_absolute_paths_included: false
"@
        [System.IO.File]::WriteAllText($absoluteEvidencePath, $evidence, [System.Text.UTF8Encoding]::new($false))

        return [pscustomobject]@{
            Success = $true
            EvidencePath = $EvidencePath
            BackupIdentifier = [string] $sourceBackup.filename
            ChecksumSha256 = [string] $sourceBackup.checksum_sha256
            CriticalTableCount = $criticalTableCount
            PreventiveBackupStatus = [string] $preventiveBackup.status
            RollbackSucceeded = $rollbackSucceeded
            RecoverySucceeded = $successfulRecovery
        }
    } finally {
        foreach ($path in @($sourceHostSql, $preventiveHostSql)) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force
            }
        }

        foreach ($backup in @($sourceBackup, $preventiveBackup)) {
            if ($null -eq $backup -or [string]::IsNullOrWhiteSpace([string] $backup.filename)) {
                continue
            }
            $packagePath = Join-Path $ProjectRoot "backend\storage\app\private\backups\$($backup.filename)"
            if (Test-Path -LiteralPath $packagePath) {
                Remove-Item -LiteralPath $packagePath -Force
            }
        }

        try {
            Invoke-RecoveryDrillDocker `
                -Label 'Remove isolated recovery stack and volumes' `
                -Arguments (Get-RecoveryDrillComposeArguments -ComposeProject $ComposeProject -Arguments @(
                    'down', '--volumes', '--remove-orphans'
                )) | Out-Null
        } catch {
            Write-Warning 'The isolated recovery stack could not be removed automatically.'
        }

        if (-not [string]::IsNullOrWhiteSpace([string] $drillBackendImage)) {
            try {
                Invoke-RecoveryDrillDocker `
                    -Label 'Remove isolated backend image tag' `
                    -Arguments @('image', 'rm', $drillBackendImage) | Out-Null
            } catch {
                Write-Warning 'The isolated backend image tag could not be removed automatically.'
            }
        }
    }
}
