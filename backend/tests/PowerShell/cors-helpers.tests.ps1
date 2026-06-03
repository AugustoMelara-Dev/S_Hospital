# =============================================================================
# Tests for scripts/lib/cors_helpers.ps1
# =============================================================================
param(
    [string] $HelperPath
)

$ErrorActionPreference = "Stop"

if (-not $HelperPath) {
    $HelperPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\scripts\lib\cors_helpers.ps1")).Path
}
if (-not (Test-Path -LiteralPath $HelperPath)) {
    Write-Error "Helper not found: $HelperPath"
    exit 2
}

. $HelperPath

$failures = New-Object System.Collections.Generic.List[string]

function Assert-Equal {
    param([string] $Label, $Expected, $Actual)
    if ($Expected -eq $Actual) {
        Write-Host "PASS: $Label" -ForegroundColor Green
    } else {
        Write-Host "FAIL: $Label" -ForegroundColor Red
        Write-Host "  Expected: $Expected"
        Write-Host "  Actual:   $Actual"
        $script:failures.Add($Label) | Out-Null
    }
}

# 1. Production minimal value excludes Vite dev port 5173 and localhost.
$result = Get-ProductionCorsValues -ServerIp "192.168.1.10" -AppPort 8000
Assert-Equal "Sanctum has LAN host"        $true ($result.SanctumStatefulDomains -split ',' | Where-Object { $_ -eq '192.168.1.10' }).Count -eq 1
Assert-Equal "Sanctum has LAN host:port"   $true ($result.SanctumStatefulDomains -split ',' | Where-Object { $_ -eq '192.168.1.10:8000' }).Count -eq 1
Assert-Equal "Sanctum excludes 5173"       $false (($result.SanctumStatefulDomains -split ',') -contains 'localhost:5173' -or ($result.SanctumStatefulDomains -split ',') -contains '192.168.1.10:5173')
Assert-Equal "CORS has http LAN host"      $true ($result.CorsAllowedOrigins -split ',' | Where-Object { $_ -eq 'http://192.168.1.10:8000' }).Count -eq 1
Assert-Equal "CORS has https LAN host"     $true ($result.CorsAllowedOrigins -split ',' | Where-Object { $_ -eq 'https://192.168.1.10:8000' }).Count -eq 1
Assert-Equal "CORS excludes 5173"          $false (($result.CorsAllowedOrigins -split ',') -match ':5173').Count -gt 0

# 2. With -IncludeLocalhost, loopback is added.
$result2 = Get-ProductionCorsValues -ServerIp "192.168.1.10" -AppPort 8000 -IncludeLocalhost
Assert-Equal "Sanctum includes 127.0.0.1"  $true (($result2.SanctumStatefulDomains -split ',') -contains '127.0.0.1')
Assert-Equal "Sanctum includes ::1"        $true (($result2.SanctumStatefulDomains -split ',') -contains '::1')
Assert-Equal "CORS includes 127.0.0.1:8000" $true (($result2.CorsAllowedOrigins -split ',') -contains 'http://127.0.0.1:8000')

# 3. Bad inputs are rejected.
try {
    Get-ProductionCorsValues -ServerIp "not an ip" -AppPort 8000 -ErrorAction Stop
    $failures.Add("Bad ServerIp should throw") | Out-Null
} catch {
    Write-Host "PASS: Bad ServerIp throws" -ForegroundColor Green
}

try {
    Get-ProductionCorsValues -ServerIp "10.0.0.1" -AppPort 99999 -ErrorAction Stop
    $failures.Add("Out-of-range AppPort should throw") | Out-Null
} catch {
    Write-Host "PASS: Out-of-range AppPort throws" -ForegroundColor Green
}

# 4. Test-CorsOriginSafeForProduction accepts good values and rejects bad.
Assert-Equal "Empty is safe"               $true (Test-CorsOriginSafeForProduction -Value "")
Assert-Equal "Single origin is safe"       $true (Test-CorsOriginSafeForProduction -Value "http://192.168.1.10:8000")
Assert-Equal "Multi origin is safe"        $true (Test-CorsOriginSafeForProduction -Value "http://a:8000,https://b:8443")
Assert-Equal "Wildcard is rejected"        $false (Test-CorsOriginSafeForProduction -Value "*")
Assert-Equal "Wildcard mid-string rejected" $false (Test-CorsOriginSafeForProduction -Value "http://a,*,http://b")
Assert-Equal "Garbage rejected"            $false (Test-CorsOriginSafeForProduction -Value "javascript:alert(1)")

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "CORS helper tests failed: $($failures.Count)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All CORS helper tests passed." -ForegroundColor Green
exit 0
