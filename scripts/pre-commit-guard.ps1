param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

function Normalize-GitPath {
    param([string]$Path)

    return ($Path -replace "\\", "/").Trim()
}

function Get-StagedAddedLines {
    param([string]$Root)

    $diff = git -C $Root diff --cached --unified=0 --no-ext-diff --no-color

    foreach ($line in $diff) {
        if ($line.StartsWith("+++") -or -not $line.StartsWith("+")) {
            continue
        }

        $line.Substring(1)
    }
}

function Is-AllowedEnvExample {
    param([string]$Path)

    $name = [System.IO.Path]::GetFileName($Path)

    return $name -in @(".env.example", ".env.docker.example") -or $name.EndsWith(".env.example")
}

function Is-BlockedEnvFile {
    param([string]$Path)

    $name = [System.IO.Path]::GetFileName($Path)

    if (Is-AllowedEnvExample -Path $Path) {
        return $false
    }

    return $name -eq ".env" -or
        $name -eq ".env.production" -or
        $name.EndsWith(".env.local") -or
        $name.EndsWith(".env.production")
}

function Is-PlaceholderValue {
    param([string]$Value)

    $normalized = $Value.Trim().Trim('"').Trim("'")

    return $normalized -eq "" -or
        $normalized -match "^(placeholder|change-me|changeme|example|dummy|null|none)$" -or
        $normalized -match "^\$\{[A-Z0-9_]+\}$"
}

if (-not (Test-Path -LiteralPath $RepoRoot)) {
    Write-Error "RepoRoot does not exist: $RepoRoot"
    exit 1
}

$resolvedRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

$stagedFiles = git -C $resolvedRoot diff --cached --name-only --diff-filter=ACMR

foreach ($file in $stagedFiles) {
    $path = Normalize-GitPath -Path $file

    if ($path -match "(^|/)offline-release/") {
        $errors.Add("Do not commit generated offline-release files: $path")
    }

    if ($path -match "(^|/)nginx/ssl/") {
        $errors.Add("Do not commit private TLS material from nginx/ssl: $path")
    }

    if (Is-BlockedEnvFile -Path $path) {
        $errors.Add("Do not commit real environment files: $path")
    }
}

foreach ($line in Get-StagedAddedLines -Root $resolvedRoot) {
    if ($line -match "(?i)\bAPP_KEY\s*=\s*base64:[A-Za-z0-9+/=]{17,}") {
        $errors.Add("Staged diff contains a real-looking APP_KEY.")
    }

    foreach ($name in @("DB_PASSWORD", "DB_ROOT_PASSWORD")) {
        if ($line -match "(?i)\b$name\s*=\s*(.+)$") {
            $value = $Matches[1].Trim()

            if (-not (Is-PlaceholderValue -Value $value) -or $value -match "^(hospital_dev|root_dev)$") {
                $errors.Add("Staged diff contains $name with a non-placeholder value.")
            }
        }
    }

    if ($line -match "(?i)\bHOSPITAL_LICENSE_SALT\s*=\s*(.+)$") {
        $value = $Matches[1].Trim()

        if (-not (Is-PlaceholderValue -Value $value) -and $value.Length -ge 8) {
            $errors.Add("Staged diff contains HOSPITAL_LICENSE_SALT with a non-placeholder value.")
        }
    }

    if ($line -match "(?i)\bHOSPITAL_INITIAL_ADMIN_PASSWORD\s*=\s*(.+)$") {
        $value = $Matches[1].Trim()

        if (-not (Is-PlaceholderValue -Value $value)) {
            $errors.Add("Staged diff contains HOSPITAL_INITIAL_ADMIN_PASSWORD.")
        }
    }

    if ($line -match "(?i)\bHOSPITAL_DUMP_BINARY\s*=\s*[A-Za-z]:\\") {
        $warnings.Add("WARNING: HOSPITAL_DUMP_BINARY contains a Windows path. Review before committing.")
    }
}

foreach ($warning in $warnings) {
    Write-Warning $warning
}

if ($errors.Count -gt 0) {
    Write-Host "S_Hospital pre-commit guard blocked the commit:" -ForegroundColor Red

    foreach ($errorMessage in $errors) {
        Write-Host " - $errorMessage" -ForegroundColor Red
    }

    exit 1
}

Write-Host "S_Hospital pre-commit guard passed."
exit 0
