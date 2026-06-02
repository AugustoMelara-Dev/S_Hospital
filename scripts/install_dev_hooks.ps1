<#
.SYNOPSIS
  Installs the S_Hospital pre-commit guard into .git/hooks/pre-commit.

.DESCRIPTION
  Copies scripts/pre-commit-guard.ps1 to .git/hooks/pre-commit and
  marks it executable. Idempotent: rerun to refresh.

  Use -Uninstall to remove the hook.
#>

[CmdletBinding()]
param(
    [switch] $Uninstall
)

$ErrorActionPreference = "Stop"

$repoRoot = (& git rev-parse --show-toplevel 2>&1)
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not inside a git repository."
    exit 1
}

$hookDir = Join-Path $repoRoot ".git/hooks"
$hookPath = Join-Path $hookDir "pre-commit"
$sourcePath = Join-Path $repoRoot "scripts/pre-commit-guard.ps1"

if ($Uninstall) {
    if (Test-Path -LiteralPath $hookPath) {
        Remove-Item -LiteralPath $hookPath -Force
        Write-Host "Removed pre-commit hook."
    } else {
        Write-Host "No pre-commit hook to remove."
    }
    exit 0
}

if (-not (Test-Path -LiteralPath $sourcePath)) {
    Write-Error "Source not found: $sourcePath"
    exit 2
}

New-Item -ItemType Directory -Path $hookDir -Force | Out-Null

if ($IsWindows -or (-not ($IsLinux -or $IsMacOS))) {
    # Windows: git cannot execute a .ps1 via shebang. Use a .cmd shim
    # that git on Windows recognizes automatically when the hook file
    # has no extension.
    $cmdPath = Join-Path $hookDir "pre-commit.cmd"
    $cmdContent = "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$sourcePath`" -RepoRoot `"$repoRoot`"`r`nexit /B %ERRORLEVEL%"
    Set-Content -LiteralPath $cmdPath -Value $cmdContent -NoNewline -Encoding ASCII
    $hookContent = "#!/bin/sh`n`"$cmdPath`""
    Set-Content -LiteralPath $hookPath -Value $hookContent -NoNewline -Encoding ASCII
} else {
    $hookContent = "#!/usr/bin/env pwsh`n& `"$sourcePath`" -RepoRoot `"$repoRoot`"`nexit `$LASTEXITCODE"
    Set-Content -LiteralPath $hookPath -Value $hookContent -NoNewline -Encoding UTF8
    & chmod +x $hookPath
}

Write-Host "Installed pre-commit guard at $hookPath"
Write-Host "Test with: git commit --allow-empty -m 'test' (then --no-verify to skip)"
exit 0
