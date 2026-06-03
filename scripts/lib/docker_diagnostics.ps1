# ==============================================================================
# Sistema de Caja Hospitalaria - Librería Modular de Diagnósticos de Docker y WSL
# ==============================================================================
# Diseñada para Windows PowerShell 5.1. Seguro bajo StrictMode -Version Latest.

# Verifica si Docker está instalado en el sistema
function Test-DockerInstalled {
    $dockerCmd = Get-Command "docker" -ErrorAction SilentlyContinue
    return ($null -ne $dockerCmd)
}

# Verifica si el motor de Docker está corriendo
function Test-DockerRunning {
    $running = $false
    $errMsg = ""
    if (Test-DockerInstalled) {
        try {
            $dockerCheck = docker ps 2>&1
            if ($LASTEXITCODE -eq 0 -and $dockerCheck -notmatch "error|stopped|connect|refused|is not running") {
                $running = $true
            } else {
                $errMsg = $dockerCheck -join " "
            }
        } catch {
            $errMsg = $_.Exception.Message
        }
    }
    return [PSCustomObject]@{
        Running = $running
        ErrorMessage = $errMsg
    }
}

# Realiza un chequeo seguro del estado de WSL2 sin romperse ante fallos
function Test-WslStatus {
    $result = [ordered]@{
        Installed = $false
        Message = "No instalado o no disponible en PATH."
        Severity = "WARN"
    }
    
    $wslCmd = Get-Command "wsl" -ErrorAction SilentlyContinue
    if ($null -eq $wslCmd) {
        return $result
    }
    
    try {
        # Ejecutar de forma segura con timeout o control de error
        $wslOut = wsl --status 2>&1
        if ($LASTEXITCODE -eq 0) {
            $result.Installed = $true
            $result.Message = "Instalado y funcionando correctamente."
            $result.Severity = "OK"
        } else {
            $result.Installed = $true
            $result.Message = "Instalado pero reporto error al consultar estado: " + ($wslOut -join " ")
            $result.Severity = "WARN"
        }
    } catch {
        $result.Installed = $true
        $result.Message = "No se pudo consultar estado de WSL: $($_.Exception.Message)"
        $result.Severity = "WARN"
    }
    
    return $result
}

# Wrapper para obtener estado de WSL con la estructura esperada por deploy_hospital_lan.ps1
function Test-WslReady {
    $result = [ordered]@{
        Available = $false
        Version = ""
        Warning = "WSL no esta instalado o no se encuentra en el PATH."
    }
    
    $wslCmd = Get-Command "wsl" -ErrorAction SilentlyContinue
    if ($null -eq $wslCmd) {
        return [PSCustomObject]$result
    }
    
    try {
        $wslOut = wsl --status 2>&1
        if ($LASTEXITCODE -eq 0) {
            $result.Available = $true
            $result.Warning = ""
            # Intentar extraer la versión del kernel
            foreach ($line in $wslOut) {
                if ($line -match "Versi\w+ de\w+ kernel:\s+([\d\.]+)" -or $line -match "Kernel version:\s+([\d\.]+)") {
                    $result.Version = $Matches[1]
                }
            }
        } else {
            # Si wsl --status falla pero wsl existe, reportamos que está disponible pero con advertencia
            $result.Available = $true
            $result.Warning = "WSL esta instalado pero reporto error al consultar estado (posiblemente falta una distribucion por defecto)."
        }
    } catch {
        $result.Available = $true
        $result.Warning = "No se pudo consultar el estado de WSL: $($_.Exception.Message)"
    }
    
    return [PSCustomObject]$result
}


# Muestra instrucciones detalladas de instalación de Docker Desktop
function Show-DockerInstallInstructions {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host " [ACTION REQUIRED] DOCKER DESKTOP NO ESTA INSTALADO" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host "Para realizar el despliegue recomendado en contenedores se requiere Docker." -ForegroundColor White
    Write-Host ""
    Write-Host "Si esta PC tiene conexion a internet:" -ForegroundColor Yellow
    Write-Host "  1. Descargue el instalador desde: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "  2. Ejecute el instalador y siga los pasos." -ForegroundColor White
    Write-Host ""
    Write-Host "Si esta PC NO tiene conexion a internet (Instalacion Offline):" -ForegroundColor Yellow
    Write-Host "  1. Busque en la memoria USB de instalacion el instalador offline de Docker Desktop" -ForegroundColor White
    Write-Host "     (generalmente llamado 'Docker Desktop Installer.exe')." -ForegroundColor White
    Write-Host "  2. Instale Docker Desktop." -ForegroundColor White
    Write-Host "  3. Si la instalacion lo solicita, reinicie la computadora." -ForegroundColor White
    Write-Host "  4. Inicie el programa Docker Desktop desde el menu de Windows." -ForegroundColor White
    Write-Host "  5. Ejecute nuevamente setup.bat como Administrador." -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Red
    Write-Host ""
}

# Muestra instrucciones de solución de problemas cuando Docker está instalado pero apagado
function Show-DockerTroubleshooting {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " [ACTION REQUIRED] EL MOTOR DE DOCKER NO ESTA EN EJECUCION" -ForegroundColor Yellow -BackgroundColor Black
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "Docker Desktop esta instalado pero el servicio de fondo (Docker Engine) esta apagado." -ForegroundColor White
    Write-Host ""
    Write-Host "Que hacer ahora:" -ForegroundColor Yellow
    Write-Host "  1. Abra el programa 'Docker Desktop' desde el menu Inicio de Windows." -ForegroundColor White
    Write-Host "  2. Espere aproximadamente de 1 a 2 minutos hasta que el icono en la esquina" -ForegroundColor White
    Write-Host "     inferior izquierda se ponga VERDE e indique 'Engine running'." -ForegroundColor White
    Write-Host "  3. Vuelva a esta ventana de instalacion." -ForegroundColor White
    Write-Host ""
    Write-Host "Posibles causas de fallas persistentes:" -ForegroundColor Yellow
    Write-Host "  -> La virtualizacion de hardware esta desactivada en el BIOS/UEFI de la PC." -ForegroundColor White
    Write-Host "  -> Falta instalar la actualizacion de WSL2 (Windows Subsystem for Linux)." -ForegroundColor White
    Write-Host "  -> Reinicio pendiente despues de instalar Docker." -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host ""
}

# Ciclo interactivo de espera de Docker
function Wait-ForDocker {
    while ($true) {
        if ((Test-DockerRunning).Running) {
            Write-Host "[OK] Motor de Docker confirmado y listo." -ForegroundColor Green
            return $true
        }
        
        if (-not (Test-DockerInstalled)) {
            Show-DockerInstallInstructions
            Read-Host "Presione Enter para salir e instalar Docker..."
            return $false
        }
        
        Show-DockerTroubleshooting
        $retry = Read-Host "¿Desea reintentar la conexion con Docker en este momento? (S/N) [S]"
        if ($retry -eq "N" -or $retry -eq "n") {
            return $false
        }
        Write-Host "[*] Intentando reconectar con Docker..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

# Verifica si Docker Compose está instalado y devuelve su versión
function Test-DockerComposeAvailable {
    $available = $false
    $version = ""
    try {
        $check = docker compose version 2>&1
        if ($LASTEXITCODE -eq 0 -and $check -match "version") {
            $available = $true
            if ($check -match "version\s+([v\d\.]+)") {
                $version = $Matches[1]
            }
        }
    } catch {}
    return [PSCustomObject]@{
        Available = $available
        Version = $version
    }
}

# Realiza un chequeo robusto de si la virtualización está activada en BIOS/Firmware
function Test-VirtualizationEnabled {
    $result = [ordered]@{
        Enabled = $null
        Warning = ""
    }
    
    try {
        # Validar via WMI/CIM de forma segura
        $comp = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue
        if ($null -eq $comp) {
            $comp = Get-WmiObject -Class Win32_ComputerSystem -ErrorAction SilentlyContinue
        }
        
        if ($null -ne $comp) {
            $hypervisorPresent = Get-PropertyValueSafe $comp "HypervisorPresent"
            if ($null -ne $hypervisorPresent -and $hypervisorPresent -eq $true) {
                $result.Enabled = $true
                return [PSCustomObject]$result
            }
        }
        
        # Validar via Win32_Processor de forma segura
        $processors = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue
        if ($null -eq $processors) {
            $processors = Get-WmiObject -Class Win32_Processor -ErrorAction SilentlyContinue
        }
        
        $hasVirtSupport = $false
        if ($null -ne $processors) {
            foreach ($cpu in $processors) {
                $virtFirmware = Get-PropertyValueSafe $cpu "VirtualizationFirmwareEnabled"
                if ($null -ne $virtFirmware -and $virtFirmware -eq $true) {
                    $hasVirtSupport = $true
                }
            }
        }
        
        if ($hasVirtSupport) {
            $result.Enabled = $true
        } else {
            # Parsear systeminfo (resiliente a idiomas: busca Yes, Sí, Si, Habilitada, Enabled)
            $sysInfo = systeminfo 2>&1
            $virtLine = $sysInfo | Where-Object { $_ -match "Virtualization|Virtualizaci" }
            if ($null -ne $virtLine) {
                if ($virtLine -match "Yes|Sí|Si|Habilitada|Enabled") {
                    $result.Enabled = $true
                } else {
                    $result.Enabled = $false
                    $result.Warning = "La virtualización de hardware parece estar DESACTIVADA en el BIOS/firmware. Docker la requiere."
                }
            } else {
                # Ante la duda, no bloqueamos y retornamos true
                $result.Enabled = $true
            }
        }
    } catch {
        $result.Enabled = $true
    }
    
    return [PSCustomObject]$result
}

# Realiza un chequeo interactivo de Docker para el instalador
function Invoke-DockerCheck {
    if (-not (Test-DockerInstalled)) {
        return [PSCustomObject]@{
            Status = "NotInstalled"
            Message = "Docker no esta instalado."
        }
    }
    
    $run = Test-DockerRunning
    if ($run.Running) {
        return [PSCustomObject]@{
            Status = "Ready"
            Message = "Docker listo y en ejecucion."
        }
    }
    
    # Si esta instalado pero no corriendo, podemos intentar guiar al usuario
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " [ADVERTENCIA] EL MOTOR DE DOCKER NO ESTA EN EJECUCION" -ForegroundColor Yellow -BackgroundColor Black
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " Docker Desktop esta instalado pero el servicio de fondo (Docker Engine) esta apagado." -ForegroundColor White
    Write-Host ""
    Write-Host " Seleccione una opcion:" -ForegroundColor White
    Write-Host "  [1] Esperar / Reintentar conexion con Docker (inicie Docker Desktop primero)" -ForegroundColor Green
    Write-Host "  [2] Omitir Docker (continuar en modo Bare-Metal si es posible)" -ForegroundColor Yellow
    Write-Host "  [3] Cancelar instalacion" -ForegroundColor Red
    Write-Host ""
    
    $choice = ""
    while ($choice -notin @("1", "2", "3")) {
        $choice = Read-Host "Ingrese una opcion [1-3]"
    }
    
    if ($choice -eq "1") {
        $ok = Wait-ForDocker
        if ($ok) {
            return [PSCustomObject]@{
                Status = "Ready"
                Message = "Docker listo y en ejecucion."
            }
        } else {
            return [PSCustomObject]@{
                Status = "Stopped"
                Message = "Docker no se pudo iniciar."
            }
        }
    }
    elseif ($choice -eq "2") {
        return [PSCustomObject]@{
            Status = "UserSkipped"
            Message = "El usuario decidio omitir Docker."
        }
    }
    else {
        return [PSCustomObject]@{
            Status = "UserCancelled"
            Message = "Instalacion cancelada por el usuario."
        }
    }
}

# Menu de instalacion previa para prevenir sobreescribir datos accidentalmente.
# Este instalador no ofrece borrado de volumenes ni reinicio destructivo.
function Show-PreviousInstallMenu {
    param(
        [string]$ComposeFile
    )
    
    $containers = @(Get-ExistingContainers)
    $volumes = @(Get-ExistingVolumes)
    
    if ($containers.Count -eq 0 -and $volumes.Count -eq 0) {
        return "new"
    }
    
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " [DETECTADO] INSTALACION PREVIA DE SISTEMA DE CAJA HOSPITALARIA DETECTADA" -ForegroundColor Yellow -BackgroundColor Black
    Write-Host "======================================================================" -ForegroundColor Yellow
    if ($containers.Count -gt 0) {
        Write-Host "  Contenedores previos: $($containers -join ', ')" -ForegroundColor White
    }
    if ($volumes.Count -gt 0) {
        Write-Host "  Volumenes de datos previos: $($volumes -join ', ')" -ForegroundColor White
    }
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "Seleccione una opcion para proceder:" -ForegroundColor White
    Write-Host "  [1] Re-iniciar / Reparar (Reinicia contenedores sin tocar los datos)" -ForegroundColor Green
    Write-Host "  [2] Conservar Base de Datos (Actualiza la app pero mantiene su informacion)" -ForegroundColor Green
    Write-Host "  [3] Cancelar y pedir soporte antes de tocar datos" -ForegroundColor White
    Write-Host ""
    
    $choice = ""
    while ($choice -notin @("1", "2", "3")) {
        $choice = Read-Host "Ingrese una opcion [1-3]"
    }
    
    if ($choice -eq "1") {
        Write-Host "[*] Reparando contenedores..." -ForegroundColor Yellow
        try {
            & docker compose -f $ComposeFile down 2>&1 | Out-Null
        } catch {}
        return "repair"
    }
    elseif ($choice -eq "2") {
        Write-Host "[*] Actualizando aplicacion conservando base de datos..." -ForegroundColor Yellow
        try {
            & docker compose -f $ComposeFile down 2>&1 | Out-Null
        } catch {}
        return "keep-db"
    }
    Write-Host "[INFO] Operacion cancelada. No se borraron datos ni volumenes." -ForegroundColor Yellow
    return "cancel"
}
