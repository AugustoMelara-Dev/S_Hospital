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

function Get-RecoveryIntegrityChecks {
    [CmdletBinding()]
    param()

    # Contrato de integridad del restore descartable. Cada chequeo devuelve un
    # COUNT(*) que debe ser 0 para considerarse sano, salvo los de metadatos que
    # solo se registran. El SQL usa {db} y se parametriza con un nombre de base
    # ya validado como descartable (Test-RecoveryDisposableDatabaseName).
    return @(
        [pscustomobject]@{
            Name = 'orphan_invoice_items'
            Group = 'relations'
            Severity = 'blocking'
            Description = 'Items de factura sin factura padre.'
            Sql = 'SELECT COUNT(*) FROM {db}.invoice_items i LEFT JOIN {db}.invoices v ON v.id = i.invoice_id WHERE v.id IS NULL;'
        },
        [pscustomobject]@{
            Name = 'orphan_payments_invoice'
            Group = 'relations'
            Severity = 'blocking'
            Description = 'Pagos sin factura padre.'
            Sql = 'SELECT COUNT(*) FROM {db}.payments p LEFT JOIN {db}.invoices v ON v.id = p.invoice_id WHERE v.id IS NULL;'
        },
        [pscustomobject]@{
            Name = 'orphan_payments_session'
            Group = 'relations'
            Severity = 'blocking'
            Description = 'Pagos sin sesion de caja.'
            Sql = 'SELECT COUNT(*) FROM {db}.payments p LEFT JOIN {db}.cash_register_sessions s ON s.id = p.cash_session_id WHERE s.id IS NULL;'
        },
        [pscustomobject]@{
            Name = 'orphan_cash_movements_session'
            Group = 'relations'
            Severity = 'blocking'
            Description = 'Movimientos de caja sin sesion.'
            Sql = 'SELECT COUNT(*) FROM {db}.cash_movements m LEFT JOIN {db}.cash_register_sessions s ON s.id = m.cash_session_id WHERE s.id IS NULL;'
        },
        [pscustomobject]@{
            Name = 'orphan_invoices_issuer'
            Group = 'relations'
            Severity = 'blocking'
            Description = 'Facturas sin usuario emisor.'
            Sql = 'SELECT COUNT(*) FROM {db}.invoices v LEFT JOIN {db}.users u ON u.id = v.issued_by WHERE u.id IS NULL;'
        },
        [pscustomobject]@{
            Name = 'invoice_cents_coherence'
            Group = 'financial'
            Severity = 'blocking'
            Description = 'Columnas de centavos de facturas incoherentes con su decimal.'
            Sql = 'SELECT COUNT(*) FROM {db}.invoices WHERE total_cents <> ROUND(total * 100) OR paid_amount_cents <> ROUND(paid_amount * 100) OR balance_due_cents <> ROUND(balance_due * 100) OR subtotal_cents <> ROUND(subtotal * 100) OR tax_amount_cents <> ROUND(tax_amount * 100) OR discount_amount_cents <> ROUND(discount_amount * 100);'
        },
        [pscustomobject]@{
            Name = 'payment_cents_coherence'
            Group = 'financial'
            Severity = 'blocking'
            Description = 'Pagos cuyo monto en centavos no coincide con el decimal.'
            Sql = 'SELECT COUNT(*) FROM {db}.payments WHERE amount_cents <> ROUND(amount * 100);'
        },
        [pscustomobject]@{
            Name = 'invoice_balance_coherence'
            Group = 'financial'
            Severity = 'blocking'
            Description = 'Facturas cuyo saldo no es total menos pagado.'
            Sql = 'SELECT COUNT(*) FROM {db}.invoices WHERE balance_due_cents <> total_cents - paid_amount_cents;'
        },
        [pscustomobject]@{
            Name = 'duplicate_invoice_numbers'
            Group = 'financial'
            Severity = 'blocking'
            Description = 'Numeros de factura duplicados.'
            Sql = 'SELECT COUNT(*) FROM (SELECT invoice_number FROM {db}.invoices GROUP BY invoice_number HAVING COUNT(*) > 1) duplicated;'
        },
        [pscustomobject]@{
            Name = 'invoice_totals_vs_items'
            Group = 'financial'
            Severity = 'report'
            Description = 'Facturas cuyo total difiere de la suma de sus items (evidencia, no bloqueo).'
            Sql = 'SELECT COUNT(*) FROM {db}.invoices v WHERE v.total_cents <> COALESCE((SELECT SUM(i.line_total_cents) FROM {db}.invoice_items i WHERE i.invoice_id = v.id), 0);'
        },
        [pscustomobject]@{
            Name = 'applied_migrations'
            Group = 'metadata'
            Severity = 'metadata'
            Description = 'Migraciones aplicadas presentes en la base restaurada.'
            Sql = 'SELECT COUNT(*) FROM {db}.migrations;'
        },
        [pscustomobject]@{
            Name = 'schema_table_count'
            Group = 'metadata'
            Severity = 'metadata'
            Description = 'Tablas totales del esquema restaurado.'
            Sql = 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ''{db}'';'
        }
    )
}

function Format-RecoveryIntegritySql {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Template,

        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    if (-not (Test-RecoveryDisposableDatabaseName -Database $Database)) {
        throw "La base '$Database' no es descartable; no se ejecutan chequeos de integridad."
    }

    return $Template.Replace('{db}', $Database)
}

function New-RecoveryIntegrityResult {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Database,

        [Parameter(Mandatory = $true)]
        [hashtable]$Measurements
    )

    $details = @()
    $blockingFailures = @()

    foreach ($check in (Get-RecoveryIntegrityChecks)) {
        $value = $null
        if ($Measurements.ContainsKey($check.Name) -and $null -ne $Measurements[$check.Name]) {
            $value = [int]$Measurements[$check.Name]
        }

        $failed = ($check.Severity -eq 'blocking' -and ($null -eq $value -or $value -ne 0))
        if ($failed) {
            $blockingFailures += $check.Name
        }

        $details += [pscustomobject]@{
            Name = $check.Name
            Group = $check.Group
            Severity = $check.Severity
            Description = $check.Description
            Count = $value
            Failed = $failed
        }
    }

    return [pscustomobject]@{
        Valid = $blockingFailures.Count -eq 0
        Database = $Database
        Checks = @($details)
        BlockingFailures = @($blockingFailures)
    }
}

function New-RecoveryDatabaseFingerprint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$TableCounts
    )

    $canonicalLines = @(
        Get-RecoveryCriticalTables |
            ForEach-Object {
                $value = if ($TableCounts.ContainsKey($_)) { [string]$TableCounts[$_] } else { 'missing' }
                "$_=$value"
            }
    )
    $canonical = ($canonicalLines -join "`n")

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
        $hash = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
    } finally {
        $sha.Dispose()
    }

    return [pscustomobject]@{
        Sha256 = $hash
        Tables = $canonicalLines.Count
        Counts = $TableCounts
    }
}

function Test-RecoveryFingerprintUnchanged {
    [CmdletBinding()]
    param(
        [object]$Before,
        [object]$After
    )

    if ($null -eq $Before -or $null -eq $After) {
        return [pscustomobject]@{
            Verified = $false
            Unchanged = $false
            ChangedTables = @()
        }
    }

    $changed = @()
    foreach ($table in (Get-RecoveryCriticalTables)) {
        $beforeValue = if ($Before.Counts.ContainsKey($table)) { [string]$Before.Counts[$table] } else { 'missing' }
        $afterValue = if ($After.Counts.ContainsKey($table)) { [string]$After.Counts[$table] } else { 'missing' }
        if ($beforeValue -ne $afterValue) {
            $changed += $table
        }
    }

    return [pscustomobject]@{
        Verified = $true
        Unchanged = ($changed.Count -eq 0 -and $Before.Sha256 -eq $After.Sha256)
        ChangedTables = @($changed)
    }
}
