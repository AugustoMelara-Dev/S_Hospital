#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'lib\install_result.ps1'
if (-not (Test-Path -LiteralPath $modulePath)) {
    throw "Install result module is missing: $modulePath"
}
. $modulePath

$script:Checks = 0
function Assert-InstallResult {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

$requiredNames = @(
    'runtime',
    'database',
    'migrations',
    'admin',
    'web-health',
    'queue-worker',
    'scheduler',
    'encrypted-backup',
    'app-shortcut'
)
$allChecks = @{}
foreach ($name in $requiredNames) {
    $allChecks[$name] = $true
}
$allChecks['maintenance-shortcut'] = $true

$success = Get-InstallResult `
    -Checks $allChecks `
    -Details @{
        Mode = 'SinglePc'
        LocalUrl = 'http://127.0.0.1:8000'
        LanUrl = ''
        BackupTime = '2026-07-26T15:00:00Z'
        ShortcutStatus = 'ready'
        LogLocation = 'C:\Hospital con espacios\install-logs\install.log'
        Password = 'must-not-leak'
    } `
    -ProjectRoot 'C:\Hospital con espacios'

Assert-InstallResult $success.Success 'All required checks must produce success.'
Assert-InstallResult ($success.Blockers.Count -eq 0) 'Successful result must not contain blockers.'
Assert-InstallResult ($success.SafeSummary.LogLocation -eq '%PROJECT_ROOT%\install-logs\install.log') 'Project path must be redacted.'
Assert-InstallResult ($success.SafeSummary.PSObject.Properties.Name -notcontains 'Password') 'Unsafe summary fields must be discarded.'

foreach ($failedName in $requiredNames) {
    $failedChecks = $allChecks.Clone()
    $failedChecks[$failedName] = $false
    $failure = Get-InstallResult -Checks $failedChecks
    Assert-InstallResult (-not $failure.Success) "Required check '$failedName' must block success."
    Assert-InstallResult ($failure.Blockers -contains $failedName) "Blocker '$failedName' must be reported."
}

$maintenanceWarningChecks = $allChecks.Clone()
$maintenanceWarningChecks['maintenance-shortcut'] = $false
$maintenanceWarning = Get-InstallResult -Checks $maintenanceWarningChecks
Assert-InstallResult $maintenanceWarning.Success 'Maintenance shortcut alone must remain a warning.'
Assert-InstallResult ($maintenanceWarning.Warnings -contains 'maintenance-shortcut') 'Maintenance shortcut warning must be reported.'

$setupContent = Get-Content -LiteralPath (Join-Path (Split-Path $PSScriptRoot -Parent) 'setup.bat') -Raw
Assert-InstallResult ($setupContent -match 'set "INSTALL_EXIT=%ERRORLEVEL%"') 'setup.bat must capture the PowerShell exit code.'
Assert-InstallResult ($setupContent -match 'exit /b %INSTALL_EXIT%') 'setup.bat must propagate the installer exit code.'
Assert-InstallResult ($setupContent -notmatch 'Instalacion LAN') 'setup.bat title must not imply LAN-only installation.'

$deployerContent = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'deploy_hospital_lan.ps1') -Raw
foreach ($requiredName in $requiredNames) {
    Assert-InstallResult ($deployerContent -match [regex]::Escape("'$requiredName'")) "Deployer must wire required check '$requiredName'."
}
Assert-InstallResult ($deployerContent -match 'Get-InstallResult') 'Deployer must use the consolidated result.'
Assert-InstallResult ($deployerContent -match 'exit \$finalInstallExitCode') 'Deployer must return the consolidated exit code.'
Assert-InstallResult ($deployerContent -notmatch '\[ADMIN\] CREDENCIALES') 'Final summary must not print credential details.'

Write-Host "Install result self-test passed: $script:Checks checks."
