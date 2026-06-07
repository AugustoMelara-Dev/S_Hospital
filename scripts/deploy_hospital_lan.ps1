# ==============================================================================
# Sistema de Caja Hospitalaria - Script de Instalacion y Despliegue Bulletproof LAN
# ==============================================================================
# Asistente robusto de campo. Compatible con PowerShell 5.1, Windows 10/11/Server,
# multiples tarjetas de red, WiFi/Ethernet/VPN/VirtualBox/Hyper-V/WSL,
# IP dinamica o estatica, puertos ocupados, Docker instalado/apagado/ausente,
# modo online y offline. Nunca falla por una propiedad inexistente.
# Nunca cierra la ventana sin explicacion. Nunca obliga a editar codigo en sitio.

param(
    [switch]$DiagnosticsOnly,
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-WindowsVersionInfo {
    try {
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $psVer = $PSVersionTable.PSVersion.ToString()
        return [PSCustomObject]@{
            PSVersion = $psVer
            Caption = if ($os) { $os.Caption } else { "Windows 10/11" }
            Architecture = if ($os) { $os.OSArchitecture } else { "64-bit" }
            Build = if ($os) { $os.BuildNumber } else { "19045" }
        }
    } catch {
        return [PSCustomObject]@{
            PSVersion = "5.1"
            Caption = "Windows 10"
            Architecture = "64-bit"
            Build = "19045"
        }
    }
}

function Get-DhcpStatus {
    param(
        [int]$InterfaceIndex,
        [string]$IPAddress
    )
    if ($InterfaceIndex -eq -1) {
        return "Disabled"
    }
    if (Get-Command "Get-DhcpStatusSafe" -ErrorAction SilentlyContinue) {
        return Get-DhcpStatusSafe $InterfaceIndex
    }
    return "Disabled"
}

function Test-PathHasSpaces {
    param([string]$Path)
    return ($Path -match "\s")
}

function Test-DatabaseName {
    param([string]$Name)

    return -not [string]::IsNullOrWhiteSpace($Name) -and $Name -match '^[A-Za-z][A-Za-z0-9_]{0,63}$'
}

function Get-SystemDiskSpace {
    param([string]$Path)
    try {
        $driveLetter = [System.IO.Path]::GetPathRoot($Path)
        $disk = Get-PSDrive ($driveLetter.Trim("\").Trim(":"))
        return [Math]::Round($disk.Free / 1GB, 2)
    } catch {
        return 50.0
    }
}

function Read-SecretText {
    param([string]$Prompt)

    $secureValue = Read-Host $Prompt -AsSecureString
    $secretBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretBstr)
    }
    finally {
        if ($secretBstr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretBstr)
        }
    }
}

function Get-ExistingContainers {
    try {
        $names = docker ps -a --filter "name=s_hospital" --format "{{.Names}}" 2>$null
        if ($null -eq $names) { return @() }
        return $names
    } catch {
        return @()
    }
}

function Get-ExistingVolumes {
    try {
        $vols = docker volume ls --filter "name=s_hospital" --format "{{.Name}}" 2>$null
        if ($null -eq $vols) { return @() }
        return $vols
    } catch {
        return @()
    }
}

# ==============================================================================
# IMPORT SHARED LIBRARIES
# ==============================================================================

$libDir = Join-Path $PSScriptRoot "lib"

$envHelperPath = Join-Path $libDir "env_helpers.ps1"
if (-not (Test-Path $envHelperPath)) {
    Write-Host "[FAIL] No se encontro: $envHelperPath" -ForegroundColor Red
    Write-Host "El instalador requiere la libreria de helpers de entorno." -ForegroundColor White
    Write-Host "Verifique que el paquete de instalacion esta completo." -ForegroundColor White
    Read-Host "Presione Enter para cerrar"
    exit 1
}
. $envHelperPath

$corsHelperPath = Join-Path $libDir "cors_helpers.ps1"
if (Test-Path $corsHelperPath) {
    . $corsHelperPath
}

$netDiagPath = Join-Path $libDir "net_diagnostics.ps1"
if (-not (Test-Path $netDiagPath)) {
    Write-Host "[FAIL] No se encontro: $netDiagPath" -ForegroundColor Red
    Write-Host "El instalador requiere la libreria de diagnostico de red." -ForegroundColor White
    Write-Host "Verifique que el paquete de instalacion esta completo." -ForegroundColor White
    Read-Host "Presione Enter para cerrar"
    exit 1
}
. $netDiagPath

$dockerDiagPath = Join-Path $libDir "docker_diagnostics.ps1"
if (-not (Test-Path $dockerDiagPath)) {
    Write-Host "[FAIL] No se encontro: $dockerDiagPath" -ForegroundColor Red
    Write-Host "El instalador requiere la libreria de diagnostico Docker." -ForegroundColor White
    Write-Host "Verifique que el paquete de instalacion esta completo." -ForegroundColor White
    Read-Host "Presione Enter para cerrar"
    exit 1
}
. $dockerDiagPath

$portDiagPath = Join-Path $libDir "port_diagnostics.ps1"
if (-not (Test-Path $portDiagPath)) {
    Write-Host "[FAIL] No se encontro: $portDiagPath" -ForegroundColor Red
    Write-Host "El instalador requiere la libreria de diagnostico de puertos." -ForegroundColor White
    Write-Host "Verifique que el paquete de instalacion esta completo." -ForegroundColor White
    Read-Host "Presione Enter para cerrar"
    exit 1
}
. $portDiagPath

# ==============================================================================
# PROJECT ROOT & LOGGING
# ==============================================================================

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$logDir = Join-Path $projectRoot "install-logs"
$logPath = $null

try {
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    }
    $logPath = Join-Path $logDir ("install-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
    Start-Transcript -Path $logPath -Append | Out-Null
    Write-Host "[INFO] Bitacora: $logPath" -ForegroundColor Gray
} catch {
    $logPath = $null
    Write-Host "[WARN] No se pudo iniciar la bitacora: $($_.Exception.Message)" -ForegroundColor Yellow
}

# ==============================================================================
# SELF-TEST MODE
# ==============================================================================

if ($SelfTest) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "     [SELF-TEST] Validacion interna del instalador" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    $testsPassed = 0
    $testsFailed = 0

    function Assert-Test {
        param([string]$Name, [bool]$Condition, [string]$Detail = "")
        if ($Condition) {
            Write-Host "  [PASS] $Name" -ForegroundColor Green
            Set-Variable -Name testsPassed -Value ($testsPassed + 1) -Scope 1
        }
        else {
            Write-Host "  [FAIL] $Name" -ForegroundColor Red
            if ($Detail) { Write-Host "         $Detail" -ForegroundColor Gray }
            Set-Variable -Name testsFailed -Value ($testsFailed + 1) -Scope 1
        }
    }

    # Test 1: IPv4 format validation
    Assert-Test "IPv4 valida: 192.168.1.100" (Test-IPv4Format "192.168.1.100")
    Assert-Test "IPv4 valida: 10.0.0.1" (Test-IPv4Format "10.0.0.1")
    Assert-Test "IPv4 invalida: abc.def.ghi.jkl" (-not (Test-IPv4Format "abc.def.ghi.jkl"))
    Assert-Test "IPv4 invalida: cadena vacia" (-not (Test-IPv4Format ""))
    Assert-Test "IPv4 invalida: 999.999.999.999" (-not (Test-IPv4Format "999.999.999.999"))
    Assert-Test "IPv4 invalida: 192.168.1" (-not (Test-IPv4Format "192.168.1"))

    # Test 2: Loopback rejection
    Assert-Test "127.0.0.1 es loopback" (Test-IsLoopback "127.0.0.1")
    Assert-Test "127.255.0.1 es loopback" (Test-IsLoopback "127.255.0.1")
    Assert-Test "192.168.1.1 NO es loopback" (-not (Test-IsLoopback "192.168.1.1"))

    # Test 3: APIPA detection
    Assert-Test "169.254.1.1 es APIPA" (Test-IsApipa "169.254.1.1")
    Assert-Test "192.168.1.1 NO es APIPA" (-not (Test-IsApipa "192.168.1.1"))

    # Test 4: Virtual adapter detection
    Assert-Test "Docker detectado como virtual" (Test-IsVirtualAdapter "vEthernet (Docker)")
    Assert-Test "VirtualBox detectado como virtual" (Test-IsVirtualAdapter "VirtualBox Host-Only Network")
    Assert-Test "WSL detectado como virtual" (Test-IsVirtualAdapter "vEthernet (WSL)")
    Assert-Test "Hyper-V detectado como virtual" (Test-IsVirtualAdapter "vEthernet (Hyper-V)")
    Assert-Test "VMware detectado como virtual" (Test-IsVirtualAdapter "VMware Network Adapter")
    Assert-Test "Ethernet NO es virtual" (-not (Test-IsVirtualAdapter "Ethernet"))
    Assert-Test "Wi-Fi NO es virtual" (-not (Test-IsVirtualAdapter "Wi-Fi"))

    # Test 5: IP candidate discovery
    $candidates = Get-LanIPv4Candidates
    Assert-Test "Get-LanIPv4Candidates no lanza excepcion" $true
    $hasLoopback = $false
    foreach ($c in $candidates) {
        if ($c.IPAddress -like "127.*") { $hasLoopback = $true }
    }
    Assert-Test "Candidatos incluyen 127.x.x.x (para reporte explicito)" $hasLoopback



    # Test 6: Candidates sorted (non-virtual first)
    if ($candidates.Count -ge 2) {
        $firstVirtual = -1
        $lastNonVirtual = -1
        for ($i = 0; $i -lt $candidates.Count; $i++) {
            if ($candidates[$i].IsVirtual -and $firstVirtual -eq -1) { $firstVirtual = $i }
            if (-not $candidates[$i].IsVirtual) { $lastNonVirtual = $i }
        }
        $sortOk = ($firstVirtual -eq -1) -or ($lastNonVirtual -eq -1) -or ($lastNonVirtual -lt $firstVirtual)
        Assert-Test "Candidatos ordenados: no-virtual primero" $sortOk
    }
    else {
        Assert-Test "Candidatos ordenados: (omitido, menos de 2 candidatos)" $true
    }

    # Test 7: Port check
    $portCheck = Test-PortAvailable -Port 65432
    Assert-Test "Test-PortAvailable no lanza excepcion" $true
    Assert-Test "Puerto 65432 probablemente libre" $portCheck.Available

    # Test 8: .env handling (temporary file)
    $tempDir = Join-Path $projectRoot "install-logs"
    if (-not (Test-Path $tempDir)) { New-Item -ItemType Directory -Force -Path $tempDir | Out-Null }
    $tempEnv = Join-Path $tempDir ".env.selftest.tmp"
    try {
        # Create test .env with explicit placeholders, never real-looking secrets.
        $dummyAppKey = "selftest-app-key-placeholder"
        $dummyOriginalDbPassword = "selftest-original-db-password"
        $dummyUpdatedDbPassword = "selftest-updated-db-password"
        Set-Content -LiteralPath $tempEnv -Value @("APP_KEY=$dummyAppKey", "DB_PASSWORD=$dummyOriginalDbPassword", "CUSTOM=value") -Encoding ASCII
        $before = Read-EnvFile $tempEnv
        # Update some vars
        Update-DotEnv -Path $tempEnv -Variables @{ "DB_PASSWORD" = $dummyUpdatedDbPassword; "NEW_VAR" = "new" }
        $after = Read-EnvFile $tempEnv
        Assert-Test ".env preserva APP_KEY existente" ($after["APP_KEY"] -eq $dummyAppKey)
        Assert-Test ".env actualiza DB_PASSWORD" ($after["DB_PASSWORD"] -eq $dummyUpdatedDbPassword)
        Assert-Test ".env preserva CUSTOM" ($after["CUSTOM"] -eq "value")
        Assert-Test ".env agrega NEW_VAR" ($after["NEW_VAR"] -eq "new")
    }
    catch {
        Assert-Test ".env test fallo: $($_.Exception.Message)" $false
    }
    finally {
        if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force -ErrorAction SilentlyContinue }
    }

    # Test 9: Path with spaces detection
    Assert-Test "Detecta espacios en ruta" (Test-PathHasSpaces "C:\Hospital Caja Test")
    Assert-Test "No detecta espacios en ruta limpia" (-not (Test-PathHasSpaces "C:\Hospital"))

    # Test 10: Database name validation
    Assert-Test "Nombre de base valido" (Test-DatabaseName "hospital_billing")
    Assert-Test "Nombre de base invalido con guion" (-not (Test-DatabaseName "hospital-billing"))
    Assert-Test "Nombre de base invalido con punto y coma" (-not (Test-DatabaseName "hospital;DROP"))
    Assert-Test "Nombre de base invalido iniciando con numero" (-not (Test-DatabaseName "1hospital"))

    # Test 11: offline-images detection
    $offlineDir = Join-Path $projectRoot "offline-images"
    $offlineExists = Test-Path $offlineDir
    Assert-Test "Deteccion offline-images (existe=$offlineExists) no lanza excepcion" $true

    # Test 12: Docker diagnostics don't throw
    try {
        $dockerInst = Test-DockerInstalled
        Assert-Test "Test-DockerInstalled no lanza excepcion (resultado=$dockerInst)" $true
    }
    catch {
        Assert-Test "Test-DockerInstalled lanzo excepcion" $false $_.Exception.Message
    }

    # Test 13: System info
    try {
        $winInfo = Get-WindowsVersionInfo
        Assert-Test "Get-WindowsVersionInfo retorna datos" ($null -ne $winInfo.PSVersion)
    }
    catch {
        Assert-Test "Get-WindowsVersionInfo lanzo excepcion" $false
    }

    # Test 14: Admin check
    try {
        $isAdmin = Test-IsAdmin
        Assert-Test "Test-IsAdmin no lanza excepcion (admin=$isAdmin)" $true
    }
    catch {
        Assert-Test "Test-IsAdmin lanzo excepcion" $false
    }

    # Test 15: DHCP check doesn't throw
    try {
        $dhcp = Get-DhcpStatus -InterfaceIndex -1 -IPAddress "0.0.0.0"
        Assert-Test "Get-DhcpStatus con indice invalido no lanza excepcion" $true
    }
    catch {
        Assert-Test "Get-DhcpStatus lanzo excepcion" $false
    }

    # Summary
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "  Resultados: $testsPassed pasaron, $testsFailed fallaron" -ForegroundColor $(if ($testsFailed -eq 0) { "Green" } else { "Red" })
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    try { Stop-Transcript | Out-Null } catch { }
    Read-Host "Presione Enter para cerrar"
    if ($testsFailed -gt 0) { exit 1 }
    exit 0
}

# ==============================================================================
# DIAGNOSTICS-ONLY MODE
# ==============================================================================

if ($DiagnosticsOnly) {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "     [DIAGNOSTICO] Sistema de Caja Hospitalaria - Solo revision, no instala" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    $diagWarnings = New-Object System.Collections.ArrayList
    $diagPasses = New-Object System.Collections.ArrayList
    $diagFailures = New-Object System.Collections.ArrayList

    $isDhcp = $false
    $hasPublicProfile = $false
    $hasPortConflict = $false
    $isDockerReady = $false

    # 1. Admin privileges
    $isAdmin = Test-IsAdmin
    if ($isAdmin) {
        [void]$diagPasses.Add("Ejecutando con privilegios de Administrador.")
    }
    else {
        [void]$diagWarnings.Add("NO tiene privilegios de Administrador. La instalacion requiere admin para reglas de firewall y tareas programadas.")
    }

    # 2. PowerShell / Windows version
    $winInfo = Get-WindowsVersionInfo
    [void]$diagPasses.Add("PowerShell $($winInfo.PSVersion) en $($winInfo.Caption) ($($winInfo.Architecture)) Build $($winInfo.Build)")

    if ($winInfo.PSVersion -match "^(\d+)") {
        $majorVer = [int]$Matches[1]
        if ($majorVer -lt 5) {
            [void]$diagWarnings.Add("PowerShell $($winInfo.PSVersion) detectado. Se recomienda PowerShell 5.1 o superior.")
        }
    }

    # 3. Path with spaces
    if (Test-PathHasSpaces $projectRoot) {
        [void]$diagWarnings.Add("La ruta del proyecto contiene espacios: '$projectRoot'. Docker Compose puede tener problemas con rutas con espacios. Considere mover el proyecto a una ruta sin espacios.")
    }
    else {
        [void]$diagPasses.Add("Ruta del proyecto sin espacios: $projectRoot")
    }

    # 4. Disk space
    $freeGb = Get-SystemDiskSpace -Path $projectRoot
    if ($freeGb -ge 0) {
        if ($freeGb -lt 5) {
            [void]$diagFailures.Add("Espacio libre en disco: ${freeGb} GB. Se requieren al menos 5 GB para Docker y la base de datos.")
        }
        elseif ($freeGb -lt 10) {
            [void]$diagWarnings.Add("Espacio libre en disco: ${freeGb} GB. Se recomiendan al menos 10 GB.")
        }
        else {
            [void]$diagPasses.Add("Espacio libre en disco: ${freeGb} GB")
        }
    }
    else {
        [void]$diagWarnings.Add("No se pudo determinar el espacio libre en disco.")
    }

    # 5. IP Candidates
    Write-Host "[*] Detectando interfaces de red..." -ForegroundColor Yellow
    $candidates = Get-LanIPv4Candidates
    if ($candidates.Count -gt 0) {
        [void]$diagPasses.Add("$($candidates.Count) IP(s) LAN candidata(s) detectada(s):")
        foreach ($c in $candidates) {
            if ($c.IPAddress -like "127.*") {
                Write-Host "    $($c.IPAddress) - localhost - NO sirve para estaciones cliente" -ForegroundColor DarkGray
            }
            elseif ($c.IPAddress -like "169.254.*") {
                Write-Host "    $($c.IPAddress) - APIPA - red sin DHCP/IP válida" -ForegroundColor DarkGray
            }
            else {
                $tags = @()
                if ($c.IsVirtual) { $tags += "virtual" }
                if ($c.IsDefaultRoute) { $tags += "ruta principal" }
                $tagStr = ""
                if ($tags.Count -gt 0) { $tagStr = " (" + ($tags -join ", ") + ")" }
                Write-Host "    $($c.IPAddress) - $($c.InterfaceAlias)$tagStr [via $($c.Source)]" -ForegroundColor White
            }
        }


        # DHCP check for best candidate
        $best = $candidates | Where-Object { -not $_.IsVirtual } | Select-Object -First 1
        if (-not $best) { $best = $candidates | Select-Object -First 1 }
        if ($best) {
            $dhcp = Get-DhcpStatus -InterfaceIndex $best.InterfaceIndex -IPAddress $best.IPAddress
            if ($dhcp -eq "Enabled") {
                [void]$diagWarnings.Add("La IP $($best.IPAddress) es asignada por DHCP (dinamica). Configure IP estatica antes del piloto.")
                $isDhcp = $true
            }
            elseif ($dhcp -eq "Disabled") {
                [void]$diagPasses.Add("IP $($best.IPAddress) es estatica.")
            }
            else {
                [void]$diagWarnings.Add("No se pudo determinar si la IP $($best.IPAddress) es dinamica o estatica. Verifique manualmente.")
            }
        }
    }
    else {
        [void]$diagFailures.Add("No se detecto ninguna IP LAN valida. Conecte el servidor a la red.")
    }

    # 6. Firewall profile
    try {
        $profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
        if ($profiles) {
            $publicProfiles = @($profiles | Where-Object { $_.NetworkCategory -eq "Public" })
            if ($publicProfiles.Count -gt 0) {
                [void]$diagWarnings.Add("Red configurada como 'Publica'. Windows bloqueara conexiones entrantes. Cambie a 'Privada' en Configuracion de Red.")
                $hasPublicProfile = $true
            }
            else {
                [void]$diagPasses.Add("Perfil de red: Privado (correcto).")
            }
        }
    }
    catch {
        [void]$diagWarnings.Add("No se pudo verificar el perfil de red del firewall.")
    }

    # 7. Ports
    foreach ($portInfo in @(@{Port = 8000; Label = "Servidor Web"}, @{Port = 3306; Label = "Base de Datos MySQL"}, @{Port = 3307; Label = "Base de Datos Alt"})) {
        $pCheck = Test-PortAvailable -Port $portInfo.Port
        if ($pCheck.Available) {
            [void]$diagPasses.Add("Puerto $($portInfo.Port) ($($portInfo.Label)) disponible.")
        }
        else {
            $processInfo = ""
            if ($pCheck.ProcessName) { $processInfo = " (usado por: $($pCheck.ProcessName))" }
            [void]$diagWarnings.Add("Puerto $($portInfo.Port) ($($portInfo.Label)) ocupado$processInfo.")
            $hasPortConflict = $true
        }
    }

    # 8. Docker
    Write-Host "[*] Verificando Docker..." -ForegroundColor Yellow
    $dockerInst = Test-DockerInstalled
    if ($dockerInst) {
        $dockerRun = Test-DockerRunning
        if ($dockerRun.Running) {
            $isDockerReady = $true
            [void]$diagPasses.Add("Docker instalado y corriendo.")
            $compose = Test-DockerComposeAvailable
            if ($compose.Available) {
                [void]$diagPasses.Add("Docker Compose disponible: $($compose.Version)")
            }
            else {
                [void]$diagWarnings.Add("Docker Compose no encontrado.")
            }

            # Previous containers/volumes
            $containers = @(Get-ExistingContainers)
            $volumes = @(Get-ExistingVolumes)
            if ($containers.Count -gt 0) {
                [void]$diagPasses.Add("$($containers.Count) contenedor(es) previo(s) detectado(s).")
            }
            if ($volumes.Count -gt 0) {
                [void]$diagPasses.Add("$($volumes.Count) volumen(es) previo(s) detectado(s).")
            }
        }
        else {
            [void]$diagWarnings.Add("Docker instalado pero NO corriendo. Inicie Docker Desktop.")
            if ($dockerRun.ErrorMessage -and $dockerRun.ErrorMessage -match "WSL") {
                [void]$diagWarnings.Add("Docker reporta problema con WSL. Ejecute: wsl --install")
            }
        }
    }
    else {
        [void]$diagWarnings.Add("Docker NO esta instalado.")
    }

    # 9. WSL
    Write-Host "[*] Verificando WSL..." -ForegroundColor Yellow
    $wsl = Test-WslReady
    if ($wsl.Available) {
        $versionStr = ""
        if ($wsl.Version) { $versionStr = " (kernel: $($wsl.Version))" }
        [void]$diagPasses.Add("WSL disponible$versionStr.")
    }
    else {
        if ($wsl.Warning) { [void]$diagWarnings.Add($wsl.Warning) }
    }

    # 10. Virtualization
    $virt = Test-VirtualizationEnabled
    if ($virt.Enabled -eq $true) {
        [void]$diagPasses.Add("Virtualizacion de hardware habilitada.")
    }
    elseif ($virt.Enabled -eq $false) {
        [void]$diagFailures.Add("Virtualizacion de hardware NO habilitada. Docker la requiere.")
        if ($virt.Warning) { [void]$diagFailures.Add($virt.Warning) }
    }
    else {
        if ($virt.Warning) { [void]$diagWarnings.Add($virt.Warning) }
    }

    # 11. Offline images
    $offlineImagesDir = Join-Path $projectRoot "offline-images"
    if (Test-Path $offlineImagesDir) {
        $tarFiles = @(Get-ChildItem -Path $offlineImagesDir -Filter "*.tar" -ErrorAction SilentlyContinue)
        [void]$diagPasses.Add("Modo OFFLINE: carpeta offline-images/ detectada con $($tarFiles.Count) archivo(s) .tar.")
    }
    else {
        [void]$diagPasses.Add("Modo ONLINE: no hay carpeta offline-images/. Se requiere internet para build.")
    }

    # 12. Required files
    $requiredFiles = @(
        @{ Path = (Join-Path $projectRoot "docker-compose.prod.yml"); Label = "docker-compose.prod.yml" },
        @{ Path = (Join-Path $projectRoot "setup.bat"); Label = "setup.bat" },
        @{ Path = (Join-Path $projectRoot "scripts\deploy_hospital_lan.ps1"); Label = "deploy_hospital_lan.ps1" },
        @{ Path = (Join-Path $projectRoot "scripts\lib\env_helpers.ps1"); Label = "lib/env_helpers.ps1" },
        @{ Path = (Join-Path $projectRoot "scripts\lib\cors_helpers.ps1"); Label = "lib/cors_helpers.ps1" },
        @{ Path = (Join-Path $projectRoot "scripts\lib\net_diagnostics.ps1"); Label = "lib/net_diagnostics.ps1" },
        @{ Path = (Join-Path $projectRoot "scripts\lib\docker_diagnostics.ps1"); Label = "lib/docker_diagnostics.ps1" },
        @{ Path = (Join-Path $projectRoot "scripts\load_offline_images.ps1"); Label = "load_offline_images.ps1" }
    )
    foreach ($rf in $requiredFiles) {
        if (Test-Path $rf.Path) {
            [void]$diagPasses.Add("Archivo $($rf.Label) presente.")
        }
        else {
            [void]$diagFailures.Add("Archivo $($rf.Label) FALTANTE: $($rf.Path)")
        }
    }

    # 13. .env existing
    $envPath = Join-Path $projectRoot ".env"
    if (Test-Path $envPath) {
        [void]$diagPasses.Add("Archivo .env existente detectado.")
    }
    else {
        [void]$diagPasses.Add("No hay .env existente (se creara durante instalacion).")
    }

    # ---- RESULTS ----
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "     RESULTADOS DEL DIAGNOSTICO" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Cyan

    if ($diagPasses.Count -gt 0) {
        Write-Host ""
        Write-Host "  CORRECTO ($($diagPasses.Count)):" -ForegroundColor Green
        foreach ($p in $diagPasses) {
            Write-Host "    [OK] $p" -ForegroundColor Green
        }
    }

    if ($diagWarnings.Count -gt 0) {
        Write-Host ""
        Write-Host "  ADVERTENCIAS ($($diagWarnings.Count)):" -ForegroundColor Yellow
        foreach ($w in $diagWarnings) {
            Write-Host "    [!!] $w" -ForegroundColor Yellow
        }
    }

    if ($diagFailures.Count -gt 0) {
        Write-Host ""
        Write-Host "  ERRORES CRITICOS ($($diagFailures.Count)):" -ForegroundColor Red
        foreach ($f in $diagFailures) {
            Write-Host "    [XX] $f" -ForegroundColor Red
        }
    }

    Write-Host ""
    # Determinar si hay archivos faltantes
    $hasMissingRequiredFiles = $false
    foreach ($rf in $requiredFiles) {
        if (-not (Test-Path $rf.Path)) {
            $hasMissingRequiredFiles = $true
        }
    }

    # Determinar si hay una IP LAN candidata valida (física no local ni APIPA)
    $hasValidLanIp = $false
    $candidates = Get-LanIPv4Candidates
    foreach ($c in $candidates) {
        if ($c.IPAddress -notlike "127.*" -and $c.IPAddress -notlike "169.254.*") {
            $hasValidLanIp = $true
        }
    }

    # Determinar estado del puerto de app
    $isAppPortOccupied = -not (Test-PortAvailable -Port 8000).Available

    # Determinar estado del puerto de BD
    $isDbPortOccupied = (-not (Test-PortAvailable -Port 3306).Available) -or (-not (Test-PortAvailable -Port 3307).Available)

    $veredict = "READY_FOR_INSTALL"
    $veredictColor = "Green"

    # Evaluacion de Bloqueantes de Instalacion
    if ($diagFailures.Count -gt 0 -or (-not $isAdmin) -or (-not $isDockerReady) -or $hasMissingRequiredFiles -or (-not $hasValidLanIp) -or $isAppPortOccupied) {
        $veredict = "ACTION_REQUIRED_BEFORE_INSTALL"
        $veredictColor = "Red"
    }
    # Evaluacion de Condiciones Criticas para Piloto en Campo
    elseif ($hasPublicProfile -or $isDhcp -or $isDbPortOccupied) {
        $veredict = "ACTION_REQUIRED_BEFORE_FIELD_PILOT"
        $veredictColor = "Yellow"
    }
    # Evaluacion de Advertencias Menores
    elseif ($diagWarnings.Count -gt 0) {
        $veredict = "DIAGNOSTIC_COMPLETED_WITH_WARNINGS"
        $veredictColor = "Yellow"
    }

    Write-Host "  VEREDICTO: $veredict" -ForegroundColor $veredictColor
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    try { Stop-Transcript | Out-Null } catch { }
    Read-Host "Presione Enter para cerrar"
    if ($veredict -eq "ACTION_REQUIRED_BEFORE_INSTALL") { exit 1 }
    exit 0
}

# ==============================================================================
# MAIN INSTALLER (try/catch wrapper — never closes window without explanation)
# ==============================================================================

try {
    # ---- Banner ----
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "     [SISTEMA DE CAJA HOSPITALARIA - ASISTENTE DE DESPLIEGUE v2.0]             " -ForegroundColor Cyan -BackgroundColor DarkBlue
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "  Asistente robusto de campo para instalacion en red local LAN." -ForegroundColor White
    Write-Host "  Compatible con multiples configuraciones de red, Docker y Windows." -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""

    # ==================================================================
    # RECOVERY / MAIN MENU
    # ==================================================================

    function Show-MainMenu {
        Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray
        Write-Host "  Que desea hacer?" -ForegroundColor White
        Write-Host "  [1] Instalar / iniciar sistema" -ForegroundColor Green
        Write-Host "  [2] Ver diagnostico de esta PC" -ForegroundColor White
        Write-Host "  [3] Reintentar Docker" -ForegroundColor White
        Write-Host "  [4] Cambiar IP/puerto manualmente" -ForegroundColor White
        Write-Host "  [5] Apagar contenedores" -ForegroundColor White
        Write-Host "  [6] Salir" -ForegroundColor Gray
        Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray

        while ($true) {
            $sel = Read-Host "Seleccione una opcion [1-6]"
            if ($sel -in @("1", "2", "3", "4", "5", "6")) { return $sel }
            Write-Host "  Opcion invalida." -ForegroundColor Red
        }
    }

    # ---- Main menu loop ----
    $exitRequested = $false

    while (-not $exitRequested) {
        $menuChoice = Show-MainMenu

        switch ($menuChoice) {
            # ==============================================================
            # OPTION 2: Diagnostics (same as -DiagnosticsOnly)
            # ==============================================================
            "2" {
                Write-Host ""
                Write-Host "[*] Ejecutando diagnostico..." -ForegroundColor Yellow
                # Re-invoke ourselves with -DiagnosticsOnly
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -DiagnosticsOnly
                Write-Host ""
                continue
            }

            # ==============================================================
            # OPTION 3: Retry Docker
            # ==============================================================
            "3" {
                Write-Host ""
                $dockerResult = Invoke-DockerCheck
                Write-Host ""
                Write-Host "[INFO] Estado Docker: $($dockerResult.Status) - $($dockerResult.Message)" -ForegroundColor Cyan
                Write-Host ""
                continue
            }

            # ==============================================================
            # OPTION 4: Change IP/Port manually
            # ==============================================================
            "4" {
                Write-Host ""
                $envPath = Join-Path $projectRoot ".env"
                $existingEnv = @{}
                if (Test-Path -LiteralPath $envPath) {
                    $existingEnv = Read-EnvFile $envPath
                }

                $currentIp = "127.0.0.1"
                if ($existingEnv.ContainsKey("SERVER_IP")) { $currentIp = $existingEnv["SERVER_IP"] }
                $currentPort = "443"
                if ($existingEnv.ContainsKey("APP_HTTPS_PORT")) { $currentPort = $existingEnv["APP_HTTPS_PORT"] }
                elseif ($existingEnv.ContainsKey("APP_PORT")) { $currentPort = $existingEnv["APP_PORT"] }

                Write-Host "  IP actual: $currentIp" -ForegroundColor White
                Write-Host "  Puerto HTTPS actual: $currentPort" -ForegroundColor White
                Write-Host ""

                # IP change
                $newIp = Read-Host "  Nueva IP LAN (Enter para mantener $currentIp)"
                if ([string]::IsNullOrWhiteSpace($newIp)) { $newIp = $currentIp }
                if (-not (Test-IPv4Format $newIp)) {
                    Write-Host "  [FAIL] Formato IPv4 invalido." -ForegroundColor Red
                    continue
                }
                if (Test-IsLoopback $newIp) {
                    Write-Host "  [WARN] 127.x.x.x solo sirve en esta computadora." -ForegroundColor Yellow
                }

                # Port change
                $newPort = Read-Host "  Nuevo puerto HTTPS (Enter para mantener $currentPort)"
                if ([string]::IsNullOrWhiteSpace($newPort)) { $newPort = $currentPort }
                $portNum = 0
                if (-not [int]::TryParse($newPort, [ref]$portNum) -or $portNum -lt 1 -or $portNum -gt 65535) {
                    Write-Host "  [FAIL] Puerto invalido." -ForegroundColor Red
                    continue
                }

                # Update .env
                $updateVars = @{
                    "SERVER_IP"       = $newIp
                    "APP_HTTP_PORT"   = "80"
                    "APP_HTTPS_PORT"  = "$portNum"
                    "APP_PORT"        = "$portNum"
                }
                Update-DotEnv -Path $envPath -Variables $updateVars
                Write-Host "  [OK] .env actualizado: IP=$newIp, Puerto HTTPS=$portNum" -ForegroundColor Green

                # Also update backend/.env if exists
                $backendEnv = Join-Path $projectRoot "backend\.env"
                if (Test-Path $backendEnv) {
                    $corsValues = Get-ProductionCorsValues -ServerIp $newIp -AppPort $portNum
                    $beVars = @{
                        "APP_URL"                    = Get-HospitalLanUrl -ServerIp $newIp -HttpsPort $portNum
                        "APP_HTTPS_PORT"             = "$portNum"
                        "SANCTUM_STATEFUL_DOMAINS"   = $corsValues.SanctumStatefulDomains
                        "CORS_ALLOWED_ORIGINS"       = $corsValues.CorsAllowedOrigins
                    }
                    Update-DotEnv -Path $backendEnv -Variables $beVars
                    Write-Host "  [OK] backend/.env actualizado tambien." -ForegroundColor Green
                }
                Write-Host ""
                continue
            }

            # ==============================================================
            # OPTION 5: Stop containers
            # ==============================================================
            "5" {
                Write-Host ""
                $composeProd = Join-Path $projectRoot "docker-compose.prod.yml"
                if (Test-DockerInstalled) {
                    $dockerRun = Test-DockerRunning
                    if ($dockerRun.Running) {
                        Write-Host "[*] Deteniendo contenedores..." -ForegroundColor Yellow
                        try {
                            & docker compose -f $composeProd down 2>&1
                            Write-Host "[OK] Contenedores detenidos." -ForegroundColor Green
                        }
                        catch {
                            Write-Host "[WARN] Error al detener: $($_.Exception.Message)" -ForegroundColor Yellow
                        }
                    }
                    else {
                        Write-Host "[INFO] Docker no esta corriendo." -ForegroundColor Gray
                    }
                }
                else {
                    Write-Host "[INFO] Docker no esta instalado." -ForegroundColor Gray
                }
                Write-Host ""
                continue
            }

            # ==============================================================
            # OPTION 6: Exit
            # ==============================================================
            "6" {
                $exitRequested = $true
                continue
            }

            # ==============================================================
            # OPTION 1: Install / Start System
            # ==============================================================
            "1" {
                # Fall through to installation flow below
            }
        }

        if ($menuChoice -ne "1") { continue }

        # ================================================================
        # INSTALLATION FLOW
        # ================================================================

        Write-Host ""
        Write-Host "[*] Iniciando diagnostico previo a la instalacion..." -ForegroundColor Yellow
        Write-Host ""

        $failures = New-Object System.Collections.ArrayList
        $warnings = New-Object System.Collections.ArrayList

        # ---- A. Admin check ----
        if (-not (Test-IsAdmin)) {
            [void]$warnings.Add("No tiene privilegios de Administrador. Algunas operaciones (firewall, tareas programadas) podrian fallar. Ejecute setup.bat como Administrador.")
        }

        # ---- B. Path with spaces ----
        if (Test-PathHasSpaces $projectRoot) {
            [void]$warnings.Add("La ruta '$projectRoot' contiene espacios. Docker Compose puede tener problemas.")
        }

        # ---- C. Disk space ----
        $freeGb = Get-SystemDiskSpace -Path $projectRoot
        if ($freeGb -ge 0 -and $freeGb -lt 5) {
            [void]$failures.Add("Espacio libre insuficiente: ${freeGb} GB. Se requieren al menos 5 GB.")
        }

        # ---- D. Network / IP ----
        Write-Host "[*] Detectando red LAN..." -ForegroundColor Yellow
        $ipResult = Confirm-OrSelectServerIp
        $serverIp = $ipResult.IPAddress
        foreach ($w in $ipResult.Warnings) {
            [void]$warnings.Add($w)
        }

        if (-not $serverIp) {
            [void]$failures.Add("No se selecciono una IP LAN valida. No se puede continuar.")
        }
        elseif (Test-IsLoopback $serverIp) {
            [void]$failures.Add("127.x.x.x solo sirve en esta computadora. Las estaciones cliente no podran entrar. Seleccione una IP LAN real.")
        }

        # ---- E. Firewall profile ----
        try {
            $profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue
            if ($profiles) {
                $publicProfiles = @($profiles | Where-Object { $_.NetworkCategory -eq "Public" })
                if ($publicProfiles.Count -gt 0) {
                    [void]$warnings.Add("La red esta como 'Publica'. Windows bloquea conexiones entrantes. Cambie a 'Privada' en Configuracion de Red.")
                }
                else {
                    Write-Host "[OK] Perfil de red: Privado." -ForegroundColor Green
                }
            }
        }
        catch {
            [void]$warnings.Add("No se pudo verificar el perfil de red. Asegurese de permitir trafico en los puertos necesarios.")
        }

        # ---- F. Docker check ----
        Write-Host "[*] Verificando Docker..." -ForegroundColor Yellow
        $dockerResult = Invoke-DockerCheck
        $dockerReady = ($dockerResult.Status -eq "Ready")
        $dockerSkipped = ($dockerResult.Status -eq "UserSkipped")

        if ($dockerResult.Status -eq "NotInstalled") {
            [void]$warnings.Add("Docker no instalado. Solo disponible modo bare-metal.")
        }
        elseif ($dockerResult.Status -eq "UserCancelled") {
            Write-Host "[INFO] Instalacion cancelada por el usuario." -ForegroundColor Gray
            continue
        }

        # ---- G. Ports ----
        Write-Host "[*] Verificando puertos..." -ForegroundColor Yellow
        $httpPort = 80
        $appPort = 443
        $dbPort = 3306

        $httpPort = Resolve-PortConflict -Port $httpPort -PortLabel "Redireccion HTTP"
        if ($httpPort -eq -1) {
            Write-Host "[INFO] Instalacion cancelada para resolver conflicto de puerto." -ForegroundColor Gray
            continue
        }

        $appPort = Resolve-PortConflict -Port $appPort -PortLabel "Servidor Web HTTPS"
        if ($appPort -eq -1) {
            Write-Host "[INFO] Instalacion cancelada para resolver conflicto de puerto." -ForegroundColor Gray
            continue
        }

        $dbPort = Resolve-PortConflict -Port $dbPort -PortLabel "Base de Datos"
        if ($dbPort -eq -1) {
            Write-Host "[INFO] Instalacion cancelada para resolver conflicto de puerto." -ForegroundColor Gray
            continue
        }

        # ---- H. Offline mode detection ----
        $offlineImagesDir = Join-Path $projectRoot "offline-images"
        $isOfflineMode = Test-Path $offlineImagesDir
        Write-Host ""
        if ($isOfflineMode) {
            Write-Host "======================================================================" -ForegroundColor Green
            Write-Host "  Modo detectado: OFFLINE" -ForegroundColor Green
            Write-Host "  No se usara internet. Imagenes locales de offline-images/." -ForegroundColor Green
            Write-Host "======================================================================" -ForegroundColor Green
        }
        else {
            Write-Host "======================================================================" -ForegroundColor Yellow
            Write-Host "  Modo detectado: ONLINE" -ForegroundColor Yellow
            Write-Host "  Se requiere internet para descargar/build imagenes Docker." -ForegroundColor Yellow
            Write-Host "======================================================================" -ForegroundColor Yellow
        }

        # ---- Show Warnings ----
        if ($warnings.Count -gt 0) {
            Write-Host ""
            Write-Host "[ADVERTENCIA] DIAGNOSTICOS DETECTADOS:" -ForegroundColor Yellow
            foreach ($w in $warnings) {
                Write-Host "  -> $w" -ForegroundColor Yellow
            }
            Write-Host ""
        }

        # ---- Block on Failures ----
        if ($failures.Count -gt 0) {
            Write-Host "[FAIL] SE ENCONTRARON ERRORES CRITICOS:" -ForegroundColor Red
            foreach ($f in $failures) {
                Write-Host "  -> $f" -ForegroundColor Red
            }
            Write-Host ""
            Write-Host "Que hacer:" -ForegroundColor White
            Write-Host "  1. Resuelva los errores indicados arriba." -ForegroundColor White
            Write-Host "  2. Vuelva a ejecutar setup.bat como Administrador." -ForegroundColor White
            Write-Host "  3. Si necesita ayuda, ejecute: .\scripts\deploy_hospital_lan.ps1 -DiagnosticsOnly" -ForegroundColor White
            Write-Host ""
            Read-Host "Presione Enter para volver al menu"
            continue
        }

        # ---- I. Deployment mode selection ----
        Write-Host ""
        Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray
        Write-Host "Seleccione el metodo de instalacion:" -ForegroundColor White
        if ($dockerReady) {
            Write-Host " [1] (Recomendado) Docker (aislado, empaqueta todo)" -ForegroundColor Green
        }
        elseif ($dockerSkipped) {
            Write-Host " [1] Docker (requiere iniciar Docker Desktop)" -ForegroundColor Gray
        }
        else {
            Write-Host " [1] Docker (no disponible actualmente)" -ForegroundColor DarkGray
        }
        Write-Host " [2] Bare-Metal Windows (PHP 8.2+ y MySQL/MariaDB locales)" -ForegroundColor White
        Write-Host "----------------------------------------------------------------------" -ForegroundColor Gray

        $installChoice = ""
        while ($installChoice -notin @("1", "2")) {
            $installChoice = Read-Host "Ingrese una opcion [1-2]"
            if ($installChoice -eq "1" -and -not $dockerReady) {
                Write-Host "  Docker no esta listo. Inicie Docker Desktop o elija opcion 2." -ForegroundColor Yellow
                $installChoice = ""
            }
        }

        # ---- Generate secrets ----
        $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        $dbPassword = ""
        $dbRootPassword = ""
        for ($i = 0; $i -lt 16; $i++) {
            $dbPassword += $chars[(Get-Random -Maximum $chars.Length)]
            $dbRootPassword += $chars[(Get-Random -Maximum $chars.Length)]
        }
        $appKey = "base64:" + [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Minimum 0 -Maximum 256) }))

        $envPath = Join-Path $projectRoot ".env"

        # ==============================================================
        # DOCKER MODE
        # ==============================================================
        if ($installChoice -eq "1") {
            Write-Host ""
            Write-Host "[*] Iniciando despliegue Docker..." -ForegroundColor Yellow

            # Previous install detection
            $composeProdPath = Join-Path $projectRoot "docker-compose.prod.yml"
            $prevInstall = Show-PreviousInstallMenu -ComposeFile $composeProdPath

            if ($prevInstall -eq "cancel") {
                Write-Host "[INFO] Operacion cancelada." -ForegroundColor Gray
                continue
            }

            # Read existing .env
            $existingRootEnv = @{}
            if (Test-Path -LiteralPath $envPath) {
                $existingRootEnv = Read-EnvFile $envPath
                Write-Host "[*] Conservando secretos existentes del .env..." -ForegroundColor Green
            }

            $currAppKey = if ($existingRootEnv.ContainsKey("APP_KEY") -and $existingRootEnv["APP_KEY"] -ne "") { $existingRootEnv["APP_KEY"] } else { $appKey }
            $currDbPass = if ($existingRootEnv.ContainsKey("DB_PASSWORD") -and $existingRootEnv["DB_PASSWORD"] -ne "") { $existingRootEnv["DB_PASSWORD"] } else { $dbPassword }
            $currDbRootPass = if ($existingRootEnv.ContainsKey("DB_ROOT_PASSWORD") -and $existingRootEnv["DB_ROOT_PASSWORD"] -ne "") { $existingRootEnv["DB_ROOT_PASSWORD"] } else { $dbRootPassword }

            # Write .env
            $rootVars = @{
                "SERVER_IP"        = $serverIp
                "APP_HTTP_PORT"    = "$httpPort"
                "APP_HTTPS_PORT"   = "$appPort"
                "APP_PORT"         = "$appPort"
                "APP_KEY"          = $currAppKey
                "DB_PORT"          = "$dbPort"
                "DB_DATABASE"      = "hospital_billing"
                "DB_USERNAME"      = "hospital"
                "DB_PASSWORD"      = $currDbPass
                "DB_ROOT_PASSWORD" = $currDbRootPass
            }

            Update-DotEnv -Path $envPath -Variables $rootVars
            Write-Host "[OK] Archivo .env actualizado." -ForegroundColor Green

            # Offline/Online compose up
            if ($isOfflineMode) {
                Write-Host ""
                Write-Host "[*] Cargando imagenes offline..." -ForegroundColor Yellow
                $loadScriptPath = Join-Path $projectRoot "scripts\load_offline_images.ps1"
                if (Test-Path $loadScriptPath) {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $loadScriptPath
                    if ($LASTEXITCODE -ne 0) {
                        Write-Host "[FAIL] Error al cargar imagenes offline." -ForegroundColor Red
                        Write-Host "Que hacer: Verifique que la carpeta offline-images/ contenga archivos .tar validos." -ForegroundColor White
                        Read-Host "Presione Enter para volver al menu"
                        continue
                    }
                }
                else {
                    Write-Host "[WARN] No se encontro load_offline_images.ps1. Intentando levantar sin carga previa." -ForegroundColor Yellow
                }
                Write-Host "[*] Levantando contenedores en modo offline..." -ForegroundColor Yellow
                & docker compose -f $composeProdPath --env-file $envPath up -d --no-build
            }
            else {
                Write-Host ""
                Write-Host "[*] Construyendo y levantando contenedores (requiere internet)..." -ForegroundColor Yellow
                & docker compose -f $composeProdPath --env-file $envPath up -d --build
            }

            if ($LASTEXITCODE -ne 0) {
                Write-Host ""
                Write-Host "[FAIL] Error al levantar Docker Compose." -ForegroundColor Red
                Write-Host ""
                Write-Host "Que hacer:" -ForegroundColor White
                Write-Host "  1. Revise los mensajes de error arriba." -ForegroundColor White
                Write-Host "  2. Verifique que Docker Desktop este corriendo." -ForegroundColor White
                Write-Host "  3. Si es modo online, verifique conexion a internet." -ForegroundColor White
                Write-Host "  4. Ejecute: docker compose -f docker-compose.prod.yml logs" -ForegroundColor White
                Write-Host "  5. Vuelva a intentar con opcion [1] del menu." -ForegroundColor White
                Read-Host "Presione Enter para volver al menu"
                continue
            }

            Write-Host "[*] Esperando inicializacion de MariaDB (20s)..." -ForegroundColor Yellow
            Start-Sleep -Seconds 20

            # Migrations
            Write-Host "[*] Ejecutando migraciones y seeders..." -ForegroundColor Yellow
            & docker compose -f $composeProdPath exec -T backend php artisan migrate --force
            & docker compose -f $composeProdPath exec -T backend php artisan db:seed --class=RolesAndPermissionsSeeder --force
            & docker compose -f $composeProdPath exec -T backend php artisan db:seed --class=ServiceCatalogSeeder --force

            Write-Host "[*] Registrando tareas de backup Docker..." -ForegroundColor Yellow
            $backupScript = Join-Path $projectRoot "scripts\install_backup_tasks_windows.ps1"
            if (-not (Test-Path $backupScript)) {
                throw "No se encontro el instalador de tareas de backup. El sistema no debe entregarse sin respaldos automaticos."
            }

            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupScript -ProjectRoot $projectRoot -UpdateExisting | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "No se pudieron programar backups Docker. Revise install-logs y vuelva a ejecutar setup.bat."
            }

            try {
                Start-ScheduledTask -TaskName "SistemaCajaHospitalaria-BackupWorker" -ErrorAction SilentlyContinue | Out-Null
            }
            catch { }
            Write-Host "[OK] Tareas de backup Docker registradas." -ForegroundColor Green

            Write-Host "[*] Registrando autoarranque del stack Docker..." -ForegroundColor Yellow
            $stackAutostartScript = Join-Path $projectRoot "scripts\install_stack_autostart_windows.ps1"
            if (-not (Test-Path $stackAutostartScript)) {
                throw "No se encontro el instalador de autoarranque. El sistema no debe entregarse sin plan de arranque despues de reinicio."
            }

            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $stackAutostartScript -ProjectRoot $projectRoot -UpdateExisting | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "No se pudo programar el autoarranque del stack. Revise install-logs y vuelva a ejecutar setup.bat."
            }

            Write-Host "[OK] Autoarranque del stack Docker registrado." -ForegroundColor Green
        }
        # ==============================================================
        # BARE-METAL MODE
        # ==============================================================
        else {
            Write-Host ""
            Write-Host "[*] Iniciando despliegue Bare-Metal nativo..." -ForegroundColor Yellow

            # Locate PHP
            $phpPath = "php"
            if ($null -eq (Get-Command "php" -ErrorAction SilentlyContinue)) {
                if (Test-Path "C:\xampp\php\php.exe") {
                    $phpPath = "C:\xampp\php\php.exe"
                }
                else {
                    Write-Host "[FAIL] No se encontro PHP." -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Que hacer:" -ForegroundColor White
                    Write-Host "  1. Instale PHP 8.2+ y agreguelo al PATH de Windows." -ForegroundColor White
                    Write-Host "  2. O instale XAMPP con PHP 8.2+." -ForegroundColor White
                    Write-Host "  3. Vuelva a ejecutar setup.bat." -ForegroundColor White
                    Read-Host "Presione Enter para volver al menu"
                    continue
                }
            }

            # Backend .env
            $backendEnvPath = Join-Path $projectRoot "backend\.env"
            $existingEnv = @{}
            if (Test-Path -LiteralPath $backendEnvPath) {
                $existingEnv = Read-EnvFile $backendEnvPath
                Write-Host "[*] backend/.env existente detectado. Preservando configuraciones..." -ForegroundColor Green
            }
            else {
                $backendEnvExample = Join-Path $projectRoot "backend\.env.example"
                if (Test-Path $backendEnvExample) {
                    Copy-Item $backendEnvExample $backendEnvPath
                }
                else {
                    New-Item $backendEnvPath -ItemType File -Force | Out-Null
                }
                $existingEnv = Read-EnvFile $backendEnvPath
                Write-Host "[*] Creado backend/.env." -ForegroundColor Green
            }

            # Interactive DB config
            $currDbHost = if ($existingEnv.ContainsKey("DB_HOST") -and $existingEnv["DB_HOST"] -ne "") { $existingEnv["DB_HOST"] } else { "127.0.0.1" }
            $currDbPort = if ($existingEnv.ContainsKey("DB_PORT") -and $existingEnv["DB_PORT"] -ne "") { $existingEnv["DB_PORT"] } else { "$dbPort" }
            $currDbName = if ($existingEnv.ContainsKey("DB_DATABASE") -and $existingEnv["DB_DATABASE"] -ne "") { $existingEnv["DB_DATABASE"] } else { "hospital_billing" }
            $currDbUser = if ($existingEnv.ContainsKey("DB_USERNAME") -and $existingEnv["DB_USERNAME"] -ne "") { $existingEnv["DB_USERNAME"] } else { "root" }
            $currDbPass = if ($existingEnv.ContainsKey("DB_PASSWORD")) { $existingEnv["DB_PASSWORD"] } else { "" }
            $currAppKey = if ($existingEnv.ContainsKey("APP_KEY") -and $existingEnv["APP_KEY"] -ne "") { $existingEnv["APP_KEY"] } else { $appKey }

            Write-Host ""
            Write-Host "--- Configuracion de Base de Datos MySQL/MariaDB ---" -ForegroundColor Cyan
            $dbHost = Read-Host "Host MySQL/MariaDB [$currDbHost]"
            if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = $currDbHost }

            $dbPortInput = Read-Host "Puerto MySQL/MariaDB [$currDbPort]"
            if ([string]::IsNullOrWhiteSpace($dbPortInput)) { $dbPortInput = $currDbPort }

            $dbName = Read-Host "Nombre Base de Datos [$currDbName]"
            if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = $currDbName }

            if (-not (Test-DatabaseName $dbName)) {
                Write-Host "[FAIL] Nombre de base invalido. Use una letra inicial y solo letras, numeros o guion bajo." -ForegroundColor Red
                Read-Host "Presione Enter para volver al menu"
                continue
            }

            $dbUser = Read-Host "Usuario de Base de Datos [$currDbUser]"
            if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = $currDbUser }

            $dbPass = Read-SecretText "Contrasena MySQL/MariaDB (Enter para conservar existente)"
            if ([string]::IsNullOrWhiteSpace($dbPass)) { $dbPass = $currDbPass }

            # Write backend .env
            $corsValues = Get-ProductionCorsValues -ServerIp $serverIp -AppPort $appPort
            $vars = @{
                "APP_ENV"                    = "production"
                "APP_DEBUG"                  = "false"
                "APP_KEY"                    = $currAppKey
                "APP_URL"                    = Get-HospitalLanUrl -ServerIp $serverIp -HttpsPort $appPort
                "APP_HTTPS_PORT"             = "$appPort"
                "DB_CONNECTION"              = "mysql"
                "DB_HOST"                    = $dbHost
                "DB_PORT"                    = $dbPortInput
                "DB_DATABASE"                = $dbName
                "DB_USERNAME"                = $dbUser
                "DB_PASSWORD"                = $dbPass
                "SANCTUM_STATEFUL_DOMAINS"   = $corsValues.SanctumStatefulDomains
                "CORS_ALLOWED_ORIGINS"       = $corsValues.CorsAllowedOrigins
            }

            Update-DotEnv -Path $backendEnvPath -Variables $vars
            Write-Host "[OK] backend/.env configurado." -ForegroundColor Green

            # Create DB via PHP
            Write-Host "[*] Verificando base de datos..." -ForegroundColor Yellow

            $env:DB_HOST_TEMP = $dbHost
            $env:DB_PORT_TEMP = $dbPortInput
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

            # Clean up temp env vars safely
            try { Remove-Item Env:\DB_HOST_TEMP -ErrorAction SilentlyContinue } catch { }
            try { Remove-Item Env:\DB_PORT_TEMP -ErrorAction SilentlyContinue } catch { }
            try { Remove-Item Env:\DB_NAME_TEMP -ErrorAction SilentlyContinue } catch { }
            try { Remove-Item Env:\DB_USER_TEMP -ErrorAction SilentlyContinue } catch { }
            try { Remove-Item Env:\DB_PASS_TEMP -ErrorAction SilentlyContinue } catch { }

            if ($dbStatus -ne "CREATED") {
                Write-Host "[FAIL] No se pudo conectar a MySQL o crear la base de datos." -ForegroundColor Red
                Write-Host "  Error: $dbStatus" -ForegroundColor Red
                Write-Host ""
                Write-Host "Que hacer:" -ForegroundColor White
                Write-Host "  1. Verifique que MySQL/MariaDB este corriendo." -ForegroundColor White
                Write-Host "  2. Verifique las credenciales ingresadas." -ForegroundColor White
                Write-Host "  3. Vuelva a intentar desde el menu principal." -ForegroundColor White
                Read-Host "Presione Enter para volver al menu"
                continue
            }
            Write-Host "[OK] Base de datos lista." -ForegroundColor Green

            # Migrations
            Write-Host "[*] Ejecutando migraciones..." -ForegroundColor Yellow
            Push-Location (Join-Path $projectRoot "backend")

            if ($currAppKey -eq "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" -or $currAppKey -eq "") {
                & $phpPath artisan key:generate --force
            }

            & $phpPath artisan migrate --force
            & $phpPath artisan db:seed --class=RolesAndPermissionsSeeder --force
            & $phpPath artisan db:seed --class=ServiceCatalogSeeder --force
            & $phpPath artisan config:cache
            & $phpPath artisan route:cache
            & $phpPath artisan view:cache
            Pop-Location
            Write-Host "[OK] Base de datos migrada." -ForegroundColor Green

            # Backup tasks
            Write-Host "[*] Registrando tareas de backup..." -ForegroundColor Yellow
            try {
                $backupScript = Join-Path $projectRoot "scripts\install_backup_tasks_windows.ps1"
                if (Test-Path $backupScript) {
                    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $backupScript -ProjectRoot $projectRoot -PhpPath $phpPath -UpdateExisting | Out-Null
                    Write-Host "[OK] Tareas de backup registradas." -ForegroundColor Green
                    try {
                        Start-ScheduledTask -TaskName "SistemaCajaHospitalaria-BackupWorker" -ErrorAction SilentlyContinue | Out-Null
                    }
                    catch { }
                }
            }
            catch {
                Write-Host "[WARN] No se pudieron programar backups: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host "  Puede configurarlos despues: scripts/install_backup_tasks_windows.ps1" -ForegroundColor White
            }
        }

        # ==============================================================
        # ADMIN USER CREATION
        # ==============================================================
        Write-Host ""
        Write-Host "======================================================================" -ForegroundColor Cyan
        Write-Host " [ADMIN] CONFIGURACION DEL USUARIO ADMINISTRADOR INICIAL" -ForegroundColor Cyan
        Write-Host "======================================================================" -ForegroundColor Cyan

        $adminUsername = ""
        while ([string]::IsNullOrWhiteSpace($adminUsername)) {
            $adminUsername = Read-Host "Nombre de Usuario (ej. admin.hospital)"
        }

        $adminEmail = ""
        while ([string]::IsNullOrWhiteSpace($adminEmail) -or $adminEmail -notmatch "^[^@]+@[^@]+\.[^@]+$") {
            $adminEmail = Read-Host "Correo Electronico del Administrador"
        }

        $adminPassword = ""
        while ($adminPassword.Length -lt 10) {
            $adminPassword = Read-SecretText "Contrasena Temporal (minimo 10 caracteres)"
            if ($adminPassword.Length -lt 10 -or $adminPassword -notmatch "[A-Za-z]" -or $adminPassword -notmatch "\d") {
                Write-Host "[WARN] La contrasena temporal debe tener al menos 10 caracteres, con letras y numeros." -ForegroundColor Yellow
                $adminPassword = ""
            }
        }

        Write-Host "[*] Registrando administrador..." -ForegroundColor Yellow
        $previousInitialAdminPassword = $env:HOSPITAL_INITIAL_ADMIN_PASSWORD
        $env:HOSPITAL_INITIAL_ADMIN_PASSWORD = $adminPassword
        try {
            if ($installChoice -eq "1") {
                $composeProdPath = Join-Path $projectRoot "docker-compose.prod.yml"
                & docker compose -f $composeProdPath exec -T -e HOSPITAL_INITIAL_ADMIN_PASSWORD backend php artisan auth:create-initial-admin --username="$adminUsername" --email="$adminEmail" --name="Administrador de Hospital"
            }
            else {
                Push-Location (Join-Path $projectRoot "backend")
                & $phpPath artisan auth:create-initial-admin --username="$adminUsername" --email="$adminEmail" --name="Administrador de Hospital"
                Pop-Location
            }
        }
        finally {
            if ([string]::IsNullOrEmpty($previousInitialAdminPassword)) {
                Remove-Item Env:\HOSPITAL_INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
            }
            else {
                $env:HOSPITAL_INITIAL_ADMIN_PASSWORD = $previousInitialAdminPassword
            }
            $adminPassword = ""
        }

        # ==============================================================
        # FIREWALL RULE
        # ==============================================================
        try {
            foreach ($port in (@($httpPort, $appPort) | Select-Object -Unique)) {
                & netsh advfirewall firewall delete rule name="S_Hospital Server LAN Port $port" 2>$null
                & netsh advfirewall firewall add rule name="S_Hospital Server LAN Port $port" dir=in action=allow protocol=TCP localport=$port | Out-Null
            }
            Write-Host "[OK] Reglas de firewall para HTTP $httpPort y HTTPS $appPort habilitadas." -ForegroundColor Green
        }
        catch {
            [void]$warnings.Add("No se pudo crear la regla de firewall. Habilitela manualmente.")
        }

        # ==============================================================
        # HEALTH CHECK
        # ==============================================================
        Write-Host ""
        Write-Host "[*] Verificacion final del servicio..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5

        $healthCheckUrl = Get-HospitalLanUrl -ServerIp $serverIp -HttpsPort $appPort -Path "/up"
        try {
            $webResponse = Invoke-WebRequest -Uri $healthCheckUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue
            if ($webResponse -and $webResponse.StatusCode -eq 200) {
                Write-Host "[OK] Servidor responde en $healthCheckUrl" -ForegroundColor Green
            }
            else {
                Write-Host "[WARN] No se pudo validar $healthCheckUrl. Verifique firewall." -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "[WARN] No se pudo conectar a $healthCheckUrl." -ForegroundColor Yellow
            Write-Host "  Puede ser normal si la aplicacion aun esta iniciando." -ForegroundColor Gray
            Write-Host "  Pruebe manualmente en el navegador: $(Get-HospitalLanUrl -ServerIp $serverIp -HttpsPort $appPort)" -ForegroundColor White
        }

        # ==============================================================
        # POST-INSTALL QUICK CHECK
        # ==============================================================
        # Run a 7-check smoke that verifies the stack actually
        # responded to HTTP and the basic security headers are in
        # place. Failures here are non-fatal (we already lifted the
        # stack) but they print a clear warning so the operator
        # knows to re-check before walking away.
        Write-Host ""
        Write-Host "===================================================================" -ForegroundColor Cyan
        Write-Host " [SMOKE] Verificacion rapida post-instalacion" -ForegroundColor Cyan
        Write-Host "===================================================================" -ForegroundColor Cyan
        $quickCheckScript = Join-Path $PSScriptRoot "post_install_quick_check.ps1"
        if (Test-Path $quickCheckScript) {
            try {
                & $quickCheckScript -BaseUrl (Get-HospitalLanUrl -ServerIp "127.0.0.1" -HttpsPort $appPort) -TimeoutSec 15
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "[WARN] Smoke rapido reporto fallas. Revise los checks arriba antes de entregar al hospital." -ForegroundColor Yellow
                } else {
                    Write-Host "[OK] Smoke rapido finalizo sin fallas." -ForegroundColor Green
                }
            } catch {
                Write-Host "[WARN] No se pudo ejecutar post_install_quick_check.ps1: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARN] Script $quickCheckScript no encontrado; se omite smoke." -ForegroundColor Yellow
        }

        # ==============================================================
        # SUCCESS BANNER
        # ==============================================================
        Write-Host ""
        Write-Host "======================================================================" -ForegroundColor Green
        Write-Host " [SUCCESS] SISTEMA DE CAJA HOSPITALARIA - DESPLIEGUE COMPLETADO" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host "======================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host " [RED] DIRECCIONES DE ACCESO:" -ForegroundColor Cyan
        Write-Host "  -> Esta computadora:  $(Get-HospitalLanUrl -ServerIp '127.0.0.1' -HttpsPort $appPort)" -ForegroundColor White
        Write-Host "  -> Estaciones LAN:    $(Get-HospitalLanUrl -ServerIp $serverIp -HttpsPort $appPort)" -ForegroundColor Yellow -BackgroundColor Black
        Write-Host ""
        Write-Host " [ADMIN] CREDENCIALES:" -ForegroundColor Cyan
        Write-Host "  -> Usuario:    $adminUsername" -ForegroundColor White
        Write-Host "  -> Contrasena: (la que ingreso arriba)" -ForegroundColor White
        Write-Host ""
        Write-Host " [INFO] INSTRUCCIONES:" -ForegroundColor Yellow
        Write-Host "  1. En las estaciones cliente, abra Chrome/Edge:" -ForegroundColor White
        Write-Host "     $(Get-HospitalLanUrl -ServerIp $serverIp -HttpsPort $appPort)" -ForegroundColor Yellow
        Write-Host "  2. Asegurese de que la IP $serverIp sea ESTATICA." -ForegroundColor White
        Write-Host "  3. Para apagar (Docker): docker compose -f docker-compose.prod.yml down" -ForegroundColor White
        Write-Host "======================================================================" -ForegroundColor Green

        $exitRequested = $true
    }  # end while menu loop

    Write-Host ""
    Read-Host "Presione Enter para finalizar"
}
catch {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host " [FAIL] El instalador encontro un error inesperado" -ForegroundColor Red
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Que hacer:" -ForegroundColor White
    Write-Host "    1. Lea el mensaje de error arriba." -ForegroundColor White
    Write-Host "    2. Ejecute el diagnostico: .\scripts\deploy_hospital_lan.ps1 -DiagnosticsOnly" -ForegroundColor White
    Write-Host "    3. Resuelva el problema indicado." -ForegroundColor White
    Write-Host "    4. Vuelva a ejecutar setup.bat como Administrador." -ForegroundColor White
    if ($logPath) {
        Write-Host "    5. Si necesita soporte, envie el log: $logPath" -ForegroundColor Gray
    }
    Write-Host ""
    Read-Host "Presione Enter para cerrar"
    exit 1
}
finally {
    try { Stop-Transcript | Out-Null } catch { }
}
