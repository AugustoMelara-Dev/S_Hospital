param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [switch] $AllowMissingPhysicalProof
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

trap {
    Write-Host (Protect-HospitalOperationalText $_.Exception.Message $ProjectRoot)
    Write-Host "No se ejecuto el preflight. Revise que BaseUrl use solo http://IP-DEL-SERVIDOR:8000 y no incluya usuario, contrasena ni token."
    exit 1
}

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$BaseUrl = Test-HospitalOperationalUrlInput $BaseUrl

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Protect-PreflightText([string] $value) {
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
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safeMessage = Protect-PreflightText $message
    $failures.Add($safeMessage) | Out-Null
    Write-Host "[FAIL] $safeMessage" -ForegroundColor Red
}

function Add-Warning([string] $message) {
    $safeMessage = Protect-PreflightText $message
    $warnings.Add($safeMessage) | Out-Null
    Write-Host "[WARN] $safeMessage" -ForegroundColor Yellow
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-PreflightText $message)" -ForegroundColor Green
}

function Add-Strong-Warning([string] $message) {
    $warnings.Add($message) | Out-Null
    Write-Host "[WARN] $message" -ForegroundColor Yellow
    Write-Host "[WARN] PRODUCTION_READY remains forbidden while this warning is present." -ForegroundColor Yellow
}

function Read-EnvFile([string] $path) {
    $values = @{}

    if (-not (Test-Path -LiteralPath $path)) {
        Add-Failure "Missing environment file at $path"
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

function Test-ExecutableCandidate([string] $candidate) {
    if ($candidate.Trim() -eq "") {
        return $false
    }

    $isPath = $candidate.Contains("\") -or $candidate.Contains("/")
    if ($isPath -and -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        return $false
    }

    try {
        & $candidate --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Find-FirstExecutableCandidate([string[]] $candidates) {
    foreach ($candidate in $candidates) {
        if (Test-ExecutableCandidate $candidate) {
            return $candidate
        }
    }

    return $null
}

function Test-IsWindowsHost {
    return $env:OS -eq "Windows_NT" -or $PSVersionTable.Platform -eq "Win32NT" -or $null -ne (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)
}

function Test-DockerComposeConfig([string] $composePath, [string] $envFilePath) {
    if (-not (Test-CommandExists "docker")) {
        Add-Failure "docker is not available for Docker production package validation"
        return
    }

    $configCommand = 'docker compose -f "' + $composePath + '" --env-file "' + $envFilePath + '" config --quiet >nul 2>nul'
    & cmd.exe /c $configCommand
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "docker-compose.prod.yml validates with production .env"
    } else {
        Add-Failure "docker-compose.prod.yml or root .env is invalid for Docker production package"
    }
}

function Test-BackupWrapperCheck([string] $scriptPath, [string] $label) {
    if (-not (Test-Path -LiteralPath $scriptPath)) {
        Add-Failure "Missing backup wrapper $label at $scriptPath"
        return
    }

    & cmd.exe /c "`"$scriptPath`" --check" *> $null
    if ($LASTEXITCODE -eq 0) {
        Add-Pass "$label wrapper --check passed"
    } else {
        Add-Failure "$label wrapper --check failed"
    }
}

function Test-BackupScheduledTask([string] $taskName, [string[]] $AllowedStates) {
    if ($null -eq (Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        Add-Failure "Get-ScheduledTask is not available; cannot validate Windows backup task $taskName"
        return
    }

    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($null -eq $task) {
        Add-Failure "Windows scheduled task '$taskName' is not installed."
        return
    }

    if ($AllowedStates -notcontains [string] $task.State) {
        Add-Failure "Windows scheduled task '$taskName' must be $($AllowedStates -join ' or '), current state is '$($task.State)'."
        return
    }

    $info = Get-ScheduledTaskInfo -TaskName $taskName
    Add-Pass "Windows scheduled task '$taskName' state=$($task.State), lastResult=$($info.LastTaskResult), nextRun=$($info.NextRunTime)"
}

function Normalize-ProofContent([string] $content) {
    return ($content -replace "`r", "") -replace "\s+", " "
}

function Test-ProofValueIsIncomplete([string] $value) {
    if ($null -eq $value) {
        return $true
    }

    $trimmed = $value.Trim()
    if ($trimmed -eq "") {
        return $true
    }

    return $trimmed -match "^(TODO|PENDING|PENDING_[A-Z_]+|REPLACE|N/A|NA|NONE|TBD|-|\[ \])$"
}

function Get-ProofFieldValue([string] $content, [string] $fieldLabel) {
    $escaped = [regex]::Escape($fieldLabel)
    $pattern = "(?im)^\s*-\s*$escaped\s*:[ \t]*(?<value>[^\r\n]*)$"
    $match = [regex]::Match($content, $pattern)

    if (-not $match.Success) {
        return $null
    }

    return $match.Groups["value"].Value.Trim()
}

function Test-ProofReferencedLocalEvidence([string] $path, [string] $proofName, [string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    if (Test-ProofValueIsIncomplete $value) {
        return
    }

    $reference = $value.Trim()
    if ([System.IO.Path]::IsPathRooted($reference)) {
        Add-Failure "$proofName evidence must use a relative evidence reference, not an absolute local path, in $path."
        return
    }

    $looksLikeRepoPath = $reference -match '^(qa|docs|scripts|frontend|backend)[\\/]'
    if (-not $looksLikeRepoPath) {
        return
    }

    if ($reference -notmatch '^qa[\\/]' -or $reference -match '(^|[\\/])\.\.([\\/]|$)') {
        Add-Failure "$proofName evidence must reference files under qa/ without traversal, or use a non-local physical/support reference, in $path."
        return
    }

    $candidate = Join-Path $ProjectRoot $reference

    if (-not (Test-Path -LiteralPath $candidate)) {
        Add-Failure "$proofName evidence references missing local evidence '$reference' in $path."
    }
}

function Test-ProofHasCompletedField([string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    return -not (Test-ProofValueIsIncomplete $value)
}

function Test-ProofHasCompletedCheckedItem([string] $content, [string] $labelPattern) {
    $escaped = [regex]::Escape($labelPattern)
    $linePattern = "(?im)^\s*-\s*\[[xX]\]\s*.*$escaped.*$"
    $lineMatch = [regex]::Match($content, $linePattern)

    if (-not $lineMatch.Success) {
        return $false
    }

    $line = $lineMatch.Value
    $resultMatch = [regex]::Match($line, ":[ \t]*(?<value>[^\r\n]*)$")
    if (-not $resultMatch.Success) {
        return $false
    }

    return -not (Test-ProofValueIsIncomplete $resultMatch.Groups["value"].Value)
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

    foreach ($field in $requiredFields) {
        if (-not (Test-ProofHasCompletedField $content $field)) {
            Add-Failure "Complete '${field}:' in $path."
            return
        }
    }

    foreach ($check in $requiredChecks) {
        if (-not (Test-ProofHasCompletedCheckedItem $content $check)) {
            Add-Failure "Complete a checked evidence item with a result for '$check' in $path."
            return
        }
    }

    $placeholderPatterns = @(
        @{ Pattern = '(?i)\bTODO\b'; Message = 'Remove TODO placeholders' },
        @{ Pattern = '(?i)\bPENDING_[A-Z_]+\b'; Message = 'Replace PENDING_* placeholders' },
        @{ Pattern = '(?i)\bREPLACE\b'; Message = 'Replace placeholder text' },
        @{ Pattern = '(?i)\bN/A\b'; Message = 'Replace N/A with a real result or a concrete value such as none found' },
        @{ Pattern = '(?i)\bTBD\b'; Message = 'Replace TBD placeholders' },
        @{ Pattern = '(?i)example'; Message = 'Remove example/template instructions from the proof file' },
        @{ Pattern = '(?i)template'; Message = 'Remove template instructions from the proof file' },
        @{ Pattern = '(?i)use this file'; Message = 'Remove template instructions from the proof file' },
        @{ Pattern = '\[ \]'; Message = 'Check every required evidence item after testing it' }
    )

    foreach ($placeholder in $placeholderPatterns) {
        if ($content -match $placeholder.Pattern) {
            Add-Failure "$($placeholder.Message) in $path."
            return
        }
    }

    $failureCountBeforeEvidence = $failures.Count
    Test-ProofReferencedLocalEvidence $path $proofName $content "Evidence/photo reference"
    Test-ProofReferencedLocalEvidence $path $proofName $content "Evidence/capture reference"
    if ($failures.Count -gt $failureCountBeforeEvidence) {
        return
    }

    Add-Pass "$proofName evidence is present and completed."
}

function Invoke-RouteCheck([string] $url, [string] $label, [int[]] $AllowedStatusCodes = @(200), [int] $Attempts = 3) {
    $lastError = ""

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
            if ($AllowedStatusCodes -contains [int] $response.StatusCode) {
                $attemptSuffix = if ($attempt -eq 1) { "" } else { " after $attempt attempts" }
                Add-Pass "$label responded $($response.StatusCode)$attemptSuffix"
                return
            }

            $lastError = "unexpected status $($response.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds 2
        }
    }

    Add-Failure "$label failed after $Attempts attempts: $lastError"
}

$backendDir = Join-Path $ProjectRoot "backend"
$frontendDist = Join-Path $ProjectRoot "frontend\dist"
$backendEnvPath = Join-Path $backendDir ".env"
$rootEnvPath = Join-Path $ProjectRoot ".env"
$composeProdPath = Join-Path $ProjectRoot "docker-compose.prod.yml"
$isDockerProductionPackage = (Test-Path -LiteralPath $composeProdPath) -and (Test-Path -LiteralPath $rootEnvPath) -and (-not (Test-Path -LiteralPath (Join-Path $backendDir "artisan")))
$envPath = if ($isDockerProductionPackage) { $rootEnvPath } else { $backendEnvPath }
$envValues = Read-EnvFile $envPath

$baseUri = [Uri] $BaseUrl

$baseHostWithPort = if ($baseUri.IsDefaultPort) { $baseUri.Host } else { "$($baseUri.Host):$($baseUri.Port)" }
$appEnv = Get-EnvValue $envValues "APP_ENV" "local"
$appDebug = Get-EnvValue $envValues "APP_DEBUG" "true"
$appUrl = Get-EnvValue $envValues "APP_URL" ""
$dbConnection = Get-EnvValue $envValues "DB_CONNECTION" ""
$sanctumDomains = Get-EnvValue $envValues "SANCTUM_STATEFUL_DOMAINS" ""
$corsOrigins = Get-EnvValue $envValues "CORS_ALLOWED_ORIGINS" ""
$corsOriginPatterns = Get-EnvValue $envValues "CORS_ALLOWED_ORIGIN_PATTERNS" ""
$corsOriginsIsExplicit = $envValues.ContainsKey("CORS_ALLOWED_ORIGINS")
$corsOriginList = @($corsOrigins.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
$queueConnection = Get-EnvValue $envValues "QUEUE_CONNECTION" ""
$configuredDumpBinary = Get-EnvValue $envValues "HOSPITAL_DUMP_BINARY" ""

Write-Host "Production readiness preflight for $BaseUrl"
Write-Host "Project root: $(Protect-PreflightText $ProjectRoot)"
if ($isDockerProductionPackage) {
    Add-Pass "Docker production package layout detected"
    Test-DockerComposeConfig $composeProdPath $envPath
}

if ($appEnv -eq "production") { Add-Pass "APP_ENV=production" } else { Add-Failure "APP_ENV must be production, current value is '$appEnv'" }
if ($appDebug -eq "false") { Add-Pass "APP_DEBUG=false" } else { Add-Failure "APP_DEBUG must be false, current value is '$appDebug'" }
if ($appUrl -eq $BaseUrl.TrimEnd("/")) { Add-Pass "APP_URL matches BaseUrl" } else { Add-Failure "APP_URL must match $($BaseUrl.TrimEnd('/')), current value is '$appUrl'" }

# Reject the default blank APP_KEY from .env.example. The installer
# always generates a real value with `php artisan key:generate`;
# a blank key means someone copied the template and forgot to run it.
$appKey = (Get-EnvValue $envValues "APP_KEY" "")
if ([string]::IsNullOrWhiteSpace($appKey) -or $appKey -eq "base64:") {
    Add-Failure "APP_KEY is empty or the .env.example placeholder. Run 'php artisan key:generate' on the server."
} else {
    Add-Pass "APP_KEY is set to a non-placeholder value"
}

# Same check for the database password. The installer randomizes
# it; if the value is the well-known dev default the operator
# never overrode the .env, which is a real production hazard.
$dbPassword = (Get-EnvValue $envValues "DB_PASSWORD" "")
$forbiddenDbPasswords = @("hospital_dev", "root_dev", "changeme", "password", "secret")
if ([string]::IsNullOrWhiteSpace($dbPassword)) {
    Add-Failure "DB_PASSWORD is empty. The installer must generate a random 24-char password."
} elseif ($forbiddenDbPasswords -contains $dbPassword) {
    Add-Failure "DB_PASSWORD is set to a well-known dev value '$dbPassword'. Replace it with a random 24-char string."
} else {
    Add-Pass "DB_PASSWORD is set to a non-default value"
}

$dbRootPassword = (Get-EnvValue $envValues "DB_ROOT_PASSWORD" "")
if ([string]::IsNullOrWhiteSpace($dbRootPassword)) {
    Add-Failure "DB_ROOT_PASSWORD is empty. The installer must generate a random 24-char password."
} elseif ($forbiddenDbPasswords -contains $dbRootPassword) {
    Add-Failure "DB_ROOT_PASSWORD is set to a well-known dev value '$dbRootPassword'. Replace it."
} else {
    Add-Pass "DB_ROOT_PASSWORD is set to a non-default value"
}

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

if ($corsOriginList | Where-Object { $_ -match "\*" }) {
    Add-Failure "CORS_ALLOWED_ORIGINS must not contain wildcard '*'. Configure explicit LAN origins or an explicitly empty same-origin value."
} elseif ($corsOrigins -eq "" -and $corsOriginsIsExplicit) {
    Add-Pass "CORS origins are explicitly empty for same-origin production"
} elseif ($corsOriginList -contains $BaseUrl.TrimEnd("/")) {
    Add-Pass "CORS origins are same-origin or include BaseUrl"
} else {
    Add-Failure "CORS_ALLOWED_ORIGINS must be explicitly empty for same-origin or include $($BaseUrl.TrimEnd('/'))"
}

if ($corsOriginPatterns.Trim() -ne "") {
    Add-Failure "CORS_ALLOWED_ORIGIN_PATTERNS must be empty in production preflight. Use explicit CORS_ALLOWED_ORIGINS instead."
} else {
    Add-Pass "CORS origin patterns are empty"
}

if ($queueConnection -eq "database") {
    Add-Pass "QUEUE_CONNECTION=database"
} else {
    Add-Warning "QUEUE_CONNECTION is '$queueConnection'. Backups queued from UI need a durable local queue worker."
}

if (Test-IsWindowsHost) {
    Test-BackupScheduledTask "SistemaCajaHospitalaria-BackupWorker" @("Ready", "Running")
    Test-BackupScheduledTask "SistemaCajaHospitalaria-DailyBackup" @("Ready", "Running")
} else {
    Add-Warning "Non-Windows host detected. Validate an equivalent continuous backup worker/service before production handoff."
}

if ($isDockerProductionPackage) {
    Add-Pass "Docker package serves compiled frontend from backend/shared_public image flow"
} elseif (Test-Path -LiteralPath (Join-Path $frontendDist "index.html")) {
    Add-Pass "frontend/dist/index.html exists"
} else {
    Add-Failure "Missing frontend build. Run npm.cmd run build in frontend/"
}

$assetDir = Join-Path $frontendDist "assets"
if ($isDockerProductionPackage) {
    Add-Pass "Frontend asset verification deferred to /login route check for Docker package"
} elseif (Test-Path -LiteralPath $assetDir) {
    $assetCount = (Get-ChildItem -LiteralPath $assetDir -File | Measure-Object).Count
    if ($assetCount -gt 0) { Add-Pass "frontend/dist/assets contains $assetCount files" } else { Add-Failure "frontend/dist/assets is empty" }
} else {
    Add-Failure "Missing frontend/dist/assets"
}

if ($isDockerProductionPackage) {
    Add-Pass "Host PHP is not required for Docker production package"
} elseif (Test-CommandExists "php") {
    Add-Pass "php is available in PATH"
} else {
    Add-Failure "php is not available in PATH"
}

if ($isDockerProductionPackage) {
    Add-Pass "MySQL client and dump tool are validated inside Docker image/runtime"
} else {
    $mysqlClient = Find-FirstExecutableCandidate @(
        "mysql",
        "mariadb",
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mysql\bin\mariadb.exe",
        "C:\laragon\bin\mysql\mysql-8.0\bin\mysql.exe",
        "/usr/bin/mysql",
        "/usr/bin/mariadb",
        "/usr/local/bin/mysql",
        "/usr/local/bin/mariadb"
    )
    if ($null -ne $mysqlClient) { Add-Pass "mysql client is available: $mysqlClient" } else { Add-Failure "mysql or mariadb client is not available" }

    $dumpTool = Find-FirstExecutableCandidate @(
        $configuredDumpBinary,
        "mariadb-dump",
        "mysqldump",
        "C:\xampp\mysql\bin\mariadb-dump.exe",
        "C:\xampp\mysql\bin\mysqldump.exe",
        "C:\laragon\bin\mysql\mysql-8.0\bin\mysqldump.exe",
        "/usr/bin/mariadb-dump",
        "/usr/bin/mysqldump",
        "/usr/local/bin/mariadb-dump",
        "/usr/local/bin/mysqldump"
    )
    if ($null -ne $dumpTool) {
        Add-Pass "database dump tool is available: $dumpTool"
    } else {
        Add-Failure "mariadb-dump or mysqldump must be available for backups"
    }
}

if ($isDockerProductionPackage) {
    Test-BackupWrapperCheck (Join-Path $ProjectRoot "scripts\run_backup_worker.cmd") "Backup worker"
    Test-BackupWrapperCheck (Join-Path $ProjectRoot "scripts\run_scheduled_backup.cmd") "Scheduled backup"
} else {
    $backupDir = Join-Path $backendDir "storage\app\private\backups"
    if (-not (Test-Path -LiteralPath $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    $probePath = Join-Path $backupDir ".write-test"
    try {
        Set-Content -LiteralPath $probePath -Value "ok" -NoNewline -Encoding ASCII
        Remove-Item -LiteralPath $probePath -Force
        Add-Pass "backup directory is writable"
    } catch {
        Add-Failure "backup directory is not writable: $($_.Exception.Message)"
    }
}

Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/up" "/up"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/login" "/login"
Invoke-RouteCheck "$($BaseUrl.TrimEnd('/'))/verify-email" "/verify-email" @(200, 302)

if ($AllowMissingPhysicalProof) {
    Add-Strong-Warning "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."
    Add-Failure "Physical LAN/printer proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
} else {
    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md") `
        -proofName "second-client LAN" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Client computer name",
            "Server IP or LAN name",
            "Server LAN URL",
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
        -path (Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md") `
        -proofName "physical institutional printer" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Printer brand/model",
            "Printer driver",
            "Connection type",
            "Browser/version",
            "Cashier computer",
            "Invoice used",
            "Media carta result",
            "Carta result",
            "A5 result",
            "80mm result",
            "58mm result",
            "Reprint result",
            "Margins result",
            "Browser headers/footers result",
            "Problems found",
            "Evidence/photo reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "media carta",
            "carta",
            "A5",
            "80mm",
            "58mm",
            "white background",
            "Reprint",
            "headers/footers",
            "historical"
        )

    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\FINAL_RESTORE_PROOF.md") `
        -proofName "final restore" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Source database",
            "Disposable restore database",
            "Backup file",
            "Backup SHA256",
            "Backup size bytes",
            "Evidence/capture reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "Disposable restore database",
            "Backup file",
            "Restore imports",
            "Migration table",
            "Services table",
            "Core counts"
        )

    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\FINAL_CONCURRENCY_PROOF.md") `
        -proofName "final concurrency" `
        -requiredFields @(
            "Date/time",
            "Responsible person",
            "Server LAN URL",
            "Target environment",
            "Run ID",
            "Evidence/capture reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "Double cash-session open",
            "Concurrent invoice emission",
            "Double payment"
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
