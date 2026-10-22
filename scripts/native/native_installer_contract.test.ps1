#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nativeRoot = $PSScriptRoot
$layoutModule = Join-Path $nativeRoot 'lib\native_layout.ps1'
$planModule = Join-Path $nativeRoot 'lib\native_install_plan.ps1'

if (-not (Test-Path -LiteralPath $layoutModule -PathType Leaf)) {
    throw "Missing native layout module: $layoutModule"
}
if (-not (Test-Path -LiteralPath $planModule -PathType Leaf)) {
    throw "Missing native install plan module: $planModule"
}

. $layoutModule
. $planModule

$script:Checks = 0
function Assert-NativeContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) { throw $Message }
}

$installRoot = 'C:\Program Files\S_Hospital'
$dataRoot = 'C:\ProgramData\S_Hospital'
$layout = Get-NativeInstallLayout -InstallRoot $installRoot -DataRoot $dataRoot -Version '2026.09.28'

Assert-NativeContract ($layout.ReleaseRoot -eq "$installRoot\releases\2026.09.28") 'Release must be versioned below Program Files.'
Assert-NativeContract ($layout.CurrentPath -eq "$installRoot\current") 'Current release pointer is missing.'
Assert-NativeContract ($layout.DatabaseData -eq "$dataRoot\database") 'Database data must live below ProgramData.'
Assert-NativeContract ($layout.BackupRoot -eq "$dataRoot\backups") 'Backups must live below ProgramData.'
Assert-NativeContract ($layout.ConfigRoot -eq "$dataRoot\config") 'Configuration must live below ProgramData.'
$contentLayout = Get-NativeInstallLayout -InstallRoot $installRoot -DataRoot $dataRoot -Version '2026.09.28' -ReleaseId '2026.09.28-abcdef123456'
Assert-NativeContract ($contentLayout.ReleaseRoot -eq "$installRoot\releases\2026.09.28-abcdef123456") 'Corrected same-version payloads need a distinct immutable release path.'

$plan = Get-NativeInstallPlan -Layout $layout -PayloadRoot 'D:\payload' -AppPort 8000 -PhpPort 9070 -DatabasePort 3307 -ExistingInstall
Assert-NativeContract ($plan.Network.AppUrl -eq 'http://127.0.0.1:8000') 'Native app must bind to loopback.'
Assert-NativeContract ($plan.Network.PhpEndpoint -eq '127.0.0.1:9070') 'FastCGI must bind to loopback.'
Assert-NativeContract ($plan.Network.DatabaseEndpoint -eq '127.0.0.1:3307') 'MariaDB must bind to loopback.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalMariaDB') 'MariaDB service is required.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalPhp') 'PHP FastCGI service is required.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalWeb') 'Web service is required.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalQueueDefault') 'Default queue worker is required.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalQueueBackups') 'Backup queue worker is required.'
Assert-NativeContract ($plan.Services.Id -contains 'SHospitalScheduler') 'Scheduler service is required.'
Assert-NativeContract (($plan.Services | Where-Object Id -eq 'SHospitalWeb').DependsOn -contains 'SHospitalPhp') 'Web service must depend on PHP.'
Assert-NativeContract (($plan.Services | Where-Object Id -eq 'SHospitalPhp').DependsOn -contains 'SHospitalMariaDB') 'PHP must depend on MariaDB.'
Assert-NativeContract (@($plan.Services | Where-Object Account -ne 'NT AUTHORITY\LocalService').Count -eq 0) 'Native services must use the low-privilege LocalService account.'

$backupIndex = [array]::IndexOf($plan.Steps, 'verify-pre-migration-backup')
$migrateIndex = [array]::IndexOf($plan.Steps, 'run-migrations')
$switchIndex = [array]::IndexOf($plan.Steps, 'switch-current-release')
Assert-NativeContract ($backupIndex -ge 0 -and $backupIndex -lt $migrateIndex) 'Backup verification must precede migrations.'
Assert-NativeContract ($migrateIndex -ge 0 -and $migrateIndex -lt $switchIndex) 'Release switch must happen after successful migrations.'
Assert-NativeContract ($plan.Authentication.Mode -eq 'hospital-session') 'Native launcher must preserve application authentication.'
Assert-NativeContract ($plan.Authentication.AutomaticLogin -eq $false) 'Native launcher must never bypass login.'

$installerSource = Get-Content -LiteralPath (Join-Path $nativeRoot 'install_native_runtime.ps1') -Raw
$initialRepairSource = Get-Content -LiteralPath (Join-Path $nativeRoot 'lib\native_initial_repair.ps1') -Raw
$databaseBootstrapSource = Get-Content -LiteralPath (Join-Path $nativeRoot 'lib\native_database_bootstrap.ps1') -Raw
Assert-NativeContract ($installerSource -notmatch '&\s+powershell\.exe') 'Elevated installer must use the absolute Windows PowerShell path.'
Assert-NativeContract ($installerSource -match 'Get-Service[\s\S]+Status -ne ''Running''') 'Installer result must verify registered service state.'
Assert-NativeContract ($installerSource -match 'native-install-state\.json') 'Installer must journal resumable initialization state.'
Assert-NativeContract ($installerSource -match 'resumingInitial') 'Installer must distinguish an incomplete initial install from an update.'
Assert-NativeContract ($installerSource -match 'currentPayloadMatches[\s\S]+ContentSha256') 'Installer must compare payload content before treating a same-version package as already installed.'
Assert-NativeContract ($installerSource.IndexOf('WindowsBuiltInRole') -lt $installerSource.IndexOf('New-NativeRuntimeConfiguration -Plan')) 'Elevation must be checked before writing runtime secrets.'
Assert-NativeContract ($installerSource -match 'Pre-database repair is restricted to the canonical S_Hospital installation roots') 'Partial repair must be restricted to canonical roots.'
Assert-NativeContract ($installerSource -match 'Pre-database repair refused because S_Hospital services already exist') 'Partial repair must refuse registered services.'
Assert-NativeContract ($installerSource -match 'Pre-database repair refused because the database directory is not empty') 'Partial repair must refuse any database content.'
Assert-NativeContract ($installerSource.IndexOf('Set-NativeAclProfile -Path $layout.InstallRoot -Profile ApplicationRoot') -lt $installerSource.IndexOf('$repairValidation=Test-NativePayloadManifest')) 'Partial repair must restore effective application ACLs before validating the prior release.'
Assert-NativeContract ($installerSource -match 'Test-NativePayloadManifest\s+-PayloadRoot\s+\$repairCurrentTarget\s+-IntegrityOnly') 'Prior immutable releases must be checked against their own manifest without applying current candidate file requirements.'
Assert-NativeContract ($installerSource -match "Set-NativeInstallOperationPhase 'validate_prior_release_integrity'") 'Historical release integrity failures must have a precise operation phase.'
Assert-NativeContract ($installerSource -match 'failure_message=\$safeFailureMessage') 'Operational failure evidence must retain a bounded diagnostic message.'
Assert-NativeContract ($installerSource -match '\$failureRecord=\$_[\s\S]+\$failureMessage=\$failureRecord\.Exception\.Message[\s\S]+Restore-NativeInitialRepairPointer') 'Failure evidence must preserve the original error before rollback handling can replace the active error record.'
Assert-NativeContract ($installerSource -match 'Assert-NativeInitialReleaseMutationPath -Path \$layout\.ReleaseRoot -ReleasesRoot \$layout\.ReleasesRoot') 'Initial release replacement must validate its canonical path below releases.'
$candidateStageExpression = 'Join-Path $layout.ReleasesRoot (''.candidate-initial-'''
Assert-NativeContract ($installerSource.Contains($candidateStageExpression)) 'Initial staging must remain below the immutable releases root.'
Assert-NativeContract ($installerSource.IndexOf('Protect-NativeMachineSecret') -lt $installerSource.IndexOf('Test-NativeBundledRuntimeDependencies')) 'Database administrator secret must be persisted before fallible runtime probes.'
Assert-NativeContract ($installerSource.IndexOf("Phase 'prepared'") -lt $installerSource.IndexOf('Test-NativeBundledRuntimeDependencies')) 'Resumable prepared journal must precede fallible runtime probes.'
Assert-NativeContract ($installerSource -match 'Invoke-CimMethod -ClassName Win32_Service -MethodName Create') 'MariaDB service registration must preserve the exact quoted binary path through CIM.'
Assert-NativeContract ($installerSource -match 'ServiceType\s*=\s*\[byte\]16') 'Win32_Service.Create ServiceType must use its declared UInt8 CIM type.'
Assert-NativeContract ($installerSource -match 'ErrorControl\s*=\s*\[byte\]1') 'Win32_Service.Create ErrorControl must use its declared UInt8 CIM type.'
Assert-NativeContract ($installerSource -match "StartPassword\s*=\s*''") 'LocalService registration must send an explicit empty password.'
Assert-NativeContract ($installerSource -notmatch 'LoadOrderGroup\s*=\s*\$null|LoadOrderGroupDependencies\s*=\s*\$null|ServiceDependencies\s*=\s*\$null') 'Unused optional Win32_Service.Create arguments must be omitted instead of sent as null.'
$createMethod=(Get-CimClass -ClassName Win32_Service).CimClassMethods['Create']
Assert-NativeContract ($createMethod.Parameters['ServiceType'].CimType -eq [Microsoft.Management.Infrastructure.CimType]::UInt8) 'Host Win32_Service.Create schema must declare ServiceType as UInt8.'
Assert-NativeContract ($createMethod.Parameters['ErrorControl'].CimType -eq [Microsoft.Management.Infrastructure.CimType]::UInt8) 'Host Win32_Service.Create schema must declare ErrorControl as UInt8.'
Assert-NativeContract ($createMethod.Parameters['LoadOrderGroupDependencies'].CimType -eq [Microsoft.Management.Infrastructure.CimType]::StringArray) 'Host Win32_Service.Create schema must declare load-order dependencies as StringArray.'
Assert-NativeContract ($createMethod.Parameters['ServiceDependencies'].CimType -eq [Microsoft.Management.Infrastructure.CimType]::StringArray) 'Host Win32_Service.Create schema must declare service dependencies as StringArray.'
Assert-NativeContract ($installerSource -notmatch '&\s+\$sc\s+create') 'MariaDB service registration must not rely on fragile PowerShell 5.1 native quoting.'
Assert-NativeContract ($installerSource -match '\$databaseBinPath\s*=.+--defaults-file=.+SHospitalMariaDB''') 'MariaDB service binary path must end with its explicit SCM service name.'
Assert-NativeContract ($installerSource -match 'registeredDatabase\.PathName.+Equals\(\$databaseBinPath') 'MariaDB service registration must verify the exact persisted binary path.'
Assert-NativeContract ($installerSource -match '&\s+\$serviceConfig\.ExecutablePath\s+install') 'WinSW services must install through an executable whose base name matches its adjacent XML.'
Assert-NativeContract ($installerSource -match '&\s+\$serviceConfig\.ExecutablePath\s+start') 'WinSW services must start through their persistent per-service executable.'
Assert-NativeContract ($installerSource -match '&\s+\$serviceConfig\.ExecutablePath\s+status') 'WinSW wrapper status must be checked after startup.'
Assert-NativeContract ($installerSource -notmatch '\$winsw\s+install\s+\$serviceConfig\.Path') 'WinSW config paths must not be passed as unsupported command arguments.'
Assert-NativeContract ($installerSource -notmatch 'bootstrapError\.Result') 'Bootstrap failures must never copy database process stderr into public diagnostics.'
Assert-NativeContract ($installerSource -notmatch '--bootstrap') 'Initial database security must not use MariaDB bootstrap mode because it disables grant statements.'
Assert-NativeContract ($installerSource -match 'Invoke-NativeMariaDbInitialSecurity') 'Initial database security must use the isolated named-pipe workflow.'
Assert-NativeContract ($installerSource -match '-CredentialDirectory\s*\(Join-Path\s+\$layout\.ConfigRoot\s+''administrator-only''\)') 'Temporary MariaDB credentials must stay inside the administrator-only configuration directory.'
Assert-NativeContract ($databaseBootstrapSource -match '--skip-networking') 'Initial database security must disable TCP.'
Assert-NativeContract ($databaseBootstrapSource -match '--named-pipe') 'Initial database security must use a local named pipe.'
Assert-NativeContract ($databaseBootstrapSource -match 'RedirectStandardInput\s*=\s*\$true') 'Initial database SQL must travel through standard input.'
Assert-NativeContract ($databaseBootstrapSource -match "mariadb-bootstrap-'\+\[guid\]::NewGuid") 'Protected retry credentials must use a unique temporary options file.'
Assert-NativeContract ($databaseBootstrapSource -match 'Remove-Item\s+-LiteralPath\s+\$credentialFile\s+-Force') 'Temporary MariaDB credential files must be removed in cleanup.'
Assert-NativeContract ($databaseBootstrapSource -notmatch '--password') 'Database passwords must never be passed on the MariaDB command line.'
Assert-NativeContract ($initialRepairSource -match "NativeFailedInitialRepairReleaseId='2026\.09\.28\.5-9b637d42ed3a'") 'Failed initial repair must be pinned to an explicitly reviewed release identity.'
Assert-NativeContract ($initialRepairSource -match "phase-eq'database_files_initialized'") 'Failed initial repair must require the exact initialized-but-unsecured database phase.'
Assert-NativeContract ($initialRepairSource -match "NativeFailedServicesRepairReleaseId='2026\.09\.28\.6-99fefd4d5400'") 'Failed services repair must be pinned to the observed release identity.'
Assert-NativeContract ($initialRepairSource -match "phase-eq'services_installed'") 'Failed services repair must require the exact post-services journal phase.'
Assert-NativeContract ($initialRepairSource -match "CandidateVersion-eq'2026\.09\.28\.7'") 'Failed services repair must accept only the reviewed repair candidate.'
Assert-NativeContract ($installerSource -match 'InstalledServiceCount\s+@\(\$installedRepairServices\)\.Count') 'Failed initial repair must prove that no S_Hospital service was registered.'
Assert-NativeContract ($installerSource -match '\$existingInstall[\s\S]+-not \$failedInitialRepair\s+-and\s+-not \$failedServicesRepair[\s\S]+delegate_update') 'Pinned failed repairs must bypass the normal updater delegation.'
Assert-NativeContract ($installerSource -match 'NativeRepairJournalRollback[\s\S]+Write-NativeInstallState[\s\S]+Complete-NativeInitialRepairActivation') 'Cross-release repair must snapshot its journal before committing candidate state and pointer completion.'
Assert-NativeContract ($installerSource -match 'Restore-NativeInitialRepairActivation[\s\S]+NativeRepairJournalRollback') 'Cross-release repair failure must restore both pointer and previous journal.'
Assert-NativeContract ($installerSource -match 'Invoke-CimMethod\s+-InputObject\s+\$service\s+-MethodName\s+Change[\s\S]+StartName=''NT AUTHORITY\\LocalService''') 'Existing WinSW services must migrate to LocalService through the typed CIM provider.'
Assert-NativeContract ($installerSource -match "Set-NativeInstallOperationPhase 'correct_application_service_accounts'") 'Service-account correction must have a precise operation phase.'
Assert-NativeContract ($installerSource.IndexOf("Phase 'services_installed'") -lt $installerSource.IndexOf('$initialAdmin =')) 'Pinned services repair must commit its resumable journal before administrator interaction.'
Assert-NativeContract ($installerSource -match '\$isFailure=\$Status-eq''failed''[\s\S]+\$safeFailureMessage=if\(\$isFailure\)') 'In-progress operation records must not contain a false failure message.'

Write-Host "[ OK ] Native installer contract passed: $script:Checks checks."
