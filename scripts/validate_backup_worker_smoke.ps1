param(
    [string] $BaseUrl = $env:HOSPITAL_SMOKE_BASE_URL,

    [string] $Login = $env:HOSPITAL_SMOKE_LOGIN,

    [string] $Password = $env:HOSPITAL_SMOKE_PASSWORD,

    [string] $EvidencePath = "qa\BACKUP_WORKER_SMOKE_PROOF.md",

    [int] $TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

$safeRoot = (Get-Location).Path
$evidenceFullPath = ""
. (Join-Path $PSScriptRoot "lib\operational_url_safety.ps1")

function Resolve-SmokeEvidencePath([string] $path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        throw "EvidencePath es obligatorio y debe apuntar a un archivo .md dentro de qa."
    }

    if ([System.IO.Path]::GetExtension($path) -ne ".md") {
        throw "EvidencePath debe ser un archivo Markdown (.md) dentro de qa."
    }

    $candidate = if ([System.IO.Path]::IsPathRooted($path)) {
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($path)
    } else {
        Join-Path $script:safeRoot $path
    }

    $fullPath = [System.IO.Path]::GetFullPath($candidate)
    $qaRoot = [System.IO.Path]::GetFullPath((Join-Path $script:safeRoot "qa"))
    $qaPrefix = $qaRoot.TrimEnd("\") + "\"

    if ($fullPath -eq $qaRoot -or -not $fullPath.StartsWith($qaPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "EvidencePath debe quedarse dentro de la carpeta qa del sistema."
    }

    return $fullPath
}

function Protect-SmokeText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    if (-not [string]::IsNullOrWhiteSpace($script:safeRoot)) {
        $protected = $protected -replace [regex]::Escape($script:safeRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($script:safeRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(PASSWORD|TOKEN|SECRET|APP_KEY|DB_PASSWORD)=\S+", '$1=[oculto]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

trap {
    Write-Host (Protect-SmokeText $_.Exception.Message)
    exit 1
}

$evidenceFullPath = Resolve-SmokeEvidencePath $EvidencePath

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "BaseUrl es obligatorio. Use -BaseUrl o defina HOSPITAL_SMOKE_BASE_URL."
}

$BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl

if ([string]::IsNullOrWhiteSpace($Login)) {
    throw "Login es obligatorio. Use -Login o defina HOSPITAL_SMOKE_LOGIN."
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $securePassword = Read-Host "Contrasena del usuario autorizado para validar respaldos" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "La contrasena es obligatoria. Use -Password, defina HOSPITAL_SMOKE_PASSWORD o escribala cuando el sistema la solicite."
}

$base = $BaseUrl
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Get-XsrfToken {
    foreach ($cookie in $session.Cookies.GetCookies($base)) {
        if ($cookie.Name -eq "XSRF-TOKEN") {
            return [System.Uri]::UnescapeDataString($cookie.Value)
        }
    }

    return ""
}

function Get-HttpStatusCode($errorRecord) {
    try {
        if ($null -ne $errorRecord.Exception.Response -and $null -ne $errorRecord.Exception.Response.StatusCode) {
            $statusCode = $errorRecord.Exception.Response.StatusCode
            if ($statusCode -is [int]) {
                return $statusCode
            }
            if ($null -ne $statusCode.value__) {
                return [int] $statusCode.value__
            }
            return [int] $statusCode
        }
    } catch {
        # Some PowerShell versions expose HTTP failures only in the message.
    }

    $message = [string] $errorRecord.Exception.Message
    if ($message -match "\b(401|403|419|422|5\d\d)\b") {
        return [int] $Matches[1]
    }

    return $null
}

function New-BackupSmokeFailureMessage($purpose, $statusCode) {
    if ($null -eq $statusCode) {
        return "No se pudo comunicar con el servidor al intentar $purpose. Confirme que el servidor este encendido, la red LAN funcione y BaseUrl sea correcto."
    }

    switch ($statusCode) {
        401 {
            return "No se pudo $purpose porque la sesion fue rechazada. Confirme usuario y contrasena de soporte."
        }
        403 {
            return "No se pudo $purpose porque el usuario de soporte no tiene permiso. Pida a un administrador habilitar acceso a respaldos o use una cuenta autorizada."
        }
        419 {
            return "No se pudo $purpose porque la sesion vencio o no fue aceptada. Revise la hora del servidor y APP_URL/BaseUrl antes de reintentar."
        }
        422 {
            return "No se pudo $purpose porque el servidor rechazo los datos enviados. Confirme las credenciales de soporte."
        }
        default {
            if ($statusCode -ge 500) {
                return "No se pudo $purpose porque el servidor reporto un error interno. No reintente muchas veces; genere el paquete de soporte y revise logs autorizados."
            }

            return "No se pudo $purpose. El servidor devolvio HTTP $statusCode; confirme BaseUrl, permisos y estado del sistema."
        }
    }
}

function Invoke-Json($method, $path, $body = $null, $purpose = "call the backup API") {
    $headers = @{
        Accept = "application/json"
        Referer = "$base/login"
        Origin = $base
    }
    $xsrf = Get-XsrfToken
    if ($xsrf -ne "") {
        $headers["X-XSRF-TOKEN"] = $xsrf
    }

    $params = @{
        Method = $method
        Uri = "$base$path"
        WebSession = $session
        Headers = $headers
        TimeoutSec = 30
    }

    if ($null -ne $body) {
        $params["ContentType"] = "application/json"
        $params["Body"] = ($body | ConvertTo-Json -Depth 10)
    }

    try {
        $response = Invoke-WebRequest @params
    } catch {
        $statusCode = Get-HttpStatusCode $_
        throw (New-BackupSmokeFailureMessage $purpose $statusCode)
    }

    try {
        return $response.Content | ConvertFrom-Json
    } catch {
        throw "No se pudo $purpose porque la respuesta del servidor no fue JSON valido. Genere paquete de soporte y revise la ruta API."
    }
}

try {
    Invoke-WebRequest -Uri "$base/sanctum/csrf-cookie" -WebSession $session -UseBasicParsing -TimeoutSec 30 | Out-Null
} catch {
    throw "No se pudo contactar el sistema para validar respaldos. Confirme que el servidor este encendido, que APP_URL/BaseUrl sea correcto y que la red LAN funcione antes de crear un respaldo."
}

Invoke-Json "POST" "/api/auth/login" @{ login = $Login; password = $Password } "iniciar sesion en respaldos" | Out-Null

$created = Invoke-Json "POST" "/api/backups" @{} "crear un respaldo manual"
$backupId = $created.data.id
if ($null -eq $backupId) {
    throw "No se pudo confirmar el identificador del respaldo nuevo. Genere paquete de soporte y revise la respuesta del API."
}
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$current = $created.data

while ((Get-Date) -lt $deadline) {
    $list = Invoke-Json "GET" "/api/backups?status=all&per_page=25" $null "leer la lista de respaldos"
    $match = @($list.data | Where-Object { $_.id -eq $backupId }) | Select-Object -First 1
    if ($null -ne $match) {
        $current = $match
        if ($current.status -ne "pending") {
            break
        }
    }

    Start-Sleep -Seconds 5
}

if ($current.status -ne "success") {
    throw "La validacion de respaldos fallo. El respaldo $backupId termino como '$($current.status)' despues de ${TimeoutSeconds}s."
}

if (-not $current.checksum_sha256 -or $current.checksum_sha256.Length -ne 64) {
    throw "La validacion de respaldos fallo. El respaldo $backupId no tiene checksum SHA256."
}

if (($current.size_bytes -as [int64]) -le 0) {
    throw "La validacion de respaldos fallo. El respaldo $backupId tiene tamano invalido."
}

$evidenceDir = Split-Path -Parent $evidenceFullPath
if (-not (Test-Path -LiteralPath $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$lines = @(
    "# Backup worker smoke proof",
    "",
    "- Date/time: $now",
    "- Base URL: $base",
    "- Backup id: $backupId",
    "- Filename: $($current.filename)",
    "- Status: $($current.status)",
    "- Size bytes: $($current.size_bytes)",
    "- SHA256: $($current.checksum_sha256)",
    "- Final conclusion: Backup UI/API changed from pending to success with checksum and non-zero size.",
    "",
    "## Required checks",
    "",
    "- [x] Manual backup request created a pending job. Result/evidence: backup id $backupId.",
    "- [x] Worker processed backup to success. Result/evidence: status=$($current.status).",
    "- [x] Backup has checksum and size. Result/evidence: sha256=$($current.checksum_sha256), size=$($current.size_bytes)."
)

Set-Content -LiteralPath $evidenceFullPath -Value $lines -Encoding ASCII
Write-Host "Validacion de respaldos completada: respaldo $backupId"
Write-Host "Evidencia escrita en: $(Protect-SmokeText $evidenceFullPath)"
