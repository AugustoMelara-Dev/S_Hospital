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

# Contrato de integridad post-restore (relaciones, dinero, metadatos).
$integrityChecks = @(Get-RecoveryIntegrityChecks)
Assert-Equal $true ($integrityChecks.Count -ge 10) 'El contrato de integridad debe cubrir relaciones, dinero y metadatos'
$integrityNames = @($integrityChecks | ForEach-Object { $_.Name })
Assert-Equal $integrityChecks.Count @($integrityNames | Select-Object -Unique).Count 'Cada chequeo de integridad debe tener nombre unico'
foreach ($group in @('relations', 'financial', 'metadata')) {
    Assert-Equal $true (@($integrityChecks | Where-Object { $_.Group -eq $group }).Count -ge 1) "Debe existir al menos un chequeo del grupo $group"
}
foreach ($check in $integrityChecks) {
    Assert-Equal $true ($check.Sql -match '\{db\}') "El chequeo $($check.Name) debe parametrizar la base"
}
Assert-Equal $true (@($integrityChecks | Where-Object { $_.Severity -eq 'blocking' }).Count -ge 5) 'Debe haber chequeos bloqueantes'

$formatted = Format-RecoveryIntegritySql -Template 'SELECT COUNT(*) FROM {db}.invoices;' -Database 'hospital_restore_validation'
Assert-Equal 'SELECT COUNT(*) FROM hospital_restore_validation.invoices;' $formatted 'El SQL de integridad debe apuntar a la base descartable'
$unsafeFormatRejected = $false
try {
    Format-RecoveryIntegritySql -Template 'SELECT COUNT(*) FROM {db}.invoices;' -Database 'hospital_billing' | Out-Null
} catch {
    $unsafeFormatRejected = $true
}
Assert-Equal $true $unsafeFormatRejected 'No se debe formatear SQL de integridad contra produccion'

$cleanMeasurements = @{}
foreach ($check in $integrityChecks) { $cleanMeasurements[$check.Name] = 0 }
$cleanIntegrity = New-RecoveryIntegrityResult -Database 'hospital_restore_validation' -Measurements $cleanMeasurements
Assert-Equal $true $cleanIntegrity.Valid 'Una base integra debe validar'
Assert-Equal 0 $cleanIntegrity.BlockingFailures.Count 'Una base integra no debe tener fallos bloqueantes'
Assert-Equal $true (@($cleanIntegrity.Checks | Where-Object { $_.Group -eq 'metadata' -and $_.Count -eq 0 }).Count -ge 1) 'Los metadatos deben registrarse aunque su conteo sea 0'

$brokenMeasurements = @{}
foreach ($check in $integrityChecks) { $brokenMeasurements[$check.Name] = 0 }
$brokenMeasurements['orphan_payments_invoice'] = 3
$brokenIntegrity = New-RecoveryIntegrityResult -Database 'hospital_restore_validation' -Measurements $brokenMeasurements
Assert-Equal $false $brokenIntegrity.Valid 'Una relacion rota debe bloquear la validacion'
Assert-Sequence @('orphan_payments_invoice') $brokenIntegrity.BlockingFailures 'Debe reportar exactamente la relacion rota'

$metadataMeasurement = @{}
foreach ($check in $integrityChecks) { $metadataMeasurement[$check.Name] = 0 }
$metadataMeasurement['applied_migrations'] = 120
$metadataResult = New-RecoveryIntegrityResult -Database 'hospital_restore_validation' -Measurements $metadataMeasurement
Assert-Equal $true $metadataResult.Valid 'Los metadatos no deben bloquear por si solos'

# Huella de la base original: prueba de no-escritura durante el drill.
$fingerprintCounts = @{}
foreach ($table in (Get-RecoveryCriticalTables)) { $fingerprintCounts[$table] = 7 }
$before = New-RecoveryDatabaseFingerprint -TableCounts $fingerprintCounts
$after = New-RecoveryDatabaseFingerprint -TableCounts $fingerprintCounts
Assert-Equal $true ($before.Sha256 -match '^[a-f0-9]{64}$') 'La huella debe ser un SHA-256 hexadecimal'
$same = Test-RecoveryFingerprintUnchanged -Before $before -After $after
Assert-Equal $true $same.Verified 'Con ambas huellas la comparacion debe verificarse'
Assert-Equal $true $same.Unchanged 'La misma huella debe reportarse sin cambios'

$changedCounts = @{}
foreach ($table in (Get-RecoveryCriticalTables)) { $changedCounts[$table] = 7 }
$changedCounts.invoices = 8
$changed = Test-RecoveryFingerprintUnchanged -Before $before -After (New-RecoveryDatabaseFingerprint -TableCounts $changedCounts)
Assert-Equal $false $changed.Unchanged 'Un cambio de conteo debe detectarse'
Assert-Sequence @('invoices') $changed.ChangedTables 'Debe identificar la tabla alterada'

$unverified = Test-RecoveryFingerprintUnchanged -Before $null -After $after
Assert-Equal $false $unverified.Verified 'Sin huella previa no se puede afirmar no-escritura'
Assert-Equal $false $unverified.Unchanged 'Una comparacion no verificada no es un exito'

Write-Host "Recovery validation self-test passed: $script:Checks checks."
exit 0
