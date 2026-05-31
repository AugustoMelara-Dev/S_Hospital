param(
    [string] $BaseUrl = $env:HOSPITAL_SMOKE_BASE_URL,

    [string] $Login = $env:HOSPITAL_SMOKE_LOGIN,

    [string] $Password = $env:HOSPITAL_SMOKE_PASSWORD,

    [string] $EvidencePath = "qa\BACKUP_WORKER_SMOKE_PROOF.md",

    [int] $TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

trap {
    Write-Host $_.Exception.Message
    exit 1
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "BaseUrl is required. Pass -BaseUrl or set HOSPITAL_SMOKE_BASE_URL."
}

if ([string]::IsNullOrWhiteSpace($Login)) {
    throw "Login is required. Pass -Login or set HOSPITAL_SMOKE_LOGIN."
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $securePassword = Read-Host "Password for backup worker smoke user" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "Password is required. Pass -Password, set HOSPITAL_SMOKE_PASSWORD, or enter it at the prompt."
}

$base = $BaseUrl.TrimEnd("/")
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
        return "Backup worker smoke could not communicate with the server while trying to $purpose. Confirm the server is running, the LAN connection is available, and the BaseUrl is correct."
    }

    switch ($statusCode) {
        401 {
            return "Backup worker smoke could not $purpose because the session was rejected. Confirm the support user and password are correct, then sign in again."
        }
        403 {
            return "Backup worker smoke could not $purpose because the support user does not have permission. Ask an administrator to grant backup access or use an authorized account."
        }
        419 {
            return "Backup worker smoke could not $purpose because the session token expired or was not accepted. Run the script again after confirming the server clock and APP_URL/BaseUrl."
        }
        422 {
            return "Backup worker smoke could not $purpose because the server rejected the request data. Confirm the support user credentials and try again."
        }
        default {
            if ($statusCode -ge 500) {
                return "Backup worker smoke could not $purpose because the server reported an internal error. Do not retry repeatedly; collect the support packet and review Laravel logs with support."
            }

            return "Backup worker smoke could not $purpose. HTTP status $statusCode was returned; confirm the BaseUrl, permissions, and current system status."
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
        throw "Backup worker smoke could not $purpose because the server response was not valid JSON. Confirm the route returns the API response, then collect the support packet."
    }
}

try {
    Invoke-WebRequest -Uri "$base/sanctum/csrf-cookie" -WebSession $session -UseBasicParsing -TimeoutSec 30 | Out-Null
} catch {
    throw "Backup worker smoke could not reach $base. Confirm the server is running, APP_URL/BaseUrl is correct, and the LAN connection is available before creating a backup."
}

Invoke-Json "POST" "/api/auth/login" @{ login = $Login; password = $Password } "sign in to the backup system" | Out-Null

$created = Invoke-Json "POST" "/api/backups" @{} "create a manual backup"
$backupId = $created.data.id
if ($null -eq $backupId) {
    throw "Backup worker smoke could not confirm the new backup id. Confirm the backup API response and collect the support packet."
}
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$current = $created.data

while ((Get-Date) -lt $deadline) {
    $list = Invoke-Json "GET" "/api/backups?status=all&per_page=25" $null "read the backup list"
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
    throw "Backup worker smoke failed. Backup $backupId ended as '$($current.status)' after ${TimeoutSeconds}s."
}

if (-not $current.checksum_sha256 -or $current.checksum_sha256.Length -ne 64) {
    throw "Backup worker smoke failed. Backup $backupId has no SHA256 checksum."
}

if (($current.size_bytes -as [int64]) -le 0) {
    throw "Backup worker smoke failed. Backup $backupId has invalid size_bytes."
}

$evidenceFullPath = if ([System.IO.Path]::IsPathRooted($EvidencePath)) {
    $EvidencePath
} else {
    Join-Path (Get-Location) $EvidencePath
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
Write-Host "Backup worker smoke validated: backup $backupId"
Write-Host "Evidence written to $evidenceFullPath"
