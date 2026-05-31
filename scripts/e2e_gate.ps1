param(
    [string] $BaseUrl = $env:PLAYWRIGHT_BASE_URL,
    [switch] $UseExistingServer
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$resolvedBaseUrl = if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    'http://127.0.0.1:5173'
} else {
    $BaseUrl.TrimEnd('/')
}
$url = "$resolvedBaseUrl/login"
$server = $null
$previousExternalServer = $env:PLAYWRIGHT_EXTERNAL_SERVER
$previousBaseUrl = $env:PLAYWRIGHT_BASE_URL

try {
    if (-not $UseExistingServer) {
        if ($resolvedBaseUrl -ne 'http://127.0.0.1:5173') {
            throw 'Use -UseExistingServer when passing a custom -BaseUrl. The built-in dev server gate only starts Vite on http://127.0.0.1:5173.'
        }

        $server = Start-Process -FilePath 'npm.cmd' `
            -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') `
            -WorkingDirectory $frontend `
            -WindowStyle Hidden `
            -PassThru
    }

    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $ready) {
        throw "Playwright target did not become ready at $url."
    }

    Push-Location $frontend
    $env:PLAYWRIGHT_EXTERNAL_SERVER = '1'
    $env:PLAYWRIGHT_BASE_URL = $resolvedBaseUrl
    npm.cmd run e2e
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location -ErrorAction SilentlyContinue

    if ($null -eq $previousExternalServer) {
        Remove-Item Env:\PLAYWRIGHT_EXTERNAL_SERVER -ErrorAction SilentlyContinue
    } else {
        $env:PLAYWRIGHT_EXTERNAL_SERVER = $previousExternalServer
    }

    if ($null -eq $previousBaseUrl) {
        Remove-Item Env:\PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
    } else {
        $env:PLAYWRIGHT_BASE_URL = $previousBaseUrl
    }

    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
