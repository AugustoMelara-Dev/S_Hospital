param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,

    [string] $ProjectRoot = "",

    [string] $EnvFile = "",

    [ValidateSet("Auto", "Docker", "WindowsTasks")]
    [string] $RuntimeMode = "Auto",

    [string] $DockerProject = "",

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

function Get-DockerServiceContainerId([string] $project, [string] $service) {
    $ids = @(& docker ps --filter "label=com.docker.compose.project=$project" --filter "label=com.docker.compose.service=$service" --filter "status=running" --format '{{.ID}}' 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "Could not inspect Docker service '$service': $($ids -join ' ')"
        return ""
    }

    return ([string] ($ids | Select-Object -First 1)).Trim()
}

function Read-DockerRuntimeEnv([string] $project) {
    $values = @{}
    $containerId = Get-DockerServiceContainerId $project "backend"
    if ($containerId -eq "") {
        Add-Failure "Docker backend service is not running for project '$project'"
        return $values
    }

    $inspectOutput = @(& docker inspect $containerId 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "Could not inspect the Docker backend runtime environment"
        return $values
    }

    try {
        $container = (($inspectOutput -join [Environment]::NewLine) | ConvertFrom-Json | Select-Object -First 1)
        $lines = @($container.Config.Env)
    } catch {
        Add-Failure "Could not parse the Docker backend runtime environment"
        return $values
    }

    foreach ($lineValue in $lines) {
        $line = ([string] $lineValue).Trim()
        if ($line -eq "" -or -not $line.Contains("=")) {
            continue
        }

        $key, $value = $line.Split("=", 2)
        $values[$key] = $value
    }

    return $values
}

function Test-DockerRuntimeServices([string] $project) {
    if (-not (Test-CommandExists "docker")) {
        Add-Failure "docker is required to validate the production container runtime"
        return
    }

    $output = @(& docker ps --filter "label=com.docker.compose.project=$project" --filter "status=running" --format '{{.ID}}' 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Add-Failure "Could not inspect Docker production services: $($output -join ' ')"
        return
    }

    $runningServices = @()
    foreach ($containerIdValue in $output) {
        $containerId = ([string] $containerIdValue).Trim()
        if ($containerId -eq "") {
            continue
        }

        $inspectOutput = @(& docker inspect $containerId 2>&1)
        if ($LASTEXITCODE -ne 0) {
            Add-Failure "Could not inspect Docker container '$containerId'"
            continue
        }

        try {
            $container = (($inspectOutput -join [Environment]::NewLine) | ConvertFrom-Json | Select-Object -First 1)
            $service = [string] $container.Config.Labels.'com.docker.compose.service'
            if ($service.Trim() -ne "") {
                $runningServices += $service.Trim()
            }
        } catch {
            Add-Failure "Could not parse Docker container '$containerId'"
        }
    }
    foreach ($requiredService in @("mysql", "backend", "nginx", "queue-worker", "realtime-worker", "scheduler")) {
        if ($runningServices -contains $requiredService) {
            Add-Pass "Docker runtime service '$requiredService' is running"
        } else {
            Add-Failure "Docker runtime service '$requiredService' is not running"
        }
    }
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

    $content = (Get-Content -LiteralPath $path -Raw) -replace "`r", ""
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

function Test-ServedFrontendBuild([string] $BaseUrl) {
    try {
        $loginResponse = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))/login" -UseBasicParsing -TimeoutSec 20
        $assetMatches = [regex]::Matches($loginResponse.Content, '(?:src|href)="(?<path>/assets/[^"?]+\.(?:js|css))"')
        if ($assetMatches.Count -eq 0) {
            Add-Failure "Docker frontend HTML does not reference a built JavaScript or CSS asset"
            return
        }

        $assetPath = $assetMatches[0].Groups["path"].Value
        $assetResponse = Invoke-WebRequest -Uri "$($BaseUrl.TrimEnd('/'))$assetPath" -UseBasicParsing -TimeoutSec 20
        if ([int] $assetResponse.StatusCode -eq 200 -and $assetResponse.RawContentLength -gt 0) {
            Add-Pass "Docker frontend build serves hashed assets"
        } else {
            Add-Failure "Docker frontend asset $assetPath did not return non-empty HTTP 200 content"
        }
    } catch {
        Add-Failure "Docker frontend build validation failed: $($_.Exception.Message)"
    }
}

function Invoke-WebSocketHandshake([string] $ClientHost, [int] $ClientPort, [string] $ClientScheme, [string] $PusherKey) {
    if ([string]::IsNullOrWhiteSpace($PusherKey)) {
        Add-Failure "PUSHER_APP_KEY is required to validate realtime WebSocket handshake"
        return
    }

    $scheme = if ($ClientScheme -in @("https", "wss")) { "wss" } else { "ws" }
    $builder = [System.UriBuilder]::new()
    $builder.Scheme = $scheme
    $builder.Host = $ClientHost
    $builder.Port = $ClientPort
    $builder.Path = "/app/$PusherKey"
    $builder.Query = "protocol=7&client=js&version=8.5.0&flash=false"

    $socket = [System.Net.WebSockets.ClientWebSocket]::new()
    $cts = [System.Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(10))
    try {
        $socket.ConnectAsync($builder.Uri, $cts.Token).GetAwaiter().GetResult() | Out-Null
        if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
            Add-Pass "Realtime WebSocket handshake succeeded through the configured client endpoint"
        } else {
            Add-Failure "Realtime WebSocket handshake did not open; state=$($socket.State)"
        }
    } catch {
        Add-Failure "Realtime WebSocket handshake failed: $($_.Exception.Message)"
    } finally {
        if ($socket.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
            $socket.CloseOutputAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "preflight", [System.Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
        }
        $socket.Dispose()
        $cts.Dispose()
    }
}

$backendDir = Join-Path $ProjectRoot "backend"
$frontendDist = Join-Path $ProjectRoot "frontend\dist"
$envPath = if ($EnvFile.Trim() -ne "") {
    if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $ProjectRoot $EnvFile }
} elseif ((Test-CommandExists "docker") -and (Test-Path -LiteralPath (Join-Path $ProjectRoot "docker-compose.prod.yml") -PathType Leaf)) {
    Join-Path $ProjectRoot ".env"
} else {
    Join-Path $backendDir ".env"
}
$envValues = Read-EnvFile $envPath

$resolvedRuntimeMode = if ($RuntimeMode -ne "Auto") {
    $RuntimeMode
} elseif ((Test-CommandExists "docker") -and (Test-Path -LiteralPath (Join-Path $ProjectRoot "docker-compose.prod.yml") -PathType Leaf)) {
    "Docker"
} else {
    "WindowsTasks"
}

$resolvedDockerProject = if ($DockerProject.Trim() -ne "") {
    $DockerProject.Trim()
} elseif ($envValues.ContainsKey("COMPOSE_PROJECT_NAME") -and $envValues["COMPOSE_PROJECT_NAME"].Trim() -ne "") {
    $envValues["COMPOSE_PROJECT_NAME"].Trim()
} else {
    ((Split-Path -Leaf $ProjectRoot).ToLowerInvariant() -replace '[^a-z0-9_-]', '')
}

if ($resolvedRuntimeMode -eq "Docker") {
    $runtimeValues = Read-DockerRuntimeEnv $resolvedDockerProject
    foreach ($entry in $runtimeValues.GetEnumerator()) {
        $envValues[$entry.Key] = $entry.Value
    }
}

$baseUri = $null
if (-not [Uri]::TryCreate($BaseUrl.TrimEnd("/"), [UriKind]::Absolute, [ref] $baseUri) -or $baseUri.Scheme -notin @("http", "https")) {
    Add-Failure "BaseUrl must be an absolute http(s) LAN URL, for example http://192.168.1.10"
    $baseUri = [Uri] "http://invalid.local"
}

$baseHostWithPort = if ($baseUri.IsDefaultPort) { $baseUri.Host } else { "$($baseUri.Host):$($baseUri.Port)" }
$isLoopbackBaseUrl = $baseUri.Host -match "^(localhost|127\.0\.0\.1|::1)$"
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
$allowInsecureHttp = Get-EnvValue $envValues "HOSPITAL_ALLOW_INSECURE_HTTP" ""
$sessionSecureCookie = Get-EnvValue $envValues "SESSION_SECURE_COOKIE" ""
$backupEncryptionKey = Get-EnvValue $envValues "HOSPITAL_BACKUP_ENCRYPTION_KEY" ""
$pusherAppKey = Get-EnvValue $envValues "PUSHER_APP_KEY" ""
$pusherClientHost = Get-EnvValue $envValues "PUSHER_CLIENT_HOST" $baseUri.Host
$pusherClientPortValue = Get-EnvValue $envValues "PUSHER_CLIENT_PORT" "6001"
$pusherClientScheme = Get-EnvValue $envValues "PUSHER_CLIENT_SCHEME" $baseUri.Scheme
$appScheme = Get-EnvValue $envValues "APP_SCHEME" ""

Write-Host "Production readiness preflight for $BaseUrl"
Write-Host "Project root: $ProjectRoot"
Write-Host "Environment file: $envPath"
Write-Host "Runtime mode: $resolvedRuntimeMode"
if ($resolvedRuntimeMode -eq "Docker") { Write-Host "Docker project: $resolvedDockerProject" }

if ($appEnv -eq "production") { Add-Pass "APP_ENV=production" } else { Add-Failure "APP_ENV must be production, current value is '$appEnv'" }
if ($appDebug -eq "false") { Add-Pass "APP_DEBUG=false" } else { Add-Failure "APP_DEBUG must be false, current value is '$appDebug'" }
if ($appUrl -eq $BaseUrl.TrimEnd("/")) { Add-Pass "APP_URL matches BaseUrl" } else { Add-Failure "APP_URL must match $($BaseUrl.TrimEnd('/')), current value is '$appUrl'" }
if ($appScheme -ne "" -and $appScheme -ne $baseUri.Scheme) {
    Add-Failure "APP_SCHEME must match BaseUrl scheme '$($baseUri.Scheme)', current value is '$appScheme'"
}

if ($baseUri.Scheme -eq "https") {
    if ($sessionSecureCookie -eq "true") { Add-Pass "SESSION_SECURE_COOKIE=true for HTTPS" } else { Add-Failure "SESSION_SECURE_COOKIE must be true when BaseUrl uses HTTPS" }
    if ($allowInsecureHttp -eq "1") { Add-Failure "HOSPITAL_ALLOW_INSECURE_HTTP must not be 1 when BaseUrl uses HTTPS" }
} elseif ($allowInsecureHttp -eq "1") {
    Add-Strong-Warning "HTTP LAN mode is explicitly enabled with HOSPITAL_ALLOW_INSECURE_HTTP=1. Credentials and patient names are not encrypted on the wire."
    if ($sessionSecureCookie -eq "true") {
        Add-Failure "SESSION_SECURE_COOKIE=true breaks login over explicit HTTP LAN mode. Use HTTPS or set SESSION_SECURE_COOKIE=false with documented risk."
    } else {
        Add-Pass "SESSION_SECURE_COOKIE is compatible with explicit HTTP LAN mode"
    }
} else {
    Add-Failure "BaseUrl uses HTTP but HOSPITAL_ALLOW_INSECURE_HTTP is not 1. Enable HTTPS or explicitly document insecure LAN HTTP."
}

if ($isLoopbackBaseUrl) {
    Add-Pass "BaseUrl uses loopback; validating single-machine local mode"
} else {
    Add-Pass "BaseUrl is LAN IP or local domain"
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

if ([string]::IsNullOrWhiteSpace($backupEncryptionKey)) {
    Add-Failure "HOSPITAL_BACKUP_ENCRYPTION_KEY must be set before production backups"
} else {
    Add-Pass "HOSPITAL_BACKUP_ENCRYPTION_KEY is configured"
}

if ($resolvedRuntimeMode -eq "Docker") {
    Test-DockerRuntimeServices $resolvedDockerProject
} elseif (Test-IsWindowsHost) {
    Test-BackupScheduledTask "HospitalBillingOS-BackupWorker" @("Ready", "Running")
    Test-BackupScheduledTask "HospitalBillingOS-DailyBackup" @("Ready", "Running")
} else {
    Add-Warning "Non-Windows host detected. Validate an equivalent continuous backup worker/service before production handoff."
}

if ($resolvedRuntimeMode -eq "Docker") {
    Test-ServedFrontendBuild $BaseUrl
} else {
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
}

if (Test-CommandExists "php") { Add-Pass "php is available in PATH" } else { Add-Failure "php is not available in PATH" }

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
[int] $pusherClientPort = 0
if ([int]::TryParse($pusherClientPortValue, [ref] $pusherClientPort) -and $pusherClientPort -ge 1 -and $pusherClientPort -le 65535) {
    Invoke-WebSocketHandshake $pusherClientHost $pusherClientPort $pusherClientScheme $pusherAppKey
} else {
    Add-Failure "PUSHER_CLIENT_PORT must be an integer between 1 and 65535"
}

if ($AllowMissingPhysicalProof) {
    Add-Strong-Warning "AllowMissingPhysicalProof was used. This run is only an environment preflight and MUST NOT be called PRODUCTION_READY."
    Add-Failure "Physical LAN/printer proof was bypassed. Re-run without -AllowMissingPhysicalProof before declaring PRODUCTION_READY."
} else {
    if ($isLoopbackBaseUrl) {
        Test-ProofFile `
            -path (Join-Path $ProjectRoot "qa\LOCAL_SERVER_VALIDATION_PROOF.md") `
            -proofName "local server browser" `
            -requiredFields @(
                "Date/time",
                "Responsible person",
                "Server computer name",
                "Local app URL",
                "Browser/version",
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
    }
    Test-ProofFile `
        -path (Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md") `
        -proofName "primary institutional receipt printer" `
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
            "Reprint result",
            "Margins result",
            "Browser headers/footers result",
            "Problems found",
            "Evidence/photo reference",
            "Final conclusion"
        ) `
        -requiredChecks @(
            "Media carta",
            "Carta",
            "A5",
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
    Write-Host "PRODUCTION_READY: NO. Resolve or formally accept every warning before handoff." -ForegroundColor Yellow
} else {
    Write-Host "PRODUCTION_PREFLIGHT_PASSED" -ForegroundColor Green
}
