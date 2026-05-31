param(
    [string] $BaseUrl = $env:HOSPITAL_SMOKE_BASE_URL,

    [string] $Login = $env:HOSPITAL_SMOKE_LOGIN,

    [string] $Password = $env:HOSPITAL_SMOKE_PASSWORD,

    [string] $EvidencePath = "qa\BACKUP_WORKER_SMOKE_PROOF.md",

    [int] $TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"

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

function Invoke-Json($method, $path, $body = $null) {
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

    $response = Invoke-WebRequest @params
    return $response.Content | ConvertFrom-Json
}

try {
    Invoke-WebRequest -Uri "$base/sanctum/csrf-cookie" -WebSession $session -UseBasicParsing -TimeoutSec 30 | Out-Null
} catch {
    throw "Backup worker smoke could not reach $base. Confirm the server is running, APP_URL/BaseUrl is correct, and the LAN connection is available before creating a backup."
}

Invoke-Json "POST" "/api/auth/login" @{ login = $Login; password = $Password } | Out-Null

$created = Invoke-Json "POST" "/api/backups" @{}
$backupId = $created.data.id
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$current = $created.data

while ((Get-Date) -lt $deadline) {
    $list = Invoke-Json "GET" "/api/backups?status=all&per_page=25"
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
