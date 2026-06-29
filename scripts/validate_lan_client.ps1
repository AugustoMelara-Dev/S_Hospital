param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [string] $EvidencePath = "",

    [string] $ClientName = $env:COMPUTERNAME,
    [string] $ResponsiblePerson = "",
    [string] $UserRole = "",

    [switch] $Force,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

function Protect-LanText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    if (-not [string]::IsNullOrWhiteSpace($script:ProjectRoot)) {
        $protected = $protected -replace [regex]::Escape($script:ProjectRoot), "%PROJECT_ROOT%"
        $protected = $protected -replace [regex]::Escape(($script:ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

trap {
    $safeMessage = Protect-LanText $_.Exception.Message
    Write-Host $safeMessage
    if ($safeMessage -match "ya existe") {
        Write-Host "No reemplace evidencia LAN existente sin -Force y sin autorizacion del responsable tecnico."
    } else {
        Write-Host "No se consulto la red ni se escribio evidencia LAN."
    }
    exit 1
}

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

function Resolve-LanEvidencePath([string] $path) {
    if ([string]::IsNullOrWhiteSpace($path)) {
        return ""
    }

    if ([System.IO.Path]::GetExtension($path) -ne ".md") {
        throw "La evidencia LAN debe ser un archivo Markdown (.md) dentro de qa."
    }

    $candidate = if ([System.IO.Path]::IsPathRooted($path)) {
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($path)
    } else {
        Join-Path $ProjectRoot $path
    }

    $fullPath = [System.IO.Path]::GetFullPath($candidate)
    $qaRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "qa"))
    $qaPrefix = $qaRoot.TrimEnd("\") + "\"

    if ($fullPath -eq $qaRoot -or -not $fullPath.StartsWith($qaPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "La evidencia LAN debe guardarse como archivo .md dentro de la carpeta qa del sistema."
    }

    return $fullPath
}

function New-CheckResult([string] $Label, [string] $Url, [int[]] $AllowedStatusCodes = @(200), [string] $ExpectedContentType = "") {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
        $status = [int] $response.StatusCode
        $contentType = [string] $response.Headers["Content-Type"]
        $statusOk = $AllowedStatusCodes -contains $status
        $typeOk = $ExpectedContentType -eq "" -or $contentType.ToLowerInvariant().Contains($ExpectedContentType.ToLowerInvariant())

        return [ordered] @{
            Label = $Label
            Url = $Url
            StatusCode = $status
            ContentType = $contentType
            Passed = $statusOk -and $typeOk
            Detail = if ($statusOk -and $typeOk) { "OK" } else { "Unexpected response" }
        }
    } catch {
        return [ordered] @{
            Label = $Label
            Url = $Url
            StatusCode = $null
            ContentType = ""
            Passed = $false
            Detail = $_.Exception.Message
        }
    }
}

function Read-LanEnvFile([string] $path) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $path)) {
        return $values
    }

    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $key, $value = $line.Split("=", 2)
        $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-LanEnvValue($values, [string] $key, [string] $fallback = "") {
    if ($values.ContainsKey($key) -and $values[$key] -ne "") {
        return $values[$key]
    }

    return $fallback
}

function New-WebSocketCheckResult([string] $BaseUrl, [string] $PusherKey) {
    if ([string]::IsNullOrWhiteSpace($PusherKey)) {
        return [ordered] @{
            Label = "Realtime WebSocket"
            Url = "$($BaseUrl.TrimEnd('/'))/app/<pusher-key>"
            StatusCode = $null
            ContentType = ""
            Passed = $false
            Detail = "PUSHER_APP_KEY missing in .env/backend.env"
        }
    }

    $baseUri = [Uri] $BaseUrl
    $scheme = if ($baseUri.Scheme -eq "https") { "wss" } else { "ws" }
    $builder = [System.UriBuilder]::new($baseUri)
    $builder.Scheme = $scheme
    $builder.Path = "/app/$PusherKey"
    $builder.Query = "protocol=7&client=js&version=8.5.0&flash=false"

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $cts = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(10))
    try {
        $socket.ConnectAsync($builder.Uri, $cts.Token).GetAwaiter().GetResult()
        return [ordered] @{
            Label = "Realtime WebSocket"
            Url = $builder.Uri.ToString()
            StatusCode = 101
            ContentType = "websocket"
            Passed = $socket.State -eq [System.Net.WebSockets.WebSocketState]::Open
            Detail = "Handshake state=$($socket.State)"
        }
    } catch {
        return [ordered] @{
            Label = "Realtime WebSocket"
            Url = $builder.Uri.ToString()
            StatusCode = $null
            ContentType = ""
            Passed = $false
            Detail = $_.Exception.Message
        }
    } finally {
        if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
            $socket.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "lan-validation", [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()
        }
        $socket.Dispose()
        $cts.Dispose()
    }
}

function Get-FirstAssetPath([string] $BaseUrl) {
    try {
        $loginResponse = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/login" -UseBasicParsing -TimeoutSec 20
        $matches = [regex]::Matches($loginResponse.Content, 'src="(?<path>/assets/[^"]+\.js)"')
        if ($matches.Count -gt 0) {
            return $matches[0].Groups["path"].Value
        }
    } catch {
        return $null
    }

    return $null
}

$base = Test-HospitalOperationalUrlInput $BaseUrl
$baseUri = [Uri] $base
$rootEnv = Read-LanEnvFile (Join-Path $ProjectRoot ".env")
$backendEnv = Read-LanEnvFile (Join-Path $ProjectRoot "backend\.env")
$pusherAppKey = Get-LanEnvValue $rootEnv "PUSHER_APP_KEY" (Get-LanEnvValue $backendEnv "PUSHER_APP_KEY" "")

$resolvedEvidencePath = $EvidencePath
if ($EvidencePath -ne "") {
    $resolvedEvidencePath = Resolve-LanEvidencePath $EvidencePath

    if ((Test-Path -LiteralPath $resolvedEvidencePath) -and -not $Force) {
        throw "La evidencia LAN ya existe. Use -Force solo si el responsable tecnico autorizo reemplazarla."
    }
}

if ($WhatIfOnly) {
    Write-Host "Validacion LAN preparada."
    Write-Host "Modo WhatIf: no se consulto la red y no se escribio evidencia."
    exit 0
}

if ($base -match "localhost|127\.0\.0\.1|::1") {
    Write-Host "[WARN] BaseUrl uses localhost. For production proof, run this from a second LAN client using the server IP or LAN name." -ForegroundColor Yellow
}

$assetPath = Get-FirstAssetPath $base
$checks = New-Object System.Collections.Generic.List[object]
$checks.Add((New-CheckResult "/up" "$base/up")) | Out-Null
$checks.Add((New-CheckResult "/login" "$base/login")) | Out-Null
$checks.Add((New-CheckResult "/verify-email" "$base/verify-email" @(200, 302))) | Out-Null

if ($assetPath) {
    $checks.Add((New-CheckResult "/assets/*.js" "$base$assetPath" @(200) "javascript")) | Out-Null
} else {
    $checks.Add([ordered] @{
        Label = "/assets/*.js"
        Url = "$base/assets/*.js"
        StatusCode = $null
        ContentType = ""
        Passed = $false
        Detail = "Could not discover a JS asset from /login"
    }) | Out-Null
}

$checks.Add((New-WebSocketCheckResult $base $pusherAppKey)) | Out-Null

Write-Host "LAN client validation for $base"
foreach ($check in $checks) {
    $prefix = if ($check.Passed) { "[ OK ]" } else { "[FAIL]" }
    $color = if ($check.Passed) { "Green" } else { "Red" }
    Write-Host "$prefix $($check.Label): $($check.StatusCode) $($check.ContentType) $($check.Detail)" -ForegroundColor $color
}

$allPassed = -not ($checks | Where-Object { -not $_.Passed })

if ($EvidencePath -ne "") {
    $EvidencePath = $resolvedEvidencePath
    $evidenceDir = Split-Path -Parent $EvidencePath
    if (-not [string]::IsNullOrWhiteSpace($evidenceDir) -and -not (Test-Path -LiteralPath $evidenceDir)) {
        New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
    }

    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("# LAN client validation proof") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("## Environment") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("- Date/time: $now") | Out-Null
    $lines.Add("- Responsible person: $ResponsiblePerson") | Out-Null
    $lines.Add("- Client computer name: $ClientName") | Out-Null
    $lines.Add("- Server IP or LAN name: $($baseUri.Host)") | Out-Null
    $lines.Add("- Server LAN URL: $base") | Out-Null
    $lines.Add("- Client browser/version: Pending browser login validation") | Out-Null
    $lines.Add("- User/role used: $UserRole") | Out-Null
    $lines.Add("- Evidence/capture reference: Generated by scripts\validate_lan_client.ps1; add screenshots/photos for login/POS/backups") | Out-Null
    $lines.Add("- Final conclusion: $(if ($allPassed) { 'Routes validated; complete browser workflow checks before PRODUCTION_READY' } else { 'Route validation failed; fix failures before PRODUCTION_READY' })") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("## Required checks") | Out-Null

    foreach ($check in $checks) {
        $mark = if ($check.Passed) { "x" } else { " " }
        $label = switch ($check.Label) {
            "/assets/*.js" { "/assets/*.js loads as JavaScript" }
            "Realtime WebSocket" { "Realtime WebSocket handshake succeeds through the same LAN origin" }
            default { "$($check.Label) responds from the client computer" }
        }
        $lines.Add("- [$mark] $label. Result/evidence: $($check.StatusCode) $($check.ContentType) $($check.Detail)") | Out-Null
    }

    $lines.Add("- [ ] Login completes without 419 or session-expired state. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Cashbox opens. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Invoice is created with patient name. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Payment is registered. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Receipt preview opens. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Invoice history and reprint work. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Reports load. Result/evidence:") | Out-Null
    $lines.Add("- [ ] Backup request from UI changes from `pending` to `success`. Result/evidence:") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("## Evidence") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add("- Screenshot/photo/log reference per step:") | Out-Null
    $lines.Add("- Notes:") | Out-Null

    Set-Content -LiteralPath $EvidencePath -Value $lines -Encoding ASCII
    $writeMode = if ($Force) { "replaced" } else { "created" }
    Write-Host "LAN evidence starter ${writeMode}: $(Protect-LanText $EvidencePath)"
}

if (-not $allPassed) {
    exit 1
}
