param(
    [string] $ProjectRoot = "",
    [string] $BaseUrl = $env:HOSPITAL_SYSTEM_URL,
    [string] $OutputDir = "",
    [int] $TailLines = 120,
    [int] $RepairRetries = 30,
    [int] $RepairDelaySeconds = 2,
    [switch] $RunRepairDiagnostic,
    [switch] $SkipDockerStart,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

trap {
    Write-Host $_.Exception.Message
    Write-Host "No agregue archivos .env, respaldos SQL, passwords, tokens ni carpetas completas de datos al paquete de soporte."
    exit 1
}

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = "http://127.0.0.1:8000"
}

if ($OutputDir -eq "") {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutputDir = Join-Path $ProjectRoot "qa\support-packets\$stamp"
}

$rootPath = (Resolve-Path -LiteralPath $ProjectRoot).Path
$candidateOutputDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)
} else {
    Join-Path $rootPath $OutputDir
}
$OutputDir = [System.IO.Path]::GetFullPath($candidateOutputDir)
$rootPrefix = $rootPath.TrimEnd("\") + "\"

if ($OutputDir -eq $rootPath) {
    throw "La carpeta del paquete no puede ser la raiz del sistema. Use una subcarpeta dentro de qa\support-packets."
}

if (-not $OutputDir.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La carpeta del paquete debe estar dentro de la carpeta instalada del sistema."
}

if ($TailLines -lt 1 -or $TailLines -gt 500) {
    throw "TailLines debe estar entre 1 y 500 para evitar paquetes demasiado grandes."
}

if ($RepairRetries -lt 1 -or $RepairRetries -gt 120) {
    throw "RepairRetries debe estar entre 1 y 120."
}

if ($RepairDelaySeconds -lt 1 -or $RepairDelaySeconds -gt 30) {
    throw "RepairDelaySeconds debe estar entre 1 y 30."
}

if ($WhatIfOnly) {
    Write-Host "Validacion del paquete de soporte completada."
    Write-Host "Modo WhatIf: no se creo carpeta ni se copiaron logs."
    Write-Host "Carpeta prevista validada dentro del sistema instalado."
    exit 0
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function Protect-SupportText([string] $value) {
    $protected = $value

    if (-not [string]::IsNullOrWhiteSpace($rootPath)) {
        $protected = $protected -replace [regex]::Escape($rootPath), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($rootPath -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "\|", "/"

    if ($protected.Length -gt 1200) {
        return $protected.Substring(0, 1200) + " ...[recortado]"
    }

    return $protected
}

function Write-SafeTail([string] $SourcePath, [string] $TargetName, [System.Collections.Generic.List[string]] $manifestLines) {
    if (-not (Test-Path -LiteralPath $SourcePath)) {
        $manifestLines.Add("- No encontrado: $TargetName") | Out-Null
        return
    }

    $targetPath = Join-Path $OutputDir $TargetName
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# Extracto seguro: $TargetName") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("- Origen: $(Protect-SupportText $SourcePath)") | Out-Null
    $lines.Add("- Lineas incluidas: ultimas $TailLines") | Out-Null
    $lines.Add("- Seguridad: secretos y rutas locales se reemplazan antes de escribir.") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add('```text') | Out-Null

    try {
        Get-Content -LiteralPath $SourcePath -Tail $TailLines -ErrorAction Stop | ForEach-Object {
            $lines.Add((Protect-SupportText $_.ToString())) | Out-Null
        }
    } catch {
        $lines.Add("No se pudo leer el archivo: $(Protect-SupportText $_.Exception.Message)") | Out-Null
    }

    $lines.Add('```') | Out-Null
    Set-Content -LiteralPath $targetPath -Value $lines -Encoding ASCII
    $manifestLines.Add("- Incluido: $TargetName") | Out-Null
}

$manifest = New-Object System.Collections.Generic.List[string]
$manifest.Add("# Paquete seguro para soporte") | Out-Null
$manifest.Add("") | Out-Null
$manifest.Add("- Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")") | Out-Null
$manifest.Add("- Sistema: Sistema de Caja Hospitalaria") | Out-Null
$manifest.Add("- URL revisada: $(Protect-SupportText $BaseUrl)") | Out-Null
$manifest.Add("- Carpeta del paquete: $(Protect-SupportText $OutputDir)") | Out-Null
$manifest.Add("- Seguridad: no copia `.env`, no copia respaldos SQL, no restaura datos y no ejecuta seeders.") | Out-Null
$manifest.Add("") | Out-Null
$manifest.Add("## Archivos incluidos") | Out-Null
$manifest.Add("") | Out-Null

if ($RunRepairDiagnostic) {
    $repairScript = Join-Path $ProjectRoot "scripts\repair_hospital_system.ps1"
    $repairReport = Join-Path $OutputDir "LOCAL_REPAIR_DIAGNOSTIC.md"

    if (Test-Path -LiteralPath $repairScript) {
        $args = @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            $repairScript,
            "-ProjectRoot",
            $ProjectRoot,
            "-BaseUrl",
            $BaseUrl,
            "-ReportPath",
            $repairReport,
            "-Retries",
            $RepairRetries,
            "-DelaySeconds",
            $RepairDelaySeconds,
            "-NoBrowser"
        )

        if ($SkipDockerStart) {
            $args += "-SkipDockerStart"
        }

        & powershell.exe @args
        if ($LASTEXITCODE -in @(0, 1, 2)) {
            $manifest.Add("- Incluido: LOCAL_REPAIR_DIAGNOSTIC.md") | Out-Null
        } else {
            $manifest.Add("- Revision: la reparacion segura termino con codigo $LASTEXITCODE.") | Out-Null
        }
    } else {
        $manifest.Add("- No encontrado: repair_hospital_system.ps1") | Out-Null
    }
} else {
    $existingRepairReport = Join-Path $ProjectRoot "qa\LOCAL_REPAIR_DIAGNOSTIC.md"
    Write-SafeTail $existingRepairReport "LOCAL_REPAIR_DIAGNOSTIC.md" $manifest
}

Write-SafeTail (Join-Path $ProjectRoot "backend\storage\logs\laravel.log") "laravel-log-tail.md" $manifest
Write-SafeTail (Join-Path $ProjectRoot "backend\storage\logs\backup_worker_task.log") "backup-worker-log-tail.md" $manifest
Write-SafeTail (Join-Path $ProjectRoot "scripts\backup-automation.log") "backup-automation-log-tail.md" $manifest

$manifest.Add("") | Out-Null
$manifest.Add("## Instrucciones para soporte") | Out-Null
$manifest.Add("") | Out-Null
$manifest.Add("- Enviar esta carpeta completa al responsable tecnico autorizado.") | Out-Null
$manifest.Add("- Agregar el resumen seguro preparado desde la pantalla **Ayuda** si el navegador abre.") | Out-Null
$manifest.Add("- Agregar captura de **Respaldos** si el usuario tiene permiso.") | Out-Null
$manifest.Add("- No agregar `.env`, respaldos `.sql`, passwords, tokens ni carpetas completas de datos.") | Out-Null

$manifestPath = Join-Path $OutputDir "MANIFIESTO.md"
Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding ASCII

Write-Host "Paquete seguro para soporte creado en: $OutputDir"
Write-Host "Archivo principal: $manifestPath"
