param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [switch] $AllowMissingPhysicalProof
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Warning([string] $message) {
    $warnings.Add($message) | Out-Null
    Write-Host "[WARN] $message" -ForegroundColor Yellow
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Add-Strong-Warning([string] $message) {
    $warnings.Add($message) | Out-Null
    Write-Host "[WARN] $message" -ForegroundColor Yellow
    Write-Host "[WARN] PRODUCTION_READY remains forbidden while this warning is present." -ForegroundColor Yellow
}

function Read-EnvFile([string] $path) {
    $values = @{}

    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing backend .env at $path"
        return $values
    }

    Get-Content -LiteralPath $path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $key, $value = $line.Split("=", 2)
        $values[$key.Trim()] = $value.Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-EnvValue($values, [string] $key, [string] $fallback = "") {
    if ($values.ContainsKey($key) -and $values[$key] -ne "") {
        return $values[$key]
    }

    return $fallback
}

function Test-CommandExists([string] $name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Normalize-ProofContent([string] $content) {
    return ($content -replace "`r", "") -replace "\s+", " "
}

function Test-ProofHasCompletedField([string] $content, [string] $fieldLabel) {
    $escaped = [regex]::Escape($fieldLabel)
    $pattern = "(?im)^\s*-\s*$escaped\s*:\s*(.+?)\s*$"
    $match = [regex]::Match($content, $pattern)

    if (-not $match.Success) {
        return $false
    }

    $value = $match.Groups[1].Value.Trim()

    if ($value -eq "" -or $value -match "^(TODO|PENDING|REPLACE|N/A|NA|NONE|TBD|-|\[ \])$") {
        return $false
    }

    return $true
}

function Test-ProofHasCheckedItem([string] $content, [string] $labelPattern) {
    return $content -match "(?im)^\s*-\s*\[[xX]\]\s*.*$labelPattern"
}

function Test-ProofFile([string] $path, [string] $proofName, [string[]] $requiredFields, [string[]] $requiredChecks) {
    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing $path with real $proofName evidence."
        return
    }

    $content = Get-Content -LiteralPath $path -Raw
    $normalized = Normalize-ProofContent $content

    if ($normalized.Trim().Length -lt 300) {
        Add-Failure "$path is too short to contain real $proofName evidence."
        return
    }

    $placeholderPatterns = @(
        '(?i)\bTODO\b',
        '(?i)\bPENDING_[A-Z_]+\b',
        '(?i)\bREPLACE\b',
        '(?i)\bN/A\b',
        '(?i)\bTBD\b',
        '(?i)example',
        '(?i)template',
        '(?i)use this file',
        '\[ \]',
        '(?im):\s*$'
    )

    foreach ($pattern in $placeholderPatterns) {
        if ($content -match $pattern) {
            Add-Failure "$path still contains placeholder or incomplete proof content matching '$pattern'."
            return
        }
    }

    foreach ($field in $requiredFields) {
        if (-not (Test-ProofHasCompletedField $content $field)) {
            Add-Failure "$path must include a completed '${field}:' field."
            return
        }
    }

    foreach ($check in $requiredChecks) {
        if (-not (Test-ProofHasCheckedItem $content $check)) {
            Add-Failure "$path must include a completed checked evidence item for '$check'."
            return
        }
    }

    Add-Pass "$proofName evidence is present and completed."
}

function Invoke-RouteCheck([string] $url, [string] $label, [int[]] $AllowedStatusCodes = @(200)) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        if ($AllowedStatusCodes -contains [int] $response.StatusCode) {
            Add-Pass "$label responded $($response.StatusCode)"
            return
        }

        Add-Failure "$label returned unexpected status $($response.StatusCode)"
    } catch {
        Add-Failure "$label failed: $($_.Exception.Message)"
    }
}

$backendDir = Join-Path $ProjectRoot "backend"
$frontendDist = Join-Path $ProjectRoot "frontend\dist"
$envPath = Join-Path $backendDir ".env"
$envValues = Read-EnvFile $envPath

$baseUri = [Uri] $BaseUrl.TrimEnd("/")
$baseHostWithPort = if ($baseUri.IsDefaultPort) { $baseUri.Host } else { "$($baseUri.Host):$($baseUri.Port)" }
$appEnv = Get-EnvValue $envValues "APP_ENV" "local"
$appDebug = Get-EnvValue $envValues "APP_DEBUG" "true"
$appUrl = Get-EnvValue $envValues "APP_URL" ""
$dbConnection = Get-EnvValue $envValues "DB_CONNECTION" ""
$sanctumDomains = Get-EnvValue $envValues "SANCTUM_STATEFUL_DOMAINS" ""
$corsOrigins = Get-EnvValue $envValues "CORS_ALLOWED_ORIGINS" ""
$corsOriginsIsExplicit = $envValues.ContainsKey("CORS_ALLOWED_ORIGINS")
$corsOriginList = @($corsOrigins.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
$queueConnection = Get-EnvValue $envValues "QUEUE_CONNECTION" ""

Write-Host "Production readiness preflight for $BaseUrl"
Write-Host "Project root: $ProjectRoot"

if ($appEnv -eq "production") { Add-Pass "APP_ENV=production" } else { Add-Failure "APP_ENV must be production, current value is '$appEnv'" }
if ($appDebug -eq "false") { Add-Pass "APP_DEBUG=false" } else { Add-Failure "APP_DEBUG must be false, current value is '$appDebug'" }
if ($appUrl -eq $BaseUrl.TrimEnd("/")) { Add-Pass "APP_URL matches BaseUrl" } else { Add-Failure "APP_URL must match $($BaseUrl.TrimEnd('/')), current value is '$appUrl'" }

if ($BaseUrl -match "localhost|127\.0\.0\.1|::1") {
    Add-Failure "BaseUrl must be the final LAN IP or local domain, not localhost"
} else {
    Add-Pass "BaseUrl is not localhost"
}

if ($dbConnection -match "^(mysql|mariadb)$") { Add-Pass "DB_CONNECTION=$dbConnection" } else { Add-Failure "DB_CONNECTION must be mysql or mariadb, current value is '$dbConnection'" }

if ($sanctumDomains.Split(",").Trim() -contains $baseHostWithPort -or $sanctumDomains.Split(",").Trim() -contains $baseUri.Host) {
    Add-Pass "SANCTUM_STATEFUL_DOMAINS includes LAN host"
} else {
    Add-Failure "SANCTUM_STATEFUL_DOMAINS must include $baseHostWithPort or $($baseUri.Host)"
}

if ($corsOriginList -contains "*") {
    Add-Failure "CORS_ALLOWED_ORIGINS must not contain wildcard '*'. Configure explicit LAN origins or an explicitly empty same-origin value."
} elseif ($corsOrigins -eq "" -and $corsOriginsIsExplicit) {
    Add-Pass "CORS origins are explicitly empty for same-origin production"
} elseif ($corsOriginList -contains $BaseUrl.TrimEnd("/")) {
    Add-Pass "CORS origins are same-origin or include BaseUrl"
} else {
    Add-Failure "CORS_ALLOWED_ORIGINS must be explicitly empty for same-origin or include $($BaseUrl.TrimEnd('/'))"
}

if ($queueConnection -eq "database") {
    Add-Pass "QUEUE_CONNECTION=database"
} else {
    Add-Warning "QUEUE_CONNECTION is '$queueConnection'. Backups queued from UI need a durable local queue worker."
}

if (Test-Path -LiteralPath (Join-Path $frontendDist "index.html")) {
    Add-Pass "frontend/dist/index.html exists"
} else {
    Add-Failure "Missing frontend build. Run npm.cmd run build in frontend/"
}

$assetDir = Join-Path $frontendDist "assets"
if (Test-Path -LiteralPath $assetDir) {
    $assetCount = (Get-ChildItem -LiteralPath $assetDir -File | Measure-Object).Count
    if ($assetCount -gt 0) { Add-Pass "frontend/dist/assets contains $assetCount files" } else { Add-Failure "frontend/dist/assets is empty" }
} else {
    Add-Failure "Missing frontend/dist/assets"
}

if (Test-CommandExists "php") { Add-Pass "php is available in PATH" } else { Add-Failure "php is not available in PATH" }
if (Test-CommandExists "mysql") { Add-Pass "mysql client is available in PATH" } else { Add-Failure "mysql client is not available in PATH" }
if ((Test-CommandExists "mariadb-dump") -or (Test-CommandExists "mysqldump")) {
    Add-Pass "database dump tool is available in PATH"
} else {
    Add-Failure "mariadb-dump or mysqldump must be available in PATH for backups"
}

$backupDir = Join-Path $backendDir "storage\app\private\backups"
if (-not (Test-Path -LiteralPath $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$probePath = Join-Path $backupDir ".write-test"
try {
    Set-Content -LiteralPath $probePath -Value "ok" -NoNewline
    Remove-Item -LiteralPath $probePath -Force
    Add-Pass "backup directory is writable"
} catch {
    Add-Failure "backup directory is not writable: $($_.Exception.Message)"
}

Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/up" "/up"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/login" "/login"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/verify-email" "/verify-email" @(200, 302)

if ($AllowMissingPhysicalProof) {
    Add-Strong-Warning "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."
} else {
    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md") `
        -proofName "second-client LAN" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Client computer name",
            "Server IP or LAN name",
            "Client browser/version",
            "User/role used",
            "Evidence/capture reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "/up",
            "/login",
            "/verify-email",
            "assets",
            "Login",
            "Cashbox",
            "Invoice",
            "Payment",
            "Receipt",
            "history",
            "Reports",
            "Backup"
        )

    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\THERMAL_PRINTER_PROOF.md") `
        -proofName "physical thermal printer" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Printer brand/model",
            "Printer driver",
            "Browser/version",
            "Invoice used",
            "80mm result",
            "58mm result",
            "Problems found",
            "Evidence/photo reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "80mm",
            "58mm",
            "Reprint",
            "headers/footers",
            "historical"
        )
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_READY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
if ($warnings.Count -gt 0) {
    Write-Host "PRODUCTION_PREFLIGHT_PASSED_WITH_WARNINGS: $($warnings.Count) warning(s)" -ForegroundColor Yellow
    if ($AllowMissingPhysicalProof) {
        Write-Host "PRODUCTION_READY: NO. Physical LAN/printer proof was explicitly bypassed." -ForegroundColor Yellow
    }
} else {
    Write-Host "PRODUCTION_PREFLIGHT_PASSED" -ForegroundColor Green
}
