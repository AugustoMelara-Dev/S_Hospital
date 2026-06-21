param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $EvidencePath = "",

    [int] $WebSocketPort = 0,

    [string] $ResponsiblePerson = "",
    [string] $UserRole = ""
)

$ErrorActionPreference = "Stop"

function New-SafeFileName([string] $value) {
    $safe = $value -replace '^https?://', ''
    $safe = $safe -replace '[^a-zA-Z0-9.-]+', '-'
    return $safe.Trim('-')
}

function New-HttpCheck([string] $Label, [string] $Url, [int[]] $AllowedStatusCodes = @(200), [string] $ExpectedContentType = "") {
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
            StatusCode = ""
            ContentType = ""
            Passed = $false
            Detail = $_.Exception.Message
        }
    }
}

function New-TcpCheck([string] $Label, [string] $HostName, [int] $Port) {
    $client = $null
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $async = $client.BeginConnect($HostName, $Port, $null, $null)
        $connected = $async.AsyncWaitHandle.WaitOne([TimeSpan]::FromSeconds(8))
        if (-not $connected) {
            return [ordered] @{
                Label = $Label
                Url = "tcp://${HostName}:${Port}"
                StatusCode = ""
                ContentType = "tcp"
                Passed = $false
                Detail = "TCP timeout"
            }
        }

        $client.EndConnect($async)
        return [ordered] @{
            Label = $Label
            Url = "tcp://${HostName}:${Port}"
            StatusCode = 0
            ContentType = "tcp"
            Passed = $true
            Detail = "TCP connect OK"
        }
    } catch {
        return [ordered] @{
            Label = $Label
            Url = "tcp://${HostName}:${Port}"
            StatusCode = ""
            ContentType = "tcp"
            Passed = $false
            Detail = $_.Exception.Message
        }
    } finally {
        if ($null -ne $client) {
            $client.Close()
            $client.Dispose()
        }
    }
}

function Get-FirstAssetPath([string] $Base) {
    try {
        $loginResponse = Invoke-WebRequest -Uri "$($Base.TrimEnd('/'))/login" -UseBasicParsing -TimeoutSec 20
        $matches = [regex]::Matches($loginResponse.Content, 'src="(?<path>/assets/[^"]+\.js)"')
        if ($matches.Count -gt 0) {
            return $matches[0].Groups["path"].Value
        }
    } catch {
        return $null
    }

    return $null
}

function Get-EchoConfig([string] $Base) {
    try {
        $response = Invoke-WebRequest -Uri "$($Base.TrimEnd('/'))/api/system/echo-config" -UseBasicParsing -TimeoutSec 20
        return $response.Content | ConvertFrom-Json
    } catch {
        return $null
    }
}

$BaseUrl = $BaseUrl.TrimEnd("/")
$baseUri = [Uri] $BaseUrl

if ($baseUri.Scheme -notin @("http", "https")) {
    throw "BaseUrl debe iniciar con http:// o https://"
}

if ($baseUri.Host -match '^(localhost|127\.0\.0\.1|::1)$') {
    Write-Host "[WARN] BaseUrl usa localhost. Para cerrar produccion debe usar la IP/nombre LAN del servidor." -ForegroundColor Yellow
}

if ([string]::IsNullOrWhiteSpace($EvidencePath)) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $EvidencePath = Join-Path $env:USERPROFILE "Desktop\LAN_CLIENT_VALIDATION_PROOF-$stamp-$(New-SafeFileName $BaseUrl).md"
}

$evidenceDir = Split-Path -Parent $EvidencePath
if (-not [string]::IsNullOrWhiteSpace($evidenceDir) -and -not (Test-Path -LiteralPath $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

$assetPath = Get-FirstAssetPath $BaseUrl
$echoPayload = Get-EchoConfig $BaseUrl
$echoConfig = if ($null -ne $echoPayload -and $null -ne $echoPayload.data) { $echoPayload.data } else { $null }

$checks = New-Object System.Collections.Generic.List[object]
$checks.Add((New-HttpCheck "/up" "$BaseUrl/up")) | Out-Null
$checks.Add((New-HttpCheck "/login" "$BaseUrl/login")) | Out-Null
$checks.Add((New-HttpCheck "/verify-email" "$BaseUrl/verify-email" @(200, 302))) | Out-Null
$checks.Add((New-HttpCheck "/api/system/echo-config" "$BaseUrl/api/system/echo-config" @(200) "json")) | Out-Null

if ($assetPath) {
    $checks.Add((New-HttpCheck "/assets/*.js" "$BaseUrl$assetPath" @(200) "javascript")) | Out-Null
} else {
    $checks.Add([ordered] @{
        Label = "/assets/*.js"
        Url = "$BaseUrl/assets/*.js"
        StatusCode = ""
        ContentType = ""
        Passed = $false
        Detail = "Could not discover a JS asset from /login"
    }) | Out-Null
}

$resolvedWebSocketPort = $WebSocketPort
if ($resolvedWebSocketPort -le 0 -and $null -ne $echoConfig -and $null -ne $echoConfig.port) {
    $resolvedWebSocketPort = [int] $echoConfig.port
}

if ($null -eq $echoConfig) {
    $checks.Add([ordered] @{
        Label = "WebSocket config"
        Url = "$BaseUrl/api/system/echo-config"
        StatusCode = ""
        ContentType = "application/json"
        Passed = $false
        Detail = "Could not read Echo/Soketi client config"
    }) | Out-Null
} elseif ($echoConfig.enabled -ne $true) {
    $checks.Add([ordered] @{
        Label = "WebSocket config"
        Url = "$BaseUrl/api/system/echo-config"
        StatusCode = 200
        ContentType = "application/json"
        Passed = $false
        Detail = "Realtime is disabled; multi-PC cashier sync requires Soketi/Pusher enabled"
    }) | Out-Null
} elseif ($resolvedWebSocketPort -lt 1 -or $resolvedWebSocketPort -gt 65535) {
    $checks.Add([ordered] @{
        Label = "WebSocket TCP"
        Url = "tcp://$($baseUri.Host):$resolvedWebSocketPort"
        StatusCode = ""
        ContentType = "tcp"
        Passed = $false
        Detail = "Invalid WebSocket port"
    }) | Out-Null
} else {
    $webSocketHost = if (-not [string]::IsNullOrWhiteSpace([string] $echoConfig.host)) {
        [string] $echoConfig.host
    } else {
        $baseUri.Host
    }

    $checks.Add((New-TcpCheck "WebSocket TCP" $webSocketHost $resolvedWebSocketPort)) | Out-Null
}

$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$allPassed = -not ($checks | Where-Object { -not $_.Passed })

Write-Host "LAN client validation for $BaseUrl"
foreach ($check in $checks) {
    $prefix = if ($check.Passed) { "[ OK ]" } else { "[FAIL]" }
    $color = if ($check.Passed) { "Green" } else { "Red" }
    Write-Host "$prefix $($check.Label): $($check.StatusCode) $($check.ContentType) $($check.Detail)" -ForegroundColor $color
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# LAN client validation proof") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Environment") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Date/time: $now") | Out-Null
$lines.Add("- Responsible person: $ResponsiblePerson") | Out-Null
$lines.Add("- Client computer name: $env:COMPUTERNAME") | Out-Null
$lines.Add("- Windows user: $env:USERNAME") | Out-Null
$lines.Add("- Server IP or LAN name: $($baseUri.Host)") | Out-Null
$lines.Add("- Server LAN URL: $BaseUrl") | Out-Null
$lines.Add("- User/role used: $UserRole") | Out-Null
$lines.Add("- Evidence/capture reference: Standalone PowerShell validation; attach screenshots/photos for login/POS/backups") | Out-Null
$lines.Add("- Final conclusion: $(if ($allPassed) { 'Routes validated; complete browser workflow checks before PRODUCTION_READY' } else { 'Route validation failed; fix failures before PRODUCTION_READY' })") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Automated checks") | Out-Null
$lines.Add("") | Out-Null

foreach ($check in $checks) {
    $mark = if ($check.Passed) { "x" } else { " " }
    $lines.Add("- [$mark] $($check.Label) `"$($check.Url)`". Result/evidence: $($check.StatusCode) $($check.ContentType) $($check.Detail)") | Out-Null
}

$lines.Add("") | Out-Null
$lines.Add("## Manual browser workflow from this second PC") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- [ ] Login completes without 419, session expired, or redirect loop. Result/evidence:") | Out-Null
$lines.Add("- [ ] Dashboard loads and shows server/local-network status. Result/evidence:") | Out-Null
$lines.Add("- [ ] Cashbox opens or current cashbox status is visible. Result/evidence:") | Out-Null
$lines.Add("- [ ] Invoice is created with patient name. Result/evidence:") | Out-Null
$lines.Add("- [ ] Payment is registered without duplicate/overpayment. Result/evidence:") | Out-Null
$lines.Add("- [ ] Receipt preview opens and PDF downloads. Result/evidence:") | Out-Null
$lines.Add("- [ ] Invoice history and reprint prompt work. Result/evidence:") | Out-Null
$lines.Add("- [ ] Reports load and export controls respond according to permissions. Result/evidence:") | Out-Null
$lines.Add("- [ ] Backup request from UI changes from pending to success or shows safe actionable error. Result/evidence:") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Evidence") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Screenshot/photo/log reference per step:") | Out-Null
$lines.Add("- Notes:") | Out-Null

Set-Content -LiteralPath $EvidencePath -Value $lines -Encoding ASCII
Write-Host "Evidence saved to: $EvidencePath"

if (-not $allPassed) {
    exit 1
}
