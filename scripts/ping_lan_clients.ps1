param(
    [Parameter(Mandatory = $true)]
    [string] $ServerUrl,

    [int] $TimeoutSeconds = 5,

    [string] $EvidencePath = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not $ServerUrl.StartsWith("http://") -and -not $ServerUrl.StartsWith("https://")) {
    Write-Host "ERROR: -ServerUrl debe comenzar con http:// o https://" -ForegroundColor Red
    exit 1
}

$ServerUrl = $ServerUrl.TrimEnd("/")

$checks = @(
    @{ name = "up"; path = "/up" }
    @{ name = "login"; path = "/login" }
    @{ name = "verify-email"; path = "/verify-email" }
    @{ name = "api-health"; path = "/api/system/health" }
    @{ name = "asset-js"; path = "/assets/index-$(if ($true) { 'placeholder' } else { '' }).js" }
    @{ name = "asset-css"; path = "/assets/index-$(if ($true) { 'placeholder' } else { '' }).css" }
)

$results = New-Object System.Collections.Generic.List[object]

foreach ($check in $checks) {
    $url = "$ServerUrl$($check.path)"
    $entry = [pscustomobject]@{
        check = $check.name
        url = $url
        status = "FAIL"
        statusCode = 0
        durationMs = 0
        notes = ""
    }

    $start = Get-Date
    try {
        $request = [System.Net.HttpWebRequest]::Create($url)
        $request.Timeout = $TimeoutSeconds * 1000
        $request.Method = "GET"
        $request.AllowAutoRedirect = $false
        $request.UserAgent = "S-Hospital-LAN-Ping/1.0"

        try {
            $response = $request.GetResponse()
            $entry.statusCode = [int]$response.StatusCode
            $response.Close()
        }
        catch [System.Net.WebException] {
            $webResponse = $_.Exception.Response
            if ($webResponse -ne $null) {
                $entry.statusCode = [int][System.Net.HttpStatusCode]$webResponse.StatusCode
            }
            $entry.notes = $_.Exception.Message
        }

        $entry.durationMs = [int]((Get-Date) - $start).TotalMilliseconds

        if ($check.name -like "asset-*") {
            $entry.status = if ($entry.statusCode -eq 200 -or $entry.statusCode -eq 404) { "OK" } else { "FAIL" }
        }
        else {
            $entry.status = if ($entry.statusCode -eq 200) { "OK" } else { "FAIL" }
        }
    }
    catch {
        $entry.durationMs = [int]((Get-Date) - $start).TotalMilliseconds
        $entry.notes = $_.Exception.Message
    }

    $results.Add($entry)
}

Write-Host ""
Write-Host "Resultados de ping LAN:" -ForegroundColor Cyan
Write-Host ("=" * 70)
foreach ($r in $results) {
    $color = if ($r.status -eq "OK") { "Green" } else { "Red" }
    $line = "{0,-14} {1,-6} {2,5}ms {3}" -f $r.check, $r.status, $r.durationMs, $r.url
    Write-Host $line -ForegroundColor $color
    if ($r.notes -and $r.notes.Length -gt 0) {
        Write-Host ("                " + $r.notes) -ForegroundColor DarkYellow
    }
}
Write-Host ("=" * 70)

$failed = $results | Where-Object { $_.status -ne "OK" } | Measure-Object
Write-Host ""
if ($failed.Count -eq 0) {
    Write-Host "OK: todas las rutas respondieron. La PC cliente puede operar." -ForegroundColor Green
    $exit = 0
}
else {
    Write-Host "FAIL: $($failed.Count) ruta(s) fallaron. Revise el servidor antes de operar." -ForegroundColor Red
    $exit = 1
}

if ($EvidencePath -ne "") {
    $resolved = Resolve-Path -LiteralPath (Split-Path -Parent $EvidencePath) -ErrorAction SilentlyContinue
    if (-not $resolved) {
        $resolved = Split-Path -Parent $EvidencePath
        if (-not (Test-Path -LiteralPath $resolved)) {
            New-Item -ItemType Directory -Path $resolved -Force | Out-Null
        }
    }

    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $lines = @(
        "# Ping LAN cliente - $timestamp",
        "",
        "- ServerUrl probado: $ServerUrl",
        "- Timeout por request: ${TimeoutSeconds}s",
        "- Computadora cliente: $env:COMPUTERNAME",
        "",
        "| Check | Status | HTTP | Duracion (ms) | URL |",
        "|-------|--------|------|---------------|-----|"
    )
    foreach ($r in $results) {
        $lines += "| $($r.check) | $($r.status) | $($r.statusCode) | $($r.durationMs) | $($r.url) |"
    }
    $lines += ""
    $lines += "Conclusion: $(if ($failed.Count -eq 0) { 'OK' } else { "FAIL ($($failed.Count) rutas)" })"

    Set-Content -LiteralPath $EvidencePath -Value ($lines -join "`n") -Encoding UTF8
    Write-Host ""
    Write-Host "Evidencia guardada en: $EvidencePath" -ForegroundColor DarkCyan
}

exit $exit
