[CmdletBinding()]
param(
    [string] $ProjectRoot = '',
    [string] $EvidenceDir = '',
    [string] $Operator = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows_clean_result_contract.ps1')
$contract = Get-WindowsCleanContract

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
    $EvidenceDir = Join-Path $ProjectRoot $contract.EvidenceRoot
}
$EvidenceDir = (Resolve-Path -LiteralPath $EvidenceDir).Path
$resultPath = Get-WindowsCleanResultPath -ProjectRoot $ProjectRoot -EvidenceDir $EvidenceDir
if (-not (Test-Path -LiteralPath $resultPath)) {
    throw "No existe RESULT.json: $resultPath"
}
$result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
if ($result.schema_version -ne $contract.SchemaVersion) {
    throw "schema_version invalido: $($result.schema_version)"
}
if (-not [string]::IsNullOrWhiteSpace($Operator)) {
    $result.operator = $Operator
}
if ([string]::IsNullOrWhiteSpace([string]$result.started_at_utc)) {
    $result.started_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}

$coreStatuses = @($contract.CoreTestNames | ForEach-Object { [string]$result.tests.PSObject.Properties[$_].Value })
$physicalStatus = [string]$result.tests.PSObject.Properties['physical_print'].Value
if ($coreStatuses -contains 'FAILED' -or $physicalStatus -eq 'FAILED') {
    $softwareStatus = if ($coreStatuses -contains 'FAILED') { 'FAILED' } else { 'PASSED' }
    $rootStatus = 'FAILED'
} elseif ($coreStatuses -contains 'BLOCKED' -or $physicalStatus -eq 'BLOCKED') {
    $softwareStatus = if ($coreStatuses -contains 'BLOCKED') { 'BLOCKED' } else { 'PASSED' }
    $rootStatus = 'BLOCKED'
} elseif ($coreStatuses -contains 'PENDING') {
    $softwareStatus = 'PENDING'
    $rootStatus = 'PENDING'
} elseif ($physicalStatus -eq 'PENDING') {
    $softwareStatus = 'PASSED'
    $rootStatus = 'PASSED'
} else {
    $softwareStatus = 'PASSED'
    $rootStatus = 'PASSED'
}

$physicalCertification = switch ($physicalStatus) {
    'PASSED' { 'PASSED' }
    'FAILED' { 'FAILED' }
    'BLOCKED' { 'BLOCKED' }
    default { 'PENDING_ON_SITE' }
}
$softwareReady = $softwareStatus -eq 'PASSED'
$physicalReady = $physicalStatus -eq 'PASSED'
$result.status = $rootStatus
$result.certification.clean_windows_software = $softwareStatus
$result.certification.physical_printer = $physicalCertification
$result.certification.delivery_ready = if ($softwareReady -and $physicalReady) { 'YES' } else { 'NO' }
$result.certification.delivery_ready_for_controlled_onsite_validation = if ($softwareReady -and $physicalStatus -eq 'PENDING') { 'YES' } else { 'NO' }
$result.certification.production_certified = if ($softwareReady -and $physicalReady) { 'YES' } else { 'NO' }
if ($rootStatus -ne 'PENDING') {
    $result.completed_at_utc = (Get-Date).ToUniversalTime().ToString('o')
} else {
    $result.completed_at_utc = ''
}
$note = [ordered]@{
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    operator = if ([string]::IsNullOrWhiteSpace($Operator)) { [string]$result.operator } else { $Operator }
    action = 'FINALIZE'
    status = $rootStatus
    clean_windows_software = $softwareStatus
    physical_printer = $physicalCertification
}
$result.notes = @($result.notes) + [pscustomobject]$note
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resultPath -Encoding UTF8

$validator = Join-Path $PSScriptRoot 'validate_windows_clean_result.ps1'
$validatorArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $validator, '-ProjectRoot', $ProjectRoot, '-EvidenceDir', $EvidenceDir)
if ($physicalStatus -eq 'PENDING') {
    $validatorArgs += '-AllowPhysicalPrinterPending'
}
& powershell.exe @validatorArgs
if ($LASTEXITCODE -ne 0) {
    throw 'RESULT.json no supera la validacion despues de finalizar.'
}
Write-Host "[ OK ] RESULT.json finalizado: $rootStatus"
exit 0
