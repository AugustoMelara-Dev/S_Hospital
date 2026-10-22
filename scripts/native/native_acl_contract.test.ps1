#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$text = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\native_acl.ps1') -Raw
foreach ($sid in @('S-1-5-18','S-1-5-32-544','S-1-5-19','S-1-5-32-545')) {
    if ($text -notmatch [regex]::Escape($sid)) { throw "ACL contract is missing SID $sid." }
}
if ($text -notmatch "AdministratorSecret[\s\S]+S-1-5-18[\s\S]+S-1-5-32-544") { throw 'Administrator secret ACL is incomplete.' }
if ($text -match "AdministratorSecret[\s\S]{0,300}S-1-5-19") { throw 'Administrator secret must not grant LocalService.' }
if ($text -notmatch "RuntimeConfig[\s\S]+S-1-5-19:\$\{inheritance\}RX") { throw 'Runtime config must be read-only for LocalService.' }
if ($text -notmatch '/setowner') { throw 'ACL hardening must replace an untrusted legacy owner.' }
if ($text -notmatch 'GetOwner') { throw 'ACL hardening must verify the resulting owner.' }
if ($text -notmatch 'Join-Path \$Path ''\*''[\s\S]+/reset[\s\S]+/T') { throw 'Recursive ACL propagation must reset descendants so files receive effective inherited ACEs.' }

$probeRoot=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-acl-contract-'+[guid]::NewGuid().ToString('N'))
try{
    $probeChild=Join-Path $probeRoot 'child';$probeFile=Join-Path $probeChild 'runtime.exe'
    New-Item -ItemType Directory -Path $probeChild -Force|Out-Null
    Set-Content -LiteralPath $probeFile -Value 'probe'
    . (Join-Path $PSScriptRoot 'lib\native_acl.ps1')
    try{Set-NativeAclProfile -Path $probeRoot -Profile ApplicationRoot}catch{
        # A filtered non-elevated token cannot assign Administrators as owner;
        # ACL propagation happens first and remains directly testable.
        if($_.Exception.Message -notmatch 'trusted owner|not SYSTEM or Administrators'){throw}
    }
    if((Get-Content -LiteralPath $probeFile -Raw).Trim()-ne'probe'){throw'ApplicationRoot left a child file unreadable.'}
    $fileAcl=Get-Acl -LiteralPath $probeFile
    $usersAce=@($fileAcl.Access|Where-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value-eq'S-1-5-32-545' -and ($_.FileSystemRights-band[Security.AccessControl.FileSystemRights]::ReadAndExecute)})
    if($usersAce.Count-eq0){throw'ApplicationRoot child file did not inherit Users read/execute.'}
}
finally{
    if(Test-Path -LiteralPath $probeRoot){
        $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\';$full=[IO.Path]::GetFullPath($probeRoot)
        if(-not$full.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-acl-contract-[0-9a-f]{32}$'){throw'Refusing unsafe ACL test cleanup path.'}
        $currentSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        & (Join-Path $env:SystemRoot 'System32\icacls.exe') $full '/grant:r' ("*$currentSid`:(OI)(CI)F") '/T' '/Q'|Out-Null
        Remove-Item -LiteralPath $full -Recurse -Force
    }
}
Write-Host '[ OK ] Native ACL contract passed.'
