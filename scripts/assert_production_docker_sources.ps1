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

function Convert-SizeToMb([string] $value) {
    if ($value -notmatch '^\s*(\d+)([KMGkmg]?)\s*$') {
        return $null
    }

    $amount = [decimal]$Matches[1]
    $unit = $Matches[2]
    if ([string]::IsNullOrWhiteSpace($unit)) {
        $unit = "M"
    }

    switch ($unit.ToUpperInvariant()) {
        "K" { return $amount / 1024 }
        "G" { return $amount * 1024 }
        default { return $amount }
    }
}

function Test-UploadLimitAlignment {
    $nginxPath = Join-Path $ProjectRoot "nginx\default.conf"
    $dockerfilePath = Join-Path $ProjectRoot "backend\Dockerfile.prod"

    if (-not (Test-Path -LiteralPath $nginxPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $dockerfilePath -PathType Leaf)) {
        return
    }

    $nginx = Get-Content -LiteralPath $nginxPath -Raw
    $dockerfile = Get-Content -LiteralPath $dockerfilePath -Raw

    if ($nginx -notmatch '(?m)client_max_body_size\s+([0-9]+[KMGkmg]?)\s*;') {
        Add-Failure "nginx/default.conf must define client_max_body_size for offline upload safety."
        return
    }
    $nginxLimit = $Matches[1]

    if ($dockerfile -notmatch 'upload_max_filesize=([0-9]+[KMGkmg]?)') {
        Add-Failure "backend/Dockerfile.prod must define upload_max_filesize."
        return
    }
    $phpUploadLimit = $Matches[1]

    if ($dockerfile -notmatch 'post_max_size=([0-9]+[KMGkmg]?)') {
        Add-Failure "backend/Dockerfile.prod must define post_max_size."
        return
    }
    $phpPostLimit = $Matches[1]

    $nginxMb = Convert-SizeToMb $nginxLimit
    $uploadMb = Convert-SizeToMb $phpUploadLimit
    $postMb = Convert-SizeToMb $phpPostLimit

    if ($null -eq $nginxMb -or $null -eq $uploadMb -or $null -eq $postMb) {
        Add-Failure "Production upload limits must be parseable size values."
        return
    }

    if ($nginxMb -le $uploadMb -and $nginxMb -le $postMb) {
        Add-Pass "nginx upload limit ($nginxLimit) is aligned with PHP limits ($phpUploadLimit/$phpPostLimit)"
    } else {
        Add-Failure "nginx client_max_body_size ($nginxLimit) must not exceed PHP upload_max_filesize/post_max_size ($phpUploadLimit/$phpPostLimit)."
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
    foreach ($required in @("backend", "queue-worker", "scheduler", "soketi", "nginx", "mysql")) {
        if ($compose -match "(?m)^\s{2}$([regex]::Escape($required)):\s*$") {
            Add-Pass "docker-compose.prod.yml contains service $required"
        } else {
            Add-Failure "docker-compose.prod.yml is missing service $required"
        }
    }
}

Test-UploadLimitAlignment

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "PRODUCTION_DOCKER_SOURCES: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "PRODUCTION_DOCKER_SOURCES: YES" -ForegroundColor Green
