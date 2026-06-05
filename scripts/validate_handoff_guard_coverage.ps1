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

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw
    }

    Add-Failure "Missing required file: $relativePath"
    return ""
}

function Test-ContainsLiteral([string] $content, [string] $needle) {
    return $content.Contains($needle)
}

$finalHandoff = Read-RequiredFile "scripts\final_production_handoff.ps1"
$offlineBuilder = Read-RequiredFile "scripts\make_offline_release.ps1"
$offlineGuard = Read-RequiredFile "scripts\assert_offline_release_clean.ps1"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"

$scriptNameMatches = [regex]::Matches(
    $finalHandoff,
    '\$\w+Script\s*=\s*Join-Path\s+\$scriptsDir\s+"(?<name>[^"]+)"'
)

$handoffScripts = @(
    $scriptNameMatches |
        ForEach-Object { $_.Groups["name"].Value } |
        Sort-Object -Unique
)

if ($handoffScripts.Count -gt 0) {
    Add-Pass "Final handoff declares $($handoffScripts.Count) script dependency/dependencies"
} else {
    Add-Failure "Final handoff does not expose script dependencies in the expected Join-Path pattern."
}

foreach ($scriptName in $handoffScripts) {
    $relativeScript = "scripts\$scriptName"

    if (Test-Path -LiteralPath (Join-Path $ProjectRoot $relativeScript) -PathType Leaf) {
        Add-Pass "Handoff dependency exists: $relativeScript"
    } else {
        Add-Failure "Handoff dependency is missing from source tree: $relativeScript"
    }

    if (Test-ContainsLiteral $offlineBuilder "`"$scriptName`"") {
        Add-Pass "Offline builder critical scripts include $scriptName"
    } else {
        Add-Failure "Offline builder critical scripts omit $scriptName."
    }

    if (Test-ContainsLiteral $offlineGuard "Test-RequiredPath `"scripts\$scriptName`" `"file`"") {
        Add-Pass "Offline guard requires $relativeScript"
    } else {
        Add-Failure "Offline guard does not require $relativeScript."
    }

    if (Test-ContainsLiteral $offlineGuard "Test-ReleaseFileMatchesSource `"scripts\$scriptName`"") {
        Add-Pass "Offline guard compares $relativeScript with versioned source"
    } else {
        Add-Failure "Offline guard does not compare $relativeScript with versioned source."
    }
}

foreach ($requiredChecklistText in @(
    'validate_handoff_guard_coverage.ps1',
    'validate_offline_release_staging_safety.ps1',
    'validate_lan_client_proof.ps1',
    'validate_lan_loadtest_safety.ps1',
    'validate_realtime_own_event_safety.ps1',
    'validate_training_acceptance_proof.ps1',
    'validate_restore_windows_safety.ps1',
    'validate_production_license_salt_guard.ps1',
    'validate_final_handoff_completeness.ps1',
    'validate_ops_evidence_index.ps1',
    'assert_offline_release_clean.ps1 -SelfTest'
)) {
    if (Test-ContainsLiteral $releaseChecklist $requiredChecklistText) {
        Add-Pass "Release checklist mentions $requiredChecklistText"
    } else {
        Add-Failure "Release checklist does not mention $requiredChecklistText."
    }
}

if ($finalHandoff -match '(?i)(APP_KEY|DB_PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]') {
    Add-Failure "Final handoff appears to contain secret-like assignments."
} else {
    Add-Pass "Final handoff does not expose secret-like assignments"
}

if ($offlineBuilder -match 'migrate:fresh|DROP DATABASE|docker\s+compose\s+down\s+-v|Remove-Item\s+.*backend') {
    Add-Failure "Offline builder coverage source contains destructive operations in guarded context."
} else {
    Add-Pass "Offline builder coverage source avoids destructive reset patterns"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "HANDOFF_GUARD_COVERAGE: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "HANDOFF_GUARD_COVERAGE: YES" -ForegroundColor Green
