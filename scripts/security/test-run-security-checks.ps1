$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$guardPath = Join-Path $scriptRoot "run-security-checks.ps1"
$powerShellPath = (Get-Process -Id $PID).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempRoot "s-hospital-run-security-checks-test-$([Guid]::NewGuid().ToString('N'))"
$originalPath = $env:PATH
$originalTemp = $env:TEMP
$originalTmp = $env:TMP

function New-AuditFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [string] $AuditJson = "",
        [switch] $AuditFailsOnStderr
    )

    $fixtureRoot = Join-Path $testRoot $Name
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot "frontend") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot "fake-bin") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureRoot "temp-scan") -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureRoot "frontend\pnpm-lock.yaml") -Value "lockfileVersion: '9.0'`n" -Encoding utf8

    if ($AuditFailsOnStderr) {
        # Simulates an offline/network failure: stderr text plus a non-zero exit code.
        $cmdLines = @("@echo off", "echo synthetic-network-failure 1>&2", "exit /b 1")
    } else {
        # Synthetic pnpm audit --json payload; the fake corepack below replaces the real CLI
        # so the severity gate is exercised deterministically without network or installs.
        $cmdLines = @("@echo off", "echo $AuditJson", "exit /b 0")
    }
    Set-Content -LiteralPath (Join-Path $fixtureRoot "fake-bin\corepack.cmd") -Value ($cmdLines -join "`r`n") -Encoding ASCII

    return $fixtureRoot
}

function Invoke-AuditFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [string] $AuditJson = "",
        [Parameter(Mandatory = $true)]
        [int] $ExpectedExitCode,
        [Parameter(Mandatory = $true)]
        [string[]] $ExpectedOutput,
        [string[]] $UnexpectedOutput = @(),
        [string[]] $ExtraArguments = @(),
        [switch] $AuditFailsOnStderr
    )

    $fixtureRoot = New-AuditFixture -Name $Name -AuditJson $AuditJson -AuditFailsOnStderr:$AuditFailsOnStderr
    $env:PATH = "$(Join-Path $fixtureRoot 'fake-bin');$originalPath"
    $env:TEMP = Join-Path $fixtureRoot "temp-scan"
    $env:TMP = $env:TEMP

    try {
        # Native stderr merged with 2>&1 becomes ErrorRecords; a local EAP=Continue keeps the
        # harness alive so the guard's real exit code and output can be asserted below.
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $output = & $powerShellPath -NoProfile -ExecutionPolicy Bypass -File $guardPath -ProjectRoot $fixtureRoot @ExtraArguments 2>&1 | Out-String
            $exitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
    } finally {
        $env:PATH = $originalPath
        $env:TEMP = $originalTemp
        $env:TMP = $originalTmp
    }

    if ($exitCode -ne $ExpectedExitCode) {
        throw "Fixture '$Name' expected exit $ExpectedExitCode but received $exitCode.`n$output"
    }

    foreach ($expectedEvidence in $ExpectedOutput) {
        if ($output -notlike "*$expectedEvidence*") {
            throw "Fixture '$Name' did not emit expected evidence '$expectedEvidence'.`n$output"
        }
    }

    foreach ($unexpectedEvidence in $UnexpectedOutput) {
        if ($output -like "*$unexpectedEvidence*") {
            throw "Fixture '$Name' emitted unexpected evidence '$unexpectedEvidence'.`n$output"
        }
    }

    Write-Host "Fixture '$Name' OK (exit $exitCode as expected; expected-output and absence assertions passed)." -ForegroundColor Green
}

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

    # Regression (RV-T2-030 P3): the gate must fail on ANY advisory, not only high/critical.
    Invoke-AuditFixture -Name "advisory-moderate" `
        -AuditJson '{"advisories":{"GHSA-fixture-moderate":{"module_name":"fixture-pkg","severity":"moderate"}},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":1,"high":0,"critical":0}}}' `
        -ExpectedExitCode 1 `
        -ExpectedOutput @("Supply-chain guard passed", "pnpm audit failed the dependency gate", "1 advisory at or above 'info' severity", "moderate=1", "total advisories: 1")

    Invoke-AuditFixture -Name "advisory-low" `
        -AuditJson '{"advisories":{"GHSA-fixture-low":{"module_name":"fixture-pkg","severity":"low"}},"metadata":{"vulnerabilities":{"info":0,"low":1,"moderate":0,"high":0,"critical":0}}}' `
        -ExpectedExitCode 1 `
        -ExpectedOutput @("pnpm audit failed the dependency gate", "1 advisory at or above 'info' severity", "low=1", "total advisories: 1")

    Invoke-AuditFixture -Name "no-advisories" `
        -AuditJson '{"advisories":{},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":0,"high":0,"critical":0}}}' `
        -ExpectedExitCode 0 `
        -ExpectedOutput @("Supply-chain guard passed", "pnpm audit passed", "threshold: info", "total advisories: 0", "critical=0", "Security checks completed.")

    # Robustness (RV-T2-030 P3): valid JSON without metadata must fail closed with a clear
    # message, not crash with a StrictMode PropertyNotFoundException.
    Invoke-AuditFixture -Name "metadata-missing" `
        -AuditJson '{"advisories":{}}' `
        -ExpectedExitCode 1 `
        -ExpectedOutput @("unexpected JSON shape", "metadata.vulnerabilities", "refusing to evaluate the dependency gate") `
        -UnexpectedOutput @("PropertyNotFoundStrict", "PropertyNotFoundException", "No se encuentra la propiedad", "Security checks completed.")

    # Documented override: -FailOnSeverity high relaxes the gate; a moderate advisory passes.
    Invoke-AuditFixture -Name "override-high-moderate" `
        -AuditJson '{"advisories":{"GHSA-fixture-moderate":{"module_name":"fixture-pkg","severity":"moderate"}},"metadata":{"vulnerabilities":{"info":0,"low":0,"moderate":1,"high":0,"critical":0}}}' `
        -ExpectedExitCode 0 `
        -ExpectedOutput @("pnpm audit passed", "threshold: high", "moderate=1", "total advisories: 1") `
        -ExtraArguments @("-FailOnSeverity", "high")

    # Offline/LAN tolerance: a network-shaped failure must WARN and exit 0 instead of
    # being aborted by the native-stderr/StrictMode interaction.
    Invoke-AuditFixture -Name "offline-audit" `
        -ExpectedExitCode 0 `
        -ExpectedOutput @("pnpm audit could not complete", "synthetic-network-failure", "Security checks completed.") `
        -AuditFailsOnStderr

    Write-Host "run-security-checks self-test passed (6 fixtures)." -ForegroundColor Green
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
        $expectedPrefix = $tempRoot.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
        if (-not $resolvedTestRoot.StartsWith($expectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to remove test path outside the system temp directory: $resolvedTestRoot"
        }

        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}
