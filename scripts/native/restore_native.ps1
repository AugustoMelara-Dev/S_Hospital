#Requires -Version 5.1

[CmdletBinding()]
param(
    [ValidateSet('Validate','Replace')][string] $Mode = 'Validate',
    [Parameter(Mandatory = $true)][string] $Package,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string] $ExpectedSha256,
    [Parameter(Mandatory = $true)][string] $ValidationDatabase,
    [string] $InstallRoot = (Join-Path $env:ProgramFiles 'S_Hospital'),
    [string] $DataRoot = (Join-Path $env:ProgramData 'S_Hospital'),
    [string] $RecoveryKit = '',
    [switch] $WhatIf,
    [switch] $Json
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_secret_store.ps1')

function Test-NativeRestoreDatabaseName([string]$Name) {
    $Name -match '^[A-Za-z0-9_]{8,64}$' -and
        $Name.ToLowerInvariant() -match '(restore|validation|proof|test)' -and
        $Name.ToLowerInvariant() -notin @('hospital_billing','mysql','information_schema','performance_schema','sys')
}

function Test-NativeAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-NativeFullPath([string]$Path) {
    [IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-NativeCanonicalRoots([string]$Install, [string]$Data) {
    $expectedInstall = Get-NativeFullPath (Join-Path $env:ProgramFiles 'S_Hospital')
    $expectedData = Get-NativeFullPath (Join-Path $env:ProgramData 'S_Hospital')
    (Get-NativeFullPath $Install) -ieq $expectedInstall -and (Get-NativeFullPath $Data) -ieq $expectedData
}

function Test-NativePathNotBroadlyWritable([string]$Path) {
    $dangerous = @('S-1-1-0','S-1-5-11','S-1-5-32-545')
    $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor
        [Security.AccessControl.FileSystemRights]::Modify -bor
        [Security.AccessControl.FileSystemRights]::FullControl -bor
        [Security.AccessControl.FileSystemRights]::WriteData -bor
        [Security.AccessControl.FileSystemRights]::CreateFiles -bor
        [Security.AccessControl.FileSystemRights]::CreateDirectories
    $acl = Get-Acl -LiteralPath $Path
    foreach ($rule in $acl.Access) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) { continue }
        try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { return $false }
        if ($sid -in $dangerous -and (($rule.FileSystemRights -band $writeRights) -ne 0)) { return $false }
    }
    $true
}

function ConvertTo-NativeCommandLineArgument([AllowEmptyString()][string]$Value) {
    if ($Value.Length -gt 0 -and $Value -notmatch '[\s"]') { return $Value }
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append('"')
    $slashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq '\') { $slashes++; continue }
        if ($character -eq '"') {
            [void]$builder.Append(('\' * (($slashes * 2) + 1)))
            [void]$builder.Append('"')
            $slashes = 0
            continue
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)); $slashes = 0 }
        [void]$builder.Append($character)
    }
    if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
    [void]$builder.Append('"')
    $builder.ToString()
}

$script:NativeAllowedEnvironmentNames = @('APP_NAME','APP_ENV','APP_KEY','APP_DEBUG','APP_URL','LOG_CHANNEL','LOG_LEVEL','DB_CONNECTION','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD','SESSION_DRIVER','SESSION_SECURE_COOKIE','SANCTUM_STATEFUL_DOMAINS','CACHE_STORE','QUEUE_CONNECTION','BROADCAST_CONNECTION','FILESYSTEM_DISK','HOSPITAL_BACKUP_ENCRYPTION_KEY','HOSPITAL_ALLOW_INSECURE_HTTP','HOSPITAL_NATIVE_DATA_ROOT','LARAVEL_STORAGE_PATH','APP_CONFIG_CACHE','APP_EVENTS_CACHE','APP_PACKAGES_CACHE','APP_ROUTES_CACHE','APP_SERVICES_CACHE','VIEW_COMPILED_PATH','HOSPITAL_DUMP_BINARY')

function Read-NativeEnvironment([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { continue }
        $value = [string]$matches[2]
        if ($value.Length -ge 2 -and $value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') {
            $value = $value.Substring(1, $value.Length - 2)
            $value = $value.Replace('\n', "`n").Replace('\"', '"').Replace('\\', '\')
        }
        $name = [string]$matches[1]
        if ($name -in $script:NativeAllowedEnvironmentNames) { $values[$name] = $value }
    }
    $values
}

function Invoke-NativeProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$InputText = '',
        [string]$InputFile = '',
        [int]$TimeoutSeconds = 1800
    )
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $FilePath
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.RedirectStandardInput = ($InputText -ne '' -or $InputFile -ne '')
    $utf8 = New-Object Text.UTF8Encoding($false)
    $info.StandardOutputEncoding = $utf8
    $info.StandardErrorEncoding = $utf8
    $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-NativeCommandLineArgument $_ }) -join ' ')
    $process = New-Object Diagnostics.Process
    try {
        $process.StartInfo = $info
        if (-not $process.Start()) { throw 'No se pudo iniciar una herramienta local de recuperacion.' }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if ($InputFile -ne '') {
            $stream = [IO.File]::OpenRead($InputFile)
            try { $stream.CopyTo($process.StandardInput.BaseStream) } finally { $stream.Dispose(); $process.StandardInput.Close() }
        } elseif ($InputText -ne '') {
            $bytes = $utf8.GetBytes($InputText)
            try { $process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length) } finally { $process.StandardInput.Close(); $bytes = $null }
        }
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            try { $process.Kill() } catch { }
            throw 'Una herramienta local de recuperacion excedio el tiempo permitido.'
        }
        $stdout = $stdoutTask.Result
        $null = $stderrTask.Result
        if ($process.ExitCode -ne 0) { throw 'Una herramienta local de recuperacion devolvio un error.' }
        [pscustomobject]@{ ExitCode = $process.ExitCode; Output = [string]$stdout }
    } finally {
        $process.Dispose()
    }
}

function Invoke-NativeSql([string]$Client, [string]$Defaults, [string]$Sql, [string]$Database = '') {
    $arguments = @("--defaults-extra-file=$Defaults", '--batch', '--skip-column-names')
    if ($Database -ne '') { $arguments += $Database }
    $arguments += @('--execute', $Sql)
    (Invoke-NativeProcess -FilePath $Client -Arguments $arguments).Output.Trim()
}

function Read-ControlRequest {
    $input = [Console]::In.ReadToEnd()
    if ($input.Length -gt 8192) { throw 'La solicitud protegida de recuperacion no es valida.' }
    if ([string]::IsNullOrWhiteSpace($input)) { return @{} }
    $request = $input | ConvertFrom-Json
    $result = @{}
    foreach ($name in @('confirmation','reason','passphrase')) {
        if ($null -ne $request.PSObject.Properties[$name]) { $result[$name] = [string]$request.$name }
    }
    $result
}

function Test-NativeAdministratorControlled([string]$Path) {
    $allowedWriters = @('S-1-5-18','S-1-5-32-544')
    $acl = Get-Acl -LiteralPath $Path
    try { $ownerSid = ([Security.Principal.NTAccount]$acl.Owner).Translate([Security.Principal.SecurityIdentifier]).Value } catch { return $false }
    if ($ownerSid -notin $allowedWriters) { return $false }
    $writeRights = [Security.AccessControl.FileSystemRights]::Write -bor [Security.AccessControl.FileSystemRights]::Modify -bor [Security.AccessControl.FileSystemRights]::FullControl
    foreach ($rule in $acl.Access) {
        if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or (($rule.FileSystemRights -band $writeRights) -eq 0)) { continue }
        try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { return $false }
        if ($sid -notin $allowedWriters) { return $false }
    }
    $true
}

function Set-NativeAdministratorOwner([string]$Path) {
    $acl = Get-Acl -LiteralPath $Path
    $acl.SetOwner((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Initialize-NativeRecoveryEnvironment([hashtable]$Values,[string]$CurrentRoot,[string]$DataRoot,[string]$PhpIni) {
    if ([string]$Values.DB_HOST -cne '127.0.0.1' -or [string]$Values.DB_APP_ACCOUNT_HOST -cne '127.0.0.1' -or [string]$Values.DB_CONNECTION -cne 'mysql') {
        throw 'La identidad local de base de datos no es valida.'
    }
    $expectedDump = Get-NativeFullPath (Join-Path $CurrentRoot 'runtime\mariadb\bin\mariadb-dump.exe')
    $configuredDump = Get-NativeFullPath ([string]$Values.HOSPITAL_DUMP_BINARY)
    if (-not $configuredDump.Equals($expectedDump,[StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $expectedDump -PathType Leaf)) {
        throw 'La herramienta de respaldo no pertenece al runtime protegido.'
    }
    $expectedPaths = @{
        HOSPITAL_NATIVE_DATA_ROOT = $DataRoot
        LARAVEL_STORAGE_PATH = (Join-Path $DataRoot 'storage')
    }
    foreach ($name in $expectedPaths.Keys) {
        if (-not (Get-NativeFullPath ([string]$Values[$name])).Equals((Get-NativeFullPath ([string]$expectedPaths[$name])),[StringComparison]::OrdinalIgnoreCase)) {
            throw 'La configuracion contiene una ruta de runtime no valida.'
        }
    }
    $configRoot = Join-Path $DataRoot 'config'
    $administratorRoot = Join-Path $configRoot 'administrator-only'
    $disabledPhpScanRoot = Join-Path $administratorRoot 'php-scan-disabled'
    $elevatedCacheRoot = Join-Path $administratorRoot 'recovery-cache'
    foreach ($directory in @($administratorRoot,$disabledPhpScanRoot,$elevatedCacheRoot,(Join-Path $elevatedCacheRoot 'views'))) {
        if (-not (Test-Path -LiteralPath $directory -PathType Container)) { New-Item -ItemType Directory -Path $directory | Out-Null }
        Set-NativeRestrictedAcl -Path $directory
        Set-NativeAdministratorOwner -Path $directory
    }
    if (@(Get-ChildItem -LiteralPath $disabledPhpScanRoot -Force).Count -ne 0) { throw 'El directorio neutral de extensiones PHP no esta vacio.' }
    $extensionRoot = Get-NativeFullPath (Join-Path $CurrentRoot 'runtime\php\ext')
    $requiredExtensions = @('php_curl.dll','php_fileinfo.dll','php_gd.dll','php_intl.dll','php_mbstring.dll','php_openssl.dll','php_pdo_mysql.dll','php_sodium.dll','php_zip.dll','php_opcache.dll')
    foreach ($extension in $requiredExtensions) {
        if (-not (Test-Path -LiteralPath (Join-Path $extensionRoot $extension) -PathType Leaf)) { throw 'El runtime PHP protegido esta incompleto.' }
    }
    $recoveryIni = @"
[PHP]
expose_php=Off
display_errors=Off
log_errors=Off
memory_limit=256M
date.timezone=America/Tegucigalpa
extension_dir="$($extensionRoot.Replace('\','/'))"
extension=curl
extension=fileinfo
extension=gd
extension=intl
extension=mbstring
extension=openssl
extension=pdo_mysql
extension=sodium
extension=zip
zend_extension=opcache
opcache.enable_cli=0
"@
    $temporaryIni = $PhpIni + '.tmp-' + [guid]::NewGuid().ToString('N')
    try {
        [IO.File]::WriteAllText($temporaryIni,$recoveryIni,[Text.UTF8Encoding]::new($false))
        Set-NativeRestrictedAcl -Path $temporaryIni
        Set-NativeAdministratorOwner -Path $temporaryIni
        if (Test-Path -LiteralPath $PhpIni) { [IO.File]::Replace($temporaryIni,$PhpIni,$null,$true) }
        else { Move-Item -LiteralPath $temporaryIni -Destination $PhpIni }
    } finally { if (Test-Path -LiteralPath $temporaryIni) { Remove-Item -LiteralPath $temporaryIni -Force } }
    foreach ($protected in @($configRoot,$PhpIni,(Join-Path $configRoot 'hospital.env'),$administratorRoot,$disabledPhpScanRoot,$elevatedCacheRoot)) {
        if (-not (Test-NativeAdministratorControlled $protected)) { throw 'La configuracion elevada admite escritura no autorizada.' }
    }
    foreach ($name in $script:NativeAllowedEnvironmentNames) { [Environment]::SetEnvironmentVariable($name,$null,'Process') }
    foreach ($name in $Values.Keys) {
        [Environment]::SetEnvironmentVariable([string]$name, [string]$Values[$name], 'Process')
    }
    $safeCachePaths = @{
        APP_CONFIG_CACHE = (Join-Path $elevatedCacheRoot 'config.php')
        APP_EVENTS_CACHE = (Join-Path $elevatedCacheRoot 'events.php')
        APP_PACKAGES_CACHE = (Join-Path $elevatedCacheRoot 'packages.php')
        APP_ROUTES_CACHE = (Join-Path $elevatedCacheRoot 'routes.php')
        APP_SERVICES_CACHE = (Join-Path $elevatedCacheRoot 'services.php')
        VIEW_COMPILED_PATH = (Join-Path $elevatedCacheRoot 'views')
    }
    foreach ($name in $safeCachePaths.Keys) { [Environment]::SetEnvironmentVariable($name,[string]$safeCachePaths[$name],'Process') }
    [Environment]::SetEnvironmentVariable('PHPRC',$null,'Process')
    [Environment]::SetEnvironmentVariable('PHP_INI_SCAN_DIR',$disabledPhpScanRoot,'Process')
}

function Publish-NativeHospitalEnvironment([string]$Source, [string]$Destination, [string]$Database) {
    $contents = Get-Content -LiteralPath $Source -Raw
    $databaseLine = New-Object Text.RegularExpressions.Regex('(?m)^DB_DATABASE=.*$')
    $updated = $databaseLine.Replace($contents, "DB_DATABASE=$Database", 1)
    if ($updated -eq $contents -or $updated -notmatch "(?m)^DB_DATABASE=$([regex]::Escape($Database))$") {
        throw 'No se pudo preparar la configuracion recuperada.'
    }
    $temporary = $Destination + '.publish-' + [guid]::NewGuid().ToString('N')
    try {
        [IO.File]::WriteAllText($temporary, $updated, [Text.UTF8Encoding]::new($false))
        Set-NativeRestrictedAcl -Path $temporary
        # Publicacion atomica de hospital.env dentro de su directorio protegido.
        Move-Item -LiteralPath $temporary -Destination $Destination -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Stop-NativeWriters {
    foreach ($name in @('SHospitalWeb','SHospitalPhp','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')) {
        Stop-Service -Name $name -Force -ErrorAction Stop
    }
}

function Start-NativeWriters {
    foreach ($name in @('SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')) {
        Start-Service -Name $name -ErrorAction Stop
    }
}

function Assert-NativeRestoreHealth([hashtable]$Environment) {
    $services = @('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        $notRunning = @($services | Where-Object {
            $service = Get-Service -Name $_ -ErrorAction SilentlyContinue
            $null -eq $service -or $service.Status -ne 'Running'
        })
        if ($notRunning.Count -eq 0) { break }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($notRunning.Count -ne 0) { throw 'Los servicios nativos no recuperaron un estado saludable.' }

    $baseUrl = [string]$Environment['APP_URL']
    $uri = $null
    $validUri = -not [string]::IsNullOrWhiteSpace($baseUrl) -and [Uri]::TryCreate($baseUrl,[UriKind]::Absolute,[ref]$uri)
    if (-not $validUri -or $uri.Scheme -ne 'http' -or $uri.Host -ne '127.0.0.1' -or $uri.Port -lt 1 -or $uri.Port -gt 65535 -or $uri.AbsolutePath -ne '/' -or $uri.Query -ne '' -or $uri.Fragment -ne '' -or $uri.UserInfo -ne '') {
        throw 'APP_URL no esta configurada para comprobar la salud local.'
    }
    $healthUrl = $baseUrl.TrimEnd('/') + '/up'
    $httpDeadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ([int]$response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 1
    } while ([DateTime]::UtcNow -lt $httpDeadline)
    throw 'La aplicacion recuperada no respondio salud HTTP 200.'
}

$packagePath = [IO.Path]::GetFullPath($Package)
if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf) -or $packagePath -notmatch '\.sql\.gz\.enc$') {
    throw 'Seleccione un respaldo cifrado .sql.gz.enc valido.'
}
if (-not (Test-NativeRestoreDatabaseName $ValidationDatabase)) {
    throw 'El destino de validacion debe ser una base nueva, identificada y descartable.'
}
$actualSha = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha -cne $ExpectedSha256.ToLowerInvariant()) { throw 'La integridad SHA-256 del respaldo no coincide.' }

$plan = [ordered]@{
    mode = $Mode
    package_sha256 = $actualSha
    validation_database = $ValidationDatabase
    target_must_be_absent = $true
    replace_enabled = $true
    writes_performed = $false
    steps = @('verify-package','decrypt-private','prepare-portable-sql','create-new-validation-database','import','verify-data-triggers-write')
}
if ($Mode -eq 'Replace') {
    $plan.steps += @('create-preventive-backup','confirm-impact','stop-writers','grant-app-target','publish-config','restart-health','rollback-config-on-failure')
}
if ($WhatIf) {
    if ($Json) { $plan | ConvertTo-Json -Compress -Depth 5 } else { $plan }
    exit 0
}

if (-not (Test-NativeAdministrator)) { throw 'La recuperacion nativa requiere una consola elevada.' }
$canonicalRoots = Test-NativeCanonicalRoots -Install $InstallRoot -Data $DataRoot
if ($Mode -eq 'Replace' -and -not $canonicalRoots) {
    throw 'La sustitucion solo puede operar sobre la instalacion nativa canonica.'
}
if (-not (Test-NativePathNotBroadlyWritable $InstallRoot) -or -not (Test-NativePathNotBroadlyWritable $DataRoot)) {
    throw 'Las raices de validacion no tienen permisos suficientemente restringidos.'
}
$currentRoot = Join-Path $InstallRoot 'current'
$php = Join-Path $currentRoot 'runtime\php\php.exe'
$phpIni = Join-Path $DataRoot 'config\administrator-only\recovery-php.ini'
$client = Join-Path $currentRoot 'runtime\mariadb\bin\mariadb.exe'
$artisan = Join-Path $currentRoot 'app\backend\artisan'
$environmentPath = Join-Path $DataRoot 'config\hospital.env'
$adminSecretPath = Join-Path $DataRoot 'config\database-admin.dpapi'
foreach ($required in @($php,$client,$artisan,$environmentPath,$adminSecretPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw 'La instalacion nativa no contiene todos los componentes de recuperacion.' }
}
$currentItem = Get-Item -LiteralPath $currentRoot -Force
$currentTarget = if ($null -ne $currentItem.Target -and [string]$currentItem.Target -ne '') {
    $target = [string]$currentItem.Target
    if ([IO.Path]::IsPathRooted($target)) { Get-NativeFullPath $target } else { Get-NativeFullPath (Join-Path $currentItem.Parent.FullName $target) }
} else { Get-NativeFullPath $currentRoot }
$releasesRoot = (Get-NativeFullPath (Join-Path $InstallRoot 'releases')) + '\'
if (-not ($currentTarget + '\').StartsWith($releasesRoot,[StringComparison]::OrdinalIgnoreCase)) {
    throw 'El runtime activo no resuelve dentro de releases protegidos.'
}
$environment = Read-NativeEnvironment -Path $environmentPath
foreach ($requiredName in @('APP_URL','DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_APP_ACCOUNT_HOST','DB_PASSWORD','APP_KEY','HOSPITAL_BACKUP_ENCRYPTION_KEY')) {
    if (-not $environment.ContainsKey($requiredName) -or [string]::IsNullOrWhiteSpace([string]$environment[$requiredName])) {
        throw 'La configuracion nativa de recuperacion esta incompleta.'
    }
}
if ($environment.DB_DATABASE -eq $ValidationDatabase) { throw 'El destino de validacion coincide con la base activa.' }
if ($environment.DB_USERNAME -notmatch '^[A-Za-z0-9_]+$' -or $environment.DB_APP_ACCOUNT_HOST -notmatch '^[A-Za-z0-9_.:-]+$') {
    throw 'La identidad de base de datos configurada no es valida.'
}
Initialize-NativeRecoveryEnvironment -Values $environment -CurrentRoot $currentRoot -DataRoot $DataRoot -PhpIni $phpIni
$control = if ($Mode -eq 'Replace' -or $RecoveryKit -ne '') { Read-ControlRequest } else { @{} }
$confirmation = if ($control.ContainsKey('confirmation')) { [string]$control['confirmation'] } else { '' }
$reason = if ($control.ContainsKey('reason')) { [string]$control['reason'] } else { '' }
$passphrase = if ($control.ContainsKey('passphrase')) { [string]$control['passphrase'] } else { '' }
if ($Mode -eq 'Replace' -and ($confirmation -cne 'RESTAURAR' -or [string]::IsNullOrWhiteSpace($reason))) {
    throw 'La sustitucion requiere confirmacion protegida y motivo.'
}
if ($RecoveryKit -ne '' -and [string]::IsNullOrWhiteSpace($passphrase)) {
    throw 'El kit institucional requiere su frase protegida.'
}

$staging = Join-Path $DataRoot ('staging\restore-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Set-NativeRestrictedAcl -Path $staging
$defaults = Join-Path $staging 'database-admin.cnf'
$rawSql = Join-Path $staging 'decrypted.sql'
$portableSql = Join-Path $staging 'portable.sql'
$environmentCandidate = Join-Path (Split-Path -Parent $environmentPath) ('hospital.env.recovery-' + ([guid]::NewGuid().ToString('N').Substring(0,24)))
$configurationBackup = Join-Path $DataRoot ('state\hospital.env.before-restore-' + (Get-Date -Format 'yyyyMMddHHmmss'))
$writersStopped = $false
$configurationPublished = $false
$rootPassword = $null

try {
    $rootPassword = Unprotect-NativeMachineSecret -Path $adminSecretPath -Purpose 'database-admin'
    if ([string]::IsNullOrWhiteSpace($rootPassword) -or $rootPassword -match '[\x00\r\n]') {
        throw 'La credencial administrativa protegida no tiene un formato valido.'
    }
    $defaultsText = "[client]`nhost=$($environment.DB_HOST)`nport=$($environment.DB_PORT)`nuser=root`npassword=`"$($rootPassword.Replace('\\','\\\\').Replace('"','\"'))`"`n"
    [IO.File]::WriteAllText($defaults, $defaultsText, [Text.UTF8Encoding]::new($false))
    Set-NativeRestrictedAcl -Path $defaults
    $rootPassword = $null
    $defaultsText = $null

    $exists = Invoke-NativeSql -Client $client -Defaults $defaults -Sql "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '$ValidationDatabase';"
    if ($exists -ne '0') { throw 'La base de validacion ya existe; se requiere un destino nuevo.' }
    $createSql = "CREATE DATABASE ``$ValidationDatabase`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    Invoke-NativeSql -Client $client -Defaults $defaults -Sql $createSql | Out-Null

    $decryptArguments = @('-c',$phpIni,$artisan,'hospital:decrypt-backup',$packagePath,$rawSql)
    $controlJson = if ($RecoveryKit -ne '') { @{ passphrase = $passphrase } | ConvertTo-Json -Compress } else { '' }
    if ($RecoveryKit -ne '') { $decryptArguments += "--recovery-kit=$([IO.Path]::GetFullPath($RecoveryKit))" }
    Invoke-NativeProcess -FilePath $php -Arguments $decryptArguments -InputText $controlJson | Out-Null
    Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'hospital:prepare-portable-sql',$rawSql,$portableSql) | Out-Null
    Invoke-NativeProcess -FilePath $client -Arguments @("--defaults-extra-file=$defaults",$ValidationDatabase) -InputFile $portableSql | Out-Null

    $criticalTables = "'users','roles','permissions','services','invoices','invoice_items','payments','cash_register_sessions','cash_movements','backup_logs'"
    $tableCount = [int](Invoke-NativeSql -Client $client -Defaults $defaults -Sql "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$ValidationDatabase' AND TABLE_NAME IN ($criticalTables);")
    if ($tableCount -ne 10) { throw 'La restauracion no contiene todas las tablas criticas.' }
    $triggerCount = [int](Invoke-NativeSql -Client $client -Defaults $defaults -Sql "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA='$ValidationDatabase';")
    if ($triggerCount -lt 1) { throw 'La restauracion no contiene los triggers institucionales.' }
    $orphanDefiners = [int](Invoke-NativeSql -Client $client -Defaults $defaults -Sql "SELECT COUNT(*) FROM information_schema.TRIGGERS t LEFT JOIN mysql.user u ON CONCAT(u.User,'@',u.Host)=t.DEFINER WHERE t.TRIGGER_SCHEMA='$ValidationDatabase' AND u.User IS NULL;")
    if ($orphanDefiners -ne 0) { throw 'La restauracion contiene objetos con definidor inexistente.' }
    $orphanItems = [int](Invoke-NativeSql -Client $client -Defaults $defaults -Database $ValidationDatabase -Sql 'SELECT COUNT(*) FROM invoice_items i LEFT JOIN invoices v ON v.id=i.invoice_id WHERE v.id IS NULL;')
    $orphanPayments = [int](Invoke-NativeSql -Client $client -Defaults $defaults -Database $ValidationDatabase -Sql 'SELECT COUNT(*) FROM payments p LEFT JOIN invoices v ON v.id=p.invoice_id WHERE v.id IS NULL;')
    if ($orphanItems -ne 0 -or $orphanPayments -ne 0) { throw 'La restauracion no supera la integridad relacional.' }
    $probe = Invoke-NativeSql -Client $client -Defaults $defaults -Database $ValidationDatabase -Sql 'CREATE TEMPORARY TABLE restore_write_probe (id INT PRIMARY KEY); INSERT INTO restore_write_probe VALUES (1); SELECT COUNT(*) FROM restore_write_probe; DROP TEMPORARY TABLE restore_write_probe;'
    if (($probe -split "`r?`n" | Select-Object -Last 1) -ne '1') { throw 'La restauracion no supera la prueba reversible de escritura y lectura.' }

    $preventive = $null
    if ($Mode -eq 'Replace') {
        $backupResult = Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'hospital:backup','--type=manual','--json')
        $backupJson = @($backupResult.Output -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
        if ($backupJson.Count -ne 1) { throw 'No se obtuvo evidencia del respaldo preventivo.' }
        $preventive = $backupJson[0] | ConvertFrom-Json
        if ($preventive.status -ne 'success' -or [string]$preventive.checksum_sha256 -notmatch '^[a-f0-9]{64}$') {
            throw 'El respaldo preventivo no fue confirmado.'
        }
        $verifyResult = Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'hospital:verify-backup',[string]$preventive.backup_log_id,'--json')
        $verifyJson = @($verifyResult.Output -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1)
        if ($verifyJson.Count -ne 1) { throw 'No se obtuvo evidencia de integridad del respaldo preventivo.' }
        $preventiveVerification = $verifyJson[0] | ConvertFrom-Json
        if ($preventiveVerification.status -ne 'verified' -or $preventiveVerification.verification_scope -ne 'encrypted_file_integrity') {
            throw 'El respaldo preventivo no supero su verificacion cifrada completa.'
        }

        Copy-Item -LiteralPath $environmentPath -Destination $configurationBackup -Force
        Set-NativeRestrictedAcl -Path $configurationBackup
        Stop-NativeWriters
        $writersStopped = $true

        $grantSql = "GRANT ALL PRIVILEGES ON ``$ValidationDatabase``.* TO '$($environment.DB_USERNAME)'@'$($environment.DB_APP_ACCOUNT_HOST)'; FLUSH PRIVILEGES;"
        Invoke-NativeSql -Client $client -Defaults $defaults -Sql $grantSql | Out-Null
        $environmentSource = $environmentPath
        if ($RecoveryKit -ne '') {
            Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'hospital:apply-backup-recovery-kit',[IO.Path]::GetFullPath($RecoveryKit),$environmentPath,$environmentCandidate) -InputText $controlJson | Out-Null
            Set-NativeRestrictedAcl -Path $environmentCandidate
            $environmentSource = $environmentCandidate
        }
        Publish-NativeHospitalEnvironment -Source $environmentSource -Destination $environmentPath -Database $ValidationDatabase
        $configurationPublished = $true
        $environment = Read-NativeEnvironment -Path $environmentPath
        Initialize-NativeRecoveryEnvironment -Values $environment -CurrentRoot $currentRoot -DataRoot $DataRoot -PhpIni $phpIni
        Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'config:clear','--no-interaction') | Out-Null
        Start-NativeWriters
        $writersStopped = $false
        Assert-NativeRestoreHealth -Environment $environment
        Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'migrate:status','--no-interaction') | Out-Null
        Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'hospital:audit-catalog-rules') | Out-Null
    }

    $result = [ordered]@{
        status = if ($Mode -eq 'Replace') { 'restored' } else { 'validated' }
        mode = $Mode
        package_sha256 = $actualSha
        database = $ValidationDatabase
        critical_tables = $tableCount
        triggers = $triggerCount
        orphan_definers = $orphanDefiners
        write_read_probe = $true
        verification_scope = 'isolated_database_restore'
        restore_tested = $true
        preventive_backup_id = if ($null -ne $preventive) { $preventive.backup_log_id } else { $null }
        preventive_backup_verified = if ($null -ne $preventive) { $true } else { $null }
        previous_database_preserved = $true
        writes_performed = $true
    }
    if ($Json) { $result | ConvertTo-Json -Compress -Depth 4 } else { $result }
}
catch {
    if ($configurationPublished -and (Test-Path -LiteralPath $configurationBackup)) {
        try {
            if (-not $writersStopped) { Stop-NativeWriters; $writersStopped = $true }
            Copy-Item -LiteralPath $configurationBackup -Destination $environmentPath -Force
            Set-NativeRestrictedAcl -Path $environmentPath
            $environment = Read-NativeEnvironment -Path $environmentPath
            Initialize-NativeRecoveryEnvironment -Values $environment -CurrentRoot $currentRoot -DataRoot $DataRoot -PhpIni $phpIni
            Invoke-NativeProcess -FilePath $php -Arguments @('-c',$phpIni,$artisan,'config:clear','--no-interaction') | Out-Null
            Start-NativeWriters
            $writersStopped = $false
        } catch {
            throw 'La recuperacion fallo y el rollback de configuracion requiere intervencion tecnica.'
        }
    } elseif ($writersStopped) {
        try { Start-NativeWriters; $writersStopped = $false } catch { }
    }
    throw
}
finally {
    $rootPassword = $null
    foreach ($path in @($defaults,$rawSql,$portableSql,$environmentCandidate,$phpIni)) {
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    }
    if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue }
}
