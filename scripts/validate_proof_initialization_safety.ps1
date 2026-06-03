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
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$initializer = Join-Path $scriptRoot "init_production_proofs.ps1"

function Protect-ProofInitText([string] $value) {
    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    return $protected
}

function Add-Failure([string] $message) {
    $failures.Add((Protect-ProofInitText $message)) | Out-Null
    Write-Host "[FAIL] $(Protect-ProofInitText $message)" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-ProofInitText $message)" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Invoke-Initializer([string] $fixtureRoot, [string[]] $arguments) {
    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $initializer -ProjectRoot $fixtureRoot @arguments 2>&1 |
        ForEach-Object { $_.ToString() }

    return @{
        ExitCode = $LASTEXITCODE
        Output = ($output -join "`n")
    }
}

function Assert-ExitCode([int] $expected, [hashtable] $result, [string] $message) {
    if ($result.ExitCode -eq $expected) {
        Add-Pass $message
    } else {
        Add-Failure "$message Expected exit code $expected, got $($result.ExitCode). Output: $($result.Output)"
    }
}

$initializerContent = Read-RequiredFile "scripts\init_production_proofs.ps1"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"
$installGuide = Read-RequiredFile "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$offlineBuilder = Read-RequiredFile "scripts\make_offline_release.ps1"
$offlineGuard = Read-RequiredFile "scripts\assert_offline_release_clean.ps1"

$requiredTemplates = @(
    "LAN_CLIENT_VALIDATION_PROOF",
    "INSTITUTIONAL_RECEIPT_PRINT_PROOF",
    "FINAL_RESTORE_PROOF",
    "FINAL_CONCURRENCY_PROOF",
    "TRAINING_ACCEPTANCE_PROOF"
)

foreach ($name in $requiredTemplates) {
    Assert-Contains "Initializer includes $name example template" $initializerContent "$name\.example\.md"
    Assert-Contains "Initializer includes $name target proof" $initializerContent "$name\.md"
    Assert-Contains "Offline builder includes $name example template" $offlineBuilder "$name\.example\.md"
    Assert-Contains "Offline guard requires $name example template" $offlineGuard "$name\.example\.md"
}

Assert-Contains "Initializer supports WhatIfOnly" $initializerContent "WhatIfOnly"
Assert-Contains "Initializer protects existing evidence unless Force is passed" $initializerContent "Use -Force solo si"
Assert-Contains "Initializer sanitizes local paths in output" $initializerContent "%PROJECT_ROOT%"
Assert-Contains "Release checklist documents proof initialization" $releaseChecklist "init_production_proofs\.ps1"
Assert-Contains "Install guide documents proof initialization dry-run" $installGuide "init_production_proofs\.ps1 -WhatIfOnly"
Assert-NotContains "Initializer does not run destructive database commands" $initializerContent "migrate:fresh|DROP DATABASE|docker\s+volume\s+rm|Remove-Item\s+.*qa"

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "s-hospital-proof-init-$([Guid]::NewGuid().ToString('N'))"
try {
    $fixtureQa = Join-Path $fixtureRoot "qa"
    New-Item -ItemType Directory -Force -Path $fixtureQa | Out-Null

    foreach ($name in $requiredTemplates) {
        Set-Content -LiteralPath (Join-Path $fixtureQa "$name.example.md") -Value @(
            "# $name example",
            "",
            "Template content for disposable proof initialization safety test."
        ) -Encoding ASCII
    }

    $whatIf = Invoke-Initializer $fixtureRoot @("-WhatIfOnly")
    Assert-ExitCode 0 $whatIf "Proof initializer WhatIf succeeds against disposable fixture"

    $createdDuringWhatIf = @($requiredTemplates | Where-Object {
        Test-Path -LiteralPath (Join-Path $fixtureQa "$_.md") -PathType Leaf
    })
    if ($createdDuringWhatIf.Count -eq 0) {
        Add-Pass "Proof initializer WhatIf does not create proof files"
    } else {
        Add-Failure "Proof initializer WhatIf created proof files: $($createdDuringWhatIf -join ', ')"
    }

    $create = Invoke-Initializer $fixtureRoot @()
    Assert-ExitCode 0 $create "Proof initializer creates missing proof files in disposable fixture"

    foreach ($name in $requiredTemplates) {
        $target = Join-Path $fixtureQa "$name.md"
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            Add-Pass "Proof initializer created qa\$name.md"
        } else {
            Add-Failure "Proof initializer did not create qa\$name.md"
        }
    }

    $sentinelPath = Join-Path $fixtureQa "LAN_CLIENT_VALIDATION_PROOF.md"
    Set-Content -LiteralPath $sentinelPath -Value "DO_NOT_OVERWRITE" -Encoding ASCII
    $preserve = Invoke-Initializer $fixtureRoot @()
    Assert-ExitCode 0 $preserve "Proof initializer exits successfully when proof files already exist"
    $sentinelAfter = Get-Content -LiteralPath $sentinelPath -Raw
    if ($sentinelAfter -match "DO_NOT_OVERWRITE") {
        Add-Pass "Proof initializer preserves existing proof files without Force"
    } else {
        Add-Failure "Proof initializer overwrote existing proof files without Force"
    }

    if ($whatIf.Output -match [regex]::Escape($fixtureRoot) -or $create.Output -match [regex]::Escape($fixtureRoot)) {
        Add-Failure "Proof initializer output exposed a local fixture path"
    } else {
        Add-Pass "Proof initializer output sanitizes local fixture paths"
    }
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PROOF_INITIALIZATION_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PROOF_INITIALIZATION_SAFETY: YES" -ForegroundColor Green
Write-Host "Proof initialization creates missing final-evidence templates without overwriting existing evidence." -ForegroundColor Green
