#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$builder = Join-Path $PSScriptRoot 'build_native_payload.ps1'
if (-not (Test-Path -LiteralPath $builder -PathType Leaf)) { throw "Missing payload builder: $builder" }
. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-builder-' + [guid]::NewGuid().ToString('N'))
try {
    $project = Join-Path $root 'project'
    $backend = Join-Path $root 'backend-production'
    $frontend = Join-Path $root 'frontend-dist'
    $cache = Join-Path $root 'cache'
    $output = Join-Path $root 'payload'
    New-Item -ItemType Directory -Path $cache -Force | Out-Null

    foreach ($relative in @('artisan','public\index.php','vendor\autoload.php','composer.json','composer.lock','app\A.php','bootstrap\app.php','config\app.php','database\migrations\x.php','routes\web.php','database\seeders\data\catalogo_servicios_inicial.csv')) {
        $path = Join-Path $backend $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }
    $e2eCommand = Join-Path $backend 'app\Console\Commands\PrepareE2eReleaseDataCommand.php'
    New-Item -ItemType Directory -Path (Split-Path $e2eCommand -Parent) -Force | Out-Null
    Set-Content -LiteralPath $e2eCommand -Value 'laboratory command must not ship' -Encoding ASCII
    New-Item -ItemType Directory -Path (Join-Path $backend 'tests') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $backend 'bootstrap\cache') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $backend 'tests\MustNotShip.php') -Value 'test' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $backend '.env') -Value 'SECRET=must-not-ship' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $backend 'bootstrap\cache\config.php') -Value '<?php return ["secret"=>"must-not-ship"];' -Encoding ASCII
    foreach ($seeder in @('ProductionInstallationSeeder.php','RolesAndPermissionsSeeder.php','CashRegisterSeeder.php','ReceiptPrintProfileSeeder.php','InstitutionalReceiptSeriesSeeder.php','ServiceCatalogSeeder.php','DatabaseSeeder.php','DevelopmentValidationSeeder.php')) {
        Set-Content -LiteralPath (Join-Path $backend ('database\seeders\' + $seeder)) -Value $seeder -Encoding ASCII
    }
    New-Item -ItemType Directory -Path $frontend -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $frontend 'index.html') -Value '<html></html>' -Encoding ASCII

    foreach ($relative in @($script:NativeRequiredPayloadFiles | Where-Object { $_ -like 'scripts/*' })) {
        $relative = $relative -replace '/', '\'
        $path = Join-Path $project $relative
        New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
        Set-Content -LiteralPath $path -Value $relative -Encoding ASCII
    }

    $artifacts = @()
    $licenseDirectory = Join-Path $project 'installer\native\licenses'
    New-Item -ItemType Directory -Path $licenseDirectory -Force | Out-Null
    $winswLicense = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\..\installer\native\licenses\WinSW-2.12.0-LICENSE.txt') -Raw
    [IO.File]::WriteAllText((Join-Path $licenseDirectory 'WinSW-2.12.0-LICENSE.txt'), $winswLicense, [Text.UTF8Encoding]::new($false))
    foreach ($definition in @(
        @{ id='php'; file='php.zip'; entries=@{'php.exe'='php';'php-cgi.exe'='cgi'} },
        @{ id='mariadb'; file='maria.zip'; entries=@{'mariadb-x\bin\mariadb-install-db.exe'='init';'mariadb-x\bin\mariadb-dump.exe'='dump';'mariadb-x\bin\mariadb.exe'='client';'mariadb-x\bin\mariadbd.exe'='server'} },
        @{ id='caddy'; file='caddy.zip'; entries=@{'caddy.exe'='caddy'} }
    )) {
        $source = Join-Path $root ('zip-' + $definition.id)
        foreach ($entry in $definition.entries.GetEnumerator()) {
            $path = Join-Path $source $entry.Key
            New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
            Set-Content -LiteralPath $path -Value $entry.Value -Encoding ASCII
        }
        $archive = Join-Path $cache $definition.file
        Compress-Archive -Path (Join-Path $source '*') -DestinationPath $archive
        $artifacts += [ordered]@{ id=$definition.id; version='test'; url='https://example.invalid/'+$definition.file; file=$definition.file; algorithm='SHA256'; hash=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant(); checksum_source='test' }
    }
    $winsw = Join-Path $cache 'winsw.exe'
    Set-Content -LiteralPath $winsw -Value 'winsw' -Encoding ASCII
    $artifacts += [ordered]@{ id='winsw'; version='test'; url='https://example.invalid/winsw.exe'; file='winsw.exe'; algorithm='SHA256'; hash=(Get-FileHash $winsw -Algorithm SHA256).Hash.ToLowerInvariant(); checksum_source='test' }
    $vcredist = Join-Path $cache 'vc_redist.x64.exe'
    Set-Content -LiteralPath $vcredist -Value 'vcredist' -Encoding ASCII
    $artifacts += [ordered]@{ id='vcredist'; version='test'; url='https://example.invalid/vc_redist.x64.exe'; file='vc_redist.x64.exe'; algorithm='SHA256'; hash=(Get-FileHash $vcredist -Algorithm SHA256).Hash.ToLowerInvariant(); checksum_source='test' }
    $sources = Join-Path $root 'sources.json'
    [ordered]@{ schema_version=1; architecture='x64'; artifacts=$artifacts } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $sources -Encoding UTF8

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $builder -ProjectRoot $project -ProductionBackendRoot $backend -FrontendDistRoot $frontend -RuntimeCache $cache -SourcesPath $sources -OutputRoot $output -Version '2026.09.28-test' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Payload builder failed.' }
    $validation = Test-NativePayloadManifest -PayloadRoot $output
    if (-not $validation.Ready) { throw "Built payload is invalid: $($validation.Reasons -join '; ')" }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\.env')) { throw 'Backend secrets leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\tests')) { throw 'Development tests leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\app\Console\Commands\PrepareE2eReleaseDataCommand.php')) { throw 'Laboratory setup command leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\bootstrap\cache\config.php')) { throw 'Bootstrap config cache leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\database\seeders\DatabaseSeeder.php')) { throw 'DatabaseSeeder leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'app\backend\database\seeders\DevelopmentValidationSeeder.php')) { throw 'Development seeder leaked into payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'scripts\install_backup_tasks_windows.ps1')) { throw 'Legacy scheduled-task installer leaked into the native payload.' }
    if (Test-Path -LiteralPath (Join-Path $output 'scripts\restore_hospital_windows.ps1')) { throw 'Legacy restore wrapper leaked into the native payload.' }
    if (-not (Test-Path -LiteralPath (Join-Path $output 'runtime\mariadb\bin\mariadb-dump.exe'))) { throw 'MariaDB archive layout was not normalized.' }
    if (-not (Test-Path -LiteralPath (Join-Path $output 'native-runtime-probe.json'))) { throw 'Runtime extension probe evidence is missing.' }
    $bundledLicense = Get-Content -LiteralPath (Join-Path $output 'runtime\winsw\LICENSE.txt') -Raw
    if ($bundledLicense -ne $winswLicense) { throw 'WinSW redistribution omitted or changed its upstream license notice.' }
    $release = Get-Content -LiteralPath (Join-Path $output 'native-release.json') -Raw | ConvertFrom-Json
    if ($release.database_update_policy -ne 'no_schema_change') { throw 'Payload builder must default to fail-closed database update policy.' }
    Write-Host '[ OK ] Native payload builder contract passed.'
}
finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
