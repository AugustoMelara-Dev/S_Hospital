#Requires -Version 5.1

[CmdletBinding()]
param([string]$ReleaseRoot)

$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_database_bootstrap.ps1')
if([string]::IsNullOrWhiteSpace($ReleaseRoot)){$ReleaseRoot=Join-Path (Split-Path $PSScriptRoot -Parent) '..\artifacts\native-payload-2026.09.28.5'}
$release=(Resolve-Path -LiteralPath $ReleaseRoot).Path
$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-mariadb-pipe-'+[guid]::NewGuid().ToString('N'))
$data=Join-Path $root 'database';$log=Join-Path $root 'mariadb-error.log';$config=Join-Path $root 'my.ini'
$install=Join-Path $release 'runtime\mariadb\bin\mariadb-install-db.exe';$server=Join-Path $release 'runtime\mariadb\bin\mariadbd.exe';$client=Join-Path $release 'runtime\mariadb\bin\mariadb.exe'
try{
    New-Item -ItemType Directory -Path $data -Force|Out-Null
    $basedir=(Join-Path $release 'runtime\mariadb').Replace('\','/');$datadir=$data.Replace('\','/');$logPath=$log.Replace('\','/')
    [IO.File]::WriteAllText($config,"[client]`r`nhost=127.0.0.1`r`nport=33307`r`n[mysqld]`r`nbasedir=`"$basedir`"`r`ndatadir=`"$datadir`"`r`nbind-address=127.0.0.1`r`nport=33307`r`nlog-error=`"$logPath`"`r`nskip-name-resolve`r`n",[Text.UTF8Encoding]::new($false))
    $init=@(& $install "--datadir=$data" "--config=$config" 2>&1);if($LASTEXITCODE-ne0){throw'Synthetic MariaDB initialization failed.'}
    $credentialDirectory=Join-Path $root 'administrator-only';New-Item -ItemType Directory -Path $credentialDirectory|Out-Null
    $appPassword='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';$rootPassword='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    $result=Invoke-NativeMariaDbInitialSecurity -ServerPath $server -ClientPath $client -ConfigPath $config -ApplicationPassword $appPassword -RootPassword $rootPassword -CredentialDirectory $credentialDirectory
    if(-not$result.Ready-or$result.Transport-ne'named-pipe'-or-not$result.TcpDisabled-or$result.InitialAuthentication-ne'unsecured'-or$result.ServerExitCode-ne0-or$result.ClientExitCode-ne0){throw'First isolated MariaDB security result is invalid.'}
    $second=Invoke-NativeMariaDbInitialSecurity -ServerPath $server -ClientPath $client -ConfigPath $config -ApplicationPassword $appPassword -RootPassword $rootPassword -CredentialDirectory $credentialDirectory
    if(-not$second.Ready-or$second.InitialAuthentication-ne'secured'-or$second.ServerExitCode-ne0-or$second.ClientExitCode-ne0){throw'Idempotent isolated MariaDB security retry did not authenticate with the protected credential file.'}
    if(@(Get-ChildItem -LiteralPath $credentialDirectory -File -Filter 'mariadb-bootstrap-*.ini').Count-ne0){throw'Bootstrap credential file was not removed.'}
    $source=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\native_database_bootstrap.ps1') -Raw
    if($source-notmatch'--skip-networking'-or$source-notmatch'--named-pipe'-or$source-notmatch'RedirectStandardInput\s*=\s*\$true'){throw'Isolated MariaDB security transport contract is incomplete.'}
    if($source-match'--password'){throw'Database secrets must not travel through the client command line.'}
    [pscustomobject]@{passed=$true;transport=$result.Transport;tcp_disabled=$result.TcpDisabled;first_authentication=$result.InitialAuthentication;retry_authentication=$second.InitialAuthentication;server_exit_code=$second.ServerExitCode;client_exit_code=$second.ClientExitCode;credential_file_removed=$true}|ConvertTo-Json
}
finally{
    if(Test-Path $root){$full=[IO.Path]::GetFullPath($root);$prefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\';if(-not$full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-mariadb-pipe-[0-9a-f]{32}$'){throw'Refusing unsafe pipe fixture cleanup.'};[IO.Directory]::Delete($full,$true)}
}
