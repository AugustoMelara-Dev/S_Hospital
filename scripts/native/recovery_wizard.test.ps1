#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'recovery_wizard.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw
$checks = 0
function Assert-Wizard([bool]$Condition, [string]$Message) {
    $script:checks++
    if (-not $Condition) { throw $Message }
}
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$errors)
Assert-Wizard (@($errors).Count -eq 0) 'Recovery wizard must parse in Windows PowerShell 5.1.'
Assert-Wizard ($source -match 'Windows\.Forms') 'Recovery wizard must expose a protected GUI.'
Assert-Wizard ($ast.ParamBlock.Parameters.Count -eq 0) 'Recovery wizard must not accept attacker-controlled runtime roots.'
Assert-Wizard ($source -match "GetFolderPath\(\[Environment\+SpecialFolder\]::System\)" -and $source -match "WindowsPowerShell\\v1\.0\\powershell\.exe") 'Recovery wizard must invoke the system Windows PowerShell by absolute path.'
Assert-Wizard ($source -match '@\(''-c'',\$phpIni,\$artisan') 'Recovery wizard must use the installed PHP configuration.'
Assert-Wizard ($source -match 'ProgramFiles' -and $source -match 'CommonApplicationData' -and $source -match 'outside_releases') 'Recovery wizard must derive canonical roots and constrain the active junction to releases.'
Assert-Wizard ($source -match 'Assert-NoUnprivilegedWriteAcl' -and $source -match 'Assert-Within') 'Recovery wizard must verify protected path containment and ACLs.'
Assert-Wizard ($source -match 'native_dotenv\.ps1' -and $source -match 'ConvertFrom-NativeDotEnvValue' -and $source -match '\^\[A-Z\]\[A-Z0-9_\]\*\$') 'Recovery wizard must import the protected native environment.'
Assert-Wizard ($source -match '\$allowedNames' -and $source -match "DB_HOST -cne '127\.0\.0\.1'" -and $source -match 'invalid_app_url') 'Elevated environment import must be allowlisted and restricted to loopback services.'
Assert-Wizard ($source -match 'expectedDump' -and $source -match 'configuredDump' -and $source -match 'invalid_dump_binary') 'Backup executable must resolve to the protected bundled runtime.'
Assert-Wizard ($source -match 'EnvironmentVariables\[''PHPRC''\].*=\s*''''\s*' -and $source -match 'EnvironmentVariables\[''PHP_INI_SCAN_DIR''\].*=\s*\$disabledPhpScanRoot' -and $source -match 'unsafe_php_scan') 'Elevated PHP must ignore inherited user ini locations and use an empty protected scan directory.'
Assert-Wizard ($source -match '\$expectedPaths' -and $source -match 'invalid_runtime_path' -and $source -match '\$safeCachePaths' -and $source -match 'administrator-only') 'Laravel executable cache paths must be validated then replaced with administrator-only paths.'
Assert-Wizard ($source -match 'SecureStringToBSTR[\s\S]+ZeroFreeBSTR') 'Passphrase must be materialized only around protected stdin and cleared.'
Assert-Wizard ($source -match 'RedirectStandardInput\s*=\s*\$true') 'Sensitive control data must use child stdin.'
Assert-Wizard ($source -match 'StandardOutputEncoding\s*=\s*\[Text\.Encoding\]::UTF8' -and $source -match 'StandardInput\.BaseStream\.Write') 'Protected process transport must use explicit UTF-8.'
Assert-Wizard ($source -match 'ReadToEndAsync' -and $source -match 'AddSeconds\(\$TimeoutSeconds\)' -and $source -match '\$process\.Dispose\(\)') 'Child output must drain asynchronously with a timeout and disposal.'
Assert-Wizard ($source -match 'taskkill\.exe' -and $source -match '/PID \{0\} /T /F' -and $source -match 'recovery-attention\.required') 'Timeout must terminate the process tree and persist a fail-closed marker if termination is unconfirmed.'
Assert-Wizard ($source -match 'function ConvertTo-NativeArgument' -and $source -notmatch "Replace\('\\','\\\\'\)") 'Native arguments must use Windows-compatible quoting without doubling every path separator.'
Assert-Wizard ($source -notmatch 'Write-Host|Write-Output|Out-File|Set-Content.+nativeEnvironment') 'Wizard must not print or persist imported environment values.'
Assert-Wizard ($source -match 'DriveType\]::Removable' -and $source -match "StartsWith\('\\\\'") 'Kit export must require removable media or UNC.'
Assert-Wizard ($source -match 'hospital:export-backup-recovery-kit') 'Wizard must call the canonical kit exporter.'
Assert-Wizard ($source -match "ExpectedStatus[\s\S]+'success'" -and $source -match "'validated'" -and $source -match "'restored'" -and $source -match 'RequireRestoreTested') 'Wizard must verify each JSON result contract.'
Assert-Wizard ($source -match "'-Mode','Validate'" -and $source -match "'-Mode','Replace'") 'Recovery must validate before guarded replacement.'
Assert-Wizard ($source -match 's_hospital_validation_''\+\$runId' -and $source -match 's_hospital_restore_''\+\$runId' -and $source -match '\[guid\]::NewGuid') 'Validation and replacement must each use a collision-resistant new database.'
Assert-Wizard ($source -match 'Get-FileHash[\s\S]+SHA256') 'Recovery must pin the selected package checksum.'
Assert-Wizard ($source -match "confirmation\s*=\s*'RESTAURAR'") 'Replacement must send explicit protected confirmation.'
Assert-Wizard ($source -match 'respaldo preventivo' -and $source -match 'base anterior') 'Impact copy must explain preventive backup and preservation.'
Assert-Wizard ($source -match 'YesNoCancel' -and $source -match 'if \(\$kit\) \{ \$common \+=') 'Recovery kit must be optional for same-machine recovery.'
Assert-Wizard ($source -notmatch 'Exception\.Message' -and $source -notmatch 'triggers|base activa') 'Hospital UI must not expose technical errors or database jargon.'
Assert-Wizard ($source -match 'Set-Busy' -and $source -match 'UseWaitCursor') 'Long operations must provide progress and prevent duplicate actions.'
Assert-Wizard ($source -match "Global\\S_Hospital_Recovery" -and $source -match 'WaitOne\(0\)' -and $source -match 'ReleaseMutex') 'Only one elevated recovery wizard may run at a time.'
Assert-Wizard ($source -match 'Add_FormClosing' -and $source -match '\$eventArgs\.Cancel\s*=\s*\$true' -and $source -match '\$close\.Enabled\s*=\s*-not \$Busy') 'The wizard must block closing while a protected child is running.'
Assert-Wizard ($source -notmatch '(?i)DROP\s+DATABASE|migrate:fresh|db:wipe') 'Wizard must contain no destructive database resets.'
Write-Host "Native recovery wizard contract passed: $checks checks."
