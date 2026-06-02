#Requires -Version 5.1
<#
.SYNOPSIS
    Restaurar base de datos Hospital desde backup SQL.

.DESCRIPTION
    Script guiado para restaurar la base de datos desde un archivo .sql o .tar.gz.
    ADVERTENCIA: Este script sobreescribe datos. Usar solo en base de datos de PRUEBA.

.PARAMETER BackupFile
    Ruta al archivo de backup .sql o .tar.gz

.PARAMETER TargetDatabase
    Nombre de la base de datos destino (default: hospital_billing_test)

.PARAMETER UseExistingEnv
    Usa la configuracion de backend\.env existente para conexion

.EXAMPLE
    .\restore_hospital_windows.ps1 -BackupFile "C:\backups\hospital_2026-06-01.sql"
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$BackupFile = "",

    [Parameter(Mandatory=$false)]
    [string]$TargetDatabase = "hospital_billing_test",

    [Parameter(Mandatory=$false)]
    [switch]$UseExistingEnv
)

$ErrorActionPreference = "Stop"
$script:ExitCode = 0

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

    return $null
}

function Get-DatabaseConfig {
    $envPath = "C:\Projects\S_Hospital\backend\.env"

    if (-not (Test-Path $envPath)) {
        return $null
    }

    $config = @{}
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $config[$Matches[1].Trim()] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }

    return @{
        Host = $config['DB_HOST'] ?? '127.0.0.1'
        Port = $config['DB_PORT'] ?? '3306'
        Database = $config['DB_DATABASE'] ?? 'hospital_billing'
        Username = $config['DB_USERNAME'] ?? 'hospital'
        Password = $config['DB_PASSWORD'] ?? ''
    }
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

if ($TargetDatabase -eq "hospital_billing" -or $TargetDatabase -eq "hospital_billing_production") {
    Write-Error "No se puede restaurar a la base de datos de produccion '$TargetDatabase'."
    Write-Error "Use un nombre diferente como 'hospital_billing_test'."
    exit 1
}

if (-not $UseExistingEnv -and -not $BackupFile) {
    Write-Step "Ingrese la ruta del archivo de backup (.sql o .tar.gz)"
    $BackupFile = Read-Host "Ruta del backup"
}

if ($BackupFile -and -not (Test-Path $BackupFile)) {
    Write-Error "Archivo de backup no encontrado: $BackupFile"
    exit 1
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
    $dbConfig.Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    $dbConfig.Database = $TargetDatabase
}

if ($BackupFile -and $BackupFile -match '\.tar\.gz$') {
    Write-Step "Expandiendo archivo tar.gz..."
    try {
        $tempDir = Join-Path $env:TEMP "hospital_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
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

Write-Step "Verificando que '$($dbConfig.Database)' sea base de prueba..."
if ($dbConfig.Database -notmatch 'test|validation|restore|disposable|proof?') {
    Write-Error "La base de datos '$($dbConfig.Database)' no parece ser de prueba."
    Write-Error "Use un nombre como 'hospital_billing_test' o 'hospital_restore_validation'."
    exit 1
}

Write-Step "Creando base de datos '$($dbConfig.Database)' si no existe..."
$createDbCmd = "CREATE DATABASE IF NOT EXISTS ``$($dbConfig.Database)`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$env:MYSQL_PWD = $dbConfig.Password
& $mysqlExe --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) -e $createDbCmd 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Error al crear base de datos"
    exit 1
}
Write-Success "Base de datos lista"

if ($BackupFile) {
    Write-Step "Restaurando backup desde: $BackupFile"
    Write-Host "Esto puede tomar varios minutos..." -ForegroundColor Yellow

    & cmd /c "$mysqlExe --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) --default-character-set=utf8mb4 ""$($dbConfig.Database)"" < ""$BackupFile"" 2>&1"
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
$tableCount = & $mysqlExe --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) --batch --skip-column-names -e $tableCountCmd 2>&1
if ($tableCount -as [int] -gt 0) {
    Write-Success "Base de datos restaurada con $tableCount tablas"
} else {
    Write-Warning "No se pudo verificar el conteo de tablas"
}

Write-Step "Verificando tablas criticas..."
$criticalTables = @('users', 'services', 'invoices', 'payments', 'backup_logs')
foreach ($table in $criticalTables) {
    $countCmd = "SELECT COUNT(*) FROM ``$($dbConfig.Database)``.``$table``;"
    $count = & $mysqlExe --host=$($dbConfig.Host) --port=$($dbConfig.Port) --user=$($dbConfig.Username) --batch --skip-column-names -e $countCmd 2>&1
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

exit $script:ExitCode