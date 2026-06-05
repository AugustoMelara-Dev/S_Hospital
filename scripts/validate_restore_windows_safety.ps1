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

function Assert-Contains([string] $content, [string] $pattern, [string] $message) {
    if ($content -match $pattern) {
        Add-Pass $message
    } else {
        Add-Failure $message
    }
}

$restoreScript = Read-RequiredFile "scripts\restore_hospital_windows.ps1"
$restoreGuide = Read-RequiredFile "docs\manuales\GUIA_RESPALDOS_Y_RESTAURACION.md"
$backupReference = Read-RequiredFile "docs\BACKUP_RESTORE.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"

if ($restoreScript -ne "") {
    Assert-Contains $restoreScript '\[switch\]\s*\$SelfTest' "Restore helper exposes non-destructive -SelfTest"
    Assert-Contains $restoreScript 'Invoke-SelfTest' "Restore helper implements self-test function"
    Assert-Contains $restoreScript 'Test-DisposableDatabaseName' "Restore helper has disposable database name guard"
    Assert-Contains $restoreScript "hospital_billing_production|hospital_billing" "Restore helper rejects production-like database names"
    Assert-Contains $restoreScript '\(test\|validation\|restore\|disposable\|proof\)' "Restore helper requires disposable target wording"
    Assert-Contains $restoreScript 'Read-Host\s+"Password"\s+-AsSecureString' "Restore helper reads interactive password as SecureString"
    Assert-Contains $restoreScript 'ZeroFreeBSTR' "Restore helper clears SecureString BSTR after conversion"
    Assert-Contains $restoreScript 'Assert-SafeConnectionConfig\s+\$dbConfig' "Restore helper validates connection config before restore"
    Assert-Contains $restoreScript '\.\(sql\|tar\\\.gz\)' "Restore helper only allows .sql or .tar.gz backup files"
    Assert-Contains $restoreScript 'Self-test completado\. No se tocaron bases ni backups\.' "Restore self-test explicitly avoids DB and backup mutation"

    $selfTestOutput = @(& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ProjectRoot "scripts\restore_hospital_windows.ps1") -SelfTest 2>&1 | ForEach-Object { $_.ToString() })
    $selfTestExit = $LASTEXITCODE
    foreach ($line in $selfTestOutput) {
        Write-Host $line
    }

    if ($selfTestExit -eq 0 -and ($selfTestOutput -join "`n") -match 'Self-test completado') {
        Add-Pass "Restore helper self-test passes without touching databases or backups"
    } else {
        Add-Failure "Restore helper self-test failed or did not report safe completion."
    }
}

$combinedDocs = "$restoreGuide`n$backupReference`n$releaseChecklist"
if ($combinedDocs -ne "") {
    Assert-Contains $combinedDocs 'restore_hospital_windows\.ps1\s+-SelfTest' "Docs require restore helper self-test"
    Assert-Contains $combinedDocs '(?i)base descartable|base de prueba|ambiente seguro' "Docs require disposable restore target"
    Assert-Contains $combinedDocs '(?i)nunca sobre la base real|Nunca restaure|no use nombres como la base real' "Docs warn against restoring over production"
    Assert-Contains $combinedDocs 'qa\\FINAL_RESTORE_PROOF\.md|qa/FINAL_RESTORE_PROOF\.md' "Docs preserve final restore proof path"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "RESTORE_WINDOWS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "RESTORE_WINDOWS_SAFETY: YES" -ForegroundColor Green
