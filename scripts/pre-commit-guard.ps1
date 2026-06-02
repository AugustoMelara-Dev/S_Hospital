<#
.SYNOPSIS
  Pre-commit guard that blocks accidentally committing real secrets
  to the S_Hospital repository.

.DESCRIPTION
  Inspects the staged diff for:
  - APP_KEY=base64: followed by a non-empty value (real key).
  - DB_PASSWORD or DB_ROOT_PASSWORD assigned a non-empty, non-placeholder
    value.
  - Any file inside offline-release/ that is not in the allow-list.

  The guard is bypassed with `git commit --no-verify` for intentional
  cases (e.g. test fixtures with fake keys). See docs/SECRETS.md.

.PARAMETER RepoRoot
  Repository root. Defaults to the parent of the .git directory.
#>

[CmdletBinding()]
param(
    [string] $RepoRoot
)

if (-not $RepoRoot) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

$ErrorActionPreference = "Stop"

$allowedOfflineFiles = @(
    "MANIFEST.txt"
    "checksums.sha256"
    "setup.bat"
    "docker-compose.prod.yml"
    "Dockerfile.prod"
    ".gitkeep"
)

$failures = New-Object System.Collections.Generic.List[string]

# Use git diff --cached to read the staged changes. We only look at added
# lines to avoid false positives on removals or unchanged context.
$staged = & git -C $RepoRoot diff --cached --unified=0 --no-color 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Could not read staged diff: $staged"
    exit 0
}

$currentFile = $null
foreach ($line in $staged) {
    if ($line -match '^\+\+\+ b/(.+)$') {
        $currentFile = $Matches[1]
        continue
    }
    if ($line -notmatch '^\+[^+]') {
        continue
    }
    $added = $line.Substring(1)

    # File-level rules.
    if ($currentFile -like 'offline-release/*') {
        $leaf = Split-Path $currentFile -Leaf
        if ($allowedOfflineFiles -notcontains $leaf) {
            $script:failures.Add("offline-release/$leaf is generated; do not commit. Run scripts/make_offline_release.ps1 instead.") | Out-Null
        }
        continue
    }

    # Line-level rules.
    if ($added -match '^APP_KEY=base64:([A-Za-z0-9+/=]{16,})$') {
        $script:failures.Add("$currentFile : APP_KEY has a real base64 value. Use APP_KEY= in tracked files; the installer generates a real key.") | Out-Null
    }
    if ($added -match '^DB_PASSWORD=(.+)$' -and $Matches[1] -notin @('', '""', "''", 'changeme')) {
        $script:failures.Add("$currentFile : DB_PASSWORD is set to a non-placeholder value. Leave empty; the installer generates a random one.") | Out-Null
    }
    if ($added -match '^DB_ROOT_PASSWORD=(.+)$' -and $Matches[1] -notin @('', '""', "''", 'changeme')) {
        $script:failures.Add("$currentFile : DB_ROOT_PASSWORD is set to a non-placeholder value. Leave empty; the installer generates a random one.") | Out-Null
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "Pre-commit guard blocked this commit:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "If this is intentional, use 'git commit --no-verify' and document why." -ForegroundColor Yellow
    Write-Host "See docs/SECRETS.md for the full secret management playbook." -ForegroundColor Yellow
    exit 1
}

exit 0
