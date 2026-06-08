param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-LicenseSaltText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "(?i)/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "(?is)<(Task|Actions|Principals|Triggers|Settings)\b.*?</\1>", "[xml-protegido]"
    $protected = $protected -replace "(?is)<(Task|Actions|Principals|Triggers|Settings)\b[^>]*>", "[xml-protegido]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-LicenseSaltText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-LicenseSaltText $message)" -ForegroundColor Green
}

function Read-RequiredText([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Test-Content([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Invoke-ComposeConfigCheck([string] $label, [string[]] $envLines, [int] $expectedExit, [string[]] $expectedOutputPatterns) {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("s_hospital_license_salt_" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    $envFile = Join-Path $tempDir "compose.env"

    try {
        Set-Content -LiteralPath $envFile -Value $envLines -Encoding ASCII
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $output = @(& docker compose --env-file $envFile -f (Join-Path $ProjectRoot "docker-compose.prod.yml") config --quiet 2>&1 | ForEach-Object { $_.ToString() })
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        $exitCode = $LASTEXITCODE
        $joined = $output -join "`n"

        foreach ($line in $output) {
            Write-Host (Protect-LicenseSaltText $line)
        }

        if ($exitCode -ne $expectedExit) {
            Add-Failure "$label returned exit code $exitCode; expected $expectedExit."
            return
        }

        foreach ($pattern in $expectedOutputPatterns) {
            if ($joined -notmatch $pattern) {
                Add-Failure "$label did not print expected pattern: $pattern"
            }
        }

        if ($joined -match "(?i)(APP_KEY|DB_PASSWORD|TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*=\s*[^,\s\]\)]+") {
            Add-Failure "$label exposed secret-like assignments."
        }

        Add-Pass "$label completed with expected compose behavior"
    } finally {
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force
        }
    }
}

$provider = Read-RequiredText "backend\app\Providers\AppServiceProvider.php"
$appConfig = Read-RequiredText "backend\config\app.php"
$unitTest = Read-RequiredText "backend\tests\Unit\LicenseSaltGuardTest.php"
$compose = Read-RequiredText "docker-compose.prod.yml"
$preCommitGuard = Read-RequiredText "scripts\pre-commit-guard.ps1"
$secretsDoc = Read-RequiredText "docs\SECRETS.md"
$knownLimitations = Read-RequiredText "docs\KNOWN_LIMITATIONS.md"
$evidence = Read-RequiredText "qa\PRODUCTION_LICENSE_SALT_GUARD_2026_06_04.md"
$licenseSaltGuard = Read-RequiredText "scripts\validate_production_license_salt_guard.ps1"

if ($provider -ne "") {
    Test-Content $provider 'private const MIN_PROD_SALT_LENGTH\s*=\s*32' "Provider enforces 32-character minimum"
    Test-Content $provider "config\('app\.license_salt'\)" "Provider reads app license_salt config"
    Test-Content $provider '\$environment\s*!==\s*''production''' "Provider allows non-production environments"
    Test-Content $provider 'RuntimeException' "Provider throws a production boot exception"
    Test-Content $provider 'HOSPITAL_LICENSE_SALT must be at least %d characters in production' "Provider has human production error"
}

if ($appConfig -ne "") {
    Test-Content $appConfig "'license_salt'\s*=>\s*env\('HOSPITAL_LICENSE_SALT',\s*''\)" "Config maps HOSPITAL_LICENSE_SALT without committed fallback"
}

if ($unitTest -ne "") {
    Test-Content $unitTest 'test_short_or_missing_license_salt_passes_in_testing' "Unit test keeps testing usable"
    Test-Content $unitTest 'test_short_license_salt_throws_in_production' "Unit test rejects short production salt"
    Test-Content $unitTest 'test_missing_license_salt_throws_in_production' "Unit test rejects missing production salt"
    Test-Content $unitTest 'test_long_enough_license_salt_passes_in_production' "Unit test accepts long production salt"
}

if ($compose -ne "") {
    $requiredExpression = '\$\{HOSPITAL_LICENSE_SALT:\?HOSPITAL_LICENSE_SALT must be set to a 32\+ char random string\}'
    $matches = [regex]::Matches($compose, $requiredExpression)
    if ($matches.Count -ge 2) {
        Add-Pass "Production compose requires HOSPITAL_LICENSE_SALT for backend and scheduler"
    } else {
        Add-Failure "Production compose must require HOSPITAL_LICENSE_SALT for backend and scheduler."
    }
}

if ($preCommitGuard -ne "") {
    Test-Content $preCommitGuard 'HOSPITAL_LICENSE_SALT with a non-empty, non-placeholder value' "Pre-commit guard documents license salt secret blocking"
    Test-Content $preCommitGuard 'HOSPITAL_LICENSE_SALT=\(\.\+\)' "Pre-commit guard scans added license salt assignments"
}

if ($licenseSaltGuard -ne "") {
    Test-Content $licenseSaltGuard '\(\?i\)/\(var\|home\|srv\|opt\|tmp\|usr\|mnt\)/' "License salt guard redacts Unix local paths"
    Test-Content $licenseSaltGuard '\(\?is\)<\(Task\|Actions\|Principals\|Triggers\|Settings\)\\b' "License salt guard redacts raw task XML"
    Test-Content $licenseSaltGuard '\[xml-protegido\]' "License salt guard uses protected XML marker"
}

$combinedDocs = "$secretsDoc`n$knownLimitations`n$evidence"
if ($combinedDocs -ne "") {
    Test-Content $combinedDocs 'HOSPITAL_LICENSE_SALT' "Docs/evidence mention HOSPITAL_LICENSE_SALT"
    Test-Content $combinedDocs '32\+ chars|32\+ char|32\+ random|32 characters' "Docs/evidence require 32+ character salt"
    Test-Content $combinedDocs 'No real salt value was printed or committed|Leave empty|no real production salt' "Docs/evidence warn not to commit or print real salt"
}

if ($failures.Count -eq 0) {
    $baseEnv = @(
        "APP_KEY=base64:validation-placeholder-not-a-secret-000000000000",
        "DB_PASSWORD=validation-db-password",
        "DB_ROOT_PASSWORD=validation-root-password",
        "SERVER_IP=192.168.1.10"
    )

    Invoke-ComposeConfigCheck `
        "Production compose with placeholder salt" `
        ($baseEnv + @("HOSPITAL_LICENSE_SALT=0123456789abcdef0123456789abcdef")) `
        0 `
        @()

    Invoke-ComposeConfigCheck `
        "Production compose without license salt" `
        $baseEnv `
        1 `
        @("HOSPITAL_LICENSE_SALT")
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_LICENSE_SALT_GUARD: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PRODUCTION_LICENSE_SALT_GUARD: YES" -ForegroundColor Green
