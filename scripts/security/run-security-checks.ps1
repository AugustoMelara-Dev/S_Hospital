param(
    [string] $ProjectRoot = "",
    [switch] $IncludeCaches,
    [Alias("SkipNpmAudit")]
    [switch] $SkipDependencyAudit,
    [switch] $StrictPins,
    # Dependency-audit gate threshold: fail when pnpm reports any advisory at or
    # above this severity. The default 'info' fails on ANY advisory, restoring the
    # original strict policy; relaxing it (e.g. -FailOnSeverity high) requires an
    # explicit, reviewed decision. See hospital-ai/evidencia/T3-007/INFORME.md.
    [ValidateSet("info", "low", "moderate", "high", "critical")]
    [string] $FailOnSeverity = "info"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$FailOnSeverity = $FailOnSeverity.ToLowerInvariant()

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

function Get-ObjectPropertyValue($Object, [string] $Name) {
    if ($null -eq $Object) {
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Get-VulnerabilitySeverityCount($Vulnerabilities, [string] $Name) {
    $property = $Vulnerabilities.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return 0
    }

    return [int] $property.Value
}

function Invoke-PnpmAudit([string] $Path, [string] $FailOnSeverity) {
    $corepack = Get-Command corepack -ErrorAction SilentlyContinue
    if ($null -eq $corepack) {
        throw "corepack is required to audit the canonical pnpm lockfile. The npm fallback was removed because frontend/pnpm-lock.yaml is the selected lockfile."
    }

    Push-Location $Path
    try {
        # Audit the canonical pnpm lockfile; the residual package-lock.json is never queried.
        # Native stderr merged with 2>&1 becomes ErrorRecords; keep EAP=Continue around the
        # call so a network/corepack warning cannot abort the gate before the WARN path.
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $output = corepack pnpm audit --json 2>&1
            $auditExit = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        $text = (($output | ForEach-Object { "$_" }) -join "`n").Trim()

        $json = $null
        $parsed = $false
        try {
            $json = $text | ConvertFrom-Json
            $parsed = $true
        } catch {
            $parsed = $false
        }

        $vulnerabilities = $null
        if ($parsed) {
            $vulnerabilities = Get-ObjectPropertyValue (Get-ObjectPropertyValue $json "metadata") "vulnerabilities"
        }

        if ($null -ne $vulnerabilities -and $vulnerabilities -is [System.Management.Automation.PSCustomObject]) {
            $severityOrder = @("info", "low", "moderate", "high", "critical")
            $thresholdRank = [Array]::IndexOf($severityOrder, $FailOnSeverity)
            $total = 0
            $blocking = 0
            $breakdown = foreach ($severity in $severityOrder) {
                $count = Get-VulnerabilitySeverityCount -Vulnerabilities $vulnerabilities -Name $severity
                $total += $count
                if ([Array]::IndexOf($severityOrder, $severity) -ge $thresholdRank) {
                    $blocking += $count
                }
                "$severity=$count"
            }
            $breakdownText = $breakdown -join " "

            if ($blocking -gt 0) {
                Write-Host $text
                $noun = if ($blocking -eq 1) { "advisory" } else { "advisories" }
                throw "pnpm audit failed the dependency gate in $Path ($blocking $noun at or above '$FailOnSeverity' severity; breakdown: $breakdownText; total advisories: $total)."
            }

            Write-Host "pnpm audit passed for $Path (threshold: $FailOnSeverity; total advisories: $total; breakdown: $breakdownText)."
            return
        }

        if ($auditExit -ne 0) {
            Write-Host "[WARN] pnpm audit could not complete for $Path. This is usually network-related in offline/LAN work; rerun with internet before release." -ForegroundColor Yellow
            Write-Host $text
            return
        }

        if ($parsed) {
            throw "pnpm audit returned an unexpected JSON shape for $Path (expected an object at metadata.vulnerabilities); refusing to evaluate the dependency gate."
        }

        throw "pnpm audit returned non-JSON output for $Path."
    } finally {
        Pop-Location
    }
}

function Invoke-PnpmAuditForProject([string] $Path, [string] $FailOnSeverity) {
    if (Test-Path -LiteralPath (Join-Path $Path "pnpm-lock.yaml")) {
        Invoke-PnpmAudit -Path $Path -FailOnSeverity $FailOnSeverity
    }
}

if (-not $SkipDependencyAudit) {
    Invoke-PnpmAuditForProject -Path (Join-Path $ProjectRoot "frontend") -FailOnSeverity $FailOnSeverity
    Invoke-PnpmAuditForProject -Path (Join-Path $ProjectRoot "backend") -FailOnSeverity $FailOnSeverity
}

Write-Host "Security checks completed." -ForegroundColor Green
