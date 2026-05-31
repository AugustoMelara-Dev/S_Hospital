param(
    [string] $Url = $env:HOSPITAL_SYSTEM_URL,
    [int] $Retries = 30,
    [int] $DelaySeconds = 2
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Url)) {
    $Url = 'http://127.0.0.1:8000'
}

Write-Host "Abriendo Sistema de Caja Hospitalaria en $Url"

for ($i = 1; $i -le $Retries; $i++) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            Start-Process $Url -WindowStyle Hidden
            exit 0
        }
    } catch {
        if ($i -eq 1) {
            Write-Host 'El servidor local aun no responde. Esperando...'
        }
    }

    Start-Sleep -Seconds $DelaySeconds
}

Write-Host 'No se pudo abrir el sistema. Revise que los servicios locales esten iniciados.'
Write-Host 'Puede ejecutar scripts\repair_hospital_system.ps1 para generar un diagnostico seguro.'
exit 1
