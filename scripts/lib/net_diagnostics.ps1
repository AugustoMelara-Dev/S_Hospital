# ==============================================================================
# Hospital Billing OS - Librería Modular de Diagnósticos de Red Blindados
# ==============================================================================
# Diseñada para Windows PowerShell 5.1. Seguro bajo StrictMode -Version Latest.

# Helper para extraer propiedades de objetos de red de forma segura evitando excepciones de StrictMode
function Get-PropertyValueSafe {
    param(
        $Object,
        [string]$PropertyName,
        $DefaultValue = $null
    )
    if ($null -eq $Object) { return $DefaultValue }
    try {
        $prop = $Object.PSObject.Properties[$PropertyName]
        if ($null -ne $prop) {
            return $prop.Value
        }
    } catch {}
    return $DefaultValue
}

# Obtiene la interfaz que tiene la ruta por defecto (0.0.0.0/0)
function Get-DefaultRouteInterface {
    try {
        $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
            Sort-Object RouteMetric |
            Select-Object -First 1
        if ($null -ne $defaultRoute) {
            return Get-PropertyValueSafe $defaultRoute "InterfaceIndex"
        }
    } catch {}
    return $null
}

# Obtiene el estado DHCP de una interfaz de forma ultra-segura
function Get-DhcpStatusSafe {
    param([int]$InterfaceIndex)
    if ($null -eq $InterfaceIndex) { return "Desconocido" }
    try {
        $netInterface = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $InterfaceIndex -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($null -ne $netInterface) {
            $dhcpVal = Get-PropertyValueSafe $netInterface "Dhcp"
            if ($dhcpVal -eq 1 -or $dhcpVal -eq "Enabled") { return "Enabled" }
            if ($dhcpVal -eq 0 -or $dhcpVal -eq "Disabled") { return "Disabled" }
        }
    } catch {}
    return "Desconocido"
}

# Obtiene el perfil de red de Windows (Privada vs Publica) de forma ultra-segura
function Get-NetworkProfileSafe {
    param($InterfaceIndex)
    if ($null -eq $InterfaceIndex) { return "Desconocido" }
    try {
        $profiles = Get-NetConnectionProfile -InterfaceIndex $InterfaceIndex -ErrorAction SilentlyContinue
        if ($null -ne $profiles) {
            $categories = @()
            foreach ($p in $profiles) {
                $cat = Get-PropertyValueSafe $p "NetworkCategory"
                if ($null -ne $cat) { $categories += $cat.ToString() }
            }
            if ($categories.Count -gt 0) {
                return $categories -join ", "
            }
        }
    } catch {}
    return "Desconocido"
}

# Valida formato IPv4 y revisa casos especiales (Localhost, APIPA)
function Test-IPv4Address {
    param([string]$IP)
    if ([string]::IsNullOrWhiteSpace($IP)) {
        return @{ Valid = $false; Reason = "IP vacía"; Type = "Invalid" }
    }
    # Expresión regular robusta para IPv4
    $regex = "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
    if ($IP -notmatch $regex) {
        return @{ Valid = $false; Reason = "Formato IPv4 no válido"; Type = "Invalid" }
    }

    if ($IP -like "127.*") {
        return @{ Valid = $true; Reason = "localhost - NO sirve para estaciones cliente"; Type = "Localhost" }
    }
    if ($IP -like "169.254.*") {
        return @{ Valid = $true; Reason = "APIPA - red sin DHCP/IP válida"; Type = "APIPA" }
    }
    return @{ Valid = $true; Reason = "IP LAN válida"; Type = "ValidLan" }
}

# Valida si una cadena tiene formato IPv4 correcto
function Test-IPv4Format {
    param([string]$IP)
    if ([string]::IsNullOrWhiteSpace($IP)) { return $false }
    $regex = "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
    return ($IP -match $regex)
}

# Determina si una IP es de loopback (localhost)
function Test-IsLoopback {
    param([string]$IP)
    return ($IP -like "127.*")
}

# Determina si una IP es APIPA (autoconfiguracion sin DHCP)
function Test-IsApipa {
    param([string]$IP)
    return ($IP -like "169.254.*")
}

# Determina si un adaptador es virtual/no recomendado para despliegue LAN
function Test-IsVirtualAdapter {
    param([string]$Alias)
    if ([string]::IsNullOrWhiteSpace($Alias)) { return $false }
    return ($Alias -match "Docker|vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|Bluetooth|VPN|Host-Only")
}

# Obtiene y clasifica todas las IPs candidatos de la máquina
function Get-LanIPv4Candidates {
    $candidates = @()
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue
        if ($null -eq $ips) { return $candidates }

        $defaultIdx = Get-DefaultRouteInterface

        foreach ($ipObj in $ips) {
            $ip = Get-PropertyValueSafe $ipObj "IPAddress"
            if ([string]::IsNullOrWhiteSpace($ip)) { continue }

            $idx = Get-PropertyValueSafe $ipObj "InterfaceIndex"
            $alias = Get-PropertyValueSafe $ipObj "InterfaceAlias" -DefaultValue "Sin Nombre"
            $state = Get-PropertyValueSafe $ipObj "AddressState"

            # Excluir de recomendación general
            $isVirtual = $false
            $recType = "RECOMENDADA"
            $recScore = 100

            if ($alias -match "Docker|vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|Bluetooth|VPN|Host-Only") {
                $isVirtual = $true
                $recType = "virtual/no recomendada"
                $recScore = 30
            }

            $testResult = Test-IPv4Address $ip
            if ($testResult.Type -eq "Localhost") {
                $isVirtual = $true
                $recType = "localhost - NO sirve para estaciones cliente"
                $recScore = 0
            }
            elseif ($testResult.Type -eq "APIPA") {
                $isVirtual = $true
                $recType = "APIPA - red sin DHCP/IP válida"
                $recScore = 10
            }

            # Si es la de la ruta predeterminada (física activa)
            $isDefaultRoute = $false
            if ($null -ne $defaultIdx -and $idx -eq $defaultIdx -and -not $isVirtual) {
                $isDefaultRoute = $true
                $recType = "RECOMENDADA (Interfaz física activa)"
                $recScore = 200
            }

            $dhcp = Get-DhcpStatusSafe $idx
            $profile = Get-NetworkProfileSafe $idx

            $candidates += [PSCustomObject][ordered]@{
                IP = $ip
                IPAddress = $ip
                InterfaceIndex = $idx
                Alias = $alias
                InterfaceAlias = $alias
                Source = "Get-NetIPAddress"
                IsVirtual = $isVirtual
                IsDefaultRoute = $isDefaultRoute
                RecType = $recType
                RecScore = $recScore
                Dhcp = $dhcp
                Profile = $profile
                AddressState = $state
            }
        }
    } catch {
        # Si fallan cmdlets avanzados, listamos usando WMI
        try {
            $wmi = Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled }
            foreach ($adapter in $wmi) {
                $ipAddresses = Get-PropertyValueSafe $adapter "IPAddress"
                if ($null -ne $ipAddresses) {
                    foreach ($ip in $ipAddresses) {
                        if ($ip -match "^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$") {
                            $alias = Get-PropertyValueSafe $adapter "Description" -DefaultValue "WMI Adapter"
                            $recType = "RECOMENDADA"
                            $recScore = 100
                            $isVirtual = $false
                            if ($alias -match "Docker|VirtualBox|VMware|WSL|Hyper-V|Loopback|Bluetooth|VPN") {
                                $isVirtual = $true
                                $recType = "virtual/no recomendada"
                                $recScore = 30
                            }
                            $test = Test-IPv4Address $ip
                            if ($test.Type -ne "ValidLan") {
                                $isVirtual = $true
                                $recType = $test.Reason
                                $recScore = 10
                            }
                            $candidates += [PSCustomObject][ordered]@{
                                IP = $ip
                                IPAddress = $ip
                                InterfaceIndex = $null
                                Alias = $alias
                                InterfaceAlias = $alias
                                Source = "WMI"
                                IsVirtual = $isVirtual
                                IsDefaultRoute = $false
                                RecType = $recType
                                RecScore = $recScore
                                Dhcp = "Desconocido"
                                Profile = "Desconocido"
                                AddressState = "Preferred"
                            }
                        }
                    }
                }
            }
        } catch {}
    }

    # Ordenamos por RecScore descendente para sugerir la mejor opción arriba
    return $candidates | Sort-Object RecScore -Descending
}

# Permite interactuar con el usuario para validar o ingresar una IP del servidor LAN
# Permite interactuar con el usuario para validar o ingresar una IP del servidor LAN
function Confirm-Or-SelectServerIp {
    param([string]$DefaultIp = "127.0.0.1")
    
    $candidates = Get-LanIPv4Candidates
    $validIps = $candidates | Where-Object { $_.IP -notlike "127.*" -and $_.IP -notlike "169.254.*" }

    Write-Host "[*] Detectando adaptadores de red y direcciones IP..." -ForegroundColor Yellow

    if ($candidates.Count -eq 0) {
        Write-Host "[WARN] No se detecto ninguna IP configurada en el sistema." -ForegroundColor Yellow
        return Ask-ManualIp
    }

    # Si NO hay IPs válidas reales (solo loopback o APIPA)
    if ($validIps.Count -eq 0) {
        Write-Host ""
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host " [ADVERTENCIA] NO SE DETECTO NINGUNA IP LAN FISICA VALIDA" -ForegroundColor Yellow -BackgroundColor Black
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host " Solo se detectaron interfaces locales (loopback) o de autoconfiguracion (APIPA)." -ForegroundColor White
        Write-Host " Esto significa que las estaciones cliente no podran conectarse a esta PC." -ForegroundColor White
        Write-Host " Por favor, conecte el servidor a una red valida o configure una IP estatica." -ForegroundColor White
        Write-Host "======================================================================" -ForegroundColor Yellow
        Write-Host ""
    }

    # Si hay solo una IP válida real y física, la sugerimos directamente
    if ($validIps.Count -eq 1 -and -not $validIps[0].IsVirtual) {
        $best = $validIps[0]
        Write-Host "[OK] Se detecto una IP LAN clara y recomendada:" -ForegroundColor Green
        Write-Host "  -> IP: $($best.IP) ($($best.Alias)) [DHCP: $($best.Dhcp)]" -ForegroundColor Green
        
        $confirm = Read-Host "¿Desea usar esta IP para las conexiones del hospital? (S/N) [S]"
        if ([string]::IsNullOrWhiteSpace($confirm) -or $confirm -eq "S" -or $confirm -eq "s") {
            return $best.IP
        }
    }

    # Mostrar menú de IPs detectadas (incluyendo loopback y APIPA claramente señaladas)
    Write-Host ""
    Write-Host "Se detectaron las siguientes direcciones de red en esta PC:" -ForegroundColor White
    $counter = 1
    foreach ($c in $candidates) {
        $ipText = $c.IP.PadRight(15)
        $aliasText = $c.Alias.PadRight(25)
        $dhcpText = if ($c.Dhcp -eq "Enabled") { "DHCP (Dinamica)" } else { "IP Estatica" }
        
        $color = "White"
        if ($c.RecScore -ge 200) { $color = "Green" }
        elseif ($c.RecScore -le 30) { $color = "DarkGray" }
        
        Write-Host "  [$counter] $ipText - $aliasText - $($c.RecType) [$dhcpText]" -ForegroundColor $color
        $counter++
    }
    Write-Host "  [$counter] Ingresar otra IP manualmente" -ForegroundColor Cyan
    Write-Host ""

    $selection = ""
    while ([string]::IsNullOrWhiteSpace($selection) -or $selection -lt 1 -or $selection -gt $counter) {
        $selection = Read-Host "Seleccione la IP que usaran las estaciones cliente [1-$counter]"
        if ([string]::IsNullOrWhiteSpace($selection)) { $selection = "1" }
    }

    if ($selection -eq $counter) {
        return Ask-ManualIp
    } else {
        $selectedObj = $candidates[$selection - 1]
        
        # Validar IP
        $test = Test-IPv4Address $selectedObj.IP
        if ($test.Type -eq "Localhost") {
            Write-Host "[WARN] 127.x.x.x solo sirve en esta computadora. Las estaciones cliente NO podran entrar." -ForegroundColor Yellow
            $confirm = Read-Host "¿Esta seguro de continuar de todas formas? (s/n) [n]"
            if ($confirm -ne "s") {
                return Confirm-Or-SelectServerIp -DefaultIp $DefaultIp
            }
        }
        elseif ($test.Type -eq "APIPA") {
            Write-Host "[WARN] 169.254.x.x indica que la PC no recibio IP valida de red. Revise cable, WiFi, router o DHCP." -ForegroundColor Yellow
            $confirm = Read-Host "¿Esta seguro de continuar de todas formas? (s/n) [n]"
            if ($confirm -ne "s") {
                return Confirm-Or-SelectServerIp -DefaultIp $DefaultIp
            }
        }

        return $selectedObj.IP
    }
}

function Ask-ManualIp {
    while ($true) {
        Write-Host ""
        $manual = Read-Host "Ingrese manualmente la IP del servidor (ej. 192.168.1.100)"
        $test = Test-IPv4Address $manual
        
        if ($test.Valid) {
            if ($test.Type -eq "Localhost") {
                Write-Host "[WARN] 127.x.x.x solo sirve en esta computadora. Las estaciones cliente NO podran entrar." -ForegroundColor Yellow
                $confirm = Read-Host "¿Desea usar esta IP de todas formas? (s/n) [n]"
                if ($confirm -eq "s") { return $manual }
            }
            elseif ($test.Type -eq "APIPA") {
                Write-Host "[WARN] 169.254.x.x indica que la PC no recibio IP valida de red. Revise cable, WiFi, router o DHCP." -ForegroundColor Yellow
                $confirm = Read-Host "¿Desea usar esta IP de todas formas? (s/n) [n]"
                if ($confirm -eq "s") { return $manual }
            }
            else {
                return $manual
            }
        } else {
            Write-Host "[ERROR] $($test.Reason). Intente de nuevo." -ForegroundColor Red
        }
    }
}

# Wrapper compatible con la API de deploy_hospital_lan.ps1
function Confirm-OrSelectServerIp {
    $ip = Confirm-Or-SelectServerIp
    $warnings = @()
    if ($ip) {
        $test = Test-IPv4Address $ip
        if ($test.Type -eq "Localhost") {
            $warnings += "Se selecciono IP localhost (127.0.0.1). Las estaciones cliente no podran acceder."
        }
        elseif ($test.Type -eq "APIPA") {
            $warnings += "Se selecciono una IP APIPA (169.254.x.x). Conecte el servidor a una red con DHCP o configure una IP estatica."
        }
        else {
            $candidates = Get-LanIPv4Candidates
            $match = $candidates | Where-Object { $_.IPAddress -eq $ip }
            if ($match -and $match.Dhcp -eq "Enabled") {
                $warnings += "La IP $ip es asignada por DHCP (dinamica). Configure IP estatica antes del despliegue en produccion."
            }
        }
    }
    return [PSCustomObject]@{
        IPAddress = $ip
        Warnings = $warnings
    }
}

