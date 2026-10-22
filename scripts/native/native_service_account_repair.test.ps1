#Requires -Version 5.1

$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
$sourcePath=Join-Path $PSScriptRoot 'install_native_runtime.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($sourcePath,[ref]$tokens,[ref]$errors)
if($errors.Count-gt0){throw"Installer parser failed: $($errors[0].Message)"}
$function=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-eq'Set-NativeApplicationServicesLocalService'},$true))
if($function.Count-ne1){throw'Expected one service-account repair function.'}
Invoke-Expression $function[0].Extent.Text

$script:accounts=@{};$script:states=@{};$script:changeReturnValue=0
function Get-CimInstance {
    param([string]$ClassName,[string]$Filter,$ErrorAction)
    if($ClassName-ne'Win32_Service'-or$Filter-notmatch"^Name='([^']+)'$"){throw'Unexpected synthetic CIM query.'}
    $id=$Matches[1]
    [pscustomobject]@{Name=$id;StartName=$script:accounts[$id]}
}
function Get-Service {
    param([string]$Name,$ErrorAction)
    [pscustomobject]@{Name=$Name;Status=$script:states[$Name]}
}
function Invoke-CimMethod {
    param($InputObject,[string]$MethodName,[hashtable]$Arguments)
    if($MethodName-ne'Change'-or$Arguments.StartName-ne'NT AUTHORITY\LocalService'-or$Arguments.StartPassword-ne''){throw'Unexpected synthetic service-account mutation.'}
    if($script:changeReturnValue-eq0){$script:accounts[$InputObject.Name]=$Arguments.StartName}
    [pscustomobject]@{ReturnValue=$script:changeReturnValue}
}

$ids=@('SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
$configs=@($ids|ForEach-Object{[pscustomobject]@{Id=$_;ExecutablePath='unused-in-stopped-fixture.exe'}})
foreach($id in $ids){$script:accounts[$id]='LocalSystem';$script:states[$id]='Stopped'}
Set-NativeApplicationServicesLocalService -ServiceConfigs $configs
if(@($ids|Where-Object{$script:accounts[$_]-ne'NT AUTHORITY\LocalService'}).Count-ne0){throw'Account repair did not migrate every application service.'}

$script:accounts[$ids[0]]='LocalSystem';$script:changeReturnValue=5;$failed=$false
try{Set-NativeApplicationServicesLocalService -ServiceConfigs $configs}catch{$failed=$true}
if(-not$failed){throw'Service-account repair accepted a CIM provider failure.'}
Write-Output 'PASS application service account repair contract and error path.'
