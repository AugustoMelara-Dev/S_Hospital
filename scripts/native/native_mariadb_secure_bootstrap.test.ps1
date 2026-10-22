#Requires -Version 5.1

[CmdletBinding()]
param([string]$ReleaseRoot)

$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if([string]::IsNullOrWhiteSpace($ReleaseRoot)){$ReleaseRoot=Join-Path (Split-Path $PSScriptRoot -Parent) '..\artifacts\native-payload-2026.09.28.5'}
$release=(Resolve-Path -LiteralPath $ReleaseRoot).Path
$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-mariadb-bootstrap-'+[guid]::NewGuid().ToString('N'))
$data=Join-Path $root 'database';$log=Join-Path $root 'mariadb-error.log';$config=Join-Path $root 'my.ini'
$mariaInstall=Join-Path $release 'runtime\mariadb\bin\mariadb-install-db.exe'
$mariaServer=Join-Path $release 'runtime\mariadb\bin\mariadbd.exe'
$appPassword='synthetic-app-password-canary';$rootPassword='synthetic-root-password-canary'
function Redact-BootstrapText([string]$Text){
    $safe=[string]$Text
    foreach($canary in @($appPassword,$rootPassword)){$safe=$safe.Replace($canary,'[redacted]')}
    [regex]::Replace($safe,'(?i)IDENTIFIED\s+BY\s+''[^'']*''',"IDENTIFIED BY '[redacted]'")
}
try{
    New-Item -ItemType Directory -Path $data -Force|Out-Null
    $basedir=(Join-Path $release 'runtime\mariadb').Replace('\','/');$datadir=$data.Replace('\','/');$logPath=$log.Replace('\','/')
    [IO.File]::WriteAllText($config,"[client]`r`nhost=127.0.0.1`r`nport=33307`r`n[mysqld]`r`nbasedir=`"$basedir`"`r`ndatadir=`"$datadir`"`r`nbind-address=127.0.0.1`r`nport=33307`r`nlog-error=`"$logPath`"`r`nskip-name-resolve`r`n",[Text.UTF8Encoding]::new($false))
    $init=@(& $mariaInstall "--datadir=$data" "--config=$config" 2>&1);$initExit=$LASTEXITCODE
    if($initExit-ne0){throw"Synthetic MariaDB initialization failed with code $initExit."}
    $sql=@"
CREATE DATABASE IF NOT EXISTS hospital_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hospital'@'127.0.0.1' IDENTIFIED BY '$appPassword';
ALTER USER 'hospital'@'127.0.0.1' IDENTIFIED BY '$appPassword';
GRANT ALL PRIVILEGES ON hospital_billing.* TO 'hospital'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$rootPassword';
ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '$rootPassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';
FLUSH PRIVILEGES;
"@
    $info=[Diagnostics.ProcessStartInfo]::new();$info.FileName=$mariaServer;$info.Arguments='--defaults-file="'+$config+'" --bootstrap';$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $process=[Diagnostics.Process]::new();$process.StartInfo=$info
    try{
        if(-not$process.Start()){throw 'Synthetic MariaDB bootstrap could not start.'}
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync();$process.StandardInput.Write($sql);$process.StandardInput.Close()
        if(-not$process.WaitForExit(60000)){$process.Kill();throw 'Synthetic MariaDB secure bootstrap timed out.'};$process.WaitForExit();[void]$stdout.Wait(5000);[void]$stderr.Wait(5000)
        $exit=$process.ExitCode;$safeError=Redact-BootstrapText $stderr.Result;$safeLog=if(Test-Path $log){Redact-BootstrapText (Get-Content $log -Raw)}else{''}
        if($safeError.Contains($appPassword)-or$safeError.Contains($rootPassword)-or$safeLog.Contains($appPassword)-or$safeLog.Contains($rootPassword)){throw 'Bootstrap diagnostic redaction exposed a synthetic canary.'}
        $result=[ordered]@{unsupported_bootstrap_rejected=($exit-ne0);exit_code=$exit;init_exit_code=$initExit;stderr_summary=($safeError.Trim()|Select-Object -First 1);error_log_tail=@(($safeLog-split"`r?`n")|Where-Object{$_}|Select-Object -Last 12)}
        $result|ConvertTo-Json -Depth 6
        # MariaDB 11.4 intentionally rejects account DDL in --bootstrap mode.
        # The supported product path uses isolated named-pipe SQL instead.
        $bootstrapSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\native_database_bootstrap.ps1') -Raw
        if ($exit -eq 0 -or $safeLog -notmatch 'ERROR: 1290') { throw 'Expected MariaDB bootstrap account-DDL rejection was not observed.' }
        if ($bootstrapSource -match '--bootstrap' -or $bootstrapSource -notmatch '--named-pipe' -or $bootstrapSource -notmatch '--skip-networking') { throw 'Product must use the isolated named-pipe security path.' }
        Write-Host '[ OK ] Unsupported bootstrap DDL is rejected; product uses isolated named-pipe security.'
    }finally{$process.Dispose();$sql=$null}
}
finally{
    if(Test-Path $root){$full=[IO.Path]::GetFullPath($root);$prefix=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\';if(-not$full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-mariadb-bootstrap-[0-9a-f]{32}$'){throw 'Refusing unsafe bootstrap fixture cleanup.'};[IO.Directory]::Delete($full,$true)}
}
