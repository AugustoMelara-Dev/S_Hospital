$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$guardPath = Join-Path $scriptRoot "supply-chain-check.ps1"
$powerShellPath = (Get-Process -Id $PID).Path
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$testRoot = Join-Path $tempRoot "s-hospital-supply-chain-test-$([Guid]::NewGuid().ToString('N'))"

function Assert-GuardFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [Parameter(Mandatory = $true)]
        [string] $LockContent,
        [Parameter(Mandatory = $true)]
        [int] $ExpectedExitCode,
        [Parameter(Mandatory = $true)]
        [string[]] $ExpectedOutput
    )

    $fixtureRoot = Join-Path $testRoot $Name
    New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureRoot "package.json") -Value "{}" -Encoding utf8
    Set-Content -LiteralPath (Join-Path $fixtureRoot "pnpm-lock.yaml") -Value $LockContent -Encoding utf8

    $output = & $powerShellPath -NoProfile -File $guardPath -ProjectRoot $fixtureRoot -SkipTemp 2>&1 | Out-String
    $exitCode = $LASTEXITCODE

    if ($exitCode -ne $ExpectedExitCode) {
        throw "Fixture '$Name' expected exit $ExpectedExitCode but received $exitCode.`n$output"
    }

    foreach ($expectedEvidence in $ExpectedOutput) {
        if ($output -notlike "*$expectedEvidence*") {
            throw "Fixture '$Name' did not emit expected evidence '$expectedEvidence'.`n$output"
        }
    }
}

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

    Assert-GuardFixture -Name "denied-package" -ExpectedExitCode 1 -ExpectedOutput @("Denied package 'plain-crypto-js@2.7.0-safe'", "failed with 1 finding(s)") -LockContent @"
lockfileVersion: '9.0'
packages:
  plain-crypto-js@2.7.0-safe:
    resolution: {integrity: sha512-fixture}
snapshots:
  plain-crypto-js@2.7.0-safe: {}
"@

    Assert-GuardFixture -Name "denied-version-with-peers" -ExpectedExitCode 1 -ExpectedOutput "Denied package 'axios@1.14.1'" -LockContent @"
lockfileVersion: '9.0'
packages:
  'axios@1.14.1(react@19.2.7)':
    resolution: {integrity: sha512-fixture}
"@

    Assert-GuardFixture -Name "safe-version" -ExpectedExitCode 0 -ExpectedOutput "Supply-chain guard passed with 0 warning(s)." -LockContent @"
lockfileVersion: '9.0'
packages:
  axios@1.14.2:
    resolution: {integrity: sha512-fixture}
  '@scope/safe-package@3.2.1':
    resolution: {integrity: sha512-fixture}
"@

    Write-Host "Supply-chain guard self-test passed (3 fixtures)." -ForegroundColor Green
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
