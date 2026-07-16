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
    [switch] $SkipSeed
)

$ErrorActionPreference = "Stop"

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
