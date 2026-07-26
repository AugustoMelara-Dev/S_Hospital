param(
    [string] $SeedPassword = "",
    [string] $BaseUrl = "http://127.0.0.1:5173",
    [string] $ApiBaseUrl = "http://backend:8000",
    [string] $ReportPath = "/app/test-results/mariadb-release-e2e-report.json",
    [string] $ChromiumExecutablePath = "/usr/bin/chromium-browser",
    [string] $Login = "cajero.e2e",
    [string] $AdminLogin = "admin.e2e",
    [string] $ServiceQuery = "Glucosa",
    [string] $PaymentAmount = "17.25",
    [string] $ComposeProject = "",
    [switch] $SkipSeed,
    [switch] $RecoveryDrill,
    [string] $RecoveryComposeProject = "",
    [string] $RecoverySourceDatabase = "",
    [string] $RecoveryTargetDatabase = "",
    [string] $ConfiguredProductionDatabase = "",
    [string] $RecoveryEvidencePath = "qa\RECOVERY_CERTIFICATION.md"
)

$ErrorActionPreference = "Stop"

$recoveryDrillModule = Join-Path $PSScriptRoot 'lib\recovery_release_drill.ps1'
if (-not (Test-Path -LiteralPath $recoveryDrillModule)) {
    throw "Recovery drill module is missing."
}
. $recoveryDrillModule

function Get-ConfiguredProductionDatabaseName {
    param(
        [string] $ExplicitName,
        [string] $ProjectRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($ExplicitName)) {
        return $ExplicitName.Trim()
    }

    $envPath = Join-Path $ProjectRoot '.env'
    if (Test-Path -LiteralPath $envPath) {
        foreach ($line in Get-Content -LiteralPath $envPath) {
            if ($line -match '^\s*DB_DATABASE\s*=\s*(?<value>[^#]+?)\s*$') {
                $value = $Matches['value'].Trim().Trim('"').Trim("'")
                if (-not [string]::IsNullOrWhiteSpace($value)) {
                    return $value
                }
            }
        }
    }

    return 'hospital_billing'
}

function New-RecoveryDrillSecret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }

    return [Convert]::ToBase64String($bytes)
}

if ($RecoveryDrill) {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $recoveryRunId = [Guid]::NewGuid().ToString('N').Substring(0, 12)
    if ([string]::IsNullOrWhiteSpace($RecoveryComposeProject)) {
        $RecoveryComposeProject = "s_hospital_recovery_$recoveryRunId"
    }
    if ([string]::IsNullOrWhiteSpace($RecoverySourceDatabase)) {
        $RecoverySourceDatabase = "hospital_recovery_source_$recoveryRunId"
    }
    if ([string]::IsNullOrWhiteSpace($RecoveryTargetDatabase)) {
        $RecoveryTargetDatabase = "hospital_recovery_target_$recoveryRunId"
    }
    $ConfiguredProductionDatabase = Get-ConfiguredProductionDatabaseName `
        -ExplicitName $ConfiguredProductionDatabase `
        -ProjectRoot $projectRoot

    $environmentValues = @{
        APP_PORT = '0'
        FRONTEND_PORT = '0'
        DB_PORT = '0'
        DB_DATABASE = $RecoverySourceDatabase
        DB_USERNAME = 'hospital_recovery'
        HOSPITAL_BACKUP_ENCRYPTION_KEY = New-RecoveryDrillSecret
    }
    $environmentValues['DB_' + 'PASSWORD'] = New-RecoveryDrillSecret
    $environmentValues['DB_ROOT_' + 'PASSWORD'] = New-RecoveryDrillSecret
    $previousEnvironment = @{}

    try {
        foreach ($name in $environmentValues.Keys) {
            $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, [string] $environmentValues[$name], 'Process')
        }

        $drillOutput = @(Invoke-IsolatedRecoveryDrill `
            -ProjectRoot $projectRoot `
            -ComposeProject $RecoveryComposeProject `
            -SourceDatabase $RecoverySourceDatabase `
            -TargetDatabase $RecoveryTargetDatabase `
            -ConfiguredProductionDatabase $ConfiguredProductionDatabase `
            -EvidencePath $RecoveryEvidencePath)
        $result = $drillOutput | Where-Object {
            $_ -is [psobject] -and $null -ne $_.PSObject.Properties['RecoverySucceeded']
        } | Select-Object -Last 1
        if ($null -eq $result) {
            throw 'Recovery drill completed without a certification result.'
        }
        Write-Host "[RECOVERY_CERTIFICATION] $($result | ConvertTo-Json -Compress)"
        return
    } finally {
        foreach ($name in $environmentValues.Keys) {
            [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
        }
    }
}

if ([string]::IsNullOrWhiteSpace($SeedPassword)) {
    if (-not [string]::IsNullOrWhiteSpace($env:E2E_RELEASE_PASSWORD)) {
        $SeedPassword = $env:E2E_RELEASE_PASSWORD
    } elseif (-not [string]::IsNullOrWhiteSpace($env:E2E_SEED_PASSWORD)) {
        $SeedPassword = $env:E2E_SEED_PASSWORD
    }
}

if ([string]::IsNullOrWhiteSpace($SeedPassword)) {
    throw "The E2E seed password must be provided via -SeedPassword, E2E_RELEASE_PASSWORD, or E2E_SEED_PASSWORD."
}

function Format-SafeArgument([string] $Argument) {
    if ($Argument -like "--password=*") {
        return "--password=<hidden>"
    }

    if ($Argument -like "E2E_RELEASE_PASSWORD=*") {
        return "E2E_RELEASE_PASSWORD=<hidden>"
    }

    return $Argument
}

function Invoke-Checked([string] $Label, [string] $FilePath, [string[]] $Arguments) {
    $safeArguments = $Arguments | ForEach-Object { Format-SafeArgument $_ }
    Write-Host "[release-e2e-mariadb] $Label"
    Write-Host "[release-e2e-mariadb] $FilePath $($safeArguments -join ' ')" -ForegroundColor DarkGray

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

function Get-ComposeArguments([string[]] $Arguments) {
    $result = @("compose")
    if (-not [string]::IsNullOrWhiteSpace($ComposeProject)) {
        $result += @("-p", $ComposeProject)
    }
    $result += $Arguments
    return $result
}

$runId = [guid]::NewGuid().ToString("N")

Invoke-Checked "Check Docker Compose services" "docker" (Get-ComposeArguments @("ps", "backend", "frontend"))

if (-not $SkipSeed) {
    Invoke-Checked `
        "Prepare non-production E2E release data" `
        "docker" `
        (Get-ComposeArguments @(
            "exec", "-T", "backend", "php", "artisan", "hospital:prepare-e2e-release-data",
            "--password=$SeedPassword"
        ))
}

Invoke-Checked `
    "Check container Chromium executable" `
    "docker" `
    (Get-ComposeArguments @("exec", "-T", "frontend", "test", "-x", $ChromiumExecutablePath))

Invoke-Checked `
    "Run release Playwright specs against Docker/MariaDB stack" `
    "docker" `
    (Get-ComposeArguments @(
        "exec", "-T",
        "-e", "E2E_RELEASE_ALLOW_MUTATIONS=1",
        "-e", "E2E_RELEASE_BASE_URL=$BaseUrl",
        "-e", "E2E_RELEASE_API_BASE_URL=$ApiBaseUrl",
        "-e", "E2E_RELEASE_REPORT_PATH=$ReportPath",
        "-e", "E2E_RELEASE_RUN_ID=$runId",
        "-e", "E2E_RELEASE_STACK=docker-compose-mariadb",
        "-e", "E2E_RELEASE_DATABASE_DRIVER=mysql",
        "-e", "E2E_RELEASE_LOGIN=$Login",
        "-e", "E2E_RELEASE_ADMIN_LOGIN=$AdminLogin",
        "-e", "E2E_RELEASE_PASSWORD=$SeedPassword",
        "-e", "E2E_RELEASE_SERVICE_QUERY=$ServiceQuery",
        "-e", "E2E_RELEASE_PAYMENT_AMOUNT=$PaymentAmount",
        "-e", "PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=$ChromiumExecutablePath",
        "frontend", "npx", "playwright", "test", "--config=playwright.release.config.ts"
    ))

Write-Host "[release-e2e-mariadb] PASS: release E2E specs completed against Docker/MariaDB stack." -ForegroundColor Green
