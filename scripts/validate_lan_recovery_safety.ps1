param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$refreshScriptPath = Join-Path $ProjectRoot "scripts\refresh_lan_ip.ps1"
$refreshScript = Read-RequiredFile "scripts\refresh_lan_ip.ps1"
$netDiagnostics = Read-RequiredFile "scripts\lib\net_diagnostics.ps1"
$envHelpers = Read-RequiredFile "scripts\lib\env_helpers.ps1"
$corsHelpers = Read-RequiredFile "scripts\lib\cors_helpers.ps1"
$lanValidator = Read-RequiredFile "scripts\validate_lan_client.ps1"
$lanValidatorSafety = Read-RequiredFile "scripts\test_validate_lan_client_safety.ps1"
$repairScript = Read-RequiredFile "scripts\repair_hospital_system.ps1"
$supportGuide = Read-RequiredFile "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$installGuide = Read-RequiredFile "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$supervisorManual = Read-RequiredFile "docs\manuales\MANUAL_SUPERVISOR.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"

Assert-Contains "LAN refresh script supports PowerShell WhatIf" $refreshScript 'SupportsShouldProcess\s*=\s*\$true'
Assert-NotContains "LAN refresh uses native WhatIf without a duplicate custom parameter" $refreshScript '\[switch\]\s*\$WhatIf'
Assert-Contains "LAN refresh script imports env helper library" $refreshScript "lib[\s\S]*env_helpers\.ps1"
Assert-Contains "LAN refresh script imports network diagnostics library" $refreshScript "lib[\s\S]*net_diagnostics\.ps1"
Assert-Contains "LAN refresh script imports CORS helper library" $refreshScript "lib[\s\S]*cors_helpers\.ps1"
Assert-NotContains "LAN refresh script does not reference removed helper files" $refreshScript "_lib_env_helpers|_lib_lan_ip"
Assert-Contains "LAN refresh script reads existing env safely" $refreshScript "Read-EnvFile"
Assert-Contains "LAN refresh script writes env through ASCII-safe helper" $refreshScript "Update-DotEnv"
Assert-Contains "LAN refresh updates SERVER_IP" $refreshScript "SERVER_IP"
Assert-Contains "LAN refresh updates APP_URL" $refreshScript "APP_URL"
Assert-Contains "LAN refresh updates APP_HTTPS_PORT" $refreshScript "APP_HTTPS_PORT"
Assert-Contains "LAN refresh updates Sanctum stateful domains" $refreshScript "SANCTUM_STATEFUL_DOMAINS"
Assert-Contains "LAN refresh updates CORS allowed origins" $refreshScript "CORS_ALLOWED_ORIGINS"
Assert-Contains "LAN refresh writes HTTPS APP_URL" $refreshScript "Get-HospitalLanUrl"
Assert-Contains "LAN refresh updates Windows firewall rule" $refreshScript "New-NetFirewallRule"
Assert-Contains "LAN refresh restarts affected services" $refreshScript "backend[\s\S]*queue-worker[\s\S]*scheduler"
Assert-Contains "LAN refresh guards client IP notice with ShouldProcess" $refreshScript 'ShouldProcess\(\$noticePath'
Assert-NotContains "LAN refresh does not run destructive database commands" $refreshScript "migrate:fresh|DROP DATABASE|Remove-Item\s+.*backend|docker\s+volume\s+rm|docker\s+compose\s+down\s+-v"

Assert-Contains "Network diagnostics use default route metrics" $netDiagnostics "Get-NetRoute[\s\S]*RouteMetric"
Assert-Contains "Network diagnostics identify DHCP addresses" $netDiagnostics "Dhcp"
Assert-Contains "Network diagnostics warn about localhost for clients" $netDiagnostics "localhost[\s\S]*estaciones cliente"
Assert-Contains "Network diagnostics warn about APIPA addresses" $netDiagnostics "APIPA"
Assert-Contains "Env helper writes ASCII env files" $envHelpers "Set-Content[\s\S]*-Encoding ASCII"
Assert-Contains "CORS helper defaults LAN URL to HTTPS" $corsHelpers 'return "https://\$\{ServerIp\}\$\{portPart\}\$\{pathPart\}"'
Assert-NotContains "CORS helper production origins do not allow HTTP LAN" $corsHelpers 'CorsAllowedOrigins[\s\S]*http://\$\{ServerIp\}'

Assert-Contains "LAN validation rejects credentials in URLs" $lanValidator "Test-HospitalOperationalUrlInput"
Assert-Contains "LAN validation keeps evidence under qa" $lanValidator "carpeta qa"
Assert-Contains "LAN validation supports WhatIfOnly" $lanValidator "WhatIfOnly"
Assert-Contains "LAN validation safety test covers WhatIf no-write" $lanValidatorSafety "WhatIf no debe escribir evidencia LAN"
Assert-Contains "LAN validation safety test rejects credential URLs" $lanValidatorSafety "rechazar URLs con usuario o contrasena"
Assert-Contains "Repair diagnostics warn about localhost APP_URL" $repairScript "APP_URL usa localhost o 127\.0\.0\.1"

Assert-Contains "Support guide documents IP refresh preview" $supportGuide "refresh_lan_ip\.ps1 -WhatIf"
Assert-Contains "Support guide tells staff not to invoice while LAN is down" $supportGuide "No facture desde clientes"
Assert-Contains "Install guide documents IP refresh preview" $installGuide "refresh_lan_ip\.ps1 -WhatIf"
Assert-Contains "Install guide requires second-client validation after refresh" $installGuide "validate_lan_client\.ps1"
Assert-Contains "Supervisor manual warns clients not to use localhost" $supervisorManual "No use[\s\S]*localhost[\s\S]*computadoras cliente"
Assert-Contains "Release checklist mentions LAN recovery guard" $releaseChecklist "validate_lan_recovery_safety\.ps1"

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "s-hospital-lan-recovery-$([Guid]::NewGuid().ToString('N'))"
try {
    New-Item -ItemType Directory -Force -Path (Join-Path $fixtureRoot "backend") | Out-Null
    Set-Content -LiteralPath (Join-Path $fixtureRoot ".env") -Value @("SERVER_IP=192.168.1.20") -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $fixtureRoot "backend\.env") -Value @(
        "APP_HTTPS_PORT=443",
        "APP_PORT=443",
        "SERVER_IP=192.168.1.20",
        "APP_URL=https://192.168.1.20",
        "SANCTUM_STATEFUL_DOMAINS=192.168.1.20,192.168.1.20:443",
        "CORS_ALLOWED_ORIGINS=https://192.168.1.20,https://192.168.1.20:443"
    ) -Encoding ASCII

    $rootBefore = Get-Content -LiteralPath (Join-Path $fixtureRoot ".env") -Raw
    $backendBefore = Get-Content -LiteralPath (Join-Path $fixtureRoot "backend\.env") -Raw

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $refreshScriptPath `
        -ProjectRoot $fixtureRoot `
        -ServerIp "192.168.1.30" `
        -AppPort 443 `
        -WhatIf 2>&1 | ForEach-Object { $_.ToString() }

    if ($LASTEXITCODE -eq 0) {
        Add-Pass "LAN refresh WhatIf exits successfully against disposable fixture"
    } else {
        Add-Failure "LAN refresh WhatIf failed: $($output -join ' ')"
    }

    $rootAfter = Get-Content -LiteralPath (Join-Path $fixtureRoot ".env") -Raw
    $backendAfter = Get-Content -LiteralPath (Join-Path $fixtureRoot "backend\.env") -Raw
    if ($rootBefore -eq $rootAfter -and $backendBefore -eq $backendAfter) {
        Add-Pass "LAN refresh WhatIf does not modify env files"
    } else {
        Add-Failure "LAN refresh WhatIf modified env files"
    }

    if (-not (Test-Path -LiteralPath (Join-Path $fixtureRoot "qa\IP_CHANGE_NOTICE.txt"))) {
        Add-Pass "LAN refresh WhatIf does not write client IP notice"
    } else {
        Add-Failure "LAN refresh WhatIf wrote client IP notice"
    }
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "LAN_RECOVERY_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "LAN_RECOVERY_SAFETY: YES" -ForegroundColor Green
