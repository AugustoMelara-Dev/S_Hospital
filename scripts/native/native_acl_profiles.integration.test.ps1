#Requires -Version 5.1
param([string]$OutputPath='')
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_acl.ps1')
$identity=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=New-Object Security.Principal.WindowsPrincipal($identity)
if(-not$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'This ACL integration test requires an elevated disposable test directory.'}
function Get-SidAce([string]$Path,[string]$Sid){@((Get-Acl -LiteralPath $Path).Access|Where-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value-eq$Sid})}
function Has-Rights($Aces,[Security.AccessControl.FileSystemRights]$Rights){@($Aces|Where-Object{($_.FileSystemRights-band$Rights)-eq$Rights}).Count-gt0}
$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-acl-profiles-'+[guid]::NewGuid().ToString('N'))
try{
 foreach($case in @(
   @{Name='application';Profile='ApplicationRoot';Service='Read';Users='Read'},
   @{Name='data';Profile='RuntimeData';Service='Modify';Users='None'},
   @{Name='config';Profile='RuntimeConfig';Service='Read';Users='None'},
   @{Name='secret';Profile='AdministratorSecret';Service='None';Users='None'}
 )){
   $dir=Join-Path $root $case.Name;$child=Join-Path $dir 'nested';$file=Join-Path $child 'value.bin'
   New-Item -ItemType Directory -Path $child -Force|Out-Null;Set-Content -LiteralPath $file -Value probe
   Set-NativeAclProfile -Path $dir -Profile $case.Profile
   $service=@(Get-SidAce $file 'S-1-5-19');$users=@(Get-SidAce $file 'S-1-5-32-545')
   $system=@(Get-SidAce $file 'S-1-5-18');$administrators=@(Get-SidAce $file 'S-1-5-32-544')
   if(-not(Has-Rights $system ([Security.AccessControl.FileSystemRights]::FullControl))-or-not(Has-Rights $administrators ([Security.AccessControl.FileSystemRights]::FullControl))){throw "$($case.Profile) child file omitted SYSTEM/Administrators full control."}
   if($case.Service-eq'None' -and $service.Count-ne0){throw "$($case.Profile) exposed a child file to LocalService."}
   if($case.Service-eq'Read' -and -not(Has-Rights $service ([Security.AccessControl.FileSystemRights]::ReadAndExecute))){throw "$($case.Profile) omitted LocalService read/execute."}
   if($case.Service-eq'Modify' -and -not(Has-Rights $service ([Security.AccessControl.FileSystemRights]::Modify))){throw 'RuntimeData omitted LocalService modify.'}
   $dangerous=[Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
   if($case.Service-eq'Read' -and @($service|Where-Object{($_.FileSystemRights-band$dangerous)-ne0}).Count-ne0){throw "$($case.Profile) granted write/control rights to LocalService."}
   if($case.Users-eq'None' -and $users.Count-ne0){throw "$($case.Profile) exposed a child file to Users."}
   if($case.Users-eq'Read' -and -not(Has-Rights $users ([Security.AccessControl.FileSystemRights]::ReadAndExecute))){throw 'ApplicationRoot omitted Users read/execute.'}
   if($case.Users-eq'Read' -and @($users|Where-Object{($_.FileSystemRights-band$dangerous)-ne0}).Count-ne0){throw 'ApplicationRoot granted write/control rights to Users.'}
 }
 $result=[pscustomobject]@{ok=$true;profiles=@('ApplicationRoot','RuntimeData','RuntimeConfig','AdministratorSecret');recursive_child_files_verified=$true;host_mutations='temporary ACL fixture only; removed'}
 if(-not[string]::IsNullOrWhiteSpace($OutputPath)){
  $outputFull=[IO.Path]::GetFullPath($OutputPath);$parent=Split-Path -Parent $outputFull
  if(-not(Test-Path -LiteralPath $parent -PathType Container)){New-Item -ItemType Directory -Path $parent -Force|Out-Null}
  $result|ConvertTo-Json|Set-Content -LiteralPath $outputFull -Encoding UTF8
 }
 $result|ConvertTo-Json
}
finally{
 if(Test-Path -LiteralPath $root){
  $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\';$full=[IO.Path]::GetFullPath($root)
  if(-not$full.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-acl-profiles-[0-9a-f]{32}$'){throw 'Refusing unsafe ACL integration cleanup path.'}
  Remove-Item -LiteralPath $full -Recurse -Force
 }
}
