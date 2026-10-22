#Requires -Version 5.1

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $ProjectRoot,
    [Parameter(Mandatory = $true)][string] $ProductionBackendRoot,
    [Parameter(Mandatory = $true)][string] $FrontendDistRoot,
    [Parameter(Mandatory = $true)][string] $RuntimeCache,
    [Parameter(Mandatory = $true)][string] $OutputRoot,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9A-Za-z][0-9A-Za-z._-]+$')][string] $Version,
    [ValidateSet('no_schema_change','backward_compatible_additive')][string] $DatabaseUpdatePolicy = 'no_schema_change',
    [string] $SourcesPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot 'lib\native_manifest.ps1')

function Copy-NativeDirectoryContents {
    param([Parameter(Mandatory = $true)][string] $Source, [Parameter(Mandatory = $true)][string] $Destination)

    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { throw "Required source directory is missing: $Source" }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

if ([string]::IsNullOrWhiteSpace($SourcesPath)) {
    $SourcesPath = Join-Path $ProjectRoot 'installer\native\runtime-sources.json'
}
foreach ($required in @($ProjectRoot, $ProductionBackendRoot, $FrontendDistRoot, $RuntimeCache)) {
    if (-not (Test-Path -LiteralPath $required -PathType Container)) { throw "Required build input is missing: $required" }
}
if (Test-Path -LiteralPath $OutputRoot) { throw "Output root already exists; refusing to overwrite it: $OutputRoot" }
if (Test-Path -LiteralPath (Join-Path $ProductionBackendRoot 'vendor\phpunit')) { throw 'Production backend contains development dependency phpunit.' }
foreach ($required in @('artisan', 'public\index.php', 'vendor\autoload.php')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProductionBackendRoot $required) -PathType Leaf)) { throw "Production backend is incomplete: $required" }
}
if (-not (Test-Path -LiteralPath (Join-Path $FrontendDistRoot 'index.html') -PathType Leaf)) { throw 'Final frontend dist is missing index.html.' }

$sources = Get-Content -LiteralPath $SourcesPath -Raw | ConvertFrom-Json
$byId = @{}
foreach ($artifact in @($sources.artifacts)) {
    $archive = Join-Path $RuntimeCache ([string]$artifact.file)
    if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) { throw "Runtime cache is missing '$($artifact.id)': $archive" }
    $actual = (Get-FileHash -LiteralPath $archive -Algorithm ([string]$artifact.algorithm)).Hash.ToLowerInvariant()
    if ($actual -ne ([string]$artifact.hash).ToLowerInvariant()) { throw "Runtime cache hash mismatch for '$($artifact.id)'." }
    $byId[[string]$artifact.id] = $archive
}
foreach ($runtimeId in @('php','mariadb','caddy','winsw','vcredist')) {
    if (-not $byId.ContainsKey($runtimeId)) { throw "Runtime sources do not define '$runtimeId'." }
}

$stage = $OutputRoot + '.staging-' + [guid]::NewGuid().ToString('N')
$extract = $OutputRoot + '.extract-' + [guid]::NewGuid().ToString('N')
try {
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    $backendOut = Join-Path $stage 'app\backend'
    New-Item -ItemType Directory -Path $backendOut -Force | Out-Null
    foreach ($directory in @('app','config','public','resources','routes','vendor')) {
        $sourceDirectory = Join-Path $ProductionBackendRoot $directory
        if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
            Copy-NativeDirectoryContents -Source $sourceDirectory -Destination (Join-Path $backendOut $directory)
        }
    }
    $bootstrapSource = Join-Path $ProductionBackendRoot 'bootstrap'
    $bootstrapOut = Join-Path $backendOut 'bootstrap'
    New-Item -ItemType Directory -Path $bootstrapOut -Force | Out-Null
    Get-ChildItem -LiteralPath $bootstrapSource -Force | Where-Object Name -ne 'cache' | Copy-Item -Destination $bootstrapOut -Recurse -Force
    New-Item -ItemType Directory -Path (Join-Path $bootstrapOut 'cache') -Force | Out-Null
    Copy-NativeDirectoryContents -Source (Join-Path $ProductionBackendRoot 'database\migrations') -Destination (Join-Path $backendOut 'database\migrations')
    $productionSeeders = @(
        'ProductionInstallationSeeder.php',
        'RolesAndPermissionsSeeder.php',
        'CashRegisterSeeder.php',
        'ReceiptPrintProfileSeeder.php',
        'InstitutionalReceiptSeriesSeeder.php',
        'ServiceCatalogSeeder.php'
    )
    $seedersOut = Join-Path $backendOut 'database\seeders'
    New-Item -ItemType Directory -Path $seedersOut -Force | Out-Null
    foreach ($seeder in $productionSeeders) {
        $sourceSeeder = Join-Path $ProductionBackendRoot ('database\seeders\' + $seeder)
        if (-not (Test-Path -LiteralPath $sourceSeeder -PathType Leaf)) { throw "Required production seeder is missing: $seeder" }
        Copy-Item -LiteralPath $sourceSeeder -Destination (Join-Path $seedersOut $seeder)
    }
    $catalogSource = Join-Path $ProductionBackendRoot 'database\seeders\data\catalogo_servicios_inicial.csv'
    if (-not (Test-Path -LiteralPath $catalogSource -PathType Leaf)) { throw 'Required production service catalog is missing.' }
    New-Item -ItemType Directory -Path (Join-Path $seedersOut 'data') -Force | Out-Null
    Copy-Item -LiteralPath $catalogSource -Destination (Join-Path $seedersOut 'data\catalogo_servicios_inicial.csv')
    foreach ($file in @('artisan','composer.json','composer.lock')) {
        $sourceFile = Join-Path $ProductionBackendRoot $file
        if (Test-Path -LiteralPath $sourceFile -PathType Leaf) { Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $backendOut $file) }
    }
    Copy-NativeDirectoryContents -Source $FrontendDistRoot -Destination (Join-Path $stage 'app\frontend\dist')

    $nativeScriptsOut = Join-Path $stage 'scripts\native'
    New-Item -ItemType Directory -Path $nativeScriptsOut -Force | Out-Null
    $nativeScriptsSource = Join-Path $ProjectRoot 'scripts\native'
    foreach ($runtimeScript in @('diagnose_native_partial.ps1','install_native_runtime.ps1','invoke_native_artisan.ps1','recovery_wizard.ps1','restore_native.ps1','run_native_service.ps1','start_native_app.ps1','update_native_runtime.ps1','verify_native_host.ps1')) {
        $runtimeScriptPath = Join-Path $nativeScriptsSource $runtimeScript
        if (-not (Test-Path -LiteralPath $runtimeScriptPath -PathType Leaf)) { throw "Required native runtime script is missing: $runtimeScript" }
        Copy-Item -LiteralPath $runtimeScriptPath -Destination (Join-Path $nativeScriptsOut $runtimeScript) -Force
    }
    if (Test-Path -LiteralPath (Join-Path $nativeScriptsSource 'lib') -PathType Container) {
        Copy-NativeDirectoryContents -Source (Join-Path $nativeScriptsSource 'lib') -Destination (Join-Path $nativeScriptsOut 'lib')
    }
    foreach ($scriptName in @('recover_hospital_access.ps1')) {
        $sourceScript = Join-Path (Join-Path $ProjectRoot 'scripts') $scriptName
        if (-not (Test-Path -LiteralPath $sourceScript -PathType Leaf)) { throw "Required maintenance script is missing: $scriptName" }
        $scriptsOut = Join-Path $stage 'scripts'
        New-Item -ItemType Directory -Path $scriptsOut -Force | Out-Null
        Copy-Item -LiteralPath $sourceScript -Destination (Join-Path $scriptsOut $scriptName) -Force
    }

    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    foreach ($runtimeId in @('php','mariadb','caddy')) {
        $targetExtract = Join-Path $extract $runtimeId
        Expand-Archive -LiteralPath $byId[$runtimeId] -DestinationPath $targetExtract -Force
    }
    Copy-NativeDirectoryContents -Source (Join-Path $extract 'php') -Destination (Join-Path $stage 'runtime\php')
    Copy-NativeDirectoryContents -Source (Join-Path $extract 'caddy') -Destination (Join-Path $stage 'runtime\caddy')
    $mariaExtract = Join-Path $extract 'mariadb'
    $mariaChildren = @(Get-ChildItem -LiteralPath $mariaExtract -Directory)
    $mariaSource = if ($mariaChildren.Count -eq 1 -and -not (Test-Path -LiteralPath (Join-Path $mariaExtract 'bin'))) { $mariaChildren[0].FullName } else { $mariaExtract }
    Copy-NativeDirectoryContents -Source $mariaSource -Destination (Join-Path $stage 'runtime\mariadb')
    New-Item -ItemType Directory -Path (Join-Path $stage 'runtime\winsw') -Force | Out-Null
    Copy-Item -LiteralPath $byId.winsw -Destination (Join-Path $stage 'runtime\winsw\WinSW-x64.exe')
    New-Item -ItemType Directory -Path (Join-Path $stage 'runtime\vcredist') -Force | Out-Null
    Copy-Item -LiteralPath $byId.vcredist -Destination (Join-Path $stage 'runtime\vcredist\vc_redist.x64.exe')

    $requiredExtensions = @('curl','dom','fileinfo','gd','intl','mbstring','openssl','pdo_mysql','sodium','xml','xmlwriter','zip')
    $fixtureBuild = @($sources.artifacts | Where-Object { $_.version -ne 'test' }).Count -eq 0
    $runtimeProbe = [ordered]@{ status = 'contract-fixture'; required_extensions = $requiredExtensions }
    if (-not $fixtureBuild) {
        $probeIni = Join-Path $stage 'runtime\php\native-probe.ini'
        $extensionDirectory = (Join-Path $stage 'runtime\php\ext') -replace '\\','/'
        $probeIniText = 'extension_dir="' + $extensionDirectory + '"' + "`r`n" + ((@('curl','fileinfo','gd','intl','mbstring','openssl','pdo_mysql','sodium','zip') | ForEach-Object { "extension=$_" }) -join "`r`n") + "`r`n"
        [IO.File]::WriteAllText($probeIni, $probeIniText, [Text.UTF8Encoding]::new($false))
        $probeScript = Join-Path $stage 'runtime\php\native-probe.php'
        $probeCode = '<?php $required=["curl","dom","fileinfo","gd","intl","mbstring","openssl","pdo_mysql","sodium","xml","xmlwriter","zip"]; $missing=array_values(array_filter($required,fn($e)=>!extension_loaded($e))); $sodiumReady=function_exists("sodium_crypto_pwhash") && defined("SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13"); echo json_encode(["php"=>PHP_VERSION,"missing"=>$missing,"sodium_argon2id13"=>$sodiumReady]); exit($missing===[] && $sodiumReady && version_compare(PHP_VERSION,"8.2.0",">=") ? 0 : 1);'
        [IO.File]::WriteAllText($probeScript, $probeCode, [Text.UTF8Encoding]::new($false))
        $probeOutput = & (Join-Path $stage 'runtime\php\php.exe') -c $probeIni $probeScript
        $probeExit = $LASTEXITCODE
        Remove-Item -LiteralPath $probeIni,$probeScript -Force
        if ($probeExit -ne 0) { throw "Bundled PHP failed required extension probe: $($probeOutput -join ' ')" }
        $probeResult = (($probeOutput -join "`n") | ConvertFrom-Json)
        $runtimeProbe = [ordered]@{ status = 'passed'; php = $probeResult.php; required_extensions = $requiredExtensions; missing = @($probeResult.missing); sodium_argon2id13 = [bool]$probeResult.sodium_argon2id13 }
    }
    $runtimeProbe | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stage 'native-runtime-probe.json') -Encoding UTF8

    $inspectRoots = @('app','bootstrap','config','database','public','resources','routes') | ForEach-Object { Join-Path $backendOut $_ }
    $forbiddenBackendPaths = @($inspectRoots | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object {
        Get-ChildItem -LiteralPath $_ -Recurse -Force
    } | Where-Object {
        $relative = $_.FullName.Substring($backendOut.Length).TrimStart('\')
        $relative -match '(^|\\)(tests?|factories|fixtures|propuestas|laboratorio)(\\|$)' -or
        $_.Name -in @('DatabaseSeeder.php','DevelopmentValidationSeeder.php','DevelopmentSeeder.php') -or
        $_.Name -like '.env*' -or
        ($relative -match '^bootstrap\\cache\\' -and -not $_.PSIsContainer)
    })
    if ($forbiddenBackendPaths.Count -gt 0) {
        throw "Development-only backend content leaked into the native payload: $($forbiddenBackendPaths[0].FullName)"
    }

    [ordered]@{
        product = 'S_Hospital'
        version = $Version
        architecture = 'x64'
        database_update_policy = $DatabaseUpdatePolicy
        runtime_versions = [ordered]@{
            php = ($sources.artifacts | Where-Object id -eq 'php').version
            mariadb = ($sources.artifacts | Where-Object id -eq 'mariadb').version
            caddy = ($sources.artifacts | Where-Object id -eq 'caddy').version
            winsw = ($sources.artifacts | Where-Object id -eq 'winsw').version
            vcredist = ($sources.artifacts | Where-Object id -eq 'vcredist').version
        }
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $stage 'native-release.json') -Encoding UTF8

    New-NativePayloadManifest -PayloadRoot $stage -Version $Version | Out-Null
    $validation = Test-NativePayloadManifest -PayloadRoot $stage
    if (-not $validation.Ready) { throw "Built payload did not validate: $($validation.Reasons -join '; ')" }
    Move-Item -LiteralPath $stage -Destination $OutputRoot
    [pscustomobject]@{ Ready = $true; Version = $Version; PayloadRoot = $OutputRoot; Files = $validation.FilesChecked }
}
finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
}
