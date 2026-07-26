#Requires -Version 5.1

function Get-RecoveryCriticalTables {
    return @(
        'users',
        'roles',
        'permissions',
        'services',
        'invoices',
        'invoice_items',
        'payments',
        'cash_register_sessions',
        'cash_movements',
        'backup_logs'
    )
}

function Test-RecoveryDisposableDatabaseName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    if ($Database -notmatch '^[A-Za-z0-9_]+$') {
        return $false
    }

    $lower = $Database.ToLowerInvariant()
    if ($lower -in @(
        'hospital_billing',
        'hospital_billing_production',
        'mysql',
        'information_schema',
        'performance_schema',
        'sys'
    )) {
        return $false
    }

    return $lower -match '(test|validation|restore|disposable|proof)'
}

function New-RecoveryValidationResult {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Database,

        [Parameter(Mandatory = $true)]
        [hashtable]$TableCounts
    )

    $blockers = @()
    $missingTables = @()

    if (-not (Test-RecoveryDisposableDatabaseName -Database $Database)) {
        $blockers += [pscustomobject]@{
            Code = 'UNSAFE_VALIDATION_DATABASE'
            Message = 'La validacion requiere una base descartable.'
        }
    }

    foreach ($table in (Get-RecoveryCriticalTables)) {
        if (-not $TableCounts.ContainsKey($table) -or
            $null -eq $TableCounts[$table] -or
            [int]$TableCounts[$table] -lt 0) {
            $missingTables += $table
        }
    }

    if ($missingTables.Count -gt 0) {
        $blockers += [pscustomobject]@{
            Code = 'MISSING_CRITICAL_TABLES'
            Message = 'El respaldo no contiene todas las tablas criticas.'
        }
    }

    return [pscustomobject]@{
        Valid = $blockers.Count -eq 0
        Database = $Database
        TableCounts = $TableCounts
        MissingTables = @($missingTables)
        Blockers = @($blockers)
    }
}
