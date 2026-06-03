param(
    [string] $ProjectRoot = "",
    [string] $BaseUrl = $env:HOSPITAL_SYSTEM_URL,
    [string] $ReportPath = "",
    [int] $Retries = 30,
    [int] $DelaySeconds = 2,
    [switch] $SkipDockerStart,
    [switch] $NoBrowser,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

trap {
    Write-Host (Protect-HospitalOperationalText $_.Exception.Message $ProjectRoot)
    Write-Host "No borre datos, respaldos, archivos .env ni volumenes Docker. Entregue el diagnostico seguro a soporte si existe."
    exit 1
}

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ($ReportPath -eq "") {
    $ReportPath = Join-Path $ProjectRoot "qa\LOCAL_REPAIR_DIAGNOSTIC.md"
}

$candidateReportPath = if ([System.IO.Path]::IsPathRooted($ReportPath)) {
    $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ReportPath)
} else {
    Join-Path $ProjectRoot $ReportPath
}
$ReportPath = [System.IO.Path]::GetFullPath($candidateReportPath)
$rootPrefix = $ProjectRoot.TrimEnd("\") + "\"

if ($ReportPath -eq $ProjectRoot -or -not $ReportPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "El diagnostico debe guardarse dentro de la carpeta instalada del sistema."
}

if ($Retries -lt 1 -or $Retries -gt 120) {
    throw "Retries debe estar entre 1 y 120."
}

if ($DelaySeconds -lt 1 -or $DelaySeconds -gt 30) {
    throw "DelaySeconds debe estar entre 1 y 30."
}

function Read-DotEnvFile([string] $envPath) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
        return $values
    }

    foreach ($rawLine in (Get-Content -LiteralPath $envPath)) {
        $line = $rawLine.Trim()
        if ($line -ne "" -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
        }
    }

    return $values
}

function Resolve-DockerRuntime {
    $prodCompose = Join-Path $ProjectRoot "docker-compose.prod.yml"
    $devCompose = Join-Path $ProjectRoot "docker-compose.yml"
    $rootEnv = Join-Path $ProjectRoot ".env"
    $backendEnv = Join-Path $ProjectRoot "backend\.env"
    $offlineImages = Join-Path $ProjectRoot "offline-images"
    $releaseSetup = Join-Path $ProjectRoot "setup.bat"

    $isOfflinePackage = (Test-Path -LiteralPath $offlineImages -PathType Container) -or
        ((Test-Path -LiteralPath $releaseSetup -PathType Leaf) -and -not (Test-Path -LiteralPath $devCompose -PathType Leaf))

    if ((Test-Path -LiteralPath $prodCompose -PathType Leaf) -and ($isOfflinePackage -or -not (Test-Path -LiteralPath $devCompose -PathType Leaf))) {
        $composeArgs = @("compose")
        if (Test-Path -LiteralPath $rootEnv -PathType Leaf) {
            $composeArgs += @("--env-file", $rootEnv)
        }
        $composeArgs += @("-f", $prodCompose)

        return @{
            Mode = "offline-docker"
            ComposeArgs = $composeArgs
            Services = @("backend", "nginx", "mysql", "queue-worker")
            EnvPath = $rootEnv
            EnvValues = Read-DotEnvFile $rootEnv
            DefaultPort = "8000"
        }
    }

    return @{
        Mode = "development-docker"
        ComposeArgs = @("compose")
        Services = @("backend", "frontend", "mysql")
        EnvPath = $backendEnv
        EnvValues = Read-DotEnvFile $backendEnv
        DefaultPort = "8000"
    }
}

$dockerRuntime = Resolve-DockerRuntime

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    if ($dockerRuntime.Mode -eq "offline-docker" -and $dockerRuntime.EnvValues.ContainsKey("SERVER_IP")) {
        $port = $dockerRuntime.DefaultPort
        if ($dockerRuntime.EnvValues.ContainsKey("APP_PORT") -and -not [string]::IsNullOrWhiteSpace($dockerRuntime.EnvValues["APP_PORT"])) {
            $port = $dockerRuntime.EnvValues["APP_PORT"]
        }

        $BaseUrl = "http://$($dockerRuntime.EnvValues["SERVER_IP"]):$port"
    } elseif ($dockerRuntime.EnvValues.ContainsKey("APP_URL") -and -not [string]::IsNullOrWhiteSpace($dockerRuntime.EnvValues["APP_URL"])) {
        $BaseUrl = $dockerRuntime.EnvValues["APP_URL"]
    } else {
        $BaseUrl = "http://127.0.0.1:8000"
    }
}

$BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl

if ($WhatIfOnly) {
    Write-Host "Validacion de reparacion segura completada."
    Write-Host "Modo WhatIf: no se levanta Docker, no se abre navegador y no se escribe diagnostico."
    Write-Host "Ruta de diagnostico validada dentro del sistema instalado."
    Write-Host "Modo Docker detectado: $($dockerRuntime.Mode)."
    Write-Host "Servicios que se solicitarian: $($dockerRuntime.Services -join ', ')."
    Write-Host "URL que se revisaria: $BaseUrl."
    exit 0
}

$reportLines = New-Object System.Collections.Generic.List[string]
$hadError = $false
$hadWarning = $false

function Add-Line([string] $line = "") {
    $reportLines.Add($line) | Out-Null
}

function Add-Console([string] $message, [string] $color = "Gray") {
    Write-Host $message -ForegroundColor $color
}

function Protect-ReportText([string] $value) {
    $protected = $value

    if (-not [string]::IsNullOrWhiteSpace($ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Result([string] $status, [string] $label, [string] $detail = "") {
    $safeDetail = Protect-ReportText ($detail -replace "\|", "/")
    Add-Line "| $status | $label | $safeDetail |"

    if ($status -eq "ERROR") {
        $script:hadError = $true
        Add-Console "[ERROR] $label - $safeDetail" "Red"
        return
    }

    if ($status -eq "REVISION") {
        $script:hadWarning = $true
        Add-Console "[REVISION] $label - $safeDetail" "Yellow"
        return
    }

    Add-Console "[OK] $label" "Green"
}

function Invoke-CommandForReport([string] $label, [string] $command, [string[]] $arguments) {
    try {
        $output = & $command @arguments 2>&1 | ForEach-Object { $_.ToString() }
        $exitCode = $LASTEXITCODE

        if ($exitCode -eq 0) {
            Add-Result "OK" $label "Comando ejecutado correctamente."
        } else {
            Add-Result "REVISION" $label "El comando termino con codigo $exitCode."
        }

        if ($output.Count -gt 0) {
            Add-Line ""
            Add-Line "<details><summary>$label - salida tecnica para soporte</summary>"
            Add-Line ""
            Add-Line '```text'
            foreach ($line in $output) {
                Add-Line (Protect-ReportText ($line -replace "\|", "/"))
            }
            Add-Line '```'
            Add-Line ""
            Add-Line "</details>"
        }

        return $exitCode -eq 0
    } catch {
        Add-Result "ERROR" $label $_.Exception.Message
        return $false
    }
}

function Wait-ForUrl([string] $url, [int] $minCode = 200, [int] $maxCode = 399) {
    for ($i = 1; $i -le $Retries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 4
            if ($response.StatusCode -ge $minCode -and $response.StatusCode -le $maxCode) {
                return @{ Ok = $true; StatusCode = $response.StatusCode; Attempts = $i }
            }
        } catch {
            if ($i -eq 1) {
                Add-Console "Esperando respuesta de $url ..." "Yellow"
            }
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    return @{ Ok = $false; StatusCode = ""; Attempts = $Retries }
}

function Get-LanIPv4Addresses {
    try {
        if ($null -ne (Get-Command Get-NetIPAddress -ErrorAction SilentlyContinue)) {
            return @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                Where-Object {
                    $_.IPAddress -notlike "127.*" -and
                    $_.IPAddress -notlike "169.254.*" -and
                    $_.IPAddress -notlike "0.*"
                } |
                Select-Object -ExpandProperty IPAddress)
        }
    } catch {
        return @()
    }

    return @()
}

function Get-AppUrlHostType([string] $url) {
    if ([string]::IsNullOrWhiteSpace($url)) {
        return "missing"
    }

    try {
        $uri = [System.Uri] $url
        $urlHost = (($uri.Host -replace "^\[", "") -replace "\]$", "").ToLowerInvariant()
        if ($urlHost -in @("localhost", "127.0.0.1", "::1")) {
            return "loopback"
        }

        return "lan"
    } catch {
        return "invalid"
    }
}

function Read-SafeEnvSummary([string] $envPath) {
    if (-not (Test-Path -LiteralPath $envPath)) {
        Add-Result "REVISION" "Archivo de entorno" "No existe archivo de entorno esperado para este modo. El instalador debe crearlo antes de operar."
        return @{}
    }

    $allowedKeys = @(
        "APP_ENV",
        "APP_DEBUG",
        "APP_URL",
        "APP_VERSION",
        "DB_CONNECTION",
        "DB_DATABASE",
        "QUEUE_CONNECTION",
        "HOSPITAL_DAILY_BACKUP_TIME",
        "SERVER_IP",
        "APP_PORT"
    )

    $values = @{}
    foreach ($rawLine in (Get-Content -LiteralPath $envPath)) {
        $line = $rawLine.Trim()
        if ($line -ne "" -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            $key = $key.Trim()
            if ($allowedKeys -contains $key) {
                $values[$key] = $value.Trim().Trim('"').Trim("'")
            }
        }
    }

    foreach ($key in $allowedKeys) {
        if ($values.ContainsKey($key)) {
            Add-Result "OK" "Configuracion $key" $values[$key]
        }
    }

    if (-not $values.ContainsKey("APP_VERSION")) {
        Add-Result "REVISION" "Configuracion APP_VERSION" "No definida; use APP_VERSION en backend\.env para identificar la version instalada."
    }

    $blockedKeys = Get-Content -LiteralPath $envPath | Where-Object {
        $_ -match "^(DB_PASSWORD|APP_KEY|MAIL_PASSWORD|.*SECRET.*|.*TOKEN.*)="
    }

    if ($blockedKeys.Count -gt 0) {
        Add-Result "OK" "Secretos protegidos" "El diagnostico omitio claves, tokens y passwords."
    }

    return $values
}

$reportDir = Split-Path -Parent $ReportPath
if (-not (Test-Path -LiteralPath $reportDir)) {
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
}

Set-Location $ProjectRoot

Add-Console "Reparacion segura del Sistema de Caja Hospitalaria" "Cyan"
Add-Console "No se borran datos, no se reinicia la base y no se ejecutan seeders." "Cyan"

Add-Line "# Diagnostico de reparacion segura"
Add-Line ""
Add-Line "- Fecha: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")"
Add-Line "- Sistema: Sistema de Caja Hospitalaria"
Add-Line "- Accion: revisar servicios, levantar contenedores si aplica, esperar backend y abrir navegador"
Add-Line "- Seguridad: no borra datos, no elimina volumenes, no ejecuta `migrate:fresh`, no muestra secretos"
Add-Line ""
Add-Line "## Resumen"
Add-Line ""
Add-Line "| Estado | Revision | Detalle |"
Add-Line "| --- | --- | --- |"

if (Test-Path -LiteralPath $ProjectRoot) {
    Add-Result "OK" "Carpeta del sistema" "Proyecto localizado."
} else {
    Add-Result "ERROR" "Carpeta del sistema" "No se encontro la carpeta indicada."
}

$envPath = $dockerRuntime.EnvPath
Add-Result "OK" "Modo de arranque" "Detectado $($dockerRuntime.Mode); servicios: $($dockerRuntime.Services -join ', ')."
$envSummary = Read-SafeEnvSummary $envPath

$distPath = Join-Path $ProjectRoot "frontend\dist\index.html"
if (Test-Path -LiteralPath $distPath) {
    Add-Result "OK" "Interfaz preparada" "Existe frontend\dist\index.html."
} else {
    Add-Result "REVISION" "Interfaz preparada" "No existe frontend\dist\index.html. Ejecute el build antes de validar LAN final."
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if ($null -eq $dockerCommand) {
    Add-Result "ERROR" "Docker" "Docker no esta disponible en PATH."
} else {
    Add-Result "OK" "Docker" "Docker esta instalado."
    $dockerReady = Invoke-CommandForReport "Docker activo" "docker" @("info", "--format", "{{.ServerVersion}}")

    if ($dockerReady -and -not $SkipDockerStart) {
        $upArgs = @($dockerRuntime.ComposeArgs + @("up", "-d") + $dockerRuntime.Services)
        Invoke-CommandForReport "Levantar servicios locales" "docker" $upArgs | Out-Null
    } elseif ($SkipDockerStart) {
        Add-Result "REVISION" "Levantar servicios locales" "Omitido por parametro -SkipDockerStart."
    }

    $psArgs = @($dockerRuntime.ComposeArgs + @("ps"))
    Invoke-CommandForReport "Estado de contenedores" "docker" $psArgs | Out-Null
}

$upUrl = ($BaseUrl.TrimEnd("/")) + "/up"
$healthUrl = ($BaseUrl.TrimEnd("/")) + "/api/health"
$loginUrl = ($BaseUrl.TrimEnd("/")) + "/login"
$verifyEmailUrl = ($BaseUrl.TrimEnd("/")) + "/verify-email"

$up = Wait-ForUrl $upUrl
if ($up.Ok) {
    Add-Result "OK" "Backend activo" "$upUrl respondio HTTP $($up.StatusCode) tras $($up.Attempts) intento(s)."
} else {
    Add-Result "ERROR" "Backend activo" "$upUrl no respondio despues de $Retries intentos."
}

$health = Wait-ForUrl $healthUrl
if ($health.Ok) {
    Add-Result "OK" "API disponible" "$healthUrl respondio HTTP $($health.StatusCode)."
} else {
    Add-Result "REVISION" "API disponible" "$healthUrl no respondio. Revise logs del backend."
}

$login = Wait-ForUrl $loginUrl
if ($login.Ok) {
    Add-Result "OK" "Pantalla de ingreso" "$loginUrl respondio HTTP $($login.StatusCode)."
} else {
    Add-Result "REVISION" "Pantalla de ingreso" "$loginUrl no respondio. Puede faltar build o backend."
}

$verifyEmail = Wait-ForUrl $verifyEmailUrl
if ($verifyEmail.Ok) {
    Add-Result "OK" "Pantalla de verificacion" "$verifyEmailUrl respondio HTTP $($verifyEmail.StatusCode)."
} else {
    Add-Result "REVISION" "Pantalla de verificacion" "$verifyEmailUrl no respondio. Revise rutas publicas del frontend."
}

$lanIps = Get-LanIPv4Addresses
if ($lanIps.Count -gt 0) {
    Add-Result "OK" "Acceso LAN probable" "IP local detectada: $($lanIps -join ', '). Clientes deben entrar por http://IP_DEL_SERVIDOR:8000."
} else {
    Add-Result "REVISION" "Acceso LAN probable" "No se detecto una IP LAN activa. Revise red, cable o Wi-Fi del servidor."
}

if ($envSummary.ContainsKey("APP_URL")) {
    $appUrlType = Get-AppUrlHostType $envSummary["APP_URL"]
    if ($appUrlType -eq "lan") {
        Add-Result "OK" "Direccion APP_URL para LAN" "APP_URL apunta a una direccion que no es localhost."
    } elseif ($appUrlType -eq "loopback") {
        $suggestedUrl = if ($lanIps.Count -gt 0) { "http://$($lanIps[0]):8000" } else { "http://IP_DEL_SERVIDOR:8000" }
        Add-Result "REVISION" "Direccion APP_URL para LAN" "APP_URL usa localhost o 127.0.0.1. En clientes use una IP o nombre LAN, por ejemplo $suggestedUrl."
    } elseif ($appUrlType -eq "invalid") {
        Add-Result "REVISION" "Direccion APP_URL para LAN" "APP_URL no parece una URL valida. Configure http://IP_DEL_SERVIDOR:8000 antes de validar clientes."
    }
} else {
    Add-Result "REVISION" "Direccion APP_URL para LAN" "APP_URL no esta definida. Configure http://IP_DEL_SERVIDOR:8000 antes de validar clientes."
}

try {
    $driveName = (Get-Item -LiteralPath $ProjectRoot).PSDrive.Name
    $drive = Get-PSDrive -Name $driveName
    $freeGb = [math]::Round($drive.Free / 1GB, 2)
    if ($freeGb -lt 5) {
        Add-Result "REVISION" "Espacio en disco" "Quedan $freeGb GB libres en la unidad $driveName."
    } else {
        Add-Result "OK" "Espacio en disco" "Quedan $freeGb GB libres en la unidad $driveName."
    }
} catch {
    Add-Result "REVISION" "Espacio en disco" "No se pudo leer el espacio libre."
}

if ($null -ne (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
    foreach ($taskName in @("SistemaCajaHospitalaria-BackupWorker", "SistemaCajaHospitalaria-DailyBackup")) {
        $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($null -eq $task) {
            Add-Result "REVISION" "Tarea $taskName" "No esta registrada en el Programador de tareas."
        } else {
            Add-Result "OK" "Tarea $taskName" "Estado: $($task.State)."
        }
    }
}

Add-Line ""
Add-Line "## Acciones recomendadas"
Add-Line ""

if ($hadError) {
    Add-Line "- No continue facturando desde computadoras cliente hasta que soporte revise los errores."
    Add-Line "- Envie este archivo de diagnostico al responsable tecnico."
    Add-Line "- No borre carpetas, volumenes Docker ni archivos `.env`."
} elseif ($hadWarning) {
    Add-Line "- El sistema puede requerir revision antes de operar todo el turno."
    Add-Line "- Revise respaldos, tareas programadas, build frontend y acceso LAN desde otra computadora."
} else {
    Add-Line "- El sistema respondio correctamente. Abra caja y haga una prueba corta si estaba recuperando un arranque."
}

Set-Content -LiteralPath $ReportPath -Value $reportLines -Encoding ASCII
Add-Console "Diagnostico guardado en: $ReportPath" "Cyan"

if (-not $NoBrowser -and $login.Ok) {
    Start-Process $loginUrl -WindowStyle Hidden
    Add-Console "Navegador solicitado en $loginUrl" "Green"
}

if ($hadError) {
    exit 1
}

if ($hadWarning) {
    exit 2
}

exit 0
