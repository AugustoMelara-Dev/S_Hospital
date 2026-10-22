#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'restore_native.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw
$checks = 0

function Assert-RestoreContract([bool]$Condition, [string]$Message) {
    $script:checks++
    if (-not $Condition) { throw $Message }
}

Assert-RestoreContract (Test-Path -LiteralPath $scriptPath) 'restore_native.ps1 must exist.'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
Assert-RestoreContract (@($errors).Count -eq 0) 'restore_native.ps1 must parse in Windows PowerShell 5.1.'

$params = @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
foreach ($name in @('Mode','Package','ExpectedSha256','ValidationDatabase','InstallRoot','DataRoot','RecoveryKit','WhatIf','Json')) {
    Assert-RestoreContract ($params -contains $name) "Missing parameter -$name."
}
Assert-RestoreContract ($source -match 'native_secret_store\.ps1') 'Restore must use the native protected secret store.'
Assert-RestoreContract ($source -match "Unprotect-NativeMachineSecret[\s\S]+Purpose\s+'database-admin'") 'Restore must obtain the DB admin secret internally.'
Assert-RestoreContract ($source -match 'Set-NativeRestrictedAcl') 'Restore staging/defaults files must use restricted Windows ACLs.'
Assert-RestoreContract ($source -match 'Test-NativeCanonicalRoots[\s\S]+Test-NativePathNotBroadlyWritable') 'Restore must reject redirected writable runtime roots.'
Assert-RestoreContract ($source -match 'releasesRoot[\s\S]+currentTarget') 'Restore must constrain the active runtime to protected releases.'
Assert-RestoreContract ($source -match 'ConvertTo-NativeCommandLineArgument') 'Restore must quote Windows process arguments without rewriting path separators.'
Assert-RestoreContract ($source -match 'UTF8Encoding[\s\S]+BaseStream\.Write') 'Restore must send protected JSON to child stdin as UTF-8.'
Assert-RestoreContract ($source -match 'WaitForExit\(\$TimeoutSeconds') 'Restore child processes must have a bounded timeout.'
Assert-RestoreContract ($source -match 'NativeAllowedEnvironmentNames[\s\S]+Initialize-NativeRecoveryEnvironment') 'Restore must import only an explicit runtime environment allowlist.'
Assert-RestoreContract ($source -match 'PHP_INI_SCAN_DIR' -and $source -match 'php-scan-disabled') 'Elevated PHP must disable mutable configuration scanning.'
Assert-RestoreContract ($source -match 'administrator-only\\recovery-php\.ini' -and $source -match 'requiredExtensions') 'Restore must generate an administrator-only fixed PHP configuration.'
Assert-RestoreContract ($source -match 'SetOwner[\s\S]+S-1-5-32-544') 'Elevated recovery configuration must be owned by Administrators.'
Assert-RestoreContract ($source -match 'HOSPITAL_DUMP_BINARY[\s\S]+runtime\\mariadb\\bin\\mariadb-dump\.exe') 'Preventive backups must use the dump binary from the protected release.'
Assert-RestoreContract ($source -match 'hospital:decrypt-backup') 'Restore must use the canonical backend decryptor.'
Assert-RestoreContract ($source -match 'hospital:prepare-portable-sql') 'Restore must normalize historical SQL through the canonical portable sanitizer.'
Assert-RestoreContract ($source -notmatch '(?i)migrate:fresh|db:wipe|DROP\s+DATABASE') 'Restore must not contain destructive database reset commands.'
Assert-RestoreContract ($source -match 'information_schema\.SCHEMATA') 'Restore must prove the validation database is absent before creation.'
Assert-RestoreContract ($source -match 'information_schema\.TRIGGERS') 'Restore must validate restored triggers.'
Assert-RestoreContract ($source -match 'CREATE\s+TEMPORARY\s+TABLE') 'Restore must execute a reversible write/read probe.'
Assert-RestoreContract ($source -match "verification_scope\s*=\s*'isolated_database_restore'") 'Restore result must distinguish isolated database recovery from encrypted-file integrity.'
Assert-RestoreContract ($source -match 'hospital:backup[\s\S]+--type=manual[\s\S]+--json') 'Replace must create and verify a preventive backup first.'
Assert-RestoreContract ($source -match 'hospital:verify-backup[\s\S]+encrypted_file_integrity') 'Replace must fully decrypt and verify the preventive backup before switching.'
Assert-RestoreContract ($source -match 'RESTAURAR') 'Replace must require the explicit protected confirmation phrase.'
Assert-RestoreContract ($source -match 'Stop-Service[\s\S]+SHospital') 'Replace must stop native writers before switching configuration.'
Assert-RestoreContract ($source -match 'Move-Item[\s\S]+hospital\.env') 'Replace must publish native configuration atomically.'
Assert-RestoreContract ($source -match 'Rollback|rollback') 'Replace must restore previous configuration if restart or health checks fail.'
Assert-RestoreContract ($source -match 'SHospitalMariaDB[\s\S]+SHospitalScheduler') 'Replace must verify every native service after restart.'
Assert-RestoreContract ($source -match "APP_URL[\s\S]+'/up'[\s\S]+StatusCode") 'Replace must require the configured HTTP health endpoint to return 200.'
Assert-RestoreContract ($source -match "Host\s+-ne\s+'127\.0\.0\.1'[\s\S]+httpDeadline") 'Health must use a separate timeout against the configured loopback endpoint only.'

$temp = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-restore-test-' + [guid]::NewGuid().ToString('N'))
try {
    $install = Join-Path $temp 'install'
    $data = Join-Path $temp 'data'
    $package = Join-Path $temp 'backup.sql.gz.enc'
    New-Item -ItemType Directory -Path $install,$data -Force | Out-Null
    [IO.File]::WriteAllText($package, 'synthetic-encrypted-package', [Text.UTF8Encoding]::new($false))
    $sha = (Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant()

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
        -Mode Validate -Package $package -ExpectedSha256 $sha `
        -ValidationDatabase 's_hospital_restore_proof_20260928' `
        -InstallRoot $install -DataRoot $data -WhatIf -Json
    Assert-RestoreContract ($LASTEXITCODE -eq 0) 'Safe WhatIf plan must succeed without touching MariaDB.'
    $plan = ($output | Select-Object -Last 1) | ConvertFrom-Json
    Assert-RestoreContract ($plan.writes_performed -eq $false) 'WhatIf must report writes_performed=false.'
    Assert-RestoreContract ($plan.target_must_be_absent -eq $true) 'Plan must require a new validation database.'
    Assert-RestoreContract ($plan.replace_enabled -eq $true) 'Native recovery plan must include the guarded Replace path.'
    Assert-RestoreContract (($output -join "`n") -notmatch 'synthetic-encrypted-package|DB_PASSWORD|BACKUP_ENCRYPTION|APP_KEY') 'Plan output must not expose package contents or secrets.'

    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
            -Mode Validate -Package $package -ExpectedSha256 $sha `
            -ValidationDatabase 'hospital_billing' `
            -InstallRoot $install -DataRoot $data -WhatIf -Json *> $null
        $unsafeExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    Assert-RestoreContract ($unsafeExitCode -ne 0) 'Production database name must be rejected before any action.'

    $replacePlanOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
        -Mode Replace -Package $package -ExpectedSha256 $sha `
        -ValidationDatabase 's_hospital_restore_proof_20260928' `
        -InstallRoot $install -DataRoot $data -WhatIf -Json
    Assert-RestoreContract ($LASTEXITCODE -eq 0) 'Replace WhatIf must expose the guarded recovery plan without writing.'
    $replacePlan = ($replacePlanOutput | Select-Object -Last 1) | ConvertFrom-Json
    Assert-RestoreContract ($replacePlan.mode -eq 'Replace' -and $replacePlan.writes_performed -eq $false) 'Replace WhatIf must remain read-only.'
}
finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}

Write-Host "Native restore contract passed: $checks checks."
