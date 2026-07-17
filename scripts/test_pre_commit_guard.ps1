param(
    [string]$GuardPath = (Join-Path $PSScriptRoot "pre-commit-guard.ps1")
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "ASSERTION FAILED: $Message"
    }
}

function New-TestRepo {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ("s-hospital-precommit-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $root | Out-Null
    git -C $root init --quiet
    git -C $root config user.email "test@example.test"
    git -C $root config user.name "Precommit Test"
    return $root
}

function Invoke-Guard {
    param([string]$RepoRoot)

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $GuardPath -RepoRoot $RepoRoot 2>&1

    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = ($output -join "`n")
    }
}

Assert-True (Test-Path -LiteralPath $GuardPath) "pre-commit guard script exists"

$safeRepo = New-TestRepo
Set-Content -LiteralPath (Join-Path $safeRepo ".env.example") -Value @(
    "APP_KEY=base64:base64-placeholder"
    ("DB_" + "PASSWORD=placeholder")
    ("DB_ROOT_" + "PASSWORD=placeholder")
) -Encoding UTF8
git -C $safeRepo add .env.example
$safeResult = Invoke-Guard -RepoRoot $safeRepo
Assert-True ($safeResult.ExitCode -eq 0) "placeholder .env.example passes"

$secretRepo = New-TestRepo
$fakeAppKey = "APP_KEY=base64:" + ("A" * 43) + "="
Set-Content -LiteralPath (Join-Path $secretRepo "leak.txt") -Value $fakeAppKey -Encoding UTF8
git -C $secretRepo add leak.txt
$secretResult = Invoke-Guard -RepoRoot $secretRepo
Assert-True ($secretResult.ExitCode -ne 0) "real APP_KEY is blocked"
Assert-True ($secretResult.Output -match "APP_KEY") "APP_KEY failure is explained"

$adminPasswordVariable = "HOSPITAL_INITIAL_ADMIN_" + "PASSWORD"
$dynamicAdminRepo = New-TestRepo
Set-Content -LiteralPath (Join-Path $dynamicAdminRepo "installer.ps1") -Value "`$env:${adminPasswordVariable}=`$temporaryPassword" -Encoding UTF8
git -C $dynamicAdminRepo add installer.ps1
$dynamicAdminResult = Invoke-Guard -RepoRoot $dynamicAdminRepo
Assert-True ($dynamicAdminResult.ExitCode -eq 0) "runtime initial admin password assignment passes"

$literalAdminRepo = New-TestRepo
Set-Content -LiteralPath (Join-Path $literalAdminRepo "leak.txt") -Value "${adminPasswordVariable}=DoNotCommit123!" -Encoding UTF8
git -C $literalAdminRepo add leak.txt
$literalAdminResult = Invoke-Guard -RepoRoot $literalAdminRepo
Assert-True ($literalAdminResult.ExitCode -ne 0) "literal initial admin password is blocked"
Assert-True ($literalAdminResult.Output -match "INITIAL_ADMIN_PASSWORD") "initial admin password failure is explained"

$envRepo = New-TestRepo
Set-Content -LiteralPath (Join-Path $envRepo ".env") -Value ("DB_" + "PASSWORD=placeholder") -Encoding UTF8
git -C $envRepo add .env
$envResult = Invoke-Guard -RepoRoot $envRepo
Assert-True ($envResult.ExitCode -ne 0) "real .env files are blocked even with placeholders"
Assert-True ($envResult.Output -match "\.env") ".env failure is explained"

$sslRepo = New-TestRepo
New-Item -ItemType Directory -Path (Join-Path $sslRepo "nginx/ssl") -Force | Out-Null
Set-Content -LiteralPath (Join-Path $sslRepo "nginx/ssl/server.key") -Value "fake-key-material" -Encoding UTF8
git -C $sslRepo add nginx/ssl/server.key
$sslResult = Invoke-Guard -RepoRoot $sslRepo
Assert-True ($sslResult.ExitCode -ne 0) "nginx ssl material is blocked"
Assert-True ($sslResult.Output -match "nginx/ssl") "nginx/ssl failure is explained"

$worktreeBackupRepo = New-TestRepo
New-Item -ItemType Directory -Path (Join-Path $worktreeBackupRepo "qa/production-audit") -Force | Out-Null
Set-Content -LiteralPath (Join-Path $worktreeBackupRepo "qa/production-audit/worktree_backup.diff") -Value "diff --git a/old b/old" -Encoding UTF8
git -C $worktreeBackupRepo add qa/production-audit/worktree_backup.diff
$worktreeBackupResult = Invoke-Guard -RepoRoot $worktreeBackupRepo
Assert-True ($worktreeBackupResult.ExitCode -ne 0) "generated worktree backup patches are blocked"
Assert-True ($worktreeBackupResult.Output -match "worktree backup") "worktree backup failure is explained"

$dumpRepo = New-TestRepo
$dumpBinary = "HOSPITAL_DUMP_" + "BINARY=C:\Program Files\MariaDB\bin\mysqldump.exe"
Set-Content -LiteralPath (Join-Path $dumpRepo "config.txt") -Value $dumpBinary -Encoding UTF8
git -C $dumpRepo add config.txt
$dumpResult = Invoke-Guard -RepoRoot $dumpRepo
Assert-True ($dumpResult.ExitCode -eq 0) "HOSPITAL_DUMP_BINARY path is warning-only"
Assert-True ($dumpResult.Output -match "WARNING") "HOSPITAL_DUMP_BINARY warning is emitted"

Write-Host "pre-commit guard tests passed"
