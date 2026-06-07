# =============================================================================
# Tests for scripts/lib/env_helpers.ps1
# =============================================================================
# Validates that Update-DotEnv produces ASCII, no-BOM files that
# docker compose and Laravel's Dotenv parser can read.
# =============================================================================
param(
    [string] $HelperPath
)

$ErrorActionPreference = "Stop"

if (-not $HelperPath) {
    $HelperPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\scripts\lib\env_helpers.ps1")).Path
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

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "hospital-env-test-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
try {
    $envFile = Join-Path $tempRoot ".env"

    # 1. Create a new .env from scratch.
    Update-DotEnv -Path $envFile -Variables @{
        APP_KEY = "base64:abc1234567890def"
        DB_PASSWORD = "secret"
    }

    $content = Get-Content -LiteralPath $envFile -Raw
    Assert-Equal "File contains APP_KEY"        $true ($content -match 'APP_KEY=base64:abc1234567890def')
    Assert-Equal "File contains DB_PASSWORD"    $true ($content -match 'DB_PASSWORD=secret')

    # 2. Verify no UTF-16 LE BOM (0xFF 0xFE) at the start.
    $bytes = [System.IO.File]::ReadAllBytes($envFile)
    $hasUtf16Bom = ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE)
    $hasUtf8Bom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    Assert-Equal "No UTF-16 BOM"               $false $hasUtf16Bom
    Assert-Equal "No UTF-8 BOM"                $false $hasUtf8Bom

    # 3. Verify ASCII-only content (each byte 0x00-0x7F, except for \r\n line endings).
    $nonAscii = 0
    foreach ($b in $bytes) {
        if ($b -gt 0x7F) { $nonAscii++ }
    }
    Assert-Equal "ASCII-only bytes"            0 $nonAscii

    # 4. Update an existing key without losing other content.
    Update-DotEnv -Path $envFile -Variables @{ DB_PASSWORD = "newsecret" }
    $content = Get-Content -LiteralPath $envFile -Raw
    Assert-Equal "DB_PASSWORD updated"         $true ($content -match 'DB_PASSWORD=newsecret')
    Assert-Equal "APP_KEY preserved"           $true ($content -match 'APP_KEY=base64:abc1234567890def')

    # 5. Append new keys.
    Update-DotEnv -Path $envFile -Variables @{ NEW_VAR = "newvalue" }
    $content = Get-Content -LiteralPath $envFile -Raw
    Assert-Equal "New var appended"            $true ($content -match 'NEW_VAR=newvalue')

    # 6. Quoted values are preserved as-is.
    Update-DotEnv -Path $envFile -Variables @{ APP_NAME = "Hospital San Isidro" }
    $content = Get-Content -LiteralPath $envFile -Raw
    Assert-Equal "Spaces wrap in quotes"       $true ($content -match 'APP_NAME="Hospital San Isidro"')

    Write-Host ""
    if ($failures.Count -gt 0) {
        Write-Host "FAIL: $($failures.Count) test(s) failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "All env_helpers tests passed." -ForegroundColor Green
    exit 0
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
