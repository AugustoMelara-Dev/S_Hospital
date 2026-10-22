#Requires -Version 5.1

$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_prerequisites.ps1')
$installer=Join-Path $PSScriptRoot 'install_native_runtime.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($installer,[ref]$tokens,[ref]$errors)
if($errors.Count-gt0){throw"Installer parser failed: $($errors[0].Message)"}
$writer=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-eq'Write-NativeInstallOperationRecord'},$true))
if($writer.Count-ne1){throw'Expected one install operation writer.'}
Invoke-Expression $writer[0].Extent.Text

$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-operation-log-'+[guid]::NewGuid().ToString('N'))
$previousLocalAppData=$env:LOCALAPPDATA
try{
    $env:LOCALAPPDATA=$root
    $logRoot=Join-Path $root 'S_Hospital\logs';New-Item -ItemType Directory -Path $logRoot -Force|Out-Null
    $OperationalLogPath=Join-Path $logRoot 'native-install.json'
    $layout=$null;$script:NativeInstallOperationPhase='secure_database'
    $canary='secret-canary-must-not-appear'
    Write-NativeInstallOperationRecord -Status 'in_progress' -FailureType 'RuntimeException' -FailureMessage ('password='+$canary)
    $progress=Get-Content -LiteralPath $OperationalLogPath -Raw|ConvertFrom-Json
    if($progress.status-ne'in_progress'-or$progress.failure_type-ne''-or$progress.failure_message-ne''){throw'In-progress operation record contains false failure data.'}
    Write-NativeInstallOperationRecord -Status 'failed' -FailureType 'RuntimeException' -FailureMessage ('password='+$canary)
    $failure=Get-Content -LiteralPath $OperationalLogPath -Raw|ConvertFrom-Json
    if($failure.status-ne'failed'-or$failure.failure_type-ne'RuntimeException'-or[string]::IsNullOrWhiteSpace([string]$failure.failure_message)-or([string]$failure.failure_message).Contains($canary)){throw'Failed operation record was not safely diagnosed.'}
    Write-Output 'PASS install operation progress/failure record contract.'
}
finally{
    $env:LOCALAPPDATA=$previousLocalAppData
    if(Test-Path -LiteralPath $root){$full=[IO.Path]::GetFullPath($root);if([IO.Path]::GetFileName($full)-notmatch'^s-hospital-operation-log-[0-9a-f]{32}$'){throw'Refusing unsafe operation-log fixture cleanup.'};[IO.Directory]::Delete($full,$true)}
}
