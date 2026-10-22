#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $OutputPath,
    [string] $InstallRoot = "$env:ProgramFiles\S_Hospital",
    [string] $DataRoot = "$env:ProgramData\S_Hospital"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1')

trap {
    try {
        $failure=[ordered]@{
            schema='s-hospital-native-partial-diagnosis/v1'
            generated_at_utc=[DateTime]::UtcNow.ToString('o')
            elevated=$false
            read_only=$true
            ok=$false
            error=[ordered]@{
                type=$_.Exception.GetType().FullName
                message=[string]$_.Exception.Message
                line=[int]$_.InvocationInfo.ScriptLineNumber
                script=[IO.Path]::GetFileName([string]$_.InvocationInfo.ScriptName)
            }
            exclusions=@('No secret or database content was written to this diagnostic failure record.')
        }
        $outputFull=[IO.Path]::GetFullPath($OutputPath);$parent=Split-Path -Parent $outputFull
        if(-not(Test-Path -LiteralPath $parent -PathType Container)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
        $failure|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $outputFull -Encoding UTF8
    } catch {}
    exit 2
}

function Get-SafeFileMetadata {
    param([string] $Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return [pscustomobject]@{ path=$Path; exists=$false } }
    $item = Get-Item -LiteralPath $Path -Force
    [pscustomobject]@{ path=$item.FullName; exists=$true; bytes=[int64]$item.Length; sha256=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); modified_utc=$item.LastWriteTimeUtc.ToString('o') }
}

function Get-SafeDirectoryMetadata {
    param([string] $Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return [pscustomobject]@{ path=$Path; exists=$false } }
    $item = Get-Item -LiteralPath $Path -Force
    $acl = Get-Acl -LiteralPath $Path
    [pscustomobject]@{
        path=$item.FullName
        exists=$true
        reparse_point=(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
        owner_sid=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
        entries=@($acl.Access | ForEach-Object {
            $sid = try { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { [string]$_.IdentityReference }
            [pscustomobject]@{ sid=$sid; rights=[string]$_.FileSystemRights; type=[string]$_.AccessControlType; inherited=[bool]$_.IsInherited }
        })
        children=@(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop | Select-Object Name,PSIsContainer,Length,LastWriteTimeUtc)
    }
}

function Get-SafeAclMetadata {
    param([string] $Path)
    if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{ path=$Path; exists=$false } }
    $item = Get-Item -LiteralPath $Path -Force
    $acl = Get-Acl -LiteralPath $Path
    [pscustomobject]@{
        path=$item.FullName
        exists=$true
        directory=[bool]$item.PSIsContainer
        owner_sid=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
        entries=@($acl.Access | ForEach-Object {
            $sid = try { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { [string]$_.IdentityReference }
            [pscustomobject]@{ sid=$sid; rights=[string]$_.FileSystemRights; type=[string]$_.AccessControlType; inherited=[bool]$_.IsInherited; inheritance_flags=[string]$_.InheritanceFlags; propagation_flags=[string]$_.PropagationFlags }
        })
    }
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Partial-install diagnosis must be launched elevated.' }

$installFull = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
$dataFull = [IO.Path]::GetFullPath($DataRoot).TrimEnd('\')
$canonicalInstall = [IO.Path]::GetFullPath((Join-Path $env:ProgramFiles 'S_Hospital')).TrimEnd('\')
$canonicalData = [IO.Path]::GetFullPath((Join-Path $env:ProgramData 'S_Hospital')).TrimEnd('\')
if (-not $installFull.Equals($canonicalInstall,[StringComparison]::OrdinalIgnoreCase) -or -not $dataFull.Equals($canonicalData,[StringComparison]::OrdinalIgnoreCase)) { throw 'Diagnosis only accepts canonical S_Hospital roots.' }

$checks = New-Object Collections.Generic.List[object]
function Observe {
    param([string]$Name,[scriptblock]$Action)
    try { $value=&$Action; $checks.Add([pscustomobject]@{name=$Name;ok=$true;value=$value;error='' }); return $value }
    catch { $checks.Add([pscustomobject]@{name=$Name;ok=$false;value=$null;error=$_.Exception.Message}); return $null }
}

$currentTarget = Observe 'current_target' {
    $item=Get-Item -LiteralPath (Join-Path $installFull 'current') -Force
    if(($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0-or-not$item.Target){throw'current is not a junction'}
    $target=[string]@($item.Target)[0]
    if(-not[IO.Path]::IsPathRooted($target)){$target=Join-Path $item.Parent.FullName $target}
    $target=[IO.Path]::GetFullPath($target).TrimEnd('\')
    $releasePrefix=[IO.Path]::GetFullPath((Join-Path $installFull 'releases')).TrimEnd('\')+'\'
    if(-not$target.StartsWith($releasePrefix,[StringComparison]::OrdinalIgnoreCase)){throw'current target escapes releases'}
    $target
}

$state = Observe 'install_state' {
    $path=Join-Path $dataFull 'state\native-install-state.json'
    $raw=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
    [pscustomobject]@{path=$path;schema_version=$raw.schema_version;version=[string]$raw.version;release_id=[string]$raw.release_id;phase=[string]$raw.phase;status=[string]$raw.status;updated_at_utc=[string]$raw.updated_at_utc}
}

$release = if($currentTarget){ Observe 'release_metadata' {
    $metadata=Get-Content -LiteralPath (Join-Path $currentTarget 'native-release.json') -Raw|ConvertFrom-Json
    $manifest=Get-SafeFileMetadata (Join-Path $currentTarget 'native-payload.manifest.json')
    [pscustomobject]@{version=[string]$metadata.version;database_update_policy=[string]$metadata.database_update_policy;manifest=$manifest}
} } else {$null}

$applicationAcls = @()
$aclPaths = @(
    $installFull,
    (Join-Path $installFull 'releases'),
    (Join-Path $installFull 'current')
)
if ($currentTarget) {
    $aclPaths += @(
        $currentTarget,
        (Join-Path $currentTarget 'native-release.json'),
        (Join-Path $currentTarget 'native-payload.manifest.json'),
        (Join-Path $currentTarget 'runtime\php\php.exe')
    )
}
foreach ($aclPath in $aclPaths) {
    $applicationAcls += Observe ('acl_' + ([IO.Path]::GetFileName($aclPath) -replace '[^A-Za-z0-9_.-]','_')) { Get-SafeAclMetadata $aclPath }
}

$phpProbe = if($currentTarget){ Observe 'php_no_configuration_probe' {
    $php=Join-Path $currentTarget 'runtime\php\php.exe'
    $ini=Join-Path $currentTarget 'runtime\php\php.ini-development'
    $probe=Invoke-NativePhpCodeFromStandardInput -PhpPath $php -PhpIniPath $ini -Code '<?php echo json_encode(["php"=>PHP_VERSION,"sapi"=>PHP_SAPI]);'
    if($probe.ExitCode-ne0){throw"Bundled PHP isolated probe failed with code $($probe.ExitCode)"}
    ([string]$probe.Output)|ConvertFrom-Json
} } else {$null}

$services = Observe 'services' {
    @('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')|ForEach-Object{
        $service=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'")
        if($service){[pscustomobject]@{name=$_.ToString();exists=$true;state=[string]$service.State;start_mode=[string]$service.StartMode;start_name=[string]$service.StartName;path_name=[string]$service.PathName}}
        else{[pscustomobject]@{name=$_.ToString();exists=$false}}
    }
}

$ports = Observe 'listeners' {
    @(3307,9070,8000)|ForEach-Object{[pscustomobject]@{port=$_;listeners=@(Get-NetTCPConnection -State Listen -LocalPort $_ -ErrorAction SilentlyContinue|Select-Object LocalAddress,LocalPort)}}
}

$directories = @()
foreach($relative in @('','config','state','database','services','logs')){
    $path=if($relative-eq''){ $dataFull }else{Join-Path $dataFull $relative}
    $directories += Observe ("directory_"+$(if($relative){$relative}else{'data_root'})) { Get-SafeDirectoryMetadata $path }
}
$safeFiles=@()
foreach($relative in @('config\hospital.env','config\php.ini','config\my.ini','config\Caddyfile','config\database-admin.dpapi','state\native-install-state.json')){
    $safeFiles+=Get-SafeFileMetadata (Join-Path $dataFull $relative)
}

$result=[ordered]@{
    schema='s-hospital-native-partial-diagnosis/v1'
    generated_at_utc=[DateTime]::UtcNow.ToString('o')
    elevated=$true
    read_only=$true
    current_target=$currentTarget
    release=$release
    install_state=$state
    php_probe=$phpProbe
    services=$services
    listeners=$ports
    directories=$directories
    application_acls=$applicationAcls
    safe_file_metadata=$safeFiles
    checks=$checks.ToArray()
    exclusions=@('No hospital.env, php.ini, my.ini, Caddyfile or DPAPI contents were read.','No database rows, credentials, user identities or backup contents were read.','No service, ACL, file or process was changed.')
}
$outputFull=[IO.Path]::GetFullPath($OutputPath)
$parent=Split-Path -Parent $outputFull
if(-not(Test-Path -LiteralPath $parent -PathType Container)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
$result|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $outputFull -Encoding UTF8
$result|ConvertTo-Json -Depth 12
exit 0
