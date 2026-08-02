[CmdletBinding()]
param(
    [string] $ProjectRoot = '',
    [string] $EvidenceDir = '',
    [switch] $AllowPhysicalPrinterPending
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows_clean_result_contract.ps1')
$contract = Get-WindowsCleanContract
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure {
    param([string] $Message)
    $failures.Add($Message) | Out-Null
}

function Has-Property {
    param([object] $Object, [string] $Name)
    return $null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]
}

function Get-PropertyValue {
    param([object] $Object, [string] $Name)
    if (Has-Property -Object $Object -Name $Name) {
        return $Object.PSObject.Properties[$Name].Value
    }
    return $null
}

function Require-Property {
    param([object] $Object, [string] $Name, [string] $Path)
    if (-not (Has-Property -Object $Object -Name $Name)) {
        Add-Failure "Falta propiedad $Path.$Name"
        return $false
    }
    return $true
}

function Is-IntegerValue {
    param([object] $Value)
    if ($null -eq $Value) { return $false }
    return ([string]$Value -match '^[0-9]+$')
}

function Parse-Utc {
    param([object] $Value, [string] $Name)
    if ([string]::IsNullOrWhiteSpace([string]$Value)) {
        Add-Failure "Falta timestamp $Name"
        return $null
    }
    try {
        return [DateTimeOffset]::Parse([string]$Value)
    } catch {
        Add-Failure "Timestamp invalido ${Name}: $Value"
        return $null
    }
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
    $EvidenceDir = Join-Path $ProjectRoot $contract.EvidenceRoot
}
if (Test-Path -LiteralPath $EvidenceDir) {
    $EvidenceDir = (Resolve-Path -LiteralPath $EvidenceDir).Path
}
$resultPath = Get-WindowsCleanResultPath -ProjectRoot $ProjectRoot -EvidenceDir $EvidenceDir
$schemaPath = Join-Path $PSScriptRoot 'windows-clean-result.schema.json'

$schema = $null
if (-not (Test-Path -LiteralPath $schemaPath -PathType Leaf)) {
    Add-Failure "Falta esquema versionado: $schemaPath"
} else {
    try {
        $schema = Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json
    } catch {
        Add-Failure "El esquema no es JSON valido: $($_.Exception.Message)"
    }
}
if ($null -ne $schema) {
    if ((Get-PropertyValue -Object $schema.properties.schema_version -Name 'const') -ne $contract.SchemaVersion) {
        Add-Failure 'El esquema no fija schema_version = 1'
    }
    foreach ($requiredRoot in @('schema_version', 'status', 'source_commit', 'installer_sha256', 'installer_size_bytes', 'machine', 'tests', 'evidence', 'started_at_utc', 'completed_at_utc', 'operator', 'notes', 'certification')) {
        if (@($schema.required) -notcontains $requiredRoot) {
            Add-Failure "El esquema no exige la propiedad $requiredRoot"
        }
    }
}

$result = $null
if (-not (Test-Path -LiteralPath $resultPath -PathType Leaf)) {
    Add-Failure "Falta RESULT.json: $resultPath"
} else {
    try {
        $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    } catch {
        Add-Failure "RESULT.json no es JSON valido: $($_.Exception.Message)"
    }
}

if ($null -ne $result) {
    foreach ($rootProperty in @('schema_version', 'status', 'source_commit', 'installer_sha256', 'installer_size_bytes', 'machine', 'tests', 'evidence', 'started_at_utc', 'completed_at_utc', 'operator', 'notes', 'certification')) {
        Require-Property -Object $result -Name $rootProperty -Path 'RESULT.json' | Out-Null
    }
    if ($result.schema_version -ne $contract.SchemaVersion) {
        Add-Failure "schema_version no coincide: $($result.schema_version)"
    }
    if ($contract.AllowedTestStatuses -notcontains [string]$result.status) {
        Add-Failure "status invalido: $($result.status)"
    }
    if ([string]$result.source_commit -ne $contract.ExpectedSourceCommit) {
        Add-Failure "source_commit no coincide: $($result.source_commit)"
    }
    if (([string]$result.installer_sha256).ToLowerInvariant() -notmatch '^[0-9a-fA-F]{64}$' -or ([string]$result.installer_sha256).ToLowerInvariant() -ne $contract.ExpectedInstallerSha256) {
        Add-Failure "installer_sha256 no coincide: $($result.installer_sha256)"
    }
    if (-not (Is-IntegerValue $result.installer_size_bytes) -or [int64]$result.installer_size_bytes -ne $contract.ExpectedInstallerSizeBytes) {
        Add-Failure "installer_size_bytes no coincide: $($result.installer_size_bytes)"
    }
    if ([string]::IsNullOrWhiteSpace([string]$result.operator)) {
        Add-Failure 'operator es obligatorio'
    }

    $machine = $result.machine
    foreach ($machineProperty in @('name', 'windows_edition', 'windows_build', 'architecture', 'ram_bytes', 'free_space_bytes', 'docker_desktop_version', 'clean_environment_confirmed', 'repository_checkout_absent', 'host_mysql_mariadb_absent', 'previous_s_hospital_absent')) {
        Require-Property -Object $machine -Name $machineProperty -Path 'machine' | Out-Null
    }
    foreach ($machineString in @('name', 'windows_edition', 'windows_build', 'docker_desktop_version')) {
        if ([string]::IsNullOrWhiteSpace([string](Get-PropertyValue -Object $machine -Name $machineString))) {
            Add-Failure "machine.$machineString es obligatorio"
        }
    }
    if ([string]$machine.architecture -ne 'x64') {
        Add-Failure "machine.architecture debe ser x64: $($machine.architecture)"
    }
    foreach ($machineNumber in @('ram_bytes', 'free_space_bytes')) {
        $value = Get-PropertyValue -Object $machine -Name $machineNumber
        if (-not (Is-IntegerValue $value) -or [int64]$value -le 0) {
            Add-Failure "machine.$machineNumber debe ser mayor que cero"
        }
    }
    foreach ($machineFlag in @('clean_environment_confirmed', 'repository_checkout_absent', 'host_mysql_mariadb_absent', 'previous_s_hospital_absent')) {
        $value = Get-PropertyValue -Object $machine -Name $machineFlag
        if ($value -isnot [bool] -or $value -ne $true) {
            Add-Failure "machine.$machineFlag debe ser true"
        }
    }

    $tests = $result.tests
    foreach ($testName in $contract.TestNames) {
        if (-not (Require-Property -Object $tests -Name $testName -Path 'tests')) {
            continue
        }
        $testStatus = [string](Get-PropertyValue -Object $tests -Name $testName)
        if ($contract.AllowedTestStatuses -notcontains $testStatus) {
            Add-Failure "tests.$testName tiene estado invalido: $testStatus"
        }
    }
    $coreStatuses = @($contract.CoreTestNames | ForEach-Object { [string](Get-PropertyValue -Object $tests -Name $_) })
    $physicalStatus = [string](Get-PropertyValue -Object $tests -Name 'physical_print')
    $softwareStatus = if ($coreStatuses -contains 'FAILED') { 'FAILED' } elseif ($coreStatuses -contains 'BLOCKED') { 'BLOCKED' } elseif ($coreStatuses -contains 'PENDING') { 'PENDING' } else { 'PASSED' }
    $expectedRootStatus = if ($softwareStatus -eq 'FAILED' -or $physicalStatus -eq 'FAILED') { 'FAILED' } elseif ($softwareStatus -eq 'BLOCKED' -or $physicalStatus -eq 'BLOCKED') { 'BLOCKED' } elseif ($softwareStatus -eq 'PENDING') { 'PENDING' } else { 'PASSED' }
    if ([string]$result.status -ne $expectedRootStatus) {
        Add-Failure "status raiz no coincide con las pruebas: esperado $expectedRootStatus, obtenido $($result.status)"
    }
    if ($physicalStatus -eq 'PENDING' -and -not $AllowPhysicalPrinterPending) {
        Add-Failure 'physical_print esta PENDING; la promocion oficial exige PASSED'
    }
    if ($physicalStatus -eq 'PENDING' -and $AllowPhysicalPrinterPending -and $softwareStatus -ne 'PASSED') {
        Add-Failure 'No se permite estado fisico pendiente si el software no esta PASSED'
    }
    foreach ($testName in $contract.CoreTestNames) {
        $value = [string](Get-PropertyValue -Object $tests -Name $testName)
        if ($value -ne 'PASSED') {
            Add-Failure "La prueba obligatoria $testName no esta PASSED: $value"
        }
    }

    $evidence = $result.evidence
    foreach ($evidenceProperty in @('root', 'required_files', 'by_test')) {
        Require-Property -Object $evidence -Name $evidenceProperty -Path 'evidence' | Out-Null
    }
    if ([string]$evidence.root -ne $contract.EvidenceRoot) {
        Add-Failure "evidence.root no coincide: $($evidence.root)"
    }
    if (-not (Test-Path -LiteralPath $EvidenceDir -PathType Container)) {
        Add-Failure "No existe la raiz de evidencia: $EvidenceDir"
    }
    $requiredFiles = @($evidence.required_files)
    if ($requiredFiles.Count -eq 0) {
        Add-Failure 'evidence.required_files no puede estar vacio'
    }
    $normalizedFiles = New-Object System.Collections.Generic.List[string]
    $rootFull = ''
    if (Test-Path -LiteralPath $EvidenceDir -PathType Container) {
        $rootFull = ([System.IO.Path]::GetFullPath($EvidenceDir)).TrimEnd('\') + '\'
    }
    foreach ($relativeFileValue in $requiredFiles) {
        $relativeFile = ([string]$relativeFileValue).Replace('\', '/')
        if ([string]::IsNullOrWhiteSpace($relativeFile)) {
            Add-Failure 'evidence.required_files contiene una ruta vacia'
            continue
        }
        if ([System.IO.Path]::IsPathRooted($relativeFile)) {
            Add-Failure "Ruta de evidencia absoluta no permitida: $relativeFile"
            continue
        }
        if ($rootFull) {
            $fullPath = [System.IO.Path]::GetFullPath((Join-Path $EvidenceDir $relativeFile))
            if (-not $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
                Add-Failure "Ruta de evidencia fuera de la raiz: $relativeFile"
                continue
            }
            if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                Add-Failure "Falta evidencia: $fullPath"
                continue
            }
            if ((Get-Item -LiteralPath $fullPath).Length -le 0) {
                Add-Failure "Evidencia vacia: $fullPath"
                continue
            }
        }
        if (-not ($normalizedFiles -contains $relativeFile)) {
            $normalizedFiles.Add($relativeFile) | Out-Null
        }
    }
    foreach ($phaseDirectory in $contract.PhaseDirectories) {
        $phasePrefix = $phaseDirectory + '/'
        if (-not ($normalizedFiles | Where-Object { $_.StartsWith($phasePrefix, [System.StringComparison]::OrdinalIgnoreCase) })) {
            Add-Failure "Falta evidencia exigida para $phaseDirectory"
        }
    }
    $byTest = $evidence.by_test
    foreach ($testName in $contract.TestNames) {
        if (-not (Has-Property -Object $byTest -Name $testName)) {
            Add-Failure "Falta evidence.by_test.$testName"
            continue
        }
        $testEvidence = @((Get-PropertyValue -Object $byTest -Name $testName))
        if ($testEvidence.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$testEvidence[0])) {
            Add-Failure "evidence.by_test.$testName esta vacio"
        }
        foreach ($testEvidenceFile in $testEvidence) {
            $normalizedTestEvidence = ([string]$testEvidenceFile).Replace('\', '/')
            if ($normalizedFiles -notcontains $normalizedTestEvidence) {
                Add-Failure "evidence.by_test.$testName referencia archivo no exigido: $normalizedTestEvidence"
            }
        }
    }

    $started = Parse-Utc -Value $result.started_at_utc -Name 'started_at_utc'
    $completed = $null
    if (-not [string]::IsNullOrWhiteSpace([string]$result.completed_at_utc)) {
        $completed = Parse-Utc -Value $result.completed_at_utc -Name 'completed_at_utc'
    } elseif ([string]$result.status -ne 'PENDING') {
        Add-Failure 'completed_at_utc es obligatorio cuando la certificacion termino'
    }
    if ($null -ne $started -and $null -ne $completed -and $completed -lt $started) {
        Add-Failure 'completed_at_utc es anterior a started_at_utc'
    }

    $certification = $result.certification
    foreach ($certificationProperty in @('clean_windows_software', 'physical_printer', 'delivery_ready', 'delivery_ready_for_controlled_onsite_validation', 'production_certified')) {
        Require-Property -Object $certification -Name $certificationProperty -Path 'certification' | Out-Null
    }
    $expectedPhysicalCertification = switch ($physicalStatus) {
        'PASSED' { 'PASSED' }
        'FAILED' { 'FAILED' }
        'BLOCKED' { 'BLOCKED' }
        default { 'PENDING_ON_SITE' }
    }
    $softwareReady = $softwareStatus -eq 'PASSED'
    $physicalReady = $physicalStatus -eq 'PASSED'
    $expectedDeliveryReady = if ($softwareReady -and $physicalReady) { 'YES' } else { 'NO' }
    $expectedControlled = if ($softwareReady -and $physicalStatus -eq 'PENDING') { 'YES' } else { 'NO' }
    $expectedProduction = if ($softwareReady -and $physicalReady) { 'YES' } else { 'NO' }
    if ([string]$certification.clean_windows_software -ne $softwareStatus) { Add-Failure 'certification.clean_windows_software no coincide con tests' }
    if ([string]$certification.physical_printer -ne $expectedPhysicalCertification) { Add-Failure 'certification.physical_printer no coincide con tests' }
    if ([string]$certification.delivery_ready -ne $expectedDeliveryReady) { Add-Failure 'certification.delivery_ready no coincide con tests' }
    if ([string]$certification.delivery_ready_for_controlled_onsite_validation -ne $expectedControlled) { Add-Failure 'certification.delivery_ready_for_controlled_onsite_validation no coincide con tests' }
    if ([string]$certification.production_certified -ne $expectedProduction) { Add-Failure 'certification.production_certified no coincide con tests' }

    $stagingExe = Join-Path $ProjectRoot 'installer-output/STAGING-PENDING-CERTIFICACION/S_Hospital-Instalador.exe'
    $stagingHashFile = Join-Path $ProjectRoot 'installer-output/STAGING-PENDING-CERTIFICACION/S_Hospital-Instalador.exe.sha256'
    $stagingManifestFile = Join-Path $ProjectRoot 'installer-output/STAGING-PENDING-CERTIFICACION/CANDIDATE-MANIFEST.json'
    foreach ($candidateFile in @($stagingExe, $stagingHashFile, $stagingManifestFile)) {
        if (-not (Test-Path -LiteralPath $candidateFile -PathType Leaf)) {
            Add-Failure "Falta candidato de origen: $candidateFile"
        }
    }
    if (Test-Path -LiteralPath $stagingExe -PathType Leaf) {
        $actualSha = (Get-FileHash -LiteralPath $stagingExe -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualSha -ne $contract.ExpectedInstallerSha256) { Add-Failure "SHA del candidato de origen no coincide: $actualSha" }
        if ((Get-Item -LiteralPath $stagingExe).Length -ne $contract.ExpectedInstallerSizeBytes) { Add-Failure 'Tamano del candidato de origen no coincide' }
    }
    if (Test-Path -LiteralPath $stagingHashFile -PathType Leaf) {
        $declaredHash = ((Get-Content -LiteralPath $stagingHashFile -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
        if ($declaredHash -ne $contract.ExpectedInstallerSha256) { Add-Failure "SHA declarado por staging no coincide: $declaredHash" }
    }
    if (Test-Path -LiteralPath $stagingManifestFile -PathType Leaf) {
        try {
            $manifest = Get-Content -LiteralPath $stagingManifestFile -Raw | ConvertFrom-Json
            if ([string]$manifest.source_commit -ne $contract.ExpectedSourceCommit) { Add-Failure 'source_commit del manifiesto de staging no coincide' }
            if (([string]$manifest.installer_sha256).ToLowerInvariant() -ne $contract.ExpectedInstallerSha256) { Add-Failure 'SHA del manifiesto de staging no coincide' }
            if ([int64]$manifest.installer_size_bytes -ne $contract.ExpectedInstallerSizeBytes) { Add-Failure 'Tamano del manifiesto de staging no coincide' }
        } catch {
            Add-Failure "Manifiesto de staging invalido: $($_.Exception.Message)"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host "WINDOWS_CLEAN_RESULT: INVALID ($($failures.Count) incumplimientos)"
    foreach ($failure in $failures) {
        Write-Host "[FAIL] $failure"
    }
    exit 1
}

if ($AllowPhysicalPrinterPending) {
    Write-Host 'WINDOWS_CLEAN_RESULT: VALID_FOR_CONTROLLED_ONSITE_VALIDATION'
} else {
    Write-Host 'WINDOWS_CLEAN_RESULT: VALID_FOR_OFFICIAL_PROMOTION'
}
Write-Host "CLEAN_WINDOWS_SOFTWARE_CERTIFICATION: $($result.certification.clean_windows_software)"
Write-Host "PHYSICAL_PRINTER_CERTIFICATION: $($result.certification.physical_printer)"
Write-Host "DELIVERY_READY: $($result.certification.delivery_ready)"
Write-Host "PRODUCTION_CERTIFIED: $($result.certification.production_certified)"
exit 0
