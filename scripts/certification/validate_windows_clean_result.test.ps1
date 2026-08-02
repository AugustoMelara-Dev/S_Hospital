$ErrorActionPreference = 'Stop'
$script:Checks = 0
$script:Errors = New-Object System.Collections.Generic.List[string]
$projectRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
$validator = Join-Path $PSScriptRoot 'validate_windows_clean_result.ps1'
$promoter = Join-Path $PSScriptRoot 'promote_to_usb.ps1'
$contractScript = Join-Path $PSScriptRoot 'windows_clean_result_contract.ps1'
. $contractScript
$contract = Get-WindowsCleanContract

function Assert-True {
    param([string] $Name, [bool] $Value)
    $script:Checks++
    if (-not $Value) {
        $script:Errors.Add($Name) | Out-Null
    }
}

function New-TestEvidence {
    param([string] $Root)
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    $files = New-Object System.Collections.Generic.List[string]
    foreach ($phase in $contract.PhaseDirectories) {
        $relative = "$phase/evidence.log"
        $full = Join-Path $Root $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $full) | Out-Null
        Set-Content -LiteralPath $full -Value "timestamp_utc=$((Get-Date).ToUniversalTime().ToString('o'))`nresult=PASS" -Encoding UTF8
        $files.Add($relative) | Out-Null
    }
    return @($files)
}

function New-Result {
    param(
        [string] $EvidenceRoot,
        [string[]] $EvidenceFiles,
        [string] $PhysicalStatus = 'PENDING',
        [string] $SourceCommit = '5e7d48ecd6b7d8a0f647d8892e90fe8ac1b91c3e',
        [string] $RootStatus = 'PASSED'
    )
    $tests = [ordered]@{}
    foreach ($testName in $contract.TestNames) {
        $tests[$testName] = if ($testName -eq 'physical_print') { $PhysicalStatus } else { 'PASSED' }
    }
    $byTest = [ordered]@{}
    foreach ($testName in $contract.TestNames) {
        $byTest[$testName] = @($EvidenceFiles[0])
    }
    [ordered]@{
        schema_version = 1
        status = $RootStatus
        source_commit = $SourceCommit
        installer_sha256 = $contract.ExpectedInstallerSha256
        installer_size_bytes = $contract.ExpectedInstallerSizeBytes
        machine = [ordered]@{
            name = 'S-Hospital-Test-VM'
            windows_edition = 'Windows 11 Pro'
            windows_build = '26100'
            architecture = 'x64'
            ram_bytes = [int64]12884901888
            free_space_bytes = [int64]80000000000
            docker_desktop_version = 'Docker Desktop test'
            clean_environment_confirmed = $true
            repository_checkout_absent = $true
            host_mysql_mariadb_absent = $true
            previous_s_hospital_absent = $true
        }
        tests = $tests
        evidence = [ordered]@{
            root = $contract.EvidenceRoot
            required_files = @($EvidenceFiles)
            by_test = $byTest
        }
        started_at_utc = '2026-07-27T20:00:00Z'
        completed_at_utc = '2026-07-27T21:00:00Z'
        operator = 'automated-gate-test'
        notes = @([ordered]@{ timestamp_utc = '2026-07-27T21:00:00Z'; operator = 'automated-gate-test'; observation = 'fixture' })
        certification = [ordered]@{
            clean_windows_software = 'PASSED'
            physical_printer = if ($PhysicalStatus -eq 'PASSED') { 'PASSED' } else { 'PENDING_ON_SITE' }
            delivery_ready = if ($PhysicalStatus -eq 'PASSED') { 'YES' } else { 'NO' }
            delivery_ready_for_controlled_onsite_validation = if ($PhysicalStatus -eq 'PENDING') { 'YES' } else { 'NO' }
            production_certified = if ($PhysicalStatus -eq 'PASSED') { 'YES' } else { 'NO' }
        }
    }
}

function Write-TestResult {
    param([string] $Path, [object] $Result)
    $Result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Invoke-ChildScript {
    param([string] $ScriptPath, [string[]] $Arguments)
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1 | Out-Null
        return [int]$LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

$root = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-result-test-' + [Guid]::NewGuid().ToString('N'))
try {
    $evidenceRoot = Join-Path $root 'windows-clean'
    $files = New-TestEvidence -Root $evidenceRoot
    $resultPath = Join-Path $evidenceRoot 'RESULT.json'

    Set-Content -LiteralPath $resultPath -Value '{' -Encoding UTF8
    $exitCode = Invoke-ChildScript -ScriptPath $validator -Arguments @('-ProjectRoot', $projectRoot, '-EvidenceDir', $evidenceRoot, '-AllowPhysicalPrinterPending')
    Assert-True 'invalid JSON is rejected' ($exitCode -ne 0)

    $pendingResult = New-Result -EvidenceRoot $evidenceRoot -EvidenceFiles $files -PhysicalStatus 'PENDING'
    Write-TestResult -Path $resultPath -Result $pendingResult
    $exitCode = Invoke-ChildScript -ScriptPath $validator -Arguments @('-ProjectRoot', $projectRoot, '-EvidenceDir', $evidenceRoot)
    Assert-True 'physical pending is rejected for official promotion' ($exitCode -ne 0)
    $exitCode = Invoke-ChildScript -ScriptPath $validator -Arguments @('-ProjectRoot', $projectRoot, '-EvidenceDir', $evidenceRoot, '-AllowPhysicalPrinterPending')
    Assert-True 'physical pending is accepted only for controlled onsite validation' ($exitCode -eq 0)

    $pendingResult.source_commit = '0000000000000000000000000000000000000000'
    Write-TestResult -Path $resultPath -Result $pendingResult
    $exitCode = Invoke-ChildScript -ScriptPath $validator -Arguments @('-ProjectRoot', $projectRoot, '-EvidenceDir', $evidenceRoot, '-AllowPhysicalPrinterPending')
    Assert-True 'source commit mismatch is rejected' ($exitCode -ne 0)

    $fullResult = New-Result -EvidenceRoot $evidenceRoot -EvidenceFiles $files -PhysicalStatus 'PASSED'
    Write-TestResult -Path $resultPath -Result $fullResult
    $exitCode = Invoke-ChildScript -ScriptPath $validator -Arguments @('-ProjectRoot', $projectRoot, '-EvidenceDir', $evidenceRoot)
    Assert-True 'complete certification is accepted' ($exitCode -eq 0)

    $realResult = Join-Path $projectRoot 'qa/pre-installation-final/windows-clean/RESULT.json'
    if (Test-Path -LiteralPath $realResult) {
        $exitCode = Invoke-ChildScript -ScriptPath $promoter -Arguments @('-ProjectRoot', $projectRoot)
        Assert-True 'promotion aborts with current PENDING result' ($exitCode -ne 0)
    } else {
        Assert-True 'current RESULT.json exists for promotion gate test' $false
    }
    $usbExe = Join-Path $projectRoot 'installer-output/ENTREGA-USB/S_Hospital-Instalador.exe'
    $marker = Join-Path $projectRoot 'installer-output/ENTREGA-USB/NO_ENTREGAR_AUN.txt'
    Assert-True 'USB candidate remains absent after rejected promotion' (-not (Test-Path -LiteralPath $usbExe))
    Assert-True 'USB block marker remains present after rejected promotion' (Test-Path -LiteralPath $marker)
} finally {
    if (Test-Path -LiteralPath $root) {
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($script:Errors.Count -gt 0) {
    Write-Host "FAIL: $($script:Errors.Count) de $script:Checks comprobaciones"
    foreach ($errorMessage in $script:Errors) {
        Write-Host "  - $errorMessage"
    }
    exit 1
}
Write-Host "OK: $script:Checks comprobaciones del esquema, validador y gate de promocion"
exit 0
