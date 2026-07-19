param(
    [string] $ProjectRoot = "",
    [string] $ReleaseRoot = "",
    [switch] $RequireCurrentCommit
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ($ReleaseRoot -eq "") {
    $ReleaseRoot = Join-Path $ProjectRoot "offline-release"
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-ReleaseText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    foreach ($path in @($ProjectRoot, $ReleaseRoot)) {
        if (-not [string]::IsNullOrWhiteSpace($path)) {
            $protected = $protected -replace [regex]::Escape($path), "%PROJECT_ROOT%"
            $protected = $protected -replace [regex]::Escape(($path -replace "\\", "/")), "%PROJECT_ROOT%"
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }

    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-ReleaseText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-ReleaseText $message)" -ForegroundColor Green
}

function Test-RequiredPath([string] $relativePath, [string] $kind) {
    $path = Join-Path $ReleaseRoot $relativePath
    if ($kind -eq "dir") {
        if (Test-Path -LiteralPath $path -PathType Container) {
            Add-Pass "Found $relativePath"
        } else {
            Add-Failure "Missing required release directory: $relativePath"
        }
        return
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
    } else {
        Add-Failure "Missing required release file: $relativePath"
    }
}

function Get-RelativeReleasePath([System.IO.FileSystemInfo] $item) {
    $root = [System.IO.Path]::GetFullPath($ReleaseRoot).TrimEnd("\") + "\"
    $full = [System.IO.Path]::GetFullPath($item.FullName)
    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $full.Substring($root.Length) -replace "\\", "/"
    }

    return $item.FullName -replace "\\", "/"
}

function Test-IsForbiddenEnvFile([string] $name) {
    if ($name -notmatch '(?i)^\.env(\.|$)') {
        return $false
    }

    return $name -notmatch '(?i)(^\.env\.example$|^\.env\..*\.example$|^\.env\.sample$|^\.env\.dist$)'
}

function Test-ReleaseFileMatchesSource([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $release = Join-Path $ReleaseRoot $relativePath

    if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or
        -not (Test-Path -LiteralPath $release -PathType Leaf)) {
        return
    }

    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $releaseHash = (Get-FileHash -LiteralPath $release -Algorithm SHA256).Hash

    if ($sourceHash -eq $releaseHash) {
        Add-Pass "$relativePath matches versioned source"
    } else {
        Add-Failure "$relativePath in offline release differs from versioned source. Regenerate offline-release before handoff."
    }
}

function Invoke-ComposeImages([string] $composePath) {
    if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
        Add-Failure "Docker is required to verify offline image coverage against docker-compose.prod.yml."
        return @()
    }

    $savedEnv = @{
        SERVER_IP = $env:SERVER_IP
        APP_KEY = $env:APP_KEY
        DB_PASSWORD = $env:DB_PASSWORD
        DB_ROOT_PASSWORD = $env:DB_ROOT_PASSWORD
        PUSHER_APP_ID = $env:PUSHER_APP_ID
        PUSHER_APP_KEY = $env:PUSHER_APP_KEY
        PUSHER_APP_SECRET = $env:PUSHER_APP_SECRET
        HOSPITAL_ALLOW_INSECURE_HTTP = $env:HOSPITAL_ALLOW_INSECURE_HTTP
        HOSPITAL_BACKUP_ENCRYPTION_KEY = $env:HOSPITAL_BACKUP_ENCRYPTION_KEY
        HOSPITAL_MIGRATION_BACKUP_CONFIRMED = $env:HOSPITAL_MIGRATION_BACKUP_CONFIRMED
    }

    try {
        $env:SERVER_IP = "127.0.0.1"
        $env:APP_KEY = "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
        $env:DB_PASSWORD = "guard_password"
        $env:DB_ROOT_PASSWORD = "guard_root_password"
        $env:PUSHER_APP_ID = "guard-app"
        $env:PUSHER_APP_KEY = "guard-key"
        $env:PUSHER_APP_SECRET = "guard-secret"
        $env:HOSPITAL_ALLOW_INSECURE_HTTP = "1"
        $env:HOSPITAL_BACKUP_ENCRYPTION_KEY = "guard-backup-key"
        $env:HOSPITAL_MIGRATION_BACKUP_CONFIRMED = "false"

        $quotedComposePath = '"' + ($composePath -replace '"', '\"') + '"'
        $rawOutput = @(& cmd.exe /d /c "docker compose -f $quotedComposePath config --images 2>NUL" | ForEach-Object { $_.ToString() })
        if ($LASTEXITCODE -ne 0) {
            Add-Failure "docker compose config --images failed for offline release coverage."
            return @()
        }

        return @($rawOutput |
            Where-Object { $_ -match '^[A-Za-z0-9._/-]+(?::[A-Za-z0-9._-]+)?(?:@sha256:[a-fA-F0-9]{64})?$' } |
            Sort-Object -Unique)
    } finally {
        foreach ($key in $savedEnv.Keys) {
            if ($null -eq $savedEnv[$key]) {
                Remove-Item "Env:\$key" -ErrorAction SilentlyContinue
            } else {
                Set-Item "Env:\$key" $savedEnv[$key]
            }
        }
    }
}

try {
    $ReleaseRoot = (Resolve-Path -LiteralPath $ReleaseRoot).Path
} catch {
    Add-Failure "Offline release directory does not exist: $ReleaseRoot"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OFFLINE_RELEASE_CLEAN: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host "Checking offline release: $(Protect-ReleaseText $ReleaseRoot)"

Test-RequiredPath "setup.bat" "file"
Test-RequiredPath "docker-compose.prod.yml" "file"
Test-RequiredPath "backend\Dockerfile.prod" "file"
Test-RequiredPath "nginx\default.conf" "file"
Test-RequiredPath "MANIFEST.txt" "file"
Test-RequiredPath "checksums.sha256" "file"
Test-RequiredPath "offline-images" "dir"
Test-RequiredPath "scripts\deploy_hospital_lan.ps1" "file"
Test-RequiredPath "scripts\load_offline_images.ps1" "file"
Test-RequiredPath "scripts\install_hospital_startup_shortcut.ps1" "file"
Test-RequiredPath "scripts\install_backup_tasks_windows.ps1" "file"
Test-RequiredPath "scripts\run_backup_worker.cmd" "file"
Test-RequiredPath "scripts\run_scheduled_backup.cmd" "file"

Test-ReleaseFileMatchesSource "docker-compose.prod.yml"
Test-ReleaseFileMatchesSource "backend\Dockerfile.prod"
Test-ReleaseFileMatchesSource "nginx\default.conf"
Test-ReleaseFileMatchesSource "scripts\deploy_hospital_lan.ps1"
Test-ReleaseFileMatchesSource "scripts\install_hospital_startup_shortcut.ps1"
Test-ReleaseFileMatchesSource "scripts\install_backup_tasks_windows.ps1"
Test-ReleaseFileMatchesSource "scripts\lib\operational_url_safety.ps1"
Test-ReleaseFileMatchesSource "scripts\open_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\repair_hospital_system.ps1"
Test-ReleaseFileMatchesSource "scripts\start_hospital_services.ps1"
Test-ReleaseFileMatchesSource "scripts\run_backup_worker.cmd"
Test-ReleaseFileMatchesSource "scripts\run_scheduled_backup.cmd"

$forbiddenItems = Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -Force | Where-Object {
    $relative = Get-RelativeReleasePath $_
    $name = $_.Name

    if ($_.PSIsContainer) {
        return $relative -match '(^|/)(node_modules|install-logs|playwright-report|test-results|\.git|qa)(/|$)' -or
            $relative -match '(^|/)storage/(app/private/backups|logs)(/|$)'
    }

    return (Test-IsForbiddenEnvFile $name) -or
        $relative -match '(^|/)(install-logs|qa|test-results|playwright-report)/' -or
        $relative -match '(^|/)storage/(app/private/backups|logs)/' -or
        $relative -match '\.(sql|sql\.gz|dump|bak|log|sqlite|sqlite3|db)$'
}

foreach ($item in $forbiddenItems) {
    Add-Failure "Forbidden file or directory in offline release: $(Get-RelativeReleasePath $item)"
}

$manifestPath = Join-Path $ReleaseRoot "MANIFEST.txt"
if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $stalePattern = '(?i)(deben regenerarse|must regenerate|regenerate before|cambios locales|stale|preparacion RC|NOTA RC)'
    if ($manifest -match $stalePattern) {
        Add-Failure "MANIFEST.txt contains stale or candidate-only release wording."
    } else {
        Add-Pass "MANIFEST.txt has no stale release wording"
    }

    if ($RequireCurrentCommit) {
        $head = (& git -C $ProjectRoot rev-parse HEAD 2>$null).Trim()
        $shortHead = (& git -C $ProjectRoot rev-parse --short HEAD 2>$null).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($head)) {
            Add-Failure "Cannot determine current Git commit for manifest validation."
        } elseif ($manifest -match [regex]::Escape($head) -or $manifest -match [regex]::Escape($shortHead)) {
            Add-Pass "MANIFEST.txt references current commit $shortHead"
        } else {
            Add-Failure "MANIFEST.txt must reference current commit $shortHead before release handoff."
        }
    }
}

$imagesDir = Join-Path $ReleaseRoot "offline-images"
if (Test-Path -LiteralPath $imagesDir -PathType Container) {
    $imageFiles = @(Get-ChildItem -LiteralPath $imagesDir -Filter "*.tar" -File)
    if ($imageFiles.Count -eq 0) {
        Add-Failure "offline-images contains no Docker image tar files."
    } else {
        Add-Pass "offline-images contains $($imageFiles.Count) Docker image tar file(s)"
    }

    $checksumPath = Join-Path $ReleaseRoot "checksums.sha256"
    $checksumContent = if (Test-Path -LiteralPath $checksumPath -PathType Leaf) {
        Get-Content -LiteralPath $checksumPath -Raw
    } else {
        ""
    }

    foreach ($image in $imageFiles) {
        $relative = "offline-images/$($image.Name)"
        $sidecar = "$($image.FullName).sha256"
        $actualHash = (Get-FileHash -LiteralPath $image.FullName -Algorithm SHA256).Hash

        if (-not (Test-Path -LiteralPath $sidecar -PathType Leaf)) {
            Add-Failure "Missing checksum sidecar for $relative"
        } else {
            $sidecarHash = (Get-Content -LiteralPath $sidecar -Raw).Trim().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)[0]
            if ($sidecarHash -ne $actualHash) {
                Add-Failure "Checksum sidecar does not match $relative"
            }
        }

        $checksumPattern = "(?im)^\s*$([regex]::Escape($actualHash))\s+$([regex]::Escape($relative))\s*$"
        if ($checksumContent -notmatch $checksumPattern) {
            Add-Failure "checksums.sha256 does not match $relative"
        }
    }

    $expectedImageArchives = @(
        "backend.tar",
        "queue-worker.tar",
        "scheduler.tar",
        "nginx.tar",
        "mariadb.tar",
        "soketi.tar"
    )

    foreach ($expectedImage in $expectedImageArchives) {
        if (-not (Test-Path -LiteralPath (Join-Path $imagesDir $expectedImage) -PathType Leaf)) {
            Add-Failure "offline-images is missing required Docker image archive: $expectedImage"
        }
    }

    $expectedImages = @{
        "s_hospital-backend:latest" = "backend.tar"
        "s_hospital-queue-worker:latest" = "queue-worker.tar"
        "s_hospital-scheduler:latest" = "scheduler.tar"
        "nginx:1.25.4-alpine@sha256:31bad00311cb5eeb8a6648beadcf67277a175da89989f14727420a80e2e76742" = "nginx.tar"
        "mariadb:11.4.3@sha256:e3432369d4d432ec2a3d777ff84ffca11ec8c2188cf1b6a0551a393ae5d833bb" = "mariadb.tar"
        "quay.io/soketi/soketi:1.6-16-alpine@sha256:5e45fe1adbf2d4ef8022d0126a3c7e4371b7b08f35784b76a2dc353954ee885c" = "soketi.tar"
    }

    $composeImages = Invoke-ComposeImages (Join-Path $ReleaseRoot "docker-compose.prod.yml")
    if ($composeImages.Count -gt 0) {
        foreach ($image in $composeImages) {
            if (-not $expectedImages.ContainsKey($image)) {
                Add-Failure "docker-compose.prod.yml uses image '$image' but offline release has no expected archive mapping."
            }
        }

        foreach ($image in $expectedImages.Keys) {
            if ($composeImages -notcontains $image) {
                Add-Failure "offline image mapping contains '$image' but docker-compose.prod.yml does not use it."
            }
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OFFLINE_RELEASE_CLEAN: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OFFLINE_RELEASE_CLEAN: YES" -ForegroundColor Green
