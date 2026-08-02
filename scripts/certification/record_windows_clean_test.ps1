[CmdletBinding()]
param(
    [string] $ProjectRoot = '',
    [string] $EvidenceDir = '',
    [string] $TestName = '',
    [ValidateSet('PENDING', 'PASSED', 'FAILED', 'BLOCKED')]
    [string] $Status = '',
    [string[]] $EvidenceFile = @(),
    [string] $Operator = '',
    [string] $Observation = ''
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

if ([string]::IsNullOrWhiteSpace($TestName) -or $contract.TestNames -notcontains $TestName) {
    throw "TestName invalido. Valores permitidos: $($contract.TestNames -join ', ')"
}
if ([string]::IsNullOrWhiteSpace($Status)) {
    throw 'Status es obligatorio.'
}
if ([string]::IsNullOrWhiteSpace($Operator)) {
    throw 'Operator es obligatorio.'
}
if ([string]::IsNullOrWhiteSpace($Observation)) {
    throw 'Observation es obligatorio.'
}
if (-not (Test-Path -LiteralPath $resultPath)) {
    throw "No existe RESULT.json: $resultPath"
}

try {
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
} catch {
    throw "RESULT.json no es JSON valido: $($_.Exception.Message)"
}
if ($result.schema_version -ne $contract.SchemaVersion) {
    throw "schema_version invalido: $($result.schema_version)"
}
if ($null -eq $result.tests.PSObject.Properties[$TestName]) {
    throw "RESULT.json no contiene la prueba $TestName"
}
if ($EvidenceFile.Count -eq 0) {
    throw 'Cada actualizacion requiere al menos un archivo de evidencia.'
}

$normalizedFiles = New-Object System.Collections.Generic.List[string]
$rootFull = ([System.IO.Path]::GetFullPath($EvidenceDir)).TrimEnd('\') + '\'
foreach ($relativeFile in $EvidenceFile) {
    if ([string]::IsNullOrWhiteSpace($relativeFile)) {
        throw 'No se permiten rutas de evidencia vacias.'
    }
    if ([System.IO.Path]::IsPathRooted($relativeFile)) {
        throw "La evidencia debe ser relativa a $($contract.EvidenceRoot): $relativeFile"
    }
    $normalized = $relativeFile.Replace('\', '/')
    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $EvidenceDir $normalized))
    if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "La evidencia sale de la raiz permitida: $relativeFile"
    }
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "No existe la evidencia: $fullPath"
    }
    if ((Get-Item -LiteralPath $fullPath).Length -le 0) {
        throw "La evidencia esta vacia: $fullPath"
    }
    if (-not ($normalizedFiles -contains $normalized)) {
        $normalizedFiles.Add($normalized) | Out-Null
    }
}

if ($null -eq $result.evidence.PSObject.Properties['by_test']) {
    $result.evidence | Add-Member -MemberType NoteProperty -Name by_test -Value ([pscustomobject]@{})
}
if ($null -eq $result.evidence.PSObject.Properties['required_files']) {
    $result.evidence | Add-Member -MemberType NoteProperty -Name required_files -Value @()
}
$currentFiles = @($result.evidence.required_files | ForEach-Object { ([string]$_).Replace('\', '/') })
foreach ($file in $normalizedFiles) {
    if ($currentFiles -notcontains $file) {
        $currentFiles += $file
    }
}
$result.evidence.required_files = @($currentFiles | Sort-Object -Unique)
$result.evidence.by_test | Add-Member -MemberType NoteProperty -Name $TestName -Value @($normalizedFiles) -Force
$result.tests.PSObject.Properties[$TestName].Value = $Status
if ([string]::IsNullOrWhiteSpace([string]$result.operator)) {
    $result.operator = $Operator
}
if ([string]::IsNullOrWhiteSpace([string]$result.started_at_utc)) {
    $result.started_at_utc = (Get-Date).ToUniversalTime().ToString('o')
}
$note = [ordered]@{
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    operator = $Operator
    test = $TestName
    status = $Status
    observation = $Observation
    evidence = @($normalizedFiles)
}
$result.notes = @($result.notes) + [pscustomobject]$note
$result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $resultPath -Encoding UTF8
Write-Host "[ OK ] $TestName = $Status"
Write-Host "[ OK ] Evidencia registrada: $($normalizedFiles -join ', ')"
exit 0
