param(
    [string] $ProjectRoot = "",
    [switch] $IncludeCaches,
    [switch] $SkipNpmAudit,
    [switch] $StrictPins
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

$supplyChainArgs = @("-ExecutionPolicy", "Bypass", "-File", (Join-Path $scriptRoot "supply-chain-check.ps1"), "-ProjectRoot", $ProjectRoot)
if ($IncludeCaches) {
    $supplyChainArgs += "-IncludeCaches"
}
if ($StrictPins) {
    $supplyChainArgs += "-StrictPins"
}

& powershell.exe @supplyChainArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

function Invoke-NpmAudit([string] $Path) {
    Push-Location $Path
    try {
        $output = npm.cmd audit --omit=dev --json 2>&1
        $auditExit = $LASTEXITCODE
        $text = ($output | Out-String).Trim()

        $json = $null
        $parsed = $false
        try {
            $json = $text | ConvertFrom-Json
            $parsed = $true
        } catch {
            $parsed = $false
        }

        if ($parsed) {
            $total = 0
            if ($null -ne $json.metadata -and $null -ne $json.metadata.vulnerabilities) {
                $total = [int] $json.metadata.vulnerabilities.total
            }

            if ($total -gt 0) {
                Write-Host $text
                throw "npm audit found $total production vulnerabilitiy/vulnerabilities in $Path."
            }

            Write-Host "npm audit passed for $Path with 0 production vulnerabilities."
            return
        }

        if ($auditExit -ne 0) {
            Write-Host "[WARN] npm audit could not complete for $Path. This is usually network-related in offline/LAN work; rerun with internet before release." -ForegroundColor Yellow
            Write-Host $text
            return
        }

        throw "npm audit returned non-JSON output for $Path."
    } finally {
        Pop-Location
    }
}

if (-not $SkipNpmAudit) {
    $frontendPath = Join-Path $ProjectRoot "frontend"
    if (Test-Path -LiteralPath (Join-Path $frontendPath "package-lock.json")) {
        Invoke-NpmAudit $frontendPath
    }

    $backendPath = Join-Path $ProjectRoot "backend"
    if (Test-Path -LiteralPath (Join-Path $backendPath "package-lock.json")) {
        Invoke-NpmAudit $backendPath
    }
}

Write-Host "Security checks completed." -ForegroundColor Green
