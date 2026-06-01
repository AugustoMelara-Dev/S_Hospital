param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]
$dockerignoreRules = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Test-RequiredPath([string] $relativePath, [string] $kind) {
    $path = Join-Path $ProjectRoot $relativePath
    if ($kind -eq "dir") {
        if (Test-Path -LiteralPath $path -PathType Container) {
            Add-Pass "Found $relativePath"
        } else {
            Add-Failure "Missing required directory: $relativePath"
        }
        return
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
    } else {
        Add-Failure "Missing required file: $relativePath"
    }
}

function Convert-ToNormalizedDockerPath([string] $relativePath) {
    return ($relativePath.Trim().Trim('"').Trim("'") -replace "\\", "/").TrimStart("./")
}

function Test-PathNotExcludedByDockerignore([string] $relativePath) {
    $normalized = Convert-ToNormalizedDockerPath $relativePath
    if ([string]::IsNullOrWhiteSpace($normalized) -or $normalized.StartsWith("--") -or $normalized -match '[*?\[]') {
        return
    }

    foreach ($rule in $dockerignoreRules) {
        $negated = $rule.StartsWith("!")
        $pattern = if ($negated) { $rule.Substring(1) } else { $rule }
        $pattern = (Convert-ToNormalizedDockerPath $pattern).TrimEnd("/")

        if ([string]::IsNullOrWhiteSpace($pattern) -or $pattern -match '[*?\[]') {
            continue
        }

        $isMatch = $normalized -eq $pattern -or
            $normalized.StartsWith("$pattern/", [System.StringComparison]::OrdinalIgnoreCase)

        if ($isMatch -and -not $negated) {
            Add-Failure "Dockerfile COPY source is excluded by .dockerignore: $normalized"
            return
        }
    }
}

function Test-CopySourceExists([string] $source) {
    $normalized = $source.Trim().Trim('"').Trim("'")
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return
    }

    if ($normalized.StartsWith("--")) {
        return
    }

    $candidate = Join-Path $ProjectRoot $normalized
    if ($normalized -match '[*?\[]') {
        $parent = Split-Path -Parent $candidate
        $leaf = Split-Path -Leaf $candidate
        if ([string]::IsNullOrWhiteSpace($parent)) {
            $parent = $ProjectRoot
        }

        if ((Test-Path -LiteralPath $parent) -and @(Get-ChildItem -LiteralPath $parent -Filter $leaf -Force).Count -gt 0) {
            Add-Pass "Dockerfile COPY source exists: $normalized"
        } else {
            Add-Failure "Dockerfile COPY source glob has no matches: $normalized"
        }
        return
    }

    if (Test-Path -LiteralPath $candidate) {
        Add-Pass "Dockerfile COPY source exists: $normalized"
        Test-PathNotExcludedByDockerignore $normalized
    } else {
        Add-Failure "Dockerfile COPY source is missing: $normalized"
    }
}

$composePath = Join-Path $ProjectRoot "docker-compose.prod.yml"
$dockerfilePath = Join-Path $ProjectRoot "backend\Dockerfile.prod"
$dockerignorePath = Join-Path $ProjectRoot ".dockerignore"

Test-RequiredPath "docker-compose.prod.yml" "file"
Test-RequiredPath "backend\Dockerfile.prod" "file"
Test-RequiredPath ".dockerignore" "file"
Test-RequiredPath "nginx\default.conf" "file"
Test-RequiredPath "frontend\package.json" "file"
Test-RequiredPath "frontend\package-lock.json" "file"
Test-RequiredPath "backend\composer.json" "file"
Test-RequiredPath "backend\composer.lock" "file"

if (Test-Path -LiteralPath $dockerignorePath -PathType Leaf) {
    Get-Content -LiteralPath $dockerignorePath | ForEach-Object {
        $rule = $_.Trim()
        if (-not [string]::IsNullOrWhiteSpace($rule) -and -not $rule.StartsWith("#")) {
            $dockerignoreRules.Add($rule) | Out-Null
        }
    }
}

if (Test-Path -LiteralPath $dockerfilePath -PathType Leaf) {
    $copyLines = Get-Content -LiteralPath $dockerfilePath | Where-Object { $_ -match '^\s*COPY\s+' }
    foreach ($line in $copyLines) {
        $trimmed = ($line -replace '\s+#.*$', '').Trim()
        if ($trimmed -match '^\s*COPY\s+--from=') {
            continue
        }

        $parts = [regex]::Split($trimmed, '\s+') | Where-Object { $_ -ne "" }
        if ($parts.Count -lt 3) {
            Add-Failure "Dockerfile COPY line is not parseable: $line"
            continue
        }

        $sources = $parts[1..($parts.Count - 2)]
        foreach ($source in $sources) {
            Test-CopySourceExists $source
        }
    }
}

if (Test-Path -LiteralPath $composePath -PathType Leaf) {
    $compose = Get-Content -LiteralPath $composePath -Raw
    foreach ($required in @("backend", "queue-worker", "nginx", "mysql")) {
        if ($compose -match "(?m)^\s{2}$([regex]::Escape($required)):\s*$") {
            Add-Pass "docker-compose.prod.yml contains service $required"
        } else {
            Add-Failure "docker-compose.prod.yml is missing service $required"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_DOCKER_SOURCES: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PRODUCTION_DOCKER_SOURCES: YES" -ForegroundColor Green
