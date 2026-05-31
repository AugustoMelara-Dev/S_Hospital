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

trap {
    Write-Host $_.Exception.Message
    Write-Host "No reemplace evidencia LAN existente sin -Force y sin autorizacion del responsable tecnico."
    exit 1
}

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

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

$base = $BaseUrl.TrimEnd("/")
$baseUri = $null
if (-not [Uri]::TryCreate($base, [UriKind]::Absolute, [ref] $baseUri) -or $baseUri.Scheme -notin @("http", "https")) {
    throw "BaseUrl debe ser una direccion LAN absoluta http(s), por ejemplo http://192.168.1.10:8000"
}

$resolvedEvidencePath = $EvidencePath
if ($EvidencePath -ne "") {
    $candidateEvidencePath = if ([System.IO.Path]::IsPathRooted($EvidencePath)) {
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($EvidencePath)
    } else {
        Join-Path $ProjectRoot $EvidencePath
    }
    $resolvedEvidencePath = [System.IO.Path]::GetFullPath($candidateEvidencePath)
    $rootPrefix = $ProjectRoot.TrimEnd("\") + "\"

    if ($resolvedEvidencePath -eq $ProjectRoot -or -not $resolvedEvidencePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "La evidencia LAN debe guardarse dentro de la carpeta instalada del sistema."
    }

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
    Write-Host "LAN evidence starter ${writeMode}: $EvidencePath"
}

if (-not $allPassed) {
    exit 1
}
