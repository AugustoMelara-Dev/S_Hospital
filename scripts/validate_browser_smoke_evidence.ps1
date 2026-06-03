param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-JsonFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing JSON evidence: $relativePath"
        return $null
    }

    try {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    } catch {
        Add-Failure "Invalid JSON evidence: $relativePath"
        return $null
    }
}

function Test-RelativeEvidencePath([string] $relativePath, [int64] $minimumBytes, [string] $label) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        Add-Failure "$label has an empty path"
        return
    }

    if ([System.IO.Path]::IsPathRooted($relativePath)) {
        Add-Failure "$label uses an absolute path; evidence must be portable"
        return
    }

    if ($relativePath -match '(^|[\\/])\.\.([\\/]|$)') {
        Add-Failure "$label escapes the repository"
        return
    }

    $fullPath = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        Add-Failure "$label missing screenshot file: $relativePath"
        return
    }

    $file = Get-Item -LiteralPath $fullPath
    if ($file.Length -lt $minimumBytes) {
        Add-Failure "$label screenshot is unexpectedly small: $relativePath"
        return
    }

    Add-Pass "$label screenshot exists and is non-empty"
}

$rcReportPath = "qa\browser-smoke-2026-06-03\rc-e2e-mocked-report.json"
$helpReportPath = "qa\screenshots\rc-help-support-2026-05-31\help-support-report.json"
$rcReport = Read-JsonFile $rcReportPath
$helpReport = Read-JsonFile $helpReportPath

if ($null -ne $rcReport) {
    if ($rcReport.mode -eq "mocked-e2e") {
        Add-Pass "RC browser smoke declares mocked-e2e mode"
    } else {
        Add-Failure "RC browser smoke must declare mocked-e2e mode"
    }

    if ($rcReport.note -match "no sustituyen LAN|no sustituyen.*impresora|no sustituye") {
        Add-Pass "RC browser smoke states it does not replace LAN/printer proof"
    } else {
        Add-Failure "RC browser smoke must warn that screenshots do not replace LAN/printer proof"
    }

    $consoleIssues = @($rcReport.console_issues)
    if ($consoleIssues.Count -eq 0) {
        Add-Pass "RC browser smoke has no console issues"
    } else {
        Add-Failure "RC browser smoke has console issues"
    }

    $screenshots = @($rcReport.screenshots)
    $screensByName = @{}
    foreach ($shot in $screenshots) {
        if ($shot.name) {
            $screensByName[$shot.name] = $shot
        }
    }

    $requiredScreens = @(
        @{ Name = "dashboard-light"; Route = "/dashboard"; Theme = "light" },
        @{ Name = "dashboard-dark"; Route = "/dashboard"; Theme = "dark" },
        @{ Name = "cashbox-open-light"; Route = "/cashbox"; Theme = "light" },
        @{ Name = "billing-new-empty-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "billing-new-cart-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "receipt-preview-a5-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "receipt-preview-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "receipt-preview-dark"; Route = "/billing/new"; Theme = "dark" },
        @{ Name = "reports-admin-light"; Route = "/reports"; Theme = "light" },
        @{ Name = "backups-pending-light"; Route = "/backups"; Theme = "light" }
    )

    foreach ($required in $requiredScreens) {
        $name = $required.Name
        if (-not $screensByName.ContainsKey($name)) {
            Add-Failure "RC browser smoke missing screenshot entry: $name"
            continue
        }

        $shot = $screensByName[$name]
        if ($shot.route -eq $required.Route -and $shot.theme -eq $required.Theme) {
            Add-Pass "RC browser smoke metadata matches $name"
        } else {
            Add-Failure "RC browser smoke metadata mismatch for $name"
        }

        Test-RelativeEvidencePath $shot.path 10000 "RC browser smoke $name"
    }
}

if ($null -ne $helpReport) {
    $helpConsoleIssues = @($helpReport.consoleIssues)
    if ($helpConsoleIssues.Count -eq 0) {
        Add-Pass "Help/support smoke has no console issues"
    } else {
        Add-Failure "Help/support smoke has console issues"
    }

    $captures = @($helpReport.captures)
    foreach ($theme in @("light", "dark")) {
        $capture = $captures | Where-Object { $_.theme -eq $theme } | Select-Object -First 1
        if ($null -eq $capture) {
            Add-Failure "Help/support smoke missing $theme capture"
            continue
        }

        if ($capture.hasSupportEvidence -eq $true -and $capture.hasSafeMessage -eq $true -and $capture.leakedSecretWords -eq $false) {
            Add-Pass "Help/support $theme capture records safe support evidence without secret words"
        } else {
            Add-Failure "Help/support $theme capture lost safe support evidence flags"
        }

        Test-RelativeEvidencePath (Join-Path "qa\screenshots\rc-help-support-2026-05-31" $capture.file) 10000 "Help/support $theme"
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "BROWSER_SMOKE_EVIDENCE: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "BROWSER_SMOKE_EVIDENCE: YES" -ForegroundColor Green
