#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $PayloadRoot,
    [string] $InstallRoot = (Join-Path $env:ProgramFiles 'S_Hospital'),
    [string] $DataRoot = (Join-Path $env:ProgramData 'S_Hospital'),
    [ValidateRange(1024, 65535)][int] $AppPort = 8000,
    [ValidateRange(1024, 65535)][int] $PhpPort = 9070,
    [ValidateRange(1024, 65535)][int] $DatabasePort = 3307,
    [switch] $SandboxOnly,
    [switch] $WhatIfOnly,
    [switch] $Json,
    [string] $OperationalLogPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
. (Join-Path $PSScriptRoot 'lib\native_lock.ps1')
. (Join-Path $PSScriptRoot 'lib\native_layout.ps1')
. (Join-Path $PSScriptRoot 'lib\native_install_plan.ps1')
. (Join-Path $PSScriptRoot 'lib\native_config.ps1')
. (Join-Path $PSScriptRoot 'lib\native_database_bootstrap.ps1')
. (Join-Path $PSScriptRoot 'lib\native_secret_store.ps1')
. (Join-Path $PSScriptRoot 'lib\native_acl.ps1')
. (Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1')
. (Join-Path $PSScriptRoot 'lib\native_elevated_php.ps1')
. (Join-Path $PSScriptRoot 'lib\native_initial_repair.ps1')
. (Join-Path $PSScriptRoot 'lib\native_update_policy.ps1')

function New-NativeSecret {
    param([ValidateRange(16, 128)][int] $Bytes = 32, [switch] $Base64)

    $buffer = New-Object byte[] $Bytes
    $provider = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $provider.GetBytes($buffer) }
    finally { $provider.Dispose() }
    if ($Base64) { return [Convert]::ToBase64String($buffer) }
    ([BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}

function Get-NativeEnvironmentSetting {
    param([string] $Path, [string] $Name)
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $separator = $line.IndexOf('=')
        if ($separator -gt 0 -and $line.Substring(0, $separator).Trim() -eq $Name) {
            return ConvertFrom-NativeDotEnvValue $line.Substring($separator + 1).Trim()
        }
    }
    throw "Required runtime setting '$Name' is missing."
}

$script:NativeInstallPhases = @('prepared','database_files_initialized','database_secured','database_service_registered','schema_initialized','services_installed','admin_configured','completed')
function Test-NativeInstallPhaseReached {
    param([string] $Current, [string] $Required)
    [Array]::IndexOf($script:NativeInstallPhases, $Current) -ge [Array]::IndexOf($script:NativeInstallPhases, $Required)
}

function Write-NativeInstallState {
    param([string] $Path, [string] $Version, [string] $ReleaseId, [string] $Phase, [string] $Status = 'in_progress')
    $record = [ordered]@{ schema_version = 2; version = $Version; release_id = $ReleaseId; phase = $Phase; status = $Status; updated_at_utc = (Get-Date).ToUniversalTime().ToString('o') }
    $temporary = $Path + '.tmp'
    $record | ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Wait-NativeInstallHealth {
    param([string] $Url, [int] $TimeoutSeconds = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        try { if ((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch { }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    $false
}

$script:NativeInstallOperationPhase = 'starting'
$script:NativeRepairContext = $null
$script:NativeRepairJournalRollback = $null
function Write-NativeInstallOperationRecord {
    param([string]$Status,[string]$FailureType='',[string]$FailureMessage='')
    if ([string]::IsNullOrWhiteSpace($OperationalLogPath)) { return }
    $fullPath=[IO.Path]::GetFullPath($OperationalLogPath)
    $allowedRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'S_Hospital\logs')).TrimEnd('\')+'\'
    if (-not $fullPath.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Operational log path must remain in the current user local S_Hospital logs directory.' }
    $parent=Split-Path -Parent $fullPath
    if(-not(Test-Path -LiteralPath $parent -PathType Container)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
    $isFailure=$Status-eq'failed'
    $safeFailureType=if($isFailure){$FailureType}else{''}
    $safeFailureMessage=if($isFailure){ConvertTo-NativeSafeInstallFailureMessage -Phase $script:NativeInstallOperationPhase -Message $FailureMessage}else{''}
    $record=[ordered]@{schema='s-hospital-native-install-operation/v1';status=$Status;phase=$script:NativeInstallOperationPhase;version=if($null-ne$layout){$layout.Version}else{''};release_id=if($null-ne$layout){$layout.ReleaseId}else{''};failure_type=$safeFailureType;failure_message=$safeFailureMessage;updated_at_utc=[DateTime]::UtcNow.ToString('o')}
    $temporary=$fullPath+'.tmp'
    $record|ConvertTo-Json|Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $fullPath -Force
}
function Set-NativeInstallOperationPhase {
    param([string]$Phase)
    $script:NativeInstallOperationPhase=$Phase
    Write-NativeInstallOperationRecord -Status 'in_progress'
}
function Restore-NativeInitialRepairPointer {
    if($null-ne$script:NativeRepairContext){Restore-NativeInitialRepairActivation -Context $script:NativeRepairContext}
    if($null-ne$script:NativeRepairJournalRollback){
        $journal=$script:NativeRepairJournalRollback
        $temporary=$journal.Path+'.rollback-'+[guid]::NewGuid().ToString('N')
        [IO.File]::WriteAllText($temporary,[string]$journal.Content,[Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $journal.Path -Force
        $script:NativeRepairJournalRollback=$null
    }
}

function Register-NativeMariaDbService {
    param(
        [Parameter(Mandatory=$true)][string]$BinaryPath,
        [Parameter(Mandatory=$true)][string]$ScPath
    )
    $arguments = @{
        Name = 'SHospitalMariaDB'
        DisplayName = 'S_Hospital Base de datos'
        PathName = $BinaryPath
        # Win32_Service.Create declares both values as UInt8. Preserve those
        # CIM types explicitly instead of relying on provider coercion from
        # PowerShell's default Int32 literals.
        ServiceType = [byte]16
        ErrorControl = [byte]1
        StartMode = 'Automatic'
        StartName = 'NT AUTHORITY\LocalService'
        # Built-in LocalService has no password. Avoid sending null values for
        # unrelated optional CIM parameters through the provider boundary.
        StartPassword = ''
    }
    $created = Invoke-CimMethod -ClassName Win32_Service -MethodName Create -Arguments $arguments
    if ([int]$created.ReturnValue -ne 0) { throw "MariaDB service registration failed with code $($created.ReturnValue)." }
    & $ScPath config 'SHospitalMariaDB' 'start=' 'delayed-auto' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "MariaDB delayed-start configuration failed with code $LASTEXITCODE." }
    $registered = Get-CimInstance Win32_Service -Filter "Name='SHospitalMariaDB'"
    if (-not $registered -or -not ([string]$registered.PathName).Equals($BinaryPath,[StringComparison]::Ordinal)) {
        throw 'MariaDB service binary path did not match the protected runtime command exactly.'
    }
}
function Set-NativeApplicationServicesLocalService {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)][object[]]$ServiceConfigs)
    $wrong=@($ServiceConfigs|Where-Object{
        $service=Get-CimInstance Win32_Service -Filter ("Name='"+$_.Id+"'") -ErrorAction Stop
        ([string]$service.StartName)-ne'NT AUTHORITY\LocalService'
    })
    if($wrong.Count-gt0){
        $stopOrder=@($wrong)
        [array]::Reverse($stopOrder)
        foreach($serviceConfig in $stopOrder){
            if((Get-Service -Name $serviceConfig.Id -ErrorAction Stop).Status-ne'Stopped'){
                & $serviceConfig.ExecutablePath stop | Out-Null
                if($LASTEXITCODE-ne0){throw "Service '$($serviceConfig.Id)' could not stop for account correction (code $LASTEXITCODE)."}
            }
        }
        $stopDeadline=(Get-Date).AddSeconds(45)
        do{
            $notStopped=@($wrong|Where-Object{(Get-Service -Name $_.Id -ErrorAction Stop).Status-ne'Stopped'})
            if($notStopped.Count-eq0){break}
            Start-Sleep -Milliseconds 500
        }while((Get-Date)-lt$stopDeadline)
        if($notStopped.Count-gt0){throw'Application services did not stop for account correction.'}
        foreach($serviceConfig in $wrong){
            $service=Get-CimInstance Win32_Service -Filter ("Name='"+$serviceConfig.Id+"'") -ErrorAction Stop
            $changed=Invoke-CimMethod -InputObject $service -MethodName Change -Arguments @{StartName='NT AUTHORITY\LocalService';StartPassword=''}
            if([int]$changed.ReturnValue-ne0){throw "Service '$($serviceConfig.Id)' account correction failed with code $($changed.ReturnValue)."}
        }
    }
    foreach($serviceConfig in $ServiceConfigs){
        $service=Get-CimInstance Win32_Service -Filter ("Name='"+$serviceConfig.Id+"'") -ErrorAction Stop
        if(-not([string]$service.StartName).Equals('NT AUTHORITY\LocalService',[StringComparison]::OrdinalIgnoreCase)){
            throw "Service '$($serviceConfig.Id)' is not configured for LocalService."
        }
    }
}
trap {
    $failureRecord=$_
    $failureType=$failureRecord.Exception.GetType().FullName
    $failureMessage=$failureRecord.Exception.Message
    try{Restore-NativeInitialRepairPointer}catch{$failureType+=';rollback_failed'}
    try{Write-NativeInstallOperationRecord -Status 'failed' -FailureType $failureType -FailureMessage $failureMessage}catch{}
    [Console]::Error.WriteLine('S_Hospital native installation failed during phase: '+$script:NativeInstallOperationPhase)
    exit 1
}

$layout=$null
Set-NativeInstallOperationPhase 'payload_validation'
$payload = (Resolve-Path -LiteralPath $PayloadRoot).Path
$validation = Test-NativePayloadManifest -PayloadRoot $payload
if (-not $validation.Ready) {
    throw "Native payload validation failed: $($validation.Reasons -join '; ')"
}
$payloadIdentity = Get-NativePayloadIdentity -PayloadRoot $payload

$layout = Get-NativeInstallLayout -InstallRoot $InstallRoot -DataRoot $DataRoot -Version $validation.Version -ReleaseId $payloadIdentity.ReleaseId
$prerequisiteRestartRequired = $false
$existingInstall = Test-Path -LiteralPath (Join-Path $layout.DatabaseData 'mysql')
$installStatePath = Join-Path $layout.StateRoot 'native-install-state.json'
$installState = if (Test-Path -LiteralPath $installStatePath -PathType Leaf) { Get-Content -LiteralPath $installStatePath -Raw | ConvertFrom-Json } else { $null }
$stateReleaseId = if ($installState -and $installState.PSObject.Properties.Name -contains 'release_id') { [string]$installState.release_id } else { '' }
$resumingInitial = $installState -and $installState.version -eq $validation.Version -and $installState.status -eq 'in_progress' -and $stateReleaseId -eq $layout.ReleaseId
$failedInitialRepair=$false
$failedServicesRepair=$false
$failedInitialCurrentTarget=$null
if($existingInstall-and$installState-and$installState.status-eq'in_progress'-and$stateReleaseId-eq$script:NativeFailedInitialRepairReleaseId-and$validation.Version-eq'2026.09.28.6'){
    $failedInitialCurrentTarget=Get-NativeInitialCurrentTarget -Path $layout.CurrentPath -ReleasesRoot $layout.ReleasesRoot
    $previousIntegrity=Test-NativePayloadManifest -PayloadRoot $failedInitialCurrentTarget -IntegrityOnly
    $previousIdentity=if($previousIntegrity.Ready){Get-NativePayloadIdentity -PayloadRoot $failedInitialCurrentTarget}else{$null}
    $previousMetadata=if($previousIntegrity.Ready){Get-Content -LiteralPath (Join-Path $failedInitialCurrentTarget 'native-release.json') -Raw|ConvertFrom-Json}else{$null}
    $candidateMetadata=Get-Content -LiteralPath (Join-Path $payload 'native-release.json') -Raw|ConvertFrom-Json
    $candidateDatabasePolicy=if($candidateMetadata.PSObject.Properties.Name-contains'database_update_policy'){[string]$candidateMetadata.database_update_policy}else{'no_schema_change'}
    $schemaCompatibility=$false
    if($previousIntegrity.Ready){
        [void](Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot (Join-Path $failedInitialCurrentTarget 'app\backend\database\migrations') -CandidateMigrationsRoot (Join-Path $payload 'app\backend\database\migrations') -Policy $candidateDatabasePolicy)
        $schemaCompatibility=$true
    }
    $persistentConfigurationReady=@(
        (Join-Path $layout.ConfigRoot 'hospital.env'),
        (Join-Path $layout.ConfigRoot 'database-admin.dpapi'),
        (Join-Path $layout.StateRoot 'native-install-state.json')
    )|ForEach-Object{Test-Path -LiteralPath $_ -PathType Leaf}
    $installedRepairServices=@('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')|Where-Object{Get-Service -Name $_ -ErrorAction SilentlyContinue}
    $failedInitialRepair=Test-NativeFailedInitialRepairEligibility -InstallState $installState -PreviousReleaseId $(if($null-ne$previousIdentity){$previousIdentity.ReleaseId}else{''}) -CandidateVersion $validation.Version -PreviousMariaDbVersion $(if($null-ne$previousMetadata){[string]$previousMetadata.runtime_versions.mariadb}else{''}) -CandidateMariaDbVersion ([string]$candidateMetadata.runtime_versions.mariadb) -CandidateDatabasePolicy $candidateDatabasePolicy -PreviousIntegrityReady $previousIntegrity.Ready -SchemaCompatible $schemaCompatibility -PersistentConfigurationReady (@($persistentConfigurationReady|Where-Object{$_-eq$false}).Count-eq0) -DatabaseFilesReady (Test-Path -LiteralPath (Join-Path $layout.DatabaseData 'mysql') -PathType Container) -InstalledServiceCount @($installedRepairServices).Count
    if(-not$failedInitialRepair){throw'Failed initial installation does not satisfy the pinned database-safe repair contract.'}
}
elseif($existingInstall-and$installState-and$installState.status-eq'in_progress'-and$stateReleaseId-eq$script:NativeFailedServicesRepairReleaseId-and$validation.Version-eq'2026.09.28.7'){
    $failedInitialCurrentTarget=Get-NativeInitialCurrentTarget -Path $layout.CurrentPath -ReleasesRoot $layout.ReleasesRoot
    $previousIntegrity=Test-NativePayloadManifest -PayloadRoot $failedInitialCurrentTarget -IntegrityOnly
    $previousIdentity=if($previousIntegrity.Ready){Get-NativePayloadIdentity -PayloadRoot $failedInitialCurrentTarget}else{$null}
    $previousMetadata=if($previousIntegrity.Ready){Get-Content -LiteralPath (Join-Path $failedInitialCurrentTarget 'native-release.json') -Raw|ConvertFrom-Json}else{$null}
    $candidateMetadata=Get-Content -LiteralPath (Join-Path $payload 'native-release.json') -Raw|ConvertFrom-Json
    $candidateDatabasePolicy=if($candidateMetadata.PSObject.Properties.Name-contains'database_update_policy'){[string]$candidateMetadata.database_update_policy}else{'no_schema_change'}
    $schemaCompatibility=$false
    if($previousIntegrity.Ready){
        [void](Test-NativeDatabaseUpdateCompatibility -CurrentMigrationsRoot (Join-Path $failedInitialCurrentTarget 'app\backend\database\migrations') -CandidateMigrationsRoot (Join-Path $payload 'app\backend\database\migrations') -Policy $candidateDatabasePolicy)
        $schemaCompatibility=$true
    }
    $persistentConfigurationReady=@(
        (Join-Path $layout.ConfigRoot 'hospital.env'),
        (Join-Path $layout.ConfigRoot 'database-admin.dpapi'),
        (Join-Path $layout.StateRoot 'native-install-state.json')
    )|ForEach-Object{Test-Path -LiteralPath $_ -PathType Leaf}
    $repairServiceIds=@('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
    $installedRepairServices=@($repairServiceIds|ForEach-Object{Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'") -ErrorAction SilentlyContinue}|Where-Object{$_})
    $applicationRepairServices=@($installedRepairServices|Where-Object Name -ne'SHospitalMariaDB')
    $applicationAccountsRepairable=$applicationRepairServices.Count-eq5-and@($applicationRepairServices|Where-Object{([string]$_.StartName)-notin@('LocalSystem','NT AUTHORITY\LocalService')}).Count-eq0
    $databaseAccountReady=@($installedRepairServices|Where-Object{Name-eq'SHospitalMariaDB'-and[string]$_.StartName-eq'NT AUTHORITY\LocalService'}).Count-eq1
    $failedServicesRepair=Test-NativeFailedServicesRepairEligibility -InstallState $installState -PreviousReleaseId $(if($null-ne$previousIdentity){$previousIdentity.ReleaseId}else{''}) -CandidateVersion $validation.Version -PreviousMariaDbVersion $(if($null-ne$previousMetadata){[string]$previousMetadata.runtime_versions.mariadb}else{''}) -CandidateMariaDbVersion ([string]$candidateMetadata.runtime_versions.mariadb) -CandidateDatabasePolicy $candidateDatabasePolicy -PreviousIntegrityReady $previousIntegrity.Ready -SchemaCompatible $schemaCompatibility -PersistentConfigurationReady (@($persistentConfigurationReady|Where-Object{$_-eq$false}).Count-eq0) -DatabaseFilesReady (Test-Path -LiteralPath (Join-Path $layout.DatabaseData 'mysql') -PathType Container) -InstalledServiceCount $installedRepairServices.Count -ApplicationServiceAccountsRepairable $applicationAccountsRepairable -DatabaseServiceAccountReady $databaseAccountReady
    if(-not$failedServicesRepair){throw'Failed services installation does not satisfy the pinned account-safe repair contract.'}
}
$plan = Get-NativeInstallPlan `
    -Layout $layout `
    -PayloadRoot $payload `
    -AppPort $AppPort `
    -PhpPort $PhpPort `
    -DatabasePort $DatabasePort `
    -ExistingInstall:$existingInstall

if ($WhatIfOnly) {
    if ($Json) { $plan | ConvertTo-Json -Depth 8 }
    else { $plan }
    exit 0
}

if ($existingInstall -and -not $SandboxOnly -and -not $resumingInitial -and -not $failedInitialRepair -and -not $failedServicesRepair) {
    Set-NativeInstallOperationPhase 'delegate_update'
    $updater = Join-Path $payload 'scripts\native\update_native_runtime.ps1'
    if (-not (Test-Path -LiteralPath $updater -PathType Leaf)) { throw 'Existing installation detected but the update workflow is missing from the payload.' }
    & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $updater -PayloadRoot $payload -InstallRoot $InstallRoot -DataRoot $DataRoot -Json:$Json
    $updateExit=$LASTEXITCODE
    if($updateExit-eq0){Write-NativeInstallOperationRecord -Status 'completed'}
    else{Write-NativeInstallOperationRecord -Status 'failed' -FailureType ('update_exit_'+$updateExit)}
    exit $updateExit
}

$nativeMutationLock = Enter-NativeRuntimeMutationLock

if (-not $SandboxOnly) {
    Set-NativeInstallOperationPhase 'prerequisites'
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Native installation must run from an elevated Windows administrator session.'
    }
    $releaseMetadata = Get-Content -LiteralPath (Join-Path $payload 'native-release.json') -Raw | ConvertFrom-Json
    $prerequisiteLog = Join-Path $env:TEMP ('S_Hospital-vcredist-' + [guid]::NewGuid().ToString('N') + '.log')
    $prerequisite = Install-NativeVisualCppRuntime `
        -InstallerPath (Join-Path $payload 'runtime\vcredist\vc_redist.x64.exe') `
        -RequiredVersion ([version]$releaseMetadata.runtime_versions.vcredist) `
        -LogPath $prerequisiteLog
    $prerequisiteRestartRequired = [bool]$prerequisite.RestartRequired
    $runtimeProbe = Get-Content -LiteralPath (Join-Path $payload 'native-runtime-probe.json') -Raw | ConvertFrom-Json
    if ($runtimeProbe.status -ne 'passed' -or @($runtimeProbe.required_extensions) -notcontains 'sodium' -or $runtimeProbe.sodium_argon2id13 -ne $true -or @($runtimeProbe.missing).Count -gt 0) {
        throw 'Native PHP runtime has not passed the required extension probe.'
    }
}

if ($installState -and $installState.status -eq 'in_progress' -and -not $resumingInitial -and -not $failedInitialRepair -and -not $failedServicesRepair -and -not $SandboxOnly) {
    throw "Incomplete installation '$($installState.version)' must be repaired with its original package before applying release '$($layout.ReleaseId)'."
}

$currentPayloadMatches = $false
if ($existingInstall -and (Test-Path -LiteralPath $layout.CurrentPath -PathType Container)) {
    try { $currentPayloadMatches = (Get-NativePayloadIdentity -PayloadRoot $layout.CurrentPath).ContentSha256 -eq $payloadIdentity.ContentSha256 }
    catch { $currentPayloadMatches = $false }
}
if ($existingInstall -and -not $SandboxOnly -and $installState -and $installState.status -eq 'complete' -and $currentPayloadMatches) {
    $scExisting = Join-Path $env:SystemRoot 'System32\sc.exe'
    $existingServices = @('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
    foreach ($serviceId in $existingServices) {
        $service = Get-Service -Name $serviceId -ErrorAction Stop
        if ($service.Status -ne 'Running') { & $scExisting start $serviceId | Out-Null }
    }
    $deadline = (Get-Date).AddSeconds(45)
    do {
        $states = @(Get-Service -Name $existingServices -ErrorAction Stop)
        if (@($states | Where-Object Status -ne 'Running').Count -eq 0) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)
    if (@($states | Where-Object Status -ne 'Running').Count -gt 0) { throw 'Existing native installation could not restore all services.' }
    $existingAppUrl = Get-NativeEnvironmentSetting -Path (Join-Path $layout.ConfigRoot 'hospital.env') -Name 'APP_URL'
    if (-not (Wait-NativeInstallHealth -Url ($existingAppUrl.TrimEnd('/') + '/up') -TimeoutSeconds 45)) { throw 'Existing native installation did not pass its health check.' }
    $existingStartup = Test-Path -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup\S_Hospital.lnk') -PathType Leaf
    if (-not $existingStartup) { throw 'Existing native installation is missing its login launcher shortcut.' }
    $existingResult = [pscustomobject]@{ Ready = $true; Version = $layout.Version; ReleaseId = $layout.ReleaseId; AppUrl = $existingAppUrl; ServicesInstalled = $true; StartupInstalled = $existingStartup; Mode = 'native-single-pc-existing'; PayloadAlreadyCurrent = $true }
    if ($Json) { $existingResult | ConvertTo-Json -Depth 3 } else { $existingResult }
    exit 0
}

New-Item -ItemType Directory -Path $layout.ReleasesRoot -Force | Out-Null
$preDatabaseRepair=$false
$repairCurrentTarget=$null
if($failedInitialRepair){
    $preDatabaseRepair=$true
    $repairCurrentTarget=$failedInitialCurrentTarget
}
elseif($failedServicesRepair){
    $preDatabaseRepair=$true
    $repairCurrentTarget=$failedInitialCurrentTarget
}
elseif (-not $SandboxOnly -and -not $existingInstall -and -not $installState -and (Test-Path -LiteralPath $layout.CurrentPath)) {
    $canonicalInstall=[IO.Path]::GetFullPath((Join-Path $env:ProgramFiles 'S_Hospital')).TrimEnd('\')
    $canonicalData=[IO.Path]::GetFullPath((Join-Path $env:ProgramData 'S_Hospital')).TrimEnd('\')
    if (-not ([IO.Path]::GetFullPath($layout.InstallRoot).TrimEnd('\')).Equals($canonicalInstall,[StringComparison]::OrdinalIgnoreCase) -or
        -not ([IO.Path]::GetFullPath($layout.DataRoot).TrimEnd('\')).Equals($canonicalData,[StringComparison]::OrdinalIgnoreCase)) {
        throw 'Pre-database repair is restricted to the canonical S_Hospital installation roots.'
    }
    $installedServices=@('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')|Where-Object{Get-Service -Name $_ -ErrorAction SilentlyContinue}
    if (@($installedServices).Count -gt 0) { throw 'Pre-database repair refused because S_Hospital services already exist.' }
    if ((Test-Path -LiteralPath $layout.DatabaseData -PathType Container) -and @(Get-ChildItem -LiteralPath $layout.DatabaseData -Force).Count -gt 0) {
        throw 'Pre-database repair refused because the database directory is not empty.'
    }
    $repairCurrentTarget=Get-NativeInitialCurrentTarget -Path $layout.CurrentPath -ReleasesRoot $layout.ReleasesRoot
    # Release 2026.09.28.3 could leave child files with an empty DACL before the
    # first runtime probe. Repair only the canonical application tree, then
    # validate every prior-release byte before using it as the rollback target.
    Set-NativeInstallOperationPhase 'repair_prior_release_acl'
    Set-NativeAclProfile -Path $layout.InstallRoot -Profile ApplicationRoot
    Set-NativeInstallOperationPhase 'validate_prior_release_integrity'
    $repairValidation=Test-NativePayloadManifest -PayloadRoot $repairCurrentTarget -IntegrityOnly
    if (-not $repairValidation.Ready) { throw "Pre-database repair refused because the prior release is not intact: $($repairValidation.Reasons -join '; ')" }
    $preDatabaseRepair=$true
}
Set-NativeInstallOperationPhase 'stage_release'
$releaseExists = Test-Path -LiteralPath $layout.ReleaseRoot -PathType Container
if ($releaseExists) {
    $installedPayload = Test-NativePayloadManifest -PayloadRoot $layout.ReleaseRoot
    $installedIdentity = if ($installedPayload.Ready) { Get-NativePayloadIdentity -PayloadRoot $layout.ReleaseRoot } else { $null }
    if (-not $installedPayload.Ready -or $null -eq $installedIdentity -or $installedIdentity.ContentSha256 -ne $payloadIdentity.ContentSha256) {
        if ($existingInstall -or $installState) { throw 'Installed release is incomplete while persistent installation state exists; automatic replacement is unsafe.' }
        if (Test-Path -LiteralPath $layout.CurrentPath) {
            $invalidCurrentTarget=Get-NativeInitialCurrentTarget -Path $layout.CurrentPath -ReleasesRoot $layout.ReleasesRoot
            if($invalidCurrentTarget.Equals([IO.Path]::GetFullPath($layout.ReleaseRoot).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){
                throw 'Incomplete candidate is current; repair requires an intact rollback release.'
            }
        }
        $releaseToRemove=Assert-NativeInitialReleaseMutationPath -Path $layout.ReleaseRoot -ReleasesRoot $layout.ReleasesRoot
        Remove-Item -LiteralPath $releaseToRemove -Recurse -Force
        $releaseExists = $false
    }
}
if (-not $releaseExists) {
    $candidateRelease = Join-Path $layout.ReleasesRoot ('.candidate-initial-' + $layout.ReleaseId)
    if (Test-Path -LiteralPath $candidateRelease) {
        $candidateToRemove=Assert-NativeInitialReleaseMutationPath -Path $candidateRelease -ReleasesRoot $layout.ReleasesRoot
        Remove-Item -LiteralPath $candidateToRemove -Recurse -Force
    }
    $candidateRelease=Assert-NativeInitialReleaseMutationPath -Path $candidateRelease -ReleasesRoot $layout.ReleasesRoot -AllowMissing
    New-Item -ItemType Directory -Path $candidateRelease -Force | Out-Null
    Get-ChildItem -LiteralPath $payload -Force | Copy-Item -Destination $candidateRelease -Recurse -Force
    $candidateValidation = Test-NativePayloadManifest -PayloadRoot $candidateRelease
    if (-not $candidateValidation.Ready) { throw "Staged initial release is invalid: $($candidateValidation.Reasons -join '; ')" }
    $candidateToMove=Assert-NativeInitialReleaseMutationPath -Path $candidateRelease -ReleasesRoot $layout.ReleasesRoot
    $releaseDestination=Assert-NativeInitialReleaseMutationPath -Path $layout.ReleaseRoot -ReleasesRoot $layout.ReleasesRoot -AllowMissing
    if(Test-Path -LiteralPath $releaseDestination){throw'Release destination unexpectedly exists after candidate validation.'}
    Move-Item -LiteralPath $candidateToMove -Destination $releaseDestination
}

$currentTargetBeforeActivation=if(Test-Path -LiteralPath $layout.CurrentPath){Get-NativeInitialCurrentTarget -Path $layout.CurrentPath -ReleasesRoot $layout.ReleasesRoot}else{$null}
$activationRequired = $preDatabaseRepair -or ($resumingInitial -and $null -ne $currentTargetBeforeActivation -and -not $currentTargetBeforeActivation.Equals([IO.Path]::GetFullPath($layout.ReleaseRoot).TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase))
if ($activationRequired) {
    Set-NativeInstallOperationPhase 'activate_repair_release'
    $script:NativeRepairContext=Start-NativeInitialRepairActivation -CurrentPath $layout.CurrentPath -CandidateRoot $layout.ReleaseRoot -ReleasesRoot $layout.ReleasesRoot
}

if (-not $SandboxOnly) {
    Set-NativeInstallOperationPhase 'prepare_data_root'
    $dataRootAlreadyExisted = Test-Path -LiteralPath $layout.DataRoot -PathType Container
    New-Item -ItemType Directory -Path $layout.DataRoot -Force | Out-Null
    Set-NativeAclProfile -Path $layout.DataRoot -Profile RuntimeData -SelfOnly:$dataRootAlreadyExisted

    # Reapply the administrator-only boundaries before reading any persisted
    # secret. A resumed installation must never broaden child ACLs recursively.
    foreach ($administratorPath in @(
        (Join-Path $layout.ConfigRoot 'administrator-only'),
        (Join-Path $layout.StateRoot 'administrator-only'),
        (Join-Path $layout.ConfigRoot 'database-admin.dpapi')
    )) {
        if (Test-Path -LiteralPath $administratorPath) {
            Set-NativeAclProfile -Path $administratorPath -Profile AdministratorSecret
        }
    }
    $restartMarker = Join-Path $layout.StateRoot 'restart-required-after-install'
    if ($prerequisiteRestartRequired) {
        Set-Content -LiteralPath $restartMarker -Value 'Microsoft Visual C++ runtime requested a restart.' -Encoding UTF8
    }
    elseif (Test-Path -LiteralPath $restartMarker -PathType Leaf) {
        Remove-Item -LiteralPath $restartMarker -Force
    }
}

$envPath = Join-Path $layout.ConfigRoot 'hospital.env'
$configRootAlreadyExisted = Test-Path -LiteralPath $layout.ConfigRoot -PathType Container
if (-not $SandboxOnly) {
    if (-not $configRootAlreadyExisted) { New-Item -ItemType Directory -Path $layout.ConfigRoot | Out-Null }
    Set-NativeRuntimeConfigurationAcl -ConfigRoot $layout.ConfigRoot
}
$secrets = $null
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    Set-NativeInstallOperationPhase 'create_runtime_configuration'
    $secrets = [pscustomobject]@{
        AppKey = 'base64:' + (New-NativeSecret -Base64)
        DatabaseRootPassword = New-NativeSecret
        DatabasePassword = New-NativeSecret
        BackupEncryptionKey = New-NativeSecret -Base64
    }
    New-NativeRuntimeConfiguration -Plan $plan -Secrets $secrets | Out-Null
}

if (-not $SandboxOnly) {
    Set-NativeRuntimeConfigurationAcl -ConfigRoot $layout.ConfigRoot
}

if (-not (Test-Path -LiteralPath $layout.CurrentPath)) {
    New-Item -ItemType Junction -Path $layout.CurrentPath -Target $layout.ReleaseRoot | Out-Null
}

if (-not $SandboxOnly) {
    Set-NativeAclProfile -Path $layout.InstallRoot -Profile ApplicationRoot
    $databaseSecretPath = Join-Path $layout.ConfigRoot 'database-admin.dpapi'
    if (-not $secrets) {
        if($preDatabaseRepair){
            $databaseRootPassword=if(Test-Path -LiteralPath $databaseSecretPath -PathType Leaf){Unprotect-NativeMachineSecret -Path $databaseSecretPath -Purpose 'database-admin'}else{New-NativeSecret}
            $secrets=[pscustomobject]@{
                AppKey=Get-NativeEnvironmentSetting -Path $envPath -Name 'APP_KEY'
                DatabaseRootPassword=$databaseRootPassword
                DatabasePassword=Get-NativeEnvironmentSetting -Path $envPath -Name 'DB_PASSWORD'
                BackupEncryptionKey=Get-NativeEnvironmentSetting -Path $envPath -Name 'HOSPITAL_BACKUP_ENCRYPTION_KEY'
            }
        }
        else{
        if (-not $resumingInitial -or -not (Test-Path -LiteralPath $databaseSecretPath -PathType Leaf)) { throw 'Runtime configuration exists without a resumable installation journal.' }
        $secrets = [pscustomobject]@{
            AppKey = Get-NativeEnvironmentSetting -Path $envPath -Name 'APP_KEY'
            DatabaseRootPassword = Unprotect-NativeMachineSecret -Path $databaseSecretPath -Purpose 'database-admin'
            DatabasePassword = Get-NativeEnvironmentSetting -Path $envPath -Name 'DB_PASSWORD'
            BackupEncryptionKey = Get-NativeEnvironmentSetting -Path $envPath -Name 'HOSPITAL_BACKUP_ENCRYPTION_KEY'
        }
        }
    }
    if (-not (Test-Path -LiteralPath $databaseSecretPath -PathType Leaf)) {
        Protect-NativeMachineSecret -Path $databaseSecretPath -Secret $secrets.DatabaseRootPassword -Purpose 'database-admin'
    }
    if (-not $installState) {
        Set-NativeInstallOperationPhase 'write_prepared_journal'
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'prepared'
        $installState = Get-Content -LiteralPath $installStatePath -Raw | ConvertFrom-Json
    }

    # Persist the only database-administrator recovery secret and the resumable
    # journal before any fallible runtime probe. A failure after hospital.env was
    # created must never leave an unresumable partial installation again.
    Set-NativeInstallOperationPhase 'runtime_dependency_probe'
    $runtimeProbeContext = New-NativeElevatedPhpContext -Layout $layout -ReleaseRoot $layout.CurrentPath
    try {
        Test-NativeBundledRuntimeDependencies -ReleaseRoot $layout.CurrentPath -PhpIniPath $runtimeProbeContext.PhpIniPath | Out-Null
    }
    finally { Remove-NativeElevatedPhpContext -Context $runtimeProbeContext }
    if($null-ne$script:NativeRepairContext-and-not($failedInitialRepair-or$failedServicesRepair)){
        Complete-NativeInitialRepairActivation -Context $script:NativeRepairContext
        $script:NativeRepairContext=$null
    }

    $mariaInstall = Join-Path $layout.CurrentPath 'runtime\mariadb\bin\mariadb-install-db.exe'
    $mariaServer = Join-Path $layout.CurrentPath 'runtime\mariadb\bin\mariadbd.exe'
    $mariaClient = Join-Path $layout.CurrentPath 'runtime\mariadb\bin\mariadb.exe'
    $mariaConfig = Join-Path $layout.ConfigRoot 'my.ini'
    foreach ($binary in @($mariaInstall, $mariaServer, $mariaClient)) {
        if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw "Bundled MariaDB binary is missing: $binary" }
    }
    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'database_files_initialized')) {
        Set-NativeInstallOperationPhase 'initialize_database_files'
        if (Test-Path -LiteralPath (Join-Path $layout.DatabaseData 'mysql')) {
            $databaseFullPath = [IO.Path]::GetFullPath($layout.DatabaseData)
            $dataRootFullPath = [IO.Path]::GetFullPath($layout.DataRoot).TrimEnd('\') + '\'
            if (-not $databaseFullPath.StartsWith($dataRootFullPath, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to reset an uninitialized database outside ProgramData.' }
            Get-ChildItem -LiteralPath $layout.DatabaseData -Force | Remove-Item -Recurse -Force
        }
        & $mariaInstall "--datadir=$($layout.DatabaseData)" "--config=$mariaConfig"
        if ($LASTEXITCODE -ne 0) { throw "MariaDB initialization failed with code $LASTEXITCODE." }
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'database_files_initialized'
        $installState.phase = 'database_files_initialized'
    }

    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'database_secured')) {
    Set-NativeInstallOperationPhase 'secure_database'
    Invoke-NativeMariaDbInitialSecurity -ServerPath $mariaServer -ClientPath $mariaClient -ConfigPath $mariaConfig -ApplicationPassword $secrets.DatabasePassword -RootPassword $secrets.DatabaseRootPassword -CredentialDirectory (Join-Path $layout.ConfigRoot 'administrator-only')|Out-Null
        if($failedInitialRepair-and$null-ne$script:NativeRepairContext){
            $script:NativeRepairJournalRollback=[pscustomobject]@{Path=$installStatePath;Content=Get-Content -LiteralPath $installStatePath -Raw}
            Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'database_secured'
            Complete-NativeInitialRepairActivation -Context $script:NativeRepairContext
            $script:NativeRepairContext=$null
            $script:NativeRepairJournalRollback=$null
        }
        else{Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'database_secured'}
        $installState.phase = 'database_secured'
    }

    $sc = Join-Path $env:SystemRoot 'System32\sc.exe'
    # MariaDB's Windows entry point uses the last command-line argument as the
    # SCM service name. Keep it after all server options so it is not parsed by
    # mariadbd_main and exactly matches the registered service id.
    $databaseBinPath = '"' + $mariaServer + '" --defaults-file="' + $mariaConfig + '" SHospitalMariaDB'
    if (-not (Get-Service -Name 'SHospitalMariaDB' -ErrorAction SilentlyContinue)) {
        Set-NativeInstallOperationPhase 'register_database_service'
        Register-NativeMariaDbService -BinaryPath $databaseBinPath -ScPath $sc
        & $sc description 'SHospitalMariaDB' 'Base de datos local de S_Hospital; acceso sólo por loopback.' | Out-Null
        & $sc failure 'SHospitalMariaDB' 'reset=' '3600' 'actions=' 'restart/5000/restart/15000/restart/60000' | Out-Null
    }
    $registeredDatabase=Get-CimInstance Win32_Service -Filter "Name='SHospitalMariaDB'"
    if(-not$registeredDatabase-or-not([string]$registeredDatabase.PathName).Equals($databaseBinPath,[StringComparison]::Ordinal)){
        throw'MariaDB service is not registered with its explicit SCM service-name argument.'
    }
    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'database_service_registered')) {
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'database_service_registered'
        $installState.phase = 'database_service_registered'
    }
    if ((Get-Service -Name 'SHospitalMariaDB').Status -ne 'Running') {
        & $sc start 'SHospitalMariaDB' | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "MariaDB service failed to start with code $LASTEXITCODE." }
    }

    $administratorState = Join-Path $layout.StateRoot 'administrator-only'
    New-Item -ItemType Directory -Path $administratorState -Force | Out-Null
    Set-NativeAclProfile -Path $administratorState -Profile AdministratorSecret
    $adminDefaults = Join-Path $administratorState ('db-admin-' + [guid]::NewGuid().ToString('N') + '.ini')
    try {
        $databasePortValue = ([uri]('tcp://' + $plan.Network.DatabaseEndpoint)).Port
        $adminDefaultsText = @"
[client]
user=root
password="$($secrets.DatabaseRootPassword)"
host=127.0.0.1
port=$databasePortValue
"@
        [IO.File]::WriteAllText($adminDefaults, $adminDefaultsText, [Text.UTF8Encoding]::new($false))
        $databaseReady = $false
        for ($attempt = 0; $attempt -lt 30 -and -not $databaseReady; $attempt++) {
            & $mariaClient "--defaults-extra-file=$adminDefaults" '--batch' '--skip-column-names' '--execute=SELECT 1' 2>$null | Out-Null
            $databaseReady = ($LASTEXITCODE -eq 0)
            if (-not $databaseReady) { Start-Sleep -Seconds 1 }
        }
        if (-not $databaseReady) { throw 'MariaDB service did not become ready within 30 seconds.' }
    }
    finally {
        if (Test-Path -LiteralPath $adminDefaults) { Remove-Item -LiteralPath $adminDefaults -Force }
    }

    $artisan = Join-Path $layout.CurrentPath 'scripts\native\invoke_native_artisan.ps1'
    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'schema_initialized')) {
        Set-NativeInstallOperationPhase 'initialize_schema'
        foreach ($action in @('migrate','seed-initial','optimize')) {
            & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisan -Action $action -InstallRoot $layout.InstallRoot -DataRoot $layout.DataRoot
            if ($LASTEXITCODE -ne 0) { throw "Native application initialization '$action' failed with code $LASTEXITCODE." }
        }
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'schema_initialized'
        $installState.phase = 'schema_initialized'
    }

    $runtimeConfiguration = New-NativeRuntimeConfiguration -Plan $plan -Secrets $secrets
    Set-NativeInstallOperationPhase 'install_application_services'
    foreach ($serviceConfig in @($runtimeConfiguration.ServiceConfigs)) {
        if (-not (Get-Service -Name $serviceConfig.Id -ErrorAction SilentlyContinue)) {
            & $serviceConfig.ExecutablePath install
            if ($LASTEXITCODE -ne 0) { throw "Service '$($serviceConfig.Id)' installation failed with code $LASTEXITCODE." }
        }
        $registered=Get-CimInstance Win32_Service -Filter ("Name='"+$serviceConfig.Id+"'")
        $registeredPath=if($registered){([string]$registered.PathName).Trim().Trim('"')}else{''}
        if(-not$registeredPath.Equals([IO.Path]::GetFullPath($serviceConfig.ExecutablePath),[StringComparison]::OrdinalIgnoreCase)){
            throw "Service '$($serviceConfig.Id)' is not registered to its persistent wrapper executable."
        }
    }
    Set-NativeInstallOperationPhase 'correct_application_service_accounts'
    Set-NativeApplicationServicesLocalService -ServiceConfigs @($runtimeConfiguration.ServiceConfigs)
    foreach ($serviceConfig in @($runtimeConfiguration.ServiceConfigs)) {
        if ((Get-Service -Name $serviceConfig.Id).Status -ne 'Running') {
            & $serviceConfig.ExecutablePath start
            if ($LASTEXITCODE -ne 0) { throw "Service '$($serviceConfig.Id)' failed to start with code $LASTEXITCODE." }
        }
    }
    $wrapperDeadline=(Get-Date).AddSeconds(45)
    do{
        $wrapperStates=@(Get-Service -Name @($runtimeConfiguration.ServiceConfigs.Id) -ErrorAction Stop)
        if(@($wrapperStates|Where-Object Status -ne 'Running').Count-eq0){break}
        Start-Sleep -Milliseconds 500
    }while((Get-Date)-lt$wrapperDeadline)
    if(@($wrapperStates|Where-Object Status -ne 'Running').Count-gt0){throw'One or more application service wrappers did not reach running state.'}
    foreach($serviceConfig in @($runtimeConfiguration.ServiceConfigs)){
        & $serviceConfig.ExecutablePath status | Out-Null
        if($LASTEXITCODE-ne0){throw "Service '$($serviceConfig.Id)' wrapper status check failed with code $LASTEXITCODE."}
    }
    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'services_installed')) {
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'services_installed'
        $installState.phase = 'services_installed'
    }

    $healthReady = Wait-NativeInstallHealth -Url ($plan.Network.AppUrl + '/up') -TimeoutSeconds 45
    if (-not $healthReady) { throw 'S_Hospital services started but the application health check did not pass.' }
    if($failedServicesRepair-and$null-ne$script:NativeRepairContext){
        $script:NativeRepairJournalRollback=[pscustomobject]@{Path=$installStatePath;Content=Get-Content -LiteralPath $installStatePath -Raw}
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'services_installed'
        Complete-NativeInitialRepairActivation -Context $script:NativeRepairContext
        $script:NativeRepairContext=$null
        $script:NativeRepairJournalRollback=$null
        $installState=Get-Content -LiteralPath $installStatePath -Raw|ConvertFrom-Json
    }

    $initialAdmin = Join-Path $layout.CurrentPath 'scripts\recover_hospital_access.ps1'
    if (-not (Test-NativeInstallPhaseReached -Current ([string]$installState.phase) -Required 'admin_configured')) {
        Set-NativeInstallOperationPhase 'configure_initial_administrator'
        & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisan -Action has-admin -InstallRoot $layout.InstallRoot -DataRoot $layout.DataRoot | Out-Null
        if ($LASTEXITCODE -ne 0) {
            & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $initialAdmin -Initial -InstallRoot $layout.InstallRoot
            if ($LASTEXITCODE -ne 0) { throw "Initial administrator setup was not completed (code $LASTEXITCODE)." }
        }
        Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'admin_configured'
        $installState.phase = 'admin_configured'
    }

    Set-NativeInstallOperationPhase 'verify_initial_backup'
    $backupOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisan -Action backup-manual -InstallRoot $layout.InstallRoot -DataRoot $layout.DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Initial verified backup failed.' }
    $backupResult = (($backupOutput -join "`n") | ConvertFrom-Json)
    if ($backupResult.status -ne 'success' -or [string]::IsNullOrWhiteSpace([string]$backupResult.checksum_sha256) -or [string]::IsNullOrWhiteSpace([string]$backupResult.filename)) {
        throw 'Initial backup did not return success, checksum and filename.'
    }
    $verifyOutput = & $windowsPowerShell -NoProfile -ExecutionPolicy Bypass -File $artisan -Action verify-backup -BackupId $backupResult.backup_log_id -InstallRoot $layout.InstallRoot -DataRoot $layout.DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'Initial encrypted backup could not be fully verified.' }
    $verifyResult = (($verifyOutput -join "`n") | ConvertFrom-Json)
    if ($verifyResult.status -ne 'verified' -or $verifyResult.backup_log_id -ne $backupResult.backup_log_id) { throw 'Initial backup verification did not verify the backup just created.' }
    $serviceStates = @(Get-Service -Name @('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler') -ErrorAction Stop)
    if (@($serviceStates | Where-Object Status -ne 'Running').Count -gt 0) { throw 'One or more native services were registered but are not running.' }
    $startupShortcut = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup\S_Hospital.lnk'
    if (-not (Test-Path -LiteralPath $startupShortcut -PathType Leaf)) { throw 'The login launcher shortcut was not registered by the installer shell.' }
    Write-NativeInstallState -Path $installStatePath -Version $layout.Version -ReleaseId $layout.ReleaseId -Phase 'completed' -Status 'complete'
    $installState.phase = 'completed'
    $installState.status = 'complete'
    $secrets = $null
    if($null-ne$script:NativeRepairContext){Complete-NativeInitialRepairActivation -Context $script:NativeRepairContext;$script:NativeRepairContext=$null}
    Set-NativeInstallOperationPhase 'completed'
    Write-NativeInstallOperationRecord -Status 'completed'
    $result = [pscustomobject]@{
        Ready = $true
        Version = $layout.Version
        ReleaseId = $layout.ReleaseId
        AppUrl = $plan.Network.AppUrl
        ReleaseRoot = $layout.ReleaseRoot
        CurrentPath = $layout.CurrentPath
        DataRoot = $layout.DataRoot
        ServicesInstalled = $true
        StartupInstalled = (Test-Path -LiteralPath $startupShortcut -PathType Leaf)
        InitialAdministrator = 'configured'
        InitialBackup = 'verified-local'
        ExternalBackup = 'not-configured'
        RequiresInstitutionalSetup = $true
        BillingReady = $false
        Mode = 'native-single-pc'
    }
    if ($Json) { $result | ConvertTo-Json -Depth 4 } else { $result }
    exit 0
}

$result = [pscustomobject]@{
    Ready = $true
    Version = $layout.Version
    ReleaseId = $layout.ReleaseId
    AppUrl = $plan.Network.AppUrl
    ReleaseRoot = $layout.ReleaseRoot
    CurrentPath = $layout.CurrentPath
    DataRoot = $layout.DataRoot
    ServicesInstalled = $false
    StartupInstalled = $false
    Mode = 'sandbox'
}
if ($Json) { $result | ConvertTo-Json -Depth 4 }
else { $result }
