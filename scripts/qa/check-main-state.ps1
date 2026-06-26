param(
    [string] $RepoRoot = "C:\Projects\S_Hospital",
    [string] $ExpectedSha = "bfa115f15f613a69e81e54a462a5c0e7c9e40f69"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
    param([string[]] $GitArgs)
    & git -C $RepoRoot @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    throw "Repository path not found: $RepoRoot"
}

$currentBranch = (Invoke-Git -GitArgs @("branch", "--show-current") | Out-String).Trim()
$status = (Invoke-Git -GitArgs @("status", "--short") | Out-String).Trim()
$mainSha = (Invoke-Git -GitArgs @("rev-parse", "main") | Out-String).Trim()
$originMainSha = (Invoke-Git -GitArgs @("rev-parse", "origin/main") | Out-String).Trim()

Write-Host "Repository: $RepoRoot"
Write-Host "Current branch: $currentBranch"
Write-Host "Expected SHA: $ExpectedSha"
Write-Host "main: $mainSha"
Write-Host "origin/main: $originMainSha"

if ($mainSha -ne $ExpectedSha) {
    throw "main does not match expected SHA."
}

if ($originMainSha -ne $ExpectedSha) {
    throw "origin/main does not match expected SHA."
}

if ($status.Length -gt 0) {
    Write-Host "Git status is not clean:"
    Write-Host $status
    throw "Working tree is not clean."
}

Write-Host "Git state: PASS"

try {
    Write-Host "Docker containers (read-only):"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
} catch {
    Write-Host "Docker status not available from this shell."
}
