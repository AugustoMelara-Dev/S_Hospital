#Requires -Version 5.1

[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ReleaseRoot)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1')
$release=(Resolve-Path -LiteralPath $ReleaseRoot).Path
$ini=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-php-probe-'+[guid]::NewGuid().ToString('N')+'.ini')
try {
    $ext=(Join-Path $release 'runtime\php\ext').Replace('\','/')
    $text='extension_dir="'+$ext+'"'+"`r`n"+((@('curl','fileinfo','gd','intl','mbstring','openssl','pdo_mysql','sodium','zip')|ForEach-Object{"extension=$_"})-join"`r`n")+"`r`n"
    [IO.File]::WriteAllText($ini,$text,[Text.UTF8Encoding]::new($false))
    $result=Test-NativeBundledRuntimeDependencies -ReleaseRoot $release -PhpIniPath $ini
    if(-not$result.Ready-or[version]$result.PhpVersion-lt[version]'8.2.0'){throw'Runtime stdin probe result is invalid.'}
    [pscustomobject]@{ready=$result.Ready;php=$result.PhpVersion;mariadb=$result.MariaDbBinaries;host=$PSVersionTable.PSEdition;powershell=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Compress
}
finally {if(Test-Path -LiteralPath $ini){Remove-Item -LiteralPath $ini -Force}}
