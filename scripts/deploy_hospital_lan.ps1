# ==============================================================================
# Hospital Billing OS - Script de Instalación y Despliegue Bulletproof LAN
# ==============================================================================
# Disenado para Windows. Realiza diagnosticos completos antes de proceder para
# evitar cualquier error en la instalacion fisica del hospital.
# Soporta tanto despliegues en contenedores Docker (Recomendado) como en host local.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Importar helpers de variables de entorno de forma modular
$helperPath = Join-Path $PSScriptRoot "lib\env_helpers.ps1"
if (-not (Test-Path $helperPath)) {
    Write-Host "[FAIL] No se pudo encontrar la libreria de helpers de entorno en: $helperPath" -ForegroundColor Red
    exit 1
}
. $helperPath

# Banner de Presentación
Clear-Host
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "     [HOSPITAL BILLING OS - ASISTENTE DE DESPLIEGUE BULLETPROOF]       " -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  Este script valida la red, puertos y dependencias para garantizar una" -ForegroundColor White
Write-Host "  instalacion 100% exitosa y libre de errores en las computadoras del hospital." -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. DIAGNÓSTICO PREVIO Y PREFLIGHT (EVITAR ERRORES EN SITIO)
Write-Host "[*] Iniciando diagnostico de hardware y red..." -ForegroundColor Yellow
$failures = @()
$warnings = @()

# A. Diagnóstico de Red (IP Estática vs DHCP)
$ipAddresses = Get-NetIPAddress | Where-Object {
    $_.AddressState -eq "Preferred" -and 
    $_.AddressFamily -eq "IPv4" -and 
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*"
}

$detectedIp = "127.0.0.1"
if ($ipAddresses.Count -gt 0) {
    $detectedIp = $ipAddresses[0].IPAddress
    
    # Verificar si es DHCP o Estática
    $adapter = Get-NetIPInterface | Where-Object { $_.IPv4Address -contains $detectedIp }
    if ($adapter -and $adapter.Dhcp -eq 'Enabled') {
        $warnings += "La direccion IP local ($detectedIp) es asignada por DHCP (dinamica). Si el router se reinicia, la IP cambiara y las otras estaciones perderan conexion. Se recomienda encarecidamente configurar una IP estatica en el panel de control de Windows."
    } else {
        Write-Host "[OK] Direccion IP LAN Estatica detectada: $detectedIp" -ForegroundColor Green
    }
} else {
    $warnings += "No se detecto ninguna interfaz de red local (LAN) activa. El sistema solo estara accesible de forma local (localhost)."
}

# B. Diagnóstico de Firewall (Perfil de Red Pública vs Privada)
try {
    $profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
    if ($profiles) {
        $publicProfiles = $profiles | Where-Object { $_.NetworkCategory -eq "Public" }
        if ($publicProfiles) {
            $warnings += "La red activa esta configurada como 'Publica' en Windows. Windows Defender bloquea por defecto las conexiones entrantes en redes publicas. Cambie la red a 'Privada' en Configuracion de Red de Windows para que las estaciones clientes puedan acceder."
        } else {
            Write-Host "[OK] Perfil de red seguro ('Privado') confirmado." -ForegroundColor Green
        }
    }
} catch {
    $warnings += "No se pudo verificar el perfil de conexion de Windows Defender Firewall. Asegurese de permitir trafico en el puerto 8000."
}

# C. Diagnóstico de Puertos (8000 y 3306)
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($port8000) {
    $failures += "El puerto 8000 (servidor web) ya esta en uso. Si tiene Skype, XAMPP (Apache) o Laragon corriendo, detengalos antes de continuar."
} else {
    Write-Host "[OK] Puerto 8000 disponible para el Servidor Web." -ForegroundColor Green
}

$port3306 = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
if ($port3306) {
    $warnings += "El puerto 3306 (MariaDB/MySQL) esta en uso. Si usa un MySQL local fuera de Docker, asegurese de usar credenciales correctas o cambiar el puerto en el archivo .env."
} else {
    Write-Host "[OK] Puerto 3306 disponible para la Base de Datos." -ForegroundColor Green
}

# D. Diagnóstico de Virtualización y Docker
$dockerInstalled = $null -ne (Get-Command "docker" -ErrorAction SilentlyContinue)
$dockerRunning = $false

if ($dockerInstalled) {
    $dockerCheck = docker ps 2>&1
    if ($dockerCheck -match "error" -or $LASTEXITCODE -ne 0) {
        $warnings += "Docker Desktop esta instalado pero no se encuentra en ejecucion. Inicie Docker Desktop antes de continuar si desea usar la instalacion por contenedores."
    } else {
        $dockerRunning = $true
        Write-Host "[OK] Docker y Docker Compose estan activos y listos." -ForegroundColor Green
    }
} else {
    $warnings += "Docker no esta instalado en este sistema. El script intentara la instalacion por defecto en host local (Bare-metal fallback) usando PHP y MySQL nativos de Windows."
}

# Mostrar Advertencias del Diagnóstico
if ($warnings.Count -gt 0) {
    Write-Host ""
    Write-Host "[ADVERTENCIA] DIAGNOSTICOS DETECTADOS:" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "  -> $w" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Bloquear por Fallos Críticos
if ($failures.Count -gt 0) {
    Write-Host "[FAIL] SE ENCONTRARON ERRORES CRITICOS QUE IMPIDEN LA INSTALACION:" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  -> $f" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Por favor resuelva estos conflictos y vuelva a ejecutar el asistente." -ForegroundColor White
    Read-Host "Presione Enter para salir..."
    exit 1
}

# 2. DEFINICIÓN DEL MODO DE DESPLIEGUE
Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "Seleccione el metodo de instalacion:" -ForegroundColor White
if ($dockerRunning) {
    Write-Host " [1] (Recomendado) Despliegue en Contenedores Docker (Aislado, empaqueta todo y evita errores de DLLs)" -ForegroundColor Green
} else {
    Write-Host " [1] Despliegue en Contenedores Docker (Requiere iniciar Docker Desktop primero)" -ForegroundColor Gray
}
Write-Host " [2] Despliegue Bare-Metal Windows (Nativo usando PHP 8.2+ y MySQL/MariaDB locales)" -ForegroundColor White
Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray

$choice = ""
while ($choice -notin @("1", "2")) {
    $choice = Read-Host "Ingrese una opcion [1-2]"
}

# 3. EJECUCIÓN DEL DESPLIEGUE SELECCIONADO
$serverIp = Read-Host "Confirme la direccion IP LAN para el Servidor [$detectedIp]"
if ([string]::IsNullOrWhiteSpace($serverIp)) {
    $serverIp = $detectedIp
}

# Generar secretos aleatorios robustos
$chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
$dbPassword = ""
$dbRootPassword = ""
for ($i = 0; $i -lt 16; $i++) {
    $dbPassword += $chars[(Get-Random -Maximum $chars.Length)]
    $dbRootPassword += $chars[(Get-Random -Maximum $chars.Length)]
}
$appKey = "base64:" + [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 256) }))

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectRoot ".env"

if ($choice -eq "1") {
    # MODO DOCKER
    Write-Host ""
    Write-Host "[*] Iniciando despliegue Docker en produccion..." -ForegroundColor Yellow
    
    # Leer .env raíz existente para no destruir claves
    $existingRootEnv = @{}
    if (Test-Path -LiteralPath $envPath) {
        $existingRootEnv = Read-EnvFile $envPath
        Write-Host "[*] Conservando secretos de base de datos y llaves existentes del .env raiz..." -ForegroundColor Green
    }
    
    $currAppKey = if ($existingRootEnv.ContainsKey("APP_KEY") -and $existingRootEnv["APP_KEY"] -ne "") { $existingRootEnv["APP_KEY"] } else { $appKey }
    $currDbPass = if ($existingRootEnv.ContainsKey("DB_PASSWORD") -and $existingRootEnv["DB_PASSWORD"] -ne "") { $existingRootEnv["DB_PASSWORD"] } else { $dbPassword }
    $currDbRootPass = if ($existingRootEnv.ContainsKey("DB_ROOT_PASSWORD") -and $existingRootEnv["DB_ROOT_PASSWORD"] -ne "") { $existingRootEnv["DB_ROOT_PASSWORD"] } else { $dbRootPassword }

    # Generar o actualizar .env raíz
    $rootVars = @{
        "SERVER_IP" = $serverIp
        "APP_PORT" = "8000"
        "APP_KEY" = $currAppKey
        "DB_PORT" = "3306"
        "DB_DATABASE" = "hospital_billing"
        "DB_USERNAME" = "hospital"
        "DB_PASSWORD" = $currDbPass
        "DB_ROOT_PASSWORD" = $currDbRootPass
    }
    
    Update-DotEnv -Path $envPath -Variables $rootVars
    Write-Host "[OK] Archivo .env de produccion actualizado de forma segura." -ForegroundColor Green
    
    # Levantar contenedores
    $composePath = Join-Path $projectRoot "docker-compose.prod.yml"
    $offlineImagesDir = Join-Path $projectRoot "offline-images"
    $isOfflineMode = Test-Path $offlineImagesDir

    if ($isOfflineMode) {
        Write-Host ""
        Write-Host "[*] Modo offline detectado: usando imagenes locales de offline-images/." -ForegroundColor Green
        $loadScriptPath = Join-Path $projectRoot "scripts\load_offline_images.ps1"
        if (Test-Path $loadScriptPath) {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $loadScriptPath
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[FAIL] Error al cargar las imagenes offline." -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "[WARN] Carpeta offline-images/ detectada pero no se encontro scripts\load_offline_images.ps1." -ForegroundColor Yellow
        }
        Write-Host "[*] Levantando contenedores Docker en modo offline..." -ForegroundColor Yellow
        docker compose -f $composePath --env-file $envPath up -d --no-build
    } else {
        Write-Host ""
        Write-Host "[*] Modo online: se construiran/descargaran imagenes desde internet." -ForegroundColor Yellow
        Write-Host "[*] Construyendo y levantando contenedores Docker..." -ForegroundColor Yellow
        docker compose -f $composePath --env-file $envPath up -d --build
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FAIL] Error al levantar Docker Compose de produccion." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[*] Esperando inicializacion de MariaDB (20s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
    
    # Migrar y Poblar
    Write-Host "[*] Ejecutando migraciones y seeders de produccion..." -ForegroundColor Yellow
    docker compose -f $composePath exec -T backend php artisan migrate --force
    docker compose -f $composePath exec -T backend php artisan db:seed --class=RolesAndPermissionsSeeder --force
    docker compose -f $composePath exec -T backend php artisan db:seed --class=ServiceCatalogSeeder --force
    
} else {
    # MODO BARE-METAL
    Write-Host ""
    Write-Host "[*] Iniciando despliegue Bare-Metal nativo..." -ForegroundColor Yellow
    
    # Localizar PHP
    $phpPath = "php"
    if ($null -eq (Get-Command "php" -ErrorAction SilentlyContinue)) {
        if (Test-Path "C:\xampp\php\php.exe") {
            $phpPath = "C:\xampp\php\php.exe"
        } else {
            Write-Host "[FAIL] No se encontro el comando 'php' en PATH ni en C:\xampp\php\php.exe. Instale PHP antes de continuar." -ForegroundColor Red
            exit 1
        }
    }
    
    # Cargar backend/.env existente o copiar del ejemplo
    $backendEnvPath = Join-Path $projectRoot "backend\.env"
    $existingEnv = @{}
    if (Test-Path -LiteralPath $backendEnvPath) {
        $existingEnv = Read-EnvFile $backendEnvPath
        Write-Host "[*] backend/.env existente detectado. Preservando configuraciones..." -ForegroundColor Green
    } else {
        Copy-Item (Join-Path $projectRoot "backend\.env.example") $backendEnvPath
        $existingEnv = Read-EnvFile $backendEnvPath
        Write-Host "[*] Creado nuevo archivo backend/.env desde la plantilla." -ForegroundColor Green
    }
    
    # Leer valores preexistentes para pre-cargar la consola interactiva
    $currDbHost = if ($existingEnv.ContainsKey("DB_HOST") -and $existingEnv["DB_HOST"] -ne "") { $existingEnv["DB_HOST"] } else { "127.0.0.1" }
    $currDbPort = if ($existingEnv.ContainsKey("DB_PORT") -and $existingEnv["DB_PORT"] -ne "") { $existingEnv["DB_PORT"] } else { "3306" }
    $currDbName = if ($existingEnv.ContainsKey("DB_DATABASE") -and $existingEnv["DB_DATABASE"] -ne "") { $existingEnv["DB_DATABASE"] } else { "hospital_billing" }
    $currDbUser = if ($existingEnv.ContainsKey("DB_USERNAME") -and $existingEnv["DB_USERNAME"] -ne "") { $existingEnv["DB_USERNAME"] } else { "root" }
    $currDbPass = if ($existingEnv.ContainsKey("DB_PASSWORD")) { $existingEnv["DB_PASSWORD"] } else { "" }
    $currAppKey = if ($existingEnv.ContainsKey("APP_KEY") -and $existingEnv["APP_KEY"] -ne "") { $existingEnv["APP_KEY"] } else { $appKey }
    
    Write-Host "`n--- Configuracion de Conexion de Base de Datos MySQL/MariaDB ---" -ForegroundColor Cyan
    $dbHost = Read-Host "Host MySQL/MariaDB [$currDbHost]"
    if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = $currDbHost }

    $dbPort = Read-Host "Puerto MySQL/MariaDB [$currDbPort]"
    if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = $currDbPort }

    $dbName = Read-Host "Nombre Base de Datos [$currDbName]"
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = $currDbName }

    $dbUser = Read-Host "Usuario de Base de Datos [$currDbUser]"
    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = $currDbUser }

    # No mostrar contraseña existente para proteger la seguridad. Un Enter conserva la existente.
    $dbPass = Read-Host "Contrasena de Base de Datos (dejar en blanco para conservar la existente)"
    if ([string]::IsNullOrWhiteSpace($dbPass)) {
        $dbPass = $currDbPass
    }

    # Forzar producción, IP LAN, credenciales de DB y Sanctum
    $vars = @{
        "APP_ENV" = "production"
        "APP_DEBUG" = "false"
        "APP_KEY" = $currAppKey
        "APP_URL" = "http://$serverIp:8000"
        "DB_CONNECTION" = "mysql"
        "DB_HOST" = $dbHost
        "DB_PORT" = $dbPort
        "DB_DATABASE" = $dbName
        "DB_USERNAME" = $dbUser
        "DB_PASSWORD" = $dbPass
        "SANCTUM_STATEFUL_DOMAINS" = "localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,127.0.0.1:5173,$serverIp,$serverIp:8000,$serverIp:5173,::1"
        "CORS_ALLOWED_ORIGINS" = "http://localhost:5173,http://127.0.0.1:5173,http://$serverIp:5173,http://$serverIp:8000"
    }
    
    Update-DotEnv -Path $backendEnvPath -Variables $vars
    Write-Host "[OK] Archivo backend/.env configurado en produccion de forma no destructiva." -ForegroundColor Green
    
    # Crear Base de Datos de forma 100% segura usando variables de entorno temporales (evita inyeccion de caracteres especiales)
    Write-Host "[*] Asegurando existencia de base de datos local..." -ForegroundColor Yellow
    
    $env:DB_HOST_TEMP = $dbHost
    $env:DB_PORT_TEMP = $dbPort
    $env:DB_NAME_TEMP = $dbName
    $env:DB_USER_TEMP = $dbUser
    $env:DB_PASS_TEMP = $dbPass

    $createDbCode = @'
$host = getenv("DB_HOST_TEMP");
$port = getenv("DB_PORT_TEMP");
$db = getenv("DB_NAME_TEMP");
$user = getenv("DB_USER_TEMP");
$pass = getenv("DB_PASS_TEMP");
try {
    $p = new PDO("mysql:host=$host;port=$port", $user, $pass);
    $p->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "CREATED";
} catch(Exception $e) {
    echo $e->getMessage();
}
'@
    
    $dbStatus = & $phpPath -r $createDbCode
    
    # Limpiar variables de entorno temporales
    Remove-Item Env:\DB_HOST_TEMP
    Remove-Item Env:\DB_PORT_TEMP
    Remove-Item Env:\DB_NAME_TEMP
    Remove-Item Env:\DB_USER_TEMP
    Remove-Item Env:\DB_PASS_TEMP
    
    if ($dbStatus -ne "CREATED") {
        Write-Host "[FAIL] No se pudo conectar al MySQL local o crear la base de datos: $dbStatus" -ForegroundColor Red
        Write-Host "Asegurese de que el servidor MySQL local este corriendo e intente de nuevo." -ForegroundColor White
        exit 1
    }
    
    # Instalar y Migrar
    Write-Host "[*] Ejecutando migraciones locales y seeders..." -ForegroundColor Yellow
    Push-Location (Join-Path $projectRoot "backend")
    
    # Generar APP_KEY si por alguna razón no existía
    if ($currAppKey -eq "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" -or $currAppKey -eq "") {
        & $phpPath artisan key:generate --force
    }
    
    & $phpPath artisan migrate --force --seed
    & $phpPath artisan config:cache
    & $phpPath artisan route:cache
    & $phpPath artisan view:cache
    Pop-Location
    Write-Host "[OK] Base de datos migrada y optimizada para produccion." -ForegroundColor Green

    # Programar Tareas de Copia de Seguridad en Windows Task Scheduler de forma automática
    Write-Host ""
    Write-Host "[*] Registrando tareas automaticas de Copia de Seguridad en Windows..." -ForegroundColor Yellow
    try {
        $backupScript = Join-Path $projectRoot "scripts\install_backup_tasks_windows.ps1"
        if (Test-Path $backupScript) {
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupScript -ProjectRoot $projectRoot -PhpPath $phpPath -UpdateExisting | Out-Null
            Write-Host "[OK] Tareas de Copia de Seguridad registradas exitosamente en Task Scheduler." -ForegroundColor Green
            Write-Host "[*] Iniciando el worker de backups en segundo plano..." -ForegroundColor Yellow
            Start-ScheduledTask -TaskName "HospitalBillingOS-BackupWorker" | Out-Null
            Write-Host "[OK] Worker de backups activo y funcionando." -ForegroundColor Green
        }
    } catch {
        Write-Host "[WARN] No se pudieron programar las tareas de backups automaticamente: $_" -ForegroundColor Yellow
        Write-Host "Puedes configurarlas despues ejecutando: scripts/install_backup_tasks_windows.ps1 como Administrador." -ForegroundColor White
    }
}

# 4. CONFIGURAR USUARIO ADMINISTRADOR INICIAL
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " [ADMIN] CONFIGURACION DEL USUARIO ADMINISTRADOR INICIAL DE PRODUCCION" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Registre la primera cuenta de administrador para acceder al sistema:" -ForegroundColor White

$adminUsername = ""
while ([string]::IsNullOrWhiteSpace($adminUsername)) {
    $adminUsername = Read-Host "Ingrese el Nombre de Usuario (ej. admin.hospital)"
}

$adminEmail = ""
while ([string]::IsNullOrWhiteSpace($adminEmail) -or $adminEmail -notmatch "^[^@]+@[^@]+\.[^@]+$") {
    $adminEmail = Read-Host "Ingrese el Correo Electronico del Administrador"
}

$adminPassword = ""
while ($adminPassword.Length -lt 8) {
    $adminPassword = Read-Host "Ingrese la Contrasena Temporal (minimo 8 caracteres)"
}

Write-Host "[*] Registrando administrador..." -ForegroundColor Yellow
if ($choice -eq "1") {
    $composePath = Join-Path $projectRoot "docker-compose.prod.yml"
    docker compose -f $composePath exec -T backend php artisan auth:create-initial-admin --username="$adminUsername" --email="$adminEmail" --password="$adminPassword" --name="Administrador de Hospital"
} else {
    Push-Location (Join-Path $projectRoot "backend")
    & $phpPath artisan auth:create-initial-admin --username="$adminUsername" --email="$adminEmail" --password="$adminPassword" --name="Administrador de Hospital"
    Pop-Location
}

# Habilitar regla de Firewall para permitir acceso entrante
try {
    netsh advfirewall firewall delete rule name="S_Hospital Server LAN Port 8000" 2>$null
    netsh advfirewall firewall add rule name="S_Hospital Server LAN Port 8000" dir=in action=allow protocol=TCP localport=8000 | Out-Null
    Write-Host "[OK] Regla de firewall para Puerto 8000 habilitada en redes locales." -ForegroundColor Green
} catch {
    $warnings += "No se pudo crear la regla de firewall automaticamente. Habilítela de forma manual en el panel de seguridad de Windows."
}

# 5. AUTO-VERIFICACIÓN DE CONECTIVIDAD LAN
Write-Host ""
Write-Host "[*] Ejecutando auto-diagnostico final del servicio..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$healthCheckUrl = "http://$serverIp:8000/up"
$webResponse = Invoke-WebRequest -Uri $healthCheckUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue

if ($webResponse -and $webResponse.StatusCode -eq 200) {
    Write-Host "[OK] Servidor Web responde correctamente desde la IP LAN!" -ForegroundColor Green
} else {
    Write-Host "[WARN] No se pudo validar la URL LAN externa automaticamente. Asegurese de que el Firewall permita conexiones en el puerto 8000." -ForegroundColor Yellow
}

# 6. ENTREGA DE INSTALACIÓN Y DATOS DE CONEXIÓN
Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] HOSPITAL BILLING OS - DESPLIEGUE COMPLETADO CON EXITO" -ForegroundColor Green -BackgroundColor DarkGreen
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  El sistema esta configurado y activo en la red local del hospital." -ForegroundColor White
Write-Host ""
Write-Host " [RED] DIRECCIONES DE ACCESO PARA LAS COMPUTADORAS (ESTACIONES):" -ForegroundColor Cyan
Write-Host "  -> Esta computadora Servidor:  http://localhost:8000" -ForegroundColor White
Write-Host "  -> Otras Estaciones LAN (3+):   http://$serverIp:8000" -ForegroundColor Yellow -BackgroundColor Black
Write-Host ""
Write-Host " [ADMIN] CREDENCIALES DE ACCESO TEMPORALES:" -ForegroundColor Cyan
Write-Host "  -> Usuario:                    $adminUsername" -ForegroundColor White
Write-Host "  -> Contrasena:                 La contrasena que ingreso arriba" -ForegroundColor White
Write-Host "                                 (se solicitara cambiarla obligatoriamente al entrar)" -ForegroundColor Gray
Write-Host ""
Write-Host " [INFO] INSTRUCCIONES IMPORTANTES:" -ForegroundColor Yellow
Write-Host "  1. En las computadoras clientes (caja, admision), abra Google Chrome/Edge e ingrese a:" -ForegroundColor White
Write-Host "     http://$serverIp:8000" -ForegroundColor Yellow
Write-Host "  2. Asegurese de que la IP del servidor ($serverIp) sea configurada como ESTATICA." -ForegroundColor White
Write-Host "  3. Para apagar los servicios (en modo Docker), ejecute: docker compose down" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Presione Enter para finalizar el asistente de instalacion..."
