# =============================================================================
# Tests for the pre-commit guard
# =============================================================================
# These tests run scripts/pre-commit-guard.ps1 against staged diffs in
# an isolated temp repo and assert which patterns are blocked.
# =============================================================================
param(
    [string] $ScriptPath
)

$ErrorActionPreference = "Stop"

if (-not $ScriptPath) {
    $ScriptPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\scripts\pre-commit-guard.ps1")).Path
}

if (-not (Test-Path -LiteralPath $ScriptPath)) {
    Write-Error "Guard script not found: $ScriptPath"
    exit 2
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "hospital-guard-test-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
try {
    & git -C $tempRoot init --quiet --initial-branch=main 2>&1 | Out-Null
    & git -C $tempRoot config user.email "guard-test@hospital.local" 2>&1 | Out-Null
    & git -C $tempRoot config user.name "guard-test" 2>&1 | Out-Null

    # Make an initial commit so the index has a HEAD ref for subsequent
    # `git reset HEAD` operations in Test-Block.
    $readmePath = Join-Path $tempRoot "README.md"
    Set-Content -LiteralPath $readmePath -Value "init" -NoNewline
    & git -C $tempRoot add README.md 2>&1 | Out-Null
    & git -C $tempRoot commit --quiet -m "init" 2>&1 | Out-Null

    function Test-Block {
        param(
            [string] $Label,
            [string] $Content,
            [string] $Filename,
            [bool] $ExpectBlock
        )
        & git -C $tempRoot reset --quiet HEAD 2>&1 | Out-Null
        & git -C $tempRoot rm -rf --cached --quiet . 2>&1 | Out-Null
        Get-ChildItem -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike (Join-Path $tempRoot '.git*') } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        $filePath = Join-Path $tempRoot $Filename
        $parentDir = Split-Path $filePath -Parent
        if ($parentDir -ne $tempRoot) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        Set-Content -LiteralPath $filePath -Value $Content -NoNewline
        & git -C $tempRoot add $Filename 2>&1 | Out-Null
        $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -RepoRoot $tempRoot 2>&1
        $exitCode = $LASTEXITCODE
        $blocked = ($exitCode -ne 0)
        if ($blocked -eq $ExpectBlock) {
            Write-Host "PASS: $Label" -ForegroundColor Green
        } else {
            Write-Host "FAIL: $Label (expected block=$ExpectBlock, got=$blocked)" -ForegroundColor Red
            Write-Host $output
            exit 1
        }
    }

    # Pattern 1: real APP_KEY value must be blocked.
    Test-Block -Label "APP_KEY=base64: with real value is blocked" `
        -Content "APP_KEY=base64:gekGle3f0dHMqMF5Zeu/rgyNJ+r8A1yxAevylYYdzA0=" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 2: empty APP_KEY must pass.
    Test-Block -Label "APP_KEY= (empty) is allowed" `
        -Content "APP_KEY=" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $false

    # Pattern 3: real DB_PASSWORD must be blocked.
    Test-Block -Label "DB_PASSWORD=RealSecret123! is blocked" `
        -Content "DB_PASSWORD=RealSecret123!" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 4: dev default DB_PASSWORD=hospital_dev is blocked (legacy dev value).
    Test-Block -Label "DB_PASSWORD=hospital_dev is blocked" `
        -Content "DB_PASSWORD=hospital_dev" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 4b: DB_ROOT_PASSWORD=root_dev is blocked.
    Test-Block -Label "DB_ROOT_PASSWORD=root_dev is blocked" `
        -Content "DB_ROOT_PASSWORD=root_dev" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 5: empty DB_PASSWORD is allowed.
    Test-Block -Label "DB_PASSWORD= (empty) is allowed" `
        -Content "DB_PASSWORD=" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $false

    # Pattern 6: any file in offline-release outside the allow-list is blocked.
    Test-Block -Label "offline-release/random.bin is blocked" `
        -Content "binary content" `
        -Filename "offline-release/random.bin" `
        -ExpectBlock $true

    # Pattern 7: offline-release/MANIFEST.txt is allowed.
    Test-Block -Label "offline-release/MANIFEST.txt is allowed" `
        -Content "manifest line" `
        -Filename "offline-release/MANIFEST.txt" `
        -ExpectBlock $false

    # Pattern 8: HOSPITAL_LICENSE_SALT with a real value is blocked.
    Test-Block -Label "HOSPITAL_LICENSE_SALT with 32+ char value is blocked" `
        -Content "HOSPITAL_LICENSE_SALT=abcdefghijklmnopqrstuvwxyz123456" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 9: HOSPITAL_LICENSE_SALT empty is allowed.
    Test-Block -Label "HOSPITAL_LICENSE_SALT= (empty) is allowed" `
        -Content "HOSPITAL_LICENSE_SALT=" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $false

    # Pattern 10: HOSPITAL_INITIAL_ADMIN_PASSWORD with a real value is blocked.
    Test-Block -Label "HOSPITAL_INITIAL_ADMIN_PASSWORD with real value is blocked" `
        -Content "HOSPITAL_INITIAL_ADMIN_PASSWORD=StrongAdminPass2026!" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $true

    # Pattern 11: HOSPITAL_INITIAL_ADMIN_PASSWORD empty is allowed.
    Test-Block -Label "HOSPITAL_INITIAL_ADMIN_PASSWORD= (empty) is allowed" `
        -Content "HOSPITAL_INITIAL_ADMIN_PASSWORD=" `
        -Filename "config/.env.proposed" `
        -ExpectBlock $false

    # Pattern 12: any tracked .env file is blocked (defense in depth).
    Test-Block -Label "Tracked .env file is blocked" `
        -Content "APP_KEY=base64:abc" `
        -Filename "config/.env" `
        -ExpectBlock $true

    # Pattern 13: .env.example is allowed.
    Test-Block -Label ".env.example is allowed" `
        -Content "APP_KEY=" `
        -Filename "backend/.env.example" `
        -ExpectBlock $false

    # Pattern 14: nginx/ssl/ private cert is blocked.
    Test-Block -Label "nginx/ssl/server.key is blocked" `
        -Content "-----BEGIN PRIVATE KEY-----" `
        -Filename "nginx/ssl/server.key" `
        -ExpectBlock $true

    Write-Host ""
    Write-Host "All pre-commit guard tests passed." -ForegroundColor Green
    exit 0
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
