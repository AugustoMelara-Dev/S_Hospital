#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$script = Join-Path $PSScriptRoot 'invoke_native_artisan.ps1'
foreach ($action in @('migrate','migration-status','seed-initial','optimize','has-admin','backup-manual','verify-backup','verify-migration-backup')) {
    $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Action $action -InstallRoot 'C:\Program Files\S_Hospital' -DataRoot 'C:\ProgramData\S_Hospital' -BackupId 42 -WhatIfOnly -Json
    if ($LASTEXITCODE -ne 0) { throw "Artisan plan failed for $action." }
    $plan = ($json -join "`n") | ConvertFrom-Json
    if ($plan.Arguments[0] -ne '-c' -or $plan.Arguments[1] -notmatch 'php\.ini$') { throw "PHP ini missing for $action." }
    if ($plan.Executable -notmatch 'current\\runtime\\php\\php\.exe$') { throw "Bundled PHP missing for $action." }
    if (($plan.Arguments -join ' ') -match 'password|secret') { throw "Artisan plan exposed secret-shaped arguments for $action." }
    if ($action -eq 'migration-status' -and ($plan.Arguments -join ' ') -notmatch '--pending=2') { throw 'Migration status must return a distinct nonzero code when pending migrations exist.' }
}
$candidateJson = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -Action migrate -InstallRoot 'C:\Program Files\S_Hospital' -DataRoot 'C:\ProgramData\S_Hospital' -ReleaseRoot 'C:\Program Files\S_Hospital\releases\next' -WhatIfOnly -Json
$candidate = ($candidateJson -join "`n") | ConvertFrom-Json
if ($candidate.Executable -notmatch 'releases\\next\\runtime\\php\\php\.exe$') { throw 'Candidate migration must use candidate PHP.' }
if (($candidate.Arguments -join ' ') -notmatch 'extension_dir=.+releases\\next\\runtime\\php\\ext') { throw 'Candidate migration must use candidate PHP extensions.' }
$source = Get-Content -LiteralPath $script -Raw
if ($source -notmatch 'New-NativeElevatedPhpContext') { throw 'Elevated Artisan commands must use the shared protected PHP context.' }
if ($source -notmatch 'allowedEnvironmentNames') { throw 'Elevated Artisan commands must reject unexpected environment keys.' }
$helper = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lib\native_elevated_php.ps1') -Raw
foreach ($contract in @('PHP_INI_SCAN_DIR','PHPRC','APP_CONFIG_CACHE','APP_ROUTES_CACHE','HOSPITAL_DUMP_BINARY','AdministratorSecret')) {
    if ($helper -notmatch $contract) { throw "Protected PHP context is missing: $contract" }
}
Write-Host '[ OK ] Native Artisan command contract passed.'
