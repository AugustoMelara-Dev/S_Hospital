#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$runner = Join-Path $PSScriptRoot 'run_native_service.ps1'
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "Missing service runner: $runner" }

$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-native-runner-' + [guid]::NewGuid().ToString('N'))
try {
    $installRoot = Join-Path $root 'program'
    $dataRoot = Join-Path $root 'data'
    New-Item -ItemType Directory -Path (Join-Path $dataRoot 'config') -Force | Out-Null
    @'
APP_ENV=production
DB_PASSWORD="DO_NOT_PRINT_THIS_SECRET"
'@ | Set-Content -LiteralPath (Join-Path $dataRoot 'config\hospital.env') -Encoding UTF8

    $commands = @{}
    foreach ($role in @('php-fastcgi', 'web', 'queue-default', 'queue-backups', 'scheduler')) {
        $json = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
            -Role $role -InstallRoot $installRoot -DataRoot $dataRoot -WhatIfOnly -Json
        if ($LASTEXITCODE -ne 0) { throw "Runner WhatIf failed for $role." }
        if (($json -join "`n") -match 'DO_NOT_PRINT_THIS_SECRET') { throw "Runner exposed a secret for $role." }
        $commands[$role] = ($json | ConvertFrom-Json)
    }

    if ($commands['php-fastcgi'].Executable -notmatch 'current\\runtime\\php\\php-cgi\.exe$') { throw 'PHP runner executable is wrong.' }
    if (($commands['php-fastcgi'].Arguments -join ' ') -notmatch '-b 127\.0\.0\.1:9070') { throw 'PHP FastCGI endpoint is wrong.' }
    if (($commands.web.Arguments -join ' ') -notmatch 'run --config') { throw 'Caddy service command is wrong.' }
    if (($commands['queue-default'].Arguments -join ' ') -notmatch 'queue:work database --queue=default') { throw 'Default queue command is wrong.' }
    if (($commands['queue-backups'].Arguments -join ' ') -notmatch 'queue:work database --queue=backups') { throw 'Backups queue command is wrong.' }
    if (($commands.scheduler.Arguments -join ' ') -notmatch 'schedule:work') { throw 'Scheduler command is wrong.' }
    foreach ($role in @('queue-default','queue-backups','scheduler')) {
        if (($commands[$role].Arguments -join ' ') -notmatch '-c .+config\\php\.ini') { throw "PHP ini is missing for $role." }
    }
    foreach ($command in $commands.Values) {
        if ($command.WorkingDirectory -notmatch 'current\\app\\backend$') { throw 'Service working directory must follow current release.' }
    }

    $runnerSource = Get-Content -LiteralPath $runner -Raw
    if ($runnerSource -notmatch 'SetEnvironmentVariable\(''PHPRC'',\s*\$phpIni') { throw 'Runtime PHP children must inherit the canonical php.ini.' }
    if ($runnerSource -notmatch 'SetEnvironmentVariable\(''PHP_INI_SCAN_DIR'',\s*\$phpScanRoot') { throw 'Runtime PHP children must use the controlled empty scan directory.' }

    Write-Host '[ OK ] Native service runner contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
