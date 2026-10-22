#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'recover_hospital_access.ps1'
$source = Get-Content -Raw -LiteralPath $scriptPath
$tokens = $null
$errors = $null
$null = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count -gt 0) {
    throw "El wrapper de acceso no es compatible con Windows PowerShell 5.1: $($errors[0].Message)"
}

if ($source.Contains('IsPathFullyQualified')) {
    throw 'El wrapper usa una API que no existe en Windows PowerShell 5.1.'
}
if ($source.Contains("-FilePath 'powershell.exe'") -or $source.Contains("Get-Command 'php.exe'")) {
    throw 'El wrapper intenta resolver un ejecutable elevado desde PATH.'
}
if ($source -match '\$writeMask\s*=\s*\[Security\.AccessControl\.FileSystemRights\]::Write[\s\S]{0,300}::Modify' -or
    $source -match '\$writeMask\s*=\s*\[Security\.AccessControl\.FileSystemRights\]::Write[\s\S]{0,300}::FullControl') {
    throw 'El guard ACL usa permisos compuestos que confunden lectura con escritura.'
}
foreach ($requiredFragment in @(
    'SpecialFolder]::System',
    'SpecialFolder]::ProgramFiles',
    'SpecialFolder]::CommonApplicationData',
    'runtime\php\php.exe',
    'hospital.env',
    'ConvertFrom-NativeDotEnvValue',
    'administrator-only',
    'access-recovery-cache',
    'php-scan-disabled',
    "EnvironmentVariables['PHPRC']",
    "EnvironmentVariables['PHP_INI_SCAN_DIR']",
    'APP_CONFIG_CACHE',
    'VIEW_COMPILED_PATH'
)) {
    if (-not $source.Contains($requiredFragment)) {
        throw "Falta el contrato de ruta segura: $requiredFragment"
    }
}

$validPath = 'C:\Program Files\S_Hospital'
$isDriveRooted = [IO.Path]::IsPathRooted($validPath) -and $validPath -match '^[A-Za-z]:\\'
if (-not $isDriveRooted) {
    throw 'El guard de ruta absoluta no reconoce la ruta canónica.'
}

$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
$aclFunctions = @($ast.FindAll({
    param($node)
    $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -in @('Test-HospitalAccessRuleGrantsWrite','Assert-NoUnprivilegedWriteAcl')
}, $true))
if ($aclFunctions.Count -ne 2) { throw 'No se encontraron los dos componentes del guard ACL verificable.' }
foreach ($function in @($aclFunctions | Sort-Object { $_.Extent.StartOffset })) { Invoke-Expression $function.Extent.Text }
$usersSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
$readRule = [Security.AccessControl.FileSystemAccessRule]::new($usersSid, 'ReadAndExecute', 'Allow')
$modifyRule = [Security.AccessControl.FileSystemAccessRule]::new($usersSid, 'Modify', 'Allow')
$fullRule = [Security.AccessControl.FileSystemAccessRule]::new($usersSid, 'FullControl', 'Allow')
if (Test-HospitalAccessRuleGrantsWrite -Rule $readRule) { throw 'El guard ACL confundió lectura y ejecución con escritura.' }
if (-not (Test-HospitalAccessRuleGrantsWrite -Rule $modifyRule)) { throw 'El guard ACL no detectó Modify.' }
if (-not (Test-HospitalAccessRuleGrantsWrite -Rule $fullRule)) { throw 'El guard ACL no detectó FullControl.' }

Write-Output "PASS recover_hospital_access contract PS=$($PSVersionTable.PSVersion)"
