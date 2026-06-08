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

function Read-RequiredTextFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing browser evidence source: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Convert-ToEvidenceRelativePath([string] $fullPath) {
    $rootPath = (Get-Item -LiteralPath $ProjectRoot).FullName.TrimEnd('\', '/')
    $resolvedPath = (Get-Item -LiteralPath $fullPath).FullName

    if (-not $resolvedPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        Add-Failure "Browser evidence path is outside repository: $fullPath"
        return ""
    }

    return $resolvedPath.Substring($rootPath.Length).TrimStart('\', '/')
}

function Select-LatestRcReportPath {
    $qaRoot = Join-Path $ProjectRoot "qa"
    if (-not (Test-Path -LiteralPath $qaRoot -PathType Container)) {
        Add-Failure "Missing qa evidence directory."
        return ""
    }

    $candidates = @(
        Get-ChildItem -LiteralPath $qaRoot -Directory -Filter "browser-smoke-*" -ErrorAction SilentlyContinue |
            ForEach-Object {
                $directory = $_.FullName
                @(
                    @{ Path = (Join-Path $directory "controlled-e2e-report.json"); Priority = 0 },
                    @{ Path = (Join-Path $directory "rc-e2e-mocked-report.json"); Priority = 1 }
                )
            } |
            Where-Object {
                Test-Path -LiteralPath $_.Path -PathType Leaf
            } |
            ForEach-Object {
                $item = Get-Item -LiteralPath $_.Path
                [PSCustomObject]@{
                    FullName = $item.FullName
                    LastWriteTimeUtc = $item.LastWriteTimeUtc
                    Priority = $_.Priority
                }
            }
    )

    if ($candidates.Count -eq 0) {
        Add-Failure "Missing RC browser smoke report under qa\browser-smoke-*."
        return ""
    }

    $latest = $candidates |
        Sort-Object `
            @{ Expression = "LastWriteTimeUtc"; Descending = $true },
            @{ Expression = "Priority"; Ascending = $true },
            @{ Expression = "FullName"; Descending = $true } |
        Select-Object -First 1

    $relativePath = Convert-ToEvidenceRelativePath $latest.FullName
    if (-not [string]::IsNullOrWhiteSpace($relativePath)) {
        Add-Pass "Latest RC browser smoke report: $relativePath"
    }

    return $relativePath
}

function Assert-SourceContains([string] $content, [string] $needle, [string] $label) {
    if ($content.Contains($needle)) {
        Add-Pass $label
    } else {
        Add-Failure $label
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

function Assert-NoObsoleteReceiptPreviewEvidence([string] $relativeDirectory) {
    $directory = Join-Path $ProjectRoot $relativeDirectory
    if (-not (Test-Path -LiteralPath $directory -PathType Container)) {
        Add-Failure "Missing browser evidence directory: $relativeDirectory"
        return
    }

    $obsolete = @(Get-ChildItem -LiteralPath $directory -File -Filter "*receipt-preview*" -ErrorAction SilentlyContinue)
    if ($obsolete.Count -gt 0) {
        Add-Failure "Browser smoke evidence must use institutional-receipt filenames, not receipt-preview: $($obsolete.Name -join ', ')"
        return
    }

    Add-Pass "Browser smoke evidence uses institutional receipt filenames"
}

$rcReportPath = Select-LatestRcReportPath
$helpReportPath = "qa\screenshots\rc-help-support-2026-05-31\help-support-report.json"
$fieldQaScriptPath = "qa\visual-smoke\field-qa-current-screenshots.mjs"
$rcReport = if ([string]::IsNullOrWhiteSpace($rcReportPath)) { $null } else { Read-JsonFile $rcReportPath }
$helpReport = Read-JsonFile $helpReportPath
$fieldQaScript = Read-RequiredTextFile $fieldQaScriptPath
if (-not [string]::IsNullOrWhiteSpace($rcReportPath)) {
    Assert-NoObsoleteReceiptPreviewEvidence (Split-Path -Parent $rcReportPath)
}

if (-not [string]::IsNullOrWhiteSpace($fieldQaScript)) {
    Assert-SourceContains $fieldQaScript "const themes = ['light', 'dark'];" "Field QA smoke declares light and dark themes"
    Assert-SourceContains $fieldQaScript "function evidencePath(filePath)" "Field QA smoke uses portable evidence paths"
    Assert-SourceContains $fieldQaScript "screenshot: evidencePath(screenshot)" "Field QA smoke stores relative screenshot paths in JSON"
    Assert-SourceContains $fieldQaScript "theme," "Field QA smoke records theme metadata per capture"
    Assert-SourceContains $fieldQaScript '${String(index).padStart(2, ''0'')}-login-${theme}.png' "Field QA smoke captures login per theme"
    Assert-SourceContains $fieldQaScript '${String(index).padStart(2, ''0'')}-${name}-${theme}.png' "Field QA smoke captures authenticated screens per theme"
    Assert-SourceContains $fieldQaScript '${String(index).padStart(2, ''0'')}-institutional-receipt-${theme}.png' "Field QA smoke captures institutional receipt per theme when available"
    Assert-SourceContains $fieldQaScript '${entry.screen}:${entry.theme}:${key}' "Field QA smoke reports blockers with theme context"
}

if ($null -ne $rcReport) {
    if ($rcReport.mode -eq "controlled-e2e") {
        Add-Pass "RC browser smoke declares controlled-e2e mode"
    } elseif ($rcReport.mode -eq "mocked-e2e" -and $rcReportPath -like "*rc-e2e-mocked-report.json") {
        Add-Pass "RC browser smoke declares legacy mocked-e2e mode for historical evidence"
    } else {
        Add-Failure "RC browser smoke must declare controlled-e2e mode"
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
        @{ Name = "institutional-receipt-letter-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "institutional-receipt-a5-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "institutional-receipt-light"; Route = "/billing/new"; Theme = "light" },
        @{ Name = "institutional-receipt-dark"; Route = "/billing/new"; Theme = "dark" },
        @{ Name = "reports-admin-light"; Route = "/reports"; Theme = "light" },
        @{ Name = "reports-admin-dark"; Route = "/reports"; Theme = "dark" },
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
