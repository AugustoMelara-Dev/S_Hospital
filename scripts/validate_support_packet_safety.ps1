param(
    [string] $ProjectRoot = "",
    [switch] $KeepFixture
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$collector = Join-Path $ProjectRoot "scripts\collect_support_packet.ps1"
if (-not (Test-Path -LiteralPath $collector -PathType Leaf)) {
    Write-Host "[FAIL] No se encontro scripts\collect_support_packet.ps1." -ForegroundColor Red
    exit 1
}

$tempRoot = [System.IO.Path]::GetTempPath()
$fixtureName = "s-hospital-support-packet-validation-$([System.Guid]::NewGuid().ToString('N'))"
$fixtureRoot = Join-Path $tempRoot $fixtureName
$outputDir = Join-Path $fixtureRoot "qa\support-packets\validation"

function Write-Fail([string] $message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

function Remove-Fixture {
    if ($KeepFixture) {
        Write-Host "[INFO] Fixture conservado: $fixtureRoot" -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path -LiteralPath $fixtureRoot)) {
        return
    }

    $resolvedFixture = (Resolve-Path -LiteralPath $fixtureRoot).Path
    $expectedPrefix = (Join-Path $tempRoot "s-hospital-support-packet-validation-")

    if (-not $resolvedFixture.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Fail "No se limpio el fixture porque la ruta no esta dentro del prefijo temporal esperado."
    }

    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}

try {
    New-Item -ItemType Directory -Force -Path `
        (Join-Path $fixtureRoot "qa"), `
        (Join-Path $fixtureRoot "backend\storage\logs") | Out-Null

    Set-Content -LiteralPath (Join-Path $fixtureRoot ".env") -Value @(
        "APP_KEY=base64:THIS_VALUE_MUST_NOT_LEAK"
        "DB_PASSWORD=fixture_db_password"
        "TOKEN=fixture_token"
    ) -Encoding ASCII

    Set-Content -LiteralPath (Join-Path $fixtureRoot "qa\LOCAL_REPAIR_DIAGNOSTIC.md") -Value @(
        "# Diagnostico fixture"
        "Ruta real: $fixtureRoot"
        "APP_KEY=base64:THIS_VALUE_MUST_NOT_LEAK"
        "DB_PASSWORD=fixture_db_password"
        "TOKEN=fixture_token"
    ) -Encoding ASCII

    Set-Content -LiteralPath (Join-Path $fixtureRoot "backend\storage\logs\laravel.log") -Value @(
        "SQLSTATE[HY000] error in $fixtureRoot\backend\.env"
        "MAIL_PASSWORD=fixture_mail_password"
        "C:\Hospital\Sistema\.env"
        "Access denied for user 'hospital_app'@'172.18.0.1'"
        "No se pudo contactar http://soporte:clave-secreta@192.168.1.10:8000/api/system/status"
        "PDOException in /var/www/html/storage/logs/laravel.log and /var/www/html/.env"
    ) -Encoding ASCII

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $collector `
        -ProjectRoot $fixtureRoot `
        -OutputDir $outputDir `
        -TailLines 20

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "collect_support_packet.ps1 termino con codigo $LASTEXITCODE."
    }

    $manifest = Join-Path $outputDir "MANIFIESTO.md"
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
        Write-Fail "No se genero MANIFIESTO.md."
    }

    $copiedEnvFiles = @(Get-ChildItem -LiteralPath $outputDir -Recurse -Force -File | Where-Object {
        $_.Name -match '(^\.env$|\.env\.|env$)'
    })
    if ($copiedEnvFiles.Count -gt 0) {
        Write-Fail "El paquete copio archivos de entorno."
    }

    $combined = (Get-ChildItem -LiteralPath $outputDir -Recurse -Force -File |
        ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"

    $forbidden = @(
        [regex]::Escape($fixtureRoot),
        "THIS_VALUE_MUST_NOT_LEAK",
        "fixture_db_password",
        "fixture_token",
        "fixture_mail_password",
        "C:\\Hospital\\Sistema",
        "/var/www/html",
        "hospital_app",
        "172.18.0.1",
        "soporte:clave-secreta"
    )

    foreach ($pattern in $forbidden) {
        if ($combined -match $pattern) {
            Write-Fail "El paquete de soporte expuso informacion sensible o ruta local real."
        }
    }

    if ($combined -notmatch "%PROJECT_ROOT%" -or $combined -notmatch "\[redacted\]" -or $combined -notmatch "\[ruta-local\]" -or $combined -notmatch "\[db-user-host\]") {
        Write-Fail "El paquete no incluyo los marcadores seguros esperados."
    }

    Write-Host "[OK] SUPPORT_PACKET_SAFETY: YES" -ForegroundColor Green
    Write-Host "[OK] No se copiaron .env, secretos ni rutas locales reales." -ForegroundColor Green
} finally {
    Remove-Fixture
}
