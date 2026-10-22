#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$definition = Get-Content -LiteralPath (Join-Path $projectRoot 'installer\native\S_Hospital_Native.iss') -Raw
foreach ($pattern in @(
    'ArchitecturesAllowed=x64compatible',
    'PrivilegesRequired=admin',
    'DisableDirPage=yes',
    'CurStepChanged',
    'ssPostInstall',
    'install_native_runtime\.ps1',
    '\{commonstartup\}\\S_Hospital',
    'start_native_app\.ps1',
    'recover_hospital_access\.ps1',
    'Recuperar acceso a S_Hospital',
    'Respaldos y recuperación de S_Hospital',
    'recovery_wizard\.ps1',
    'NeedRestart',
    'restart-required-after-install',
    'InitializeSetup',
    'ExistingInstallAtStartup',
    'Actualizar S_Hospital',
    'Check: IsFreshInstallAndBootstrapSucceeded',
    'GetCustomSetupExitCode',
    'BootstrapFailed',
    'CurPageChanged',
    'La instalación no se completó',
    'RemoveFreshInstallShortcutsAfterFailure',
    'BootstrapSucceeded and[\s\S]+restart-required-after-install',
    'Languages\\Spanish\.isl',
    'SetupMutex=Global\\S_Hospital\.Native\.Setup'
)) {
    if ($definition -notmatch $pattern) { throw "Native Inno contract is missing: $pattern" }
}
if ($definition -match 'AUTH_BYPASS|AUTOMATIC_LOGIN') { throw 'Native installer must not bypass authentication.' }
if ($definition -match 'RaiseException') { throw 'Bootstrap failure must not fall through a generic runtime exception.' }
if ($definition -notmatch 'SW_HIDE') { throw 'Installer bootstrap must not expose a technical console.' }
if ($definition -match 'recovery_wizard\.ps1[^\r\n]+-InstallRoot') { throw 'Recovery wizard must derive and validate canonical roots itself.' }
Write-Host '[ OK ] Native Inno installer contract passed.'
