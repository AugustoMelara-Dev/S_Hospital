#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$contractPath = Join-Path $PSScriptRoot 'lib\recovery_contract.ps1'
$validationPath = Join-Path $PSScriptRoot 'lib\recovery_validation.ps1'
. $contractPath
. $validationPath

$script:Checks = 0

function Assert-Equal {
    param([object]$Expected, [object]$Actual, [string]$Message)
    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Esperado=[$Expected] Actual=[$Actual]"
    }
}

function Assert-Sequence {
    param([object[]]$Expected, [object[]]$Actual, [string]$Message)
    $script:Checks++
    if (($Expected -join '|') -ne ($Actual -join '|')) {
        throw "$Message. Esperado=[$($Expected -join ', ')] Actual=[$($Actual -join ', ')]"
    }
}

$criticalTables = Get-RecoveryCriticalTables
Assert-Sequence @(
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
) $criticalTables 'La validacion debe cubrir todas las tablas criticas'

$counts = @{}
foreach ($table in $criticalTables) {
    $counts[$table] = 0
}
$counts.users = 2
$counts.services = 121
$counts.invoices = 4

$valid = New-RecoveryValidationResult `
    -Database 'hospital_restore_validation' `
    -TableCounts $counts
Assert-Equal $true $valid.Valid 'Las tablas completas deben validar'
Assert-Equal 0 $valid.MissingTables.Count 'No debe reportar tablas ausentes'
Assert-Equal 121 $valid.TableCounts.services 'Debe conservar conteos estructurados'

$counts.Remove('payments')
$missing = New-RecoveryValidationResult `
    -Database 'hospital_restore_validation' `
    -TableCounts $counts
Assert-Equal $false $missing.Valid 'Una tabla ausente debe invalidar el restore'
Assert-Sequence @('payments') $missing.MissingTables 'Debe identificar la tabla ausente'

$unsafe = New-RecoveryValidationResult `
    -Database 'hospital_billing' `
    -TableCounts $counts
Assert-Equal $false $unsafe.Valid 'La base productiva nunca es destino de validacion'
Assert-Equal 'UNSAFE_VALIDATION_DATABASE' $unsafe.Blockers[0].Code 'Debe explicar el destino inseguro'

foreach ($database in @(
    'hospital_billing_test',
    'hospital_restore_validation',
    'hospital_disposable_proof'
)) {
    Assert-Equal $true (Test-RecoveryDisposableDatabaseName -Database $database) "Debe aceptar $database"
}

foreach ($database in @(
    'hospital_billing',
    'hospital_billing_production',
    'mysql',
    'hospital-prod',
    'hospital'
)) {
    Assert-Equal $false (Test-RecoveryDisposableDatabaseName -Database $database) "Debe rechazar $database"
}

Write-Host "Recovery validation self-test passed: $script:Checks checks."
exit 0
