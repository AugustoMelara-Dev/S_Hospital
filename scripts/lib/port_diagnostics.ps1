# ==============================================================================
# S_Hospital - Librería Modular de Diagnósticos de Puertos
# ==============================================================================
# Diseñada para Windows PowerShell 5.1. Seguro bajo StrictMode -Version Latest.

# Verifica si un puerto está disponible localmente
function Test-PortAvailable {
    param([int]$Port)
    $available = $true
    $processName = ""
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($null -ne $connections) {
            $available = $false
            $owner = Get-PortOwnerInfo $Port
            if ($null -ne $owner) {
                $processName = $owner.Name
            }
        }
    } catch {
        # Si da error de permisos, asumimos que no esta disponible
        $available = $false
    }
    return [PSCustomObject]@{
        Available = $available
        ProcessName = $processName
    }
}

# Obtiene la información del proceso dueño del puerto
function Get-PortOwnerInfo {
    param([int]$Port)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($null -ne $connections) {
            $conn = $connections | Select-Object -First 1
            $pid = $conn.OwningProcess
            if ($pid -gt 0) {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                if ($null -ne $proc) {
                    $procPath = ""
                    try { $procPath = $proc.Path } catch {}
                    return @{
                        PID = $pid
                        Name = $proc.Name
                        Path = $procPath
                    }
                }
                return @{ PID = $pid; Name = "Desconocido"; Path = "" }
            }
        }
    } catch {}
    return $null
}

# Resuelve de forma interactiva un conflicto de puerto
function Resolve-PortConflict {
    param(
        [int]$Port,
        [Alias("PortLabel")]
        [string]$PortName = "Servicio Web",
        [int]$DefaultFallbackStart = 8001
    )

    if ((Test-PortAvailable $Port).Available) {
        return $Port
    }

    $owner = Get-PortOwnerInfo $Port
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " [CONFLICTO] EL PUERTO $Port ($PortName) ESTA OCUPADO" -ForegroundColor Yellow -BackgroundColor Black
    Write-Host "======================================================================" -ForegroundColor Yellow
    if ($null -ne $owner) {
        Write-Host "  Proceso en ejecucion: $($owner.Name) (PID: $($owner.PID))" -ForegroundColor White
        if (-not [string]::IsNullOrWhiteSpace($owner.Path)) {
            Write-Host "  Ruta del programa:    $($owner.Path)" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No se pudo determinar el programa dueño del puerto." -ForegroundColor White
    }
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "Seleccione una alternativa:" -ForegroundColor White
    
    # Buscar puerto libre secuencial automáticamente
    $suggestedPort = $DefaultFallbackStart
    while (-not (Test-PortAvailable $suggestedPort).Available) {
        $suggestedPort++
    }

    Write-Host "  [1] Usar otro puerto libre automaticamente ($suggestedPort) - RECOMENDADO" -ForegroundColor Green
    Write-Host "  [2] Elegir un puerto manualmente" -ForegroundColor White
    Write-Host "  [3] Cancelar instalacion (para cerrar el programa en conflicto manualmente)" -ForegroundColor Red
    Write-Host ""

    $choice = ""
    while ($choice -notin @("1", "2", "3")) {
        $choice = Read-Host "Ingrese una opcion [1-3]"
    }

    if ($choice -eq "1") {
        Write-Host "[OK] Reasignando $PortName al puerto libre: $suggestedPort" -ForegroundColor Green
        return $suggestedPort
    }
    elseif ($choice -eq "2") {
        while ($true) {
            $manualPortStr = Read-Host "Ingrese un puerto libre (1024 - 65535)"
            $manualPort = 0
            if ([int]::TryParse($manualPortStr, [ref]$manualPort) -and $manualPort -ge 1024 -and $manualPort -le 65535) {
                if ((Test-PortAvailable $manualPort).Available) {
                    Write-Host "[OK] Puerto $manualPort disponible." -ForegroundColor Green
                    return $manualPort
                } else {
                    Write-Host "[ERROR] El puerto $manualPort tambien esta ocupado. Ingrese otro." -ForegroundColor Red
                }
            } else {
                Write-Host "[ERROR] Puerto invalido. Debe ser un numero entre 1024 y 65535." -ForegroundColor Red
            }
        }
    }
    else {
        return $null
    }
}
