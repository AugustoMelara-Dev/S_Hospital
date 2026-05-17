$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$url = 'http://127.0.0.1:5173/login'
$server = $null

try {
    $server = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1') `
        -WorkingDirectory $frontend `
        -WindowStyle Hidden `
        -PassThru

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
        throw "Vite dev server did not become ready at $url."
    }

    Push-Location $frontend
    $env:PLAYWRIGHT_EXTERNAL_SERVER = '1'
    npm.cmd run e2e
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    Remove-Item Env:\PLAYWRIGHT_EXTERNAL_SERVER -ErrorAction SilentlyContinue

    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
