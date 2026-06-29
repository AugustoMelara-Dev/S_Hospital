#Requires -Version 5.1
<#
.SYNOPSIS
    Restaurar base de datos Hospital desde backup SQL cifrado.

.DESCRIPTION
    Script guiado para restaurar la base de datos desde un archivo .sql.enc, .sql o .tar.gz.
    ADVERTENCIA: Este script sobreescribe datos. Usar solo en base de datos de PRUEBA.

.PARAMETER BackupFile
    Ruta al archivo de backup .sql.enc, .sql o .tar.gz

.PARAMETER ExpectedSha256
    SHA256 esperado del archivo de backup original. Obligatorio para restaurar.

.PARAMETER TargetDatabase
    Nombre de la base de datos destino (default: hospital_billing_test)

.PARAMETER UseExistingEnv
    Usa la configuracion de backend\.env existente para conexion

.EXAMPLE
    .\restore_hospital_windows.ps1 -BackupFile "C:\backups\hospital_2026-06-01.sql.enc" -ExpectedSha256 "<sha256>"
#>

param(
    [Parameter(Mandatory=$false)]
    [switch]$SelfTest,

    [Parameter(Mandatory=$false)]
    [switch]$WhatIf,

    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "",

    [Parameter(Mandatory=$false)]
    [string]$ExpectedSha256 = "",

    [Parameter(Mandatory=$false)]
    [string]$TargetDatabase = "hospital_billing_test",

    [Parameter(Mandatory=$false)]
    [switch]$UseExistingEnv,

    [Parameter(Mandatory=$false)]
    [switch]$ForceProductionRestore
)

$ErrorActionPreference = "Stop"
$script:ExitCode = 0
$script:DecryptedSqlPath = ""
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backendEnvPath = Join-Path $projectRoot "backend\.env"

function Write-Step {
    param([string]$Message)
    Write-Host "[ETAPA] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    $script:ExitCode = 1
}

function Get-MySqlClient {
    $searchPaths = @(
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mariadb\bin\mysql.exe",
        "C:\Program Files\MariaDB*\bin\mysql.exe",
        "C:\Program Files\MySQL\MySQL Server*\bin\mysql.exe",
        "C:\wamp64\bin\mysql\mysql*\bin\mysql.exe",
        "mysql.exe"
    )

    foreach ($path in $searchPaths) {
        if ($path -match '\*') {
            $found = Get-ChildItem $path -ErrorAction SilentlyContinue | Sort-Object -Descending | Select-Object -First 1
            if ($found) {
                return $found.FullName
            }
        } elseif (Test-Path $path) {
            return $path
        }
    }

    $pathClient = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($pathClient) {
        return $pathClient.Source
    }

    return $null
}

function New-MySqlDefaultsFile {
    param([hashtable]$DbConfig)

    $path = [System.IO.Path]::GetTempFileName()
    $password = ([string]$DbConfig.Password).Replace('\', '\\').Replace('"', '\"')
    $content = @(
        "[client]",
        "host=$($DbConfig.Host)",
        "port=$($DbConfig.Port)",
        "user=$($DbConfig.Username)",
        "password=""$password"""
    ) -join "`n"

    Set-Content -LiteralPath $path -Value $content -Encoding ASCII -NoNewline

    try {
        $acl = Get-Acl -LiteralPath $path
        $acl.SetAccessRuleProtection($true, $false)
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, "FullControl", "Allow")
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $path -AclObject $acl
    } catch {
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        Write-Error "No se pudo restringir ACL del defaults file temporal. Riesgo de filtracion de credenciales abortado."
        exit 1
    }

    return $path
}

function Remove-MySqlDefaultsFile {
    param([string]$Path)

    if ($Path -and (Test-Path -LiteralPath $Path)) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
}

function Get-ConfigValue {
    param(
        [hashtable]$Config,
        [string]$Key,
        [string]$Default
    )

    if ($Config.ContainsKey($Key) -and $null -ne $Config[$Key] -and [string]$Config[$Key] -ne "") {
        return [string]$Config[$Key]
    }

    return $Default
}

function Get-DatabaseConfig {
    param([string]$EnvPath = $backendEnvPath)

    if (-not (Test-Path $EnvPath)) {
        return $null
    }

    $config = @{}
    Get-Content $EnvPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $config[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }

    return @{
        Host = Get-ConfigValue $config 'DB_HOST' '127.0.0.1'
        Port = Get-ConfigValue $config 'DB_PORT' '3306'
        Database = Get-ConfigValue $config 'DB_DATABASE' 'hospital_billing'
        Username = Get-ConfigValue $config 'DB_USERNAME' 'hospital'
        Password = Get-ConfigValue $config 'DB_PASSWORD' ''
    }
}

function Test-DisposableDatabaseName {
    param(
        [string]$Database,
        [switch]$ForceProduction
    )

    if ($Database -notmatch '^[A-Za-z0-9_]+$') {
        return $false
    }

    $lower = $Database.ToLowerInvariant()
    
    if ($lower -in @('hospital_billing', 'hospital_billing_production')) {
        return [bool]$ForceProduction
    }
    
    if ($lower -in @('mysql', 'information_schema', 'performance_schema', 'sys')) {
        return $false
    }

    return $lower -match '(test|validation|restore|disposable|proof)'
}

function Test-SafeMysqlArgument {
    param([string]$Value)

    return $Value -match '^[A-Za-z0-9_.:-]+$'
}

function Assert-SafeConnectionConfig {
    param(
        [hashtable]$Config,
        [switch]$ForceProduction
    )

    if (-not (Test-SafeMysqlArgument ([string]$Config.Host))) {
        Write-Error "Host de base de datos contiene caracteres no permitidos."
        exit 1
    }

    if ([string]$Config.Port -notmatch '^\d{1,5}$') {
        Write-Error "Puerto de base de datos invalido."
        exit 1
    }

    if (-not (Test-SafeMysqlArgument ([string]$Config.Username))) {
        Write-Error "Usuario de base de datos contiene caracteres no permitidos."
        exit 1
    }

    if (-not (Test-DisposableDatabaseName -Database ([string]$Config.Database) -ForceProduction:$ForceProduction)) {
        Write-Error "La base de datos '$($Config.Database)' no parece ser de prueba o no se uso el flag --ForceProductionRestore."
        Write-Error "Use un nombre como 'hospital_billing_test' o 'hospital_restore_validation', o agregue -ForceProductionRestore si esta seguro."
        exit 1
    }
}

function Invoke-SelfTest {
    Write-Step "Ejecutando self-test de restore seguro"

    $tempEnv = Join-Path $env:TEMP "hospital-restore-selftest.env"
    Set-Content -LiteralPath $tempEnv -Value @(
        "DB_HOST=192.168.1.10",
        "DB_PORT=3307",
        "DB_DATABASE=hospital_billing",
        "DB_USERNAME=hospital_user",
        "DB_PASSWORD=secret-value"
    ) -Encoding ASCII

    $config = Get-DatabaseConfig -EnvPath $tempEnv
    Remove-Item $tempEnv -Force -ErrorAction SilentlyContinue

    if ($config.Host -ne "192.168.1.10" -or $config.Port -ne "3307" -or $config.Username -ne "hospital_user" -or $config.Password -ne "secret-value") {
        Write-Error "Self-test fallo: parseo .env incorrecto."
        exit 1
    }

    if (-not (Test-DisposableDatabaseName "hospital_restore_validation")) {
        Write-Error "Self-test fallo: base descartable valida fue rechazada."
        exit 1
    }

    foreach ($db in @("hospital_billing", "hospital_billing_production", "mysql", "hospital-prod", "hospital")) {
        if (Test-DisposableDatabaseName $db) {
            Write-Error "Self-test fallo: base insegura aceptada: $db"
            exit 1
        }
    }

    $safeConfig = @{
        Host = "127.0.0.1"
        Port = "3306"
        Database = "hospital_restore_validation"
        Username = "hospital_user"
        Password = "ignored"
    }
    Assert-SafeConnectionConfig $safeConfig

    Write-Success "Self-test completado. No se tocaron bases ni backups."
    exit 0
}

if ($SelfTest) {
    Invoke-SelfTest
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  RESTAURACION DE BASE DE DATOS" -ForegroundColor Magenta
Write-Host "  SISTEMA CAJA HOSPITALARIA" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

Write-Warning "ADVERTENCIA: Este proceso sobreescribe datos."
Write-Warning "Usar SOLO en base de datos de prueba o desarrollo."
Write-Host ""

if (-not (Test-DisposableDatabaseName -Database $TargetDatabase -ForceProduction:$ForceProductionRestore)) {
    Write-Error "No se puede restaurar a '$TargetDatabase'."
    Write-Error "Use una base descartable con nombre como 'hospital_billing_test' o 'hospital_restore_validation', o agregue -ForceProductionRestore si esta seguro."
    exit 1
}

if (-not $UseExistingEnv -and -not $BackupFile) {
    Write-Step "Ingrese la ruta del archivo de backup (.sql o .tar.gz)"
    $BackupFile = Read-Host "Ruta del backup"
}

if ($BackupFile) {
    $BackupFile = [System.IO.Path]::GetFullPath($BackupFile)
    if (-not (Test-Path $BackupFile)) {
        Write-Error "Archivo de backup no encontrado: $BackupFile"
        exit 1
    }

    if ($BackupFile -notmatch '\.(sql|sql\.enc|tar\.gz)$') {
        Write-Error "Formato de backup no permitido. Use .sql, .sql.enc o .tar.gz."
        exit 1
    }

    if ([string]::IsNullOrWhiteSpace($ExpectedSha256)) {
        Write-Error "Debe proporcionar -ExpectedSha256 con el hash SHA256 esperado del archivo de backup antes de restaurar."
        exit 1
    }

    if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') {
        Write-Error "ExpectedSha256 no tiene formato SHA256 valido."
        exit 1
    }

    $actualSha256 = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
        Write-Error "SHA256 del backup no coincide. Restore bloqueado."
        exit 1
    }
    Write-Success "SHA256 verificado antes del restore"
}

Write-Step "Buscando cliente MySQL/MariaDB..."
$mysqlExe = Get-MySqlClient
if (-not $mysqlExe) {
    Write-Error "No se encontro mysql.exe. Instale XAMPP, MariaDB o MySQL."
    Write-Error "O agregue mysql.exe al PATH del sistema."
    exit 1
}
Write-Success "Cliente encontrado: $mysqlExe"

$dbConfig = $null
if ($UseExistingEnv) {
    Write-Step "Leyendo configuracion de backend\.env..."
    $dbConfig = Get-DatabaseConfig
    if (-not $dbConfig) {
        Write-Error "No se pudo leer backend\.env"
        exit 1
    }
    $dbConfig.Database = $TargetDatabase
    Write-Success "Configuracion leida"
} else {
    Write-Step "Ingrese configuracion de base de datos:"
    $dbConfig = @{
        Host = Read-Host "Host (default: 127.0.0.1)"
        Port = Read-Host "Puerto (default: 3306)"
        Database = "hospital_billing"
        Username = Read-Host "Usuario (default: root)"
        Password = Read-Host "Password" -AsSecureString
    }
    $dbConfig.Host = if ($dbConfig.Host) { $dbConfig.Host } else { "127.0.0.1" }
    $dbConfig.Port = if ($dbConfig.Port) { $dbConfig.Port } else { "3306" }
    $dbConfig.Username = if ($dbConfig.Username) { $dbConfig.Username } else { "root" }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbConfig.Password)
    try {
        $dbConfig.Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $dbConfig.Database = $TargetDatabase
}

Write-Step "Verificando que '$($dbConfig.Database)' sea base permitida..."
Assert-SafeConnectionConfig -Config $dbConfig -ForceProduction:$ForceProductionRestore

if ($BackupFile -and $WhatIf) {
    Write-Warning "WhatIf activo: SHA256 verificado, cliente/config validada y restore omitido antes de crear, descifrar o modificar la base."
    exit 0
}

if ($BackupFile -and $BackupFile -match '\.tar\.gz$') {
    Write-Step "Expandiendo archivo tar.gz..."
    try {
        $tempDir = Join-Path $env:TEMP "hospital_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        $details = tar -tvf $BackupFile
        foreach ($line in $details) {
            if ($line -match '^l' -or $line -match '^h' -or $line -match '\s+->\s+') {
                Write-Error "Riesgo de enlace simbolico (symlink/hardlink) detectado en el archivo tar."
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                exit 1
            }
        }
        $contents = tar -tf $BackupFile
        foreach ($file in $contents) {
            if ($file -match '\.\.' -or $file -match '^[/\\]' -or $file -match '^[a-zA-Z]:') {
                Write-Error "Riesgo de path traversal detectado en el archivo tar."
                Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
                exit 1
            }
        }
        tar -xzf $BackupFile -C $tempDir
        $sqlFiles = Get-ChildItem $tempDir -Filter "*.sql"
        if ($sqlFiles) {
            $BackupFile = $sqlFiles[0].FullName
        } else {
            Write-Error "No se encontro archivo .sql dentro del tar.gz"
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }
        Write-Success "Archivo expandido"
    } catch {
        Write-Error "Error al expandir tar.gz: $_"
        exit 1
    }
}

if ($BackupFile -and $BackupFile -match '\.sql\.enc$') {
    Write-Step "Descifrando backup cifrado a SQL temporal..."
    $artisan = Join-Path $projectRoot "backend\artisan"
    if (-not (Test-Path -LiteralPath $artisan)) {
        Write-Error "No se encontro backend\artisan para descifrar el backup con APP_KEY local."
        exit 1
    }

    $decryptedSql = Join-Path $env:TEMP "hospital_restore_$(Get-Date -Format 'yyyyMMddHHmmss')_$([Guid]::NewGuid().ToString('N')).sql"
    & php $artisan hospital:decrypt-backup $BackupFile $decryptedSql
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $decryptedSql)) {
        Write-Error "No se pudo descifrar el backup cifrado."
        exit 1
    }
    $script:DecryptedSqlPath = $decryptedSql
    $BackupFile = $decryptedSql
    Write-Success "Backup descifrado temporalmente para importacion controlada"
}

Write-Step "Creando base de datos '$($dbConfig.Database)' si no existe..."
$createDbCmd = "CREATE DATABASE IF NOT EXISTS ``$($dbConfig.Database)`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$mysqlDefaultsFile = New-MySqlDefaultsFile $dbConfig

try {
    & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile -e $createDbCmd 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Error al crear base de datos"
        exit 1
    }
    Write-Success "Base de datos lista"

    if ($BackupFile) {
        Write-Step "Restaurando backup desde: $BackupFile"
        Write-Host "Esto puede tomar varios minutos..." -ForegroundColor Yellow

        $restoreCommand = """$mysqlExe"" --defaults-extra-file=""$mysqlDefaultsFile"" --default-character-set=utf8mb4 ""$($dbConfig.Database)"" < ""$BackupFile"" 2>&1"
        & cmd /c $restoreCommand
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Error al restaurar backup"
            exit 1
        }
        Write-Success "Backup restaurado exitosamente"
    } else {
        Write-Step "Restauracion manual requerida."
        Write-Host "Ejecute el siguiente comando en una terminal:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "mysql --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) --default-character-set=utf8mb4 ""$($dbConfig.Database)"" < backup.sql" -ForegroundColor Cyan
        Write-Host ""
    }

    Write-Step "Verificando datos restaurados..."
    $tableCountCmd = "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ``$($dbConfig.Database)``;"
    $tableCount = & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile --batch --skip-column-names -e $tableCountCmd 2>&1
    if ($tableCount -as [int] -gt 0) {
        Write-Success "Base de datos restaurada con $tableCount tablas"
    } else {
        Write-Warning "No se pudo verificar el conteo de tablas"
    }

    Write-Step "Verificando tablas criticas..."
    $criticalTables = @('users', 'services', 'invoices', 'payments', 'backup_logs')
    foreach ($table in $criticalTables) {
        $countCmd = "SELECT COUNT(*) FROM ``$($dbConfig.Database)``.``$table``;"
        $count = & $mysqlExe --defaults-extra-file=$mysqlDefaultsFile --batch --skip-column-names -e $countCmd 2>&1
        if ($count -as [int] -ge 0) {
            Write-Success "  $table : $count registros"
        } else {
            Write-Warning "  $table : no verificado"
        }
    }

    Write-Host ""
    if ($script:ExitCode -eq 0) {
        Write-Success "RESTAURACION COMPLETADA"
        Write-Host ""
        Write-Host "Base de datos: $($dbConfig.Database)" -ForegroundColor Green
        Write-Host "Host: $($dbConfig.Host):$($dbConfig.Port)" -ForegroundColor Green
    } else {
        Write-Error "RESTAURACION FALLIDA - Revise los errores arriba"
    }
    Write-Host ""
} finally {
    Remove-MySqlDefaultsFile $mysqlDefaultsFile
    if ($script:DecryptedSqlPath -and (Test-Path -LiteralPath $script:DecryptedSqlPath)) {
        Remove-Item -LiteralPath $script:DecryptedSqlPath -Force -ErrorAction SilentlyContinue
    }
}

exit $script:ExitCode
