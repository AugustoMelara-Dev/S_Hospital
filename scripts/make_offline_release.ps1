param(
    [string] $ProjectRoot = "",
    [string] $ReleaseRoot = "",
    [switch] $Force,
    [switch] $AllowDirty,
    [switch] $SkipDockerBuild,
    [switch] $SkipDockerSave,
    [switch] $SkipGuard,
    [switch] $SelfTest
)

$script:NginxDefaultConfMinLines = 80
$script:OfflineReleaseCriticalScripts = @(
    "assert_offline_release_clean.ps1",
    "collect_support_packet.ps1",
    "deploy_hospital_lan.ps1",
    "final_production_handoff.ps1",
    "init_production_proofs.ps1",
    "install_backup_tasks_windows.ps1",
    "install_hospital_startup_shortcut.ps1",
    "load_offline_images.ps1",
    "open_hospital_system.ps1",
    "production_readiness_preflight.ps1",
    "refresh_lan_ip.ps1",
    "repair_hospital_system.ps1",
    "run_backup_worker.cmd",
    "run_scheduled_backup.cmd",
    "start_hospital_services.ps1",
    "validate_backup_restore_docs_safety.ps1",
    "validate_browser_smoke_evidence.ps1",
    "validate_double_action_safety.ps1",
    "validate_field_proof_templates.ps1",
    "validate_final_handoff_completeness.ps1",
    "validate_help_screen_safety.ps1",
    "validate_installation_docs_safety.ps1",
    "validate_installer_legacy_safety.ps1",
    "validate_lan_client.ps1",
    "validate_lan_recovery_safety.ps1",
    "validate_operator_manuals_safety.ps1",
    "validate_operations_objective_audit.ps1",
    "validate_ops_evidence_index.ps1",
    "validate_shift_incident_recovery_safety.ps1",
    "validate_startup_repair_safety.ps1",
    "validate_support_packet_safety.ps1",
    "validate_system_diagnostics_safety.ps1",
    "validate_training_safety.ps1"
)
$script:OfflineReleaseCriticalDocs = @(
    "RELEASE_CHECKLIST.md",
    "manuales\GUIA_INSTALACION_OPERATIVA.md",
    "manuales\GUIA_RESPALDOS_Y_RESTAURACION.md",
    "manuales\GUIA_SOPORTE_PRIMER_NIVEL.md",
    "manuales\MANUAL_ADMINISTRADOR.md",
    "manuales\MANUAL_CAJERO.md",
    "manuales\MANUAL_SUPERVISOR.md"
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

if ($SelfTest) {
    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("s_hospital_offline_release_selftest_" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    try {
        $tempNginx = Join-Path $tempRoot "nginx"
        New-Item -ItemType Directory -Force -Path $tempNginx | Out-Null

        $sourceDefaultConf = Join-Path $ProjectRoot "nginx/default.conf"
        $sourceCrontab = Join-Path $ProjectRoot "nginx/crontab"
        if (-not (Test-Path -LiteralPath $sourceDefaultConf -PathType Leaf)) {
            Write-Fail "SelfTest FAILED: source nginx/default.conf is missing at $sourceDefaultConf."
        }
        if (-not (Test-Path -LiteralPath $sourceCrontab -PathType Leaf)) {
            Write-Fail "SelfTest FAILED: source nginx/crontab is missing at $sourceCrontab."
        }

        Copy-Item -LiteralPath $sourceDefaultConf -Destination (Join-Path $tempNginx "default.conf") -Force
        Copy-Item -LiteralPath $sourceCrontab -Destination (Join-Path $tempNginx "crontab") -Force
        Copy-Item -LiteralPath (Join-Path $ProjectRoot "scripts") -Destination (Join-Path $tempRoot "scripts") -Recurse -Force
        Copy-Item -LiteralPath (Join-Path $ProjectRoot "docs") -Destination (Join-Path $tempRoot "docs") -Recurse -Force

        $releaseSetup = Join-Path $ProjectRoot "scripts\release_setup.bat"
        if (-not (Test-Path -LiteralPath $releaseSetup -PathType Leaf)) {
            Write-Fail "SelfTest FAILED: scripts/release_setup.bat is missing."
        }
        Copy-Item -LiteralPath $releaseSetup -Destination (Join-Path $tempRoot "setup.bat") -Force
        Remove-Item -LiteralPath (Join-Path $tempRoot "scripts\release_setup.bat") -Force

        $defaultConfLines = (Get-Content -LiteralPath (Join-Path $tempNginx "default.conf")).Count
        $crontabLines = (Get-Content -LiteralPath (Join-Path $tempNginx "crontab")).Count

        if ($defaultConfLines -lt $script:NginxDefaultConfMinLines) {
            Write-Fail "SelfTest FAILED: nginx/default.conf is $defaultConfLines lines (>= $script:NginxDefaultConfMinLines required). The release bundle would ship a stripped-down config."
        }
        if ($crontabLines -lt 1) {
            Write-Fail "SelfTest FAILED: nginx/crontab is empty after copy."
        }

        $sourceHash = (Get-FileHash -LiteralPath $sourceDefaultConf -Algorithm SHA256).Hash
        $copiedHash = (Get-FileHash -LiteralPath (Join-Path $tempNginx "default.conf") -Algorithm SHA256).Hash
        if ($sourceHash -ne $copiedHash) {
            Write-Fail "SelfTest FAILED: copied nginx/default.conf does not match source hash."
        }

        foreach ($scriptName in $script:OfflineReleaseCriticalScripts) {
            $bundledScript = Join-Path (Join-Path $tempRoot "scripts") $scriptName
            if (-not (Test-Path -LiteralPath $bundledScript -PathType Leaf)) {
                Write-Fail "SelfTest FAILED: bundled scripts/$scriptName is missing."
            }
        }

        foreach ($docName in $script:OfflineReleaseCriticalDocs) {
            $bundledDoc = Join-Path (Join-Path $tempRoot "docs") $docName
            if (-not (Test-Path -LiteralPath $bundledDoc -PathType Leaf)) {
                Write-Fail "SelfTest FAILED: bundled docs/$docName is missing."
            }
        }

        if (-not (Test-Path -LiteralPath (Join-Path $tempRoot "setup.bat") -PathType Leaf)) {
            Write-Fail "SelfTest FAILED: root setup.bat launcher was not created."
        }
        if (Test-Path -LiteralPath (Join-Path $tempRoot "scripts\release_setup.bat") -PathType Leaf) {
            Write-Fail "SelfTest FAILED: scripts/release_setup.bat should be replaced by root setup.bat in the bundle."
        }

        Write-Host "[OK] SelfTest passed. default.conf=$defaultConfLines lines, crontab=$crontabLines lines, scripts=$($script:OfflineReleaseCriticalScripts.Count), docs=$($script:OfflineReleaseCriticalDocs.Count), hash=$sourceHash" -ForegroundColor Green
    } finally {
        if (Test-Path -LiteralPath $tempRoot) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force
        }
    }
    return
}

if ($ReleaseRoot -eq "") {
    $ReleaseRoot = Join-Path $ProjectRoot "offline-release"
}

$ReleaseRoot = [System.IO.Path]::GetFullPath($ReleaseRoot)
$imagesDir = Join-Path $ReleaseRoot "offline-images"
$composePath = Join-Path $ProjectRoot "docker-compose.prod.yml"
$guardScript = Join-Path $ProjectRoot "scripts\assert_offline_release_clean.ps1"
$dockerSourcesGuard = Join-Path $ProjectRoot "scripts\assert_production_docker_sources.ps1"

function Write-Step([string] $message) {
    Write-Host "[*] $message" -ForegroundColor Yellow
}

function Write-Fail([string] $message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

function Copy-RequiredFile([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $target = Join-Path $ReleaseRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        Write-Fail "Falta archivo requerido: $relativePath"
    }

    $targetDir = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $target -Force
}

function Copy-RequiredDirectory([string] $relativePath) {
    $source = Join-Path $ProjectRoot $relativePath
    $target = Join-Path $ReleaseRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        Write-Fail "Falta directorio requerido: $relativePath"
    }

    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
}

function Get-GitValue([string[]] $arguments, [string] $fallback) {
    try {
        $value = (& git -C $ProjectRoot @arguments 2>$null).Trim()
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    } catch {}

    return $fallback
}

if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
    Write-Fail "Falta docker-compose.prod.yml versionado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "backend\Dockerfile.prod") -PathType Leaf)) {
    Write-Fail "Falta backend\Dockerfile.prod versionado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "nginx\default.conf") -PathType Leaf)) {
    Write-Fail "Falta nginx\default.conf versionado."
}

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "nginx\crontab") -PathType Leaf)) {
    Write-Fail "Falta nginx\crontab versionado."
}

if (-not (Test-Path -LiteralPath $dockerSourcesGuard -PathType Leaf)) {
    Write-Fail "Falta scripts\assert_production_docker_sources.ps1 versionado."
}

Write-Step "Validando fuentes Docker productivas."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $dockerSourcesGuard -ProjectRoot $ProjectRoot
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Las fuentes Docker productivas no son reproducibles."
}

$gitStatus = Get-GitValue @("status", "--porcelain") ""
if (-not $AllowDirty -and -not [string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Fail "El arbol Git tiene cambios sin commitear. Use -AllowDirty solo para pruebas de script, no para release final."
}

if ((Test-Path -LiteralPath $ReleaseRoot) -and -not $Force) {
    Write-Fail "La carpeta de release ya existe. Use -Force para reemplazarla."
}

if (Test-Path -LiteralPath $ReleaseRoot) {
    Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $ReleaseRoot, $imagesDir | Out-Null

$gitCommit = Get-GitValue @("rev-parse", "HEAD") "unknown"
$gitShort = Get-GitValue @("rev-parse", "--short", "HEAD") "unknown"
$gitBranch = Get-GitValue @("rev-parse", "--abbrev-ref", "HEAD") "unknown"

Write-Step "Copiando archivos versionados de instalacion."
Copy-RequiredFile "docker-compose.prod.yml"
Copy-RequiredFile "backend\Dockerfile.prod"
Copy-RequiredFile "nginx\default.conf"
Copy-RequiredFile "nginx\crontab"

$bundledDefaultConf = Join-Path $ReleaseRoot "nginx\default.conf"
$bundledDefaultConfLines = (Get-Content -LiteralPath $bundledDefaultConf).Count
if ($bundledDefaultConfLines -lt $script:NginxDefaultConfMinLines) {
    Write-Fail "nginx\default.conf en release tiene solo $bundledDefaultConfLines lineas (>= $script:NginxDefaultConfMinLines requeridas). Se rechaza empacar una config truncada."
}
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "scripts\release_setup.bat") -PathType Leaf)) {
    Write-Fail "Falta scripts\release_setup.bat versionado."
}
Copy-RequiredDirectory "scripts"
Copy-RequiredDirectory "docs"
Copy-Item -LiteralPath (Join-Path $ProjectRoot "scripts\release_setup.bat") -Destination (Join-Path $ReleaseRoot "setup.bat") -Force
Remove-Item -LiteralPath (Join-Path $ReleaseRoot "scripts\release_setup.bat") -Force

if (-not $SkipDockerBuild) {
    if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
        Write-Fail "Docker es requerido para construir imagenes offline."
    }

    Write-Step "Construyendo imagenes Docker productivas."
    $env:SERVER_IP = "127.0.0.1"
    $env:APP_KEY = "base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    $env:DB_PASSWORD = "build_password"
    $env:DB_ROOT_PASSWORD = "build_root_password"
    & docker compose -f $composePath build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Fallo docker compose build."
    }
}

$imagesToSave = @(
    @{ Service = "backend"; Image = "s_hospital-backend:latest"; Target = "backend.tar" },
    @{ Service = "queue-worker"; Image = "s_hospital-queue-worker:latest"; Target = "queue-worker.tar" },
    @{ Service = "nginx"; Image = "nginx:1.25-alpine"; Target = "nginx.tar" },
    @{ Service = "mysql"; Image = "mariadb:11"; Target = "mariadb.tar" }
)

if (-not $SkipDockerSave) {
    foreach ($item in $imagesToSave) {
        $target = Join-Path $imagesDir $item.Target
        Write-Step "Exportando $($item.Image) a offline-images\$($item.Target)."
        & docker save -o $target $item.Image
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Fallo docker save para $($item.Image)."
        }
    }
}

$tarFiles = @(Get-ChildItem -LiteralPath $imagesDir -Filter "*.tar" -File)
$checksums = New-Object System.Collections.Generic.List[string]
$tarList = New-Object System.Collections.Generic.List[string]
$totalSizeBytes = 0L

foreach ($tar in $tarFiles) {
    $hash = (Get-FileHash -LiteralPath $tar.FullName -Algorithm SHA256).Hash
    $checksums.Add("$hash  offline-images/$($tar.Name)") | Out-Null
    Set-Content -LiteralPath "$($tar.FullName).sha256" -Value $hash -Encoding ASCII
    $sizeMb = [Math]::Round($tar.Length / 1MB, 2)
    $totalSizeBytes += $tar.Length
    $tarList.Add("- $($tar.Name): $sizeMb MB") | Out-Null
}

Set-Content -LiteralPath (Join-Path $ReleaseRoot "checksums.sha256") -Value $checksums -Encoding ASCII

$totalSizeMb = [Math]::Round($totalSizeBytes / 1MB, 2)
$imageList = if ($tarList.Count -gt 0) { $tarList -join "`r`n" } else { "- No image archives generated in this script run." }
$manifest = @"
======================================================================
     SISTEMA DE CAJA HOSPITALARIA - OFFLINE RELEASE MANIFEST
======================================================================
Fecha de Generacion : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Rama Git            : $gitBranch
Commit Git          : $gitCommit
Commit Corto        : $gitShort
Tamano Total Images : $totalSizeMb MB

IMAGENES INCLUIDAS:
$imageList

INSTRUCCIONES RAPIDAS DE INSTALACION:
1. Copie todo el contenido de esta carpeta a la PC servidor.
2. Inicie Docker Desktop o Docker Engine en el servidor.
3. Ejecute setup.bat como Administrador.
4. El instalador cargara imagenes desde offline-images y levantara docker-compose.prod.yml sin internet.
5. Valide backups, restore, LAN, impresora y handoff final antes de operar.
======================================================================
"@

Set-Content -LiteralPath (Join-Path $ReleaseRoot "MANIFEST.txt") -Value $manifest -Encoding ASCII

if (-not $SkipGuard) {
    Write-Step "Ejecutando guard de artefacto offline."
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $guardScript -ProjectRoot $ProjectRoot -ReleaseRoot $ReleaseRoot -RequireCurrentCommit
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "El guard de artefacto offline fallo."
    }
}

Write-Host "[OK] Paquete offline preparado en $ReleaseRoot" -ForegroundColor Green
