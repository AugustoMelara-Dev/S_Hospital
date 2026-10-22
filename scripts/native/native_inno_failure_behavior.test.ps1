#Requires -Version 5.1
[CmdletBinding()]
param([string]$IsccPath='')
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$project=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if([string]::IsNullOrWhiteSpace($IsccPath)){$IsccPath=Join-Path $project 'artifacts\tool-cache\inno-6.5.4-portable\ISCC.exe'}
$source=Join-Path $project 'installer\native\tests\failure_exit_probe.iss'
$output=Join-Path $project 'installer\native\tests\output\S_Hospital-Inno-Failure-Probe.exe'
$marker=Join-Path $env:TEMP 's-hospital-inno-launch-marker.txt'
if(-not(Test-Path -LiteralPath $IsccPath -PathType Leaf)){throw 'Portable ISCC is missing.'}
if(Test-Path -LiteralPath $marker){Remove-Item -LiteralPath $marker -Force}
& $IsccPath $source|Out-Host
if($LASTEXITCODE-ne0-or-not(Test-Path -LiteralPath $output -PathType Leaf)){throw 'Failure probe installer did not compile.'}
$process=Start-Process -FilePath $output -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-') -Wait -PassThru
if($process.ExitCode-eq0){throw 'Bootstrap failure returned a successful Setup exit code.'}
if(Test-Path -LiteralPath $marker){throw 'Post-install launcher ran after bootstrap failure.'}
[pscustomobject]@{ok=$true;setup_exit_code=$process.ExitCode;launcher_ran=$false;silent_failure_returned=$true}|ConvertTo-Json
