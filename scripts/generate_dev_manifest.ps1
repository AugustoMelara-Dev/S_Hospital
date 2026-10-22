#Requires -Version 5.1
<#
.SYNOPSIS
    Genera hospital-ai/release/MANIFIESTO_DEV.json: manifiesto reconstruible y
    determinista de las fuentes y artefactos del producto nuevo (T-DR-01).

.DESCRIPTION
    Recorre un conjunto EXPLICITO de rutas de producto (allowlist) y calcula un
    SHA-256 por archivo, un resumen por directorio y un hash agregado del propio
    manifiesto. Es determinista: no registra fecha/hora de generacion; dos
    corridas sobre los mismos bytes producen el mismo JSON y el mismo hash.

    Exclusiones duras (por construccion, nunca se leen ni se hashean):
      node_modules, vendor, .git, dist, build, .pnpm-store, test-results,
      playwright-report, coverage, artifacts, storage, bootstrap/cache,
      release (evita auto-referencia y preserva MANIFIESTO_PRODUCTO.json),
      evidencia/progreso/r2, offline-release, installer-output, backup-external,
      nginx/ssl, .env* (todos los entornos, incluidos *.example), logs, caches,
      material criptografico (*.pem, *.key, *.p12, *.pfx, *.jks), package-lock.json
      (lockfile npm legado: el canonico es pnpm-lock.yaml), qa/screenshots.

    El script NO toca MANIFIESTO_PRODUCTO.json ni ningun otro archivo fuera de
    su salida (JSON + sidecar .sha256). No ejecuta migraciones ni git.

.PARAMETER ProjectRoot
    Raiz del worktree. Por defecto, el directorio padre de scripts\.

.PARAMETER OutputPath
    Ruta del JSON de salida. Por defecto
    <raiz>\hospital-ai\release\MANIFIESTO_DEV.json.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\generate_dev_manifest.ps1
#>
[CmdletBinding()]
param(
    [string] $ProjectRoot = '',
    [string] $OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# $PSScriptRoot puede estar vacio en el bloque param() bajo Windows PowerShell
# 5.1 invocado con -File; se resuelve aqui de forma explicita.
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $scriptDir = $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        $scriptDir = Split-Path -Parent $PSCommandPath
    }
    if ([string]::IsNullOrWhiteSpace($scriptDir)) {
        throw 'Cannot resolve the script directory; pass -ProjectRoot explicitly.'
    }
    $ProjectRoot = Split-Path -Parent $scriptDir
}

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------
function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][string] $Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        $hash = $sha.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function ConvertTo-RelativePath {
    param([string] $FullName, [string] $Root)
    $prefix = $Root.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $FullName.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "File '$FullName' is outside root '$Root'."
    }
    return ($FullName.Substring($prefix.Length) -replace '\\', '/')
}

function Get-DevCategory {
    param([string] $RelPath)
    if ($RelPath -match '^backend/database/migrations/') { return 'migracion' }
    if ($RelPath -match '^backend/database/seeders/' -or $RelPath -match '^backend/database/factories/') { return 'datos_iniciales' }
    if ($RelPath -match '\.blade\.php$') { return 'plantilla_documento' }
    if ($RelPath -match '(^|/)(tests?)/' -or $RelPath -match '\.(test|spec)\.(ts|tsx|js|mjs|php|ps1)$' -or $RelPath -match 'Test\.php$') { return 'prueba' }
    if ($RelPath -match '^backend/app/') { return 'codigo_backend' }
    if ($RelPath -match '^backend/') { return 'backend_soporte' }
    if ($RelPath -match '^frontend/src/') { return 'codigo_frontend' }
    if ($RelPath -match '^frontend/') { return 'frontend_soporte' }
    if ($RelPath -match '^scripts/') { return 'arranque_operacion' }
    if ($RelPath -match '(^|/)(docker-compose|Dockerfile)' -or $RelPath -match '\.(ya?ml)$' -or $RelPath -match '^installer/') { return 'configuracion_despliegue' }
    if ($RelPath -match '^hospital-ai/' -or $RelPath -match '^AGENTS\.md$' -or $RelPath -match '\.md$') { return 'documentacion' }
    return 'otro'
}

# ---------------------------------------------------------------------------
# Raiz y salida
# ---------------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { throw 'ProjectRoot is empty.' }
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $root 'hospital-ai\release\MANIFIESTO_DEV.json'
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputLeaf = [System.IO.Path]::GetFileName($OutputPath)
if ($outputLeaf -match 'MANIFIESTO_PRODUCTO') {
    throw "Refusing to write over the historical campaign manifest '$outputLeaf'."
}
$outputDir = [System.IO.Path]::GetDirectoryName($OutputPath)
if (-not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# ---------------------------------------------------------------------------
# Alcance (allowlist). Rutas relativas con separador '/'.
# ---------------------------------------------------------------------------
$explicitFiles = @(
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.lab.yml',
    'docker-compose.tls.yml',
    '.dockerignore',
    '.editorconfig',
    '.gitignore',
    'setup.bat',
    'README.md',
    'SYSTEM_REQUIREMENTS.md',
    'CHANGELOG.md',
    'LICENSE',
    'AGENTS.md',
    'catalogo_servicios_inicial.csv',
    'installer/S_Hospital.iss',
    'hospital-ai/MANDATO_DEV.md',
    'hospital-ai/MAPA_PRODUCTO.md',
    'hospital-ai/ESTADO_DEV.md',
    'hospital-ai/WORKSPACE.json',
    'backend/artisan',
    'backend/composer.json',
    'backend/composer.lock',
    'backend/phpunit.xml',
    'backend/phpunit.mysql.xml',
    'backend/phpunit.coverage.xml',
    'backend/phpstan.neon',
    'backend/Dockerfile',
    'backend/Dockerfile.prod',
    'backend/.editorconfig',
    'backend/.gitignore',
    'backend/README.md',
    'backend/bootstrap/app.php',
    'backend/bootstrap/providers.php',
    'frontend/index.html',
    'frontend/package.json',
    'frontend/pnpm-lock.yaml',
    'frontend/pnpm-workspace.yaml',
    'frontend/tsconfig.json',
    'frontend/tsconfig.node.json',
    'frontend/vite.config.ts',
    'frontend/vitest.unit.config.ts',
    'frontend/vitest.shims.d.ts',
    'frontend/eslint.config.js',
    'frontend/components.json',
    'frontend/playwright.config.ts',
    'frontend/playwright.config.test.ts',
    'frontend/playwright.release.config.ts',
    'frontend/playwright.r2-epo.config.ts',
    'frontend/playwright.r2-money.config.ts',
    'frontend/Dockerfile',
    'frontend/.gitignore'
)

$includeTrees = @(
    'backend/app',
    'backend/routes',
    'backend/config',
    'backend/database/migrations',
    'backend/database/seeders',
    'backend/database/factories',
    'backend/resources/views',
    'backend/tests',
    'backend/public',
    'frontend/src',
    'frontend/e2e',
    'frontend/scripts',
    'frontend/vite-plugins',
    'frontend/public',
    'frontend/qa-e2e',
    'frontend/.storybook',
    'scripts',
    'hospital-ai/diseno'
)

# ---------------------------------------------------------------------------
# Exclusiones duras. Se aplican a la ruta relativa normalizada (con '/').
# ---------------------------------------------------------------------------
$exclusions = @(
    [ordered]@{ patron = 'node_modules/'; motivo = 'dependencias instaladas (no son fuente)' },
    [ordered]@{ patron = 'vendor/'; motivo = 'dependencias PHP instaladas' },
    [ordered]@{ patron = '.git/'; motivo = 'metadatos de control de versiones' },
    [ordered]@{ patron = 'dist/'; motivo = 'build generado' },
    [ordered]@{ patron = 'build/'; motivo = 'build generado' },
    [ordered]@{ patron = '.pnpm-store/'; motivo = 'cache de paquetes' },
    [ordered]@{ patron = 'test-results/'; motivo = 'salida de pruebas' },
    [ordered]@{ patron = 'playwright-report/'; motivo = 'salida de pruebas' },
    [ordered]@{ patron = 'coverage/'; motivo = 'salida de cobertura' },
    [ordered]@{ patron = 'artifacts/'; motivo = 'artefactos generados' },
    [ordered]@{ patron = 'storage/'; motivo = 'datos/runtime de Laravel' },
    [ordered]@{ patron = 'bootstrap/cache/'; motivo = 'cache de framework' },
    [ordered]@{ patron = 'release/'; motivo = 'artefactos de release; preserva MANIFIESTO_PRODUCTO.json y evita auto-referencia' },
    [ordered]@{ patron = 'evidencia/'; motivo = 'evidencia de campana, no fuente' },
    [ordered]@{ patron = 'progreso/'; motivo = 'bitacora de campana, no fuente' },
    [ordered]@{ patron = 'r2/'; motivo = 'artefactos de campana anterior, no fuente' },
    [ordered]@{ patron = 'offline-release/'; motivo = 'paquete offline generado' },
    [ordered]@{ patron = 'installer-output/'; motivo = 'salida del instalador' },
    [ordered]@{ patron = 'backup-external/'; motivo = 'destino de respaldos' },
    [ordered]@{ patron = 'nginx/ssl/'; motivo = 'material TLS local' },
    [ordered]@{ patron = 'qa/screenshots/'; motivo = 'capturas de QA' },
    [ordered]@{ patron = '.env'; motivo = 'entornos reales/templates; nunca se hashean' },
    [ordered]@{ patron = '*.log'; motivo = 'logs de ejecucion' },
    [ordered]@{ patron = '*.cache'; motivo = 'caches' },
    [ordered]@{ patron = '*.result.cache'; motivo = 'cache de pruebas' },
    [ordered]@{ patron = '*.pem, *.key, *.p12, *.pfx, *.jks'; motivo = 'material criptografico' },
    [ordered]@{ patron = '*.sha256'; motivo = 'sumas derivadas' },
    [ordered]@{ patron = 'package-lock.json'; motivo = 'lockfile npm legado; el canonico es pnpm-lock.yaml' },
    [ordered]@{ patron = '.DS_Store, Thumbs.db'; motivo = 'ruido de sistema operativo' }
)

$excludeRegexes = @(
    '(^|/)node_modules/',
    '(^|/)vendor/',
    '(^|/)\.git/',
    '(^|/)dist/',
    '(^|/)build/',
    '(^|/)\.pnpm-store/',
    '(^|/)test-results/',
    '(^|/)playwright-report/',
    '(^|/)coverage/',
    '(^|/)artifacts/',
    '(^|/)storage/',
    '(^|/)bootstrap/cache/',
    '(^|/)offline-release/',
    '(^|/)installer-output/',
    '(^|/)backup-external/',
    '(^|/)nginx/ssl/',
    '(^|/)qa/screenshots/',
    '(^|/)release/',
    '(^|/)evidencia/',
    '(^|/)progreso/',
    '(^|/)r2/',
    '(^|/)\.env',
    '\.log$',
    '\.cache$',
    '\.result\.cache$',
    '\.(pem|key|p12|pfx|jks)$',
    '\.sha256$',
    '(^|/)package-lock\.json$',
    '(^|/)\.DS_Store$',
    '(^|/)Thumbs\.db$'
)

$secretPathRegexes = @(
    '(^|/)\.env',
    '\.(pem|key|p12|pfx|jks)$',
    '(^|/)id_rsa',
    '(^|/)id_ed25519',
    '(^|/)credentials\.json$',
    '(^|/)\.htpasswd$'
)

$secretContentRegexes = @(
    # Exige cuerpo base64 real: un literal '-----BEGIN ... PRIVATE KEY-----' en
    # aserciones de prueba no cuenta como material criptografico.
    '-----BEGIN [A-Z ]*PRIVATE KEY-----[\r\n]+[A-Za-z0-9+/=\s]{40,}',
    'APP_KEY\s*=\s*base64:[A-Za-z0-9+/=]{30,}',
    'HOSPITAL_BACKUP_ENCRYPTION_KEY\s*[:=]\s*[''"]?[A-Za-z0-9+/=]{20,}',
    'AKIA[0-9A-Z]{16}',
    'ghp_[A-Za-z0-9]{20,}',
    'sk-[A-Za-z0-9]{32,}'
)

function Test-Excluded {
    param([string] $RelPath)
    foreach ($pattern in $excludeRegexes) {
        if ($RelPath -match $pattern) { return $true }
    }
    return $false
}

# ---------------------------------------------------------------------------
# Inventario de candidatos
# ---------------------------------------------------------------------------
$candidates = New-Object 'System.Collections.Generic.List[string]'

foreach ($rel in $explicitFiles) {
    $abs = Join-Path $root ($rel -replace '/', '\')
    if (Test-Path -LiteralPath $abs -PathType Leaf) {
        $candidates.Add((ConvertTo-RelativePath -FullName (Get-Item -LiteralPath $abs).FullName -Root $root))
    }
}

foreach ($tree in $includeTrees) {
    $abs = Join-Path $root ($tree -replace '/', '\')
    if (-not (Test-Path -LiteralPath $abs -PathType Container)) { continue }
    $items = Get-ChildItem -LiteralPath $abs -Recurse -File -Force -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        $candidates.Add((ConvertTo-RelativePath -FullName $item.FullName -Root $root))
    }
}

$seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
$included = New-Object 'System.Collections.Generic.List[string]'
foreach ($rel in $candidates) {
    if (Test-Excluded $rel) { continue }
    if ($seen.Add($rel)) { $included.Add($rel) }
}
$includedPaths = $included.ToArray()
[System.Array]::Sort($includedPaths, [System.StringComparer]::Ordinal)

# Guarda dura: ninguna ruta de secreto puede quedar dentro del alcance.
foreach ($rel in $includedPaths) {
    foreach ($pattern in $secretPathRegexes) {
        if ($rel -match $pattern) {
            throw "Secret-like path slipped into the scope '$rel' (pattern '$pattern'). Refusing to publish a manifest."
        }
    }
}

# ---------------------------------------------------------------------------
# Hash por archivo + resumen por directorio
# ---------------------------------------------------------------------------
$fileEntries = New-Object 'System.Collections.Generic.List[object]'
$contentFindings = New-Object 'System.Collections.Generic.List[string]'
$dirTotals = @{}
$totalBytes = [int64] 0

foreach ($rel in $includedPaths) {
    $abs = Join-Path $root ($rel -replace '/', '\')
    $item = Get-Item -LiteralPath $abs -Force
    $hash = (Get-FileHash -LiteralPath $abs -Algorithm SHA256).Hash.ToLowerInvariant()
    $totalBytes = $totalBytes + [int64] $item.Length

    $fileEntries.Add([ordered]@{
        ruta     = $rel
        bytes    = [int64] $item.Length
        sha256   = $hash
        categoria = (Get-DevCategory -RelPath $rel)
    })

    # Escaneo de contenido solo en extensiones de texto plausibles.
    if ($rel -match '\.(php|phtml|blade\.php|ts|tsx|js|jsx|mjs|cjs|json|ya?ml|md|txt|ps1|psm1|sh|cmd|bat|css|scss|html|xml|neon|iss|csv|conf|cnf|example|env)$') {
        try {
            $lines = Get-Content -LiteralPath $abs -ErrorAction Stop
        }
        catch {
            $lines = @()
        }
        $joined = [string]::Join("`n", @($lines))
        foreach ($pattern in $secretContentRegexes) {
            if ($joined -match $pattern) {
                $contentFindings.Add("$rel :: $pattern")
            }
        }
    }

    $dir = '(raiz)'
    $parts = $rel.Split('/')
    if ($parts.Count -ge 3) { $dir = $parts[0] + '/' + $parts[1] }
    elseif ($parts.Count -eq 2) { $dir = $parts[0] }

    if (-not $dirTotals.ContainsKey($dir)) {
        $dirTotals[$dir] = [ordered]@{ archivos = 0; bytes = [int64]0; lineas = (New-Object 'System.Collections.Generic.List[string]') }
    }
    $dirTotals[$dir].archivos = $dirTotals[$dir].archivos + 1
    $dirTotals[$dir].bytes = $dirTotals[$dir].bytes + [int64] $item.Length
    $dirTotals[$dir].lineas.Add("$hash  $rel")
}

if ($contentFindings.Count -gt 0) {
    throw ("Secret-like content found in included files:`n" + ([string]::Join("`n", $contentFindings)))
}

$dirEntries = New-Object 'System.Collections.Generic.List[object]'
$dirNames = @($dirTotals.Keys)
[System.Array]::Sort($dirNames, [System.StringComparer]::Ordinal)
foreach ($dir in $dirNames) {
    $payload = $dirTotals[$dir].lineas.ToArray()
    [System.Array]::Sort($payload, [System.StringComparer]::Ordinal)
    $dirEntries.Add([ordered]@{
        directorio     = $dir
        archivos       = [int] $dirTotals[$dir].archivos
        bytes          = [int64] $dirTotals[$dir].bytes
        hash_agregado  = (Get-TextSha256 -Text (([string]::Join("`n", $payload)) + "`n"))
    })
}

# ---------------------------------------------------------------------------
# Archivos criticos (lista curada; solo los que existen en el alcance)
# ---------------------------------------------------------------------------
$criticalCandidates = @(
    'AGENTS.md',
    'hospital-ai/MANDATO_DEV.md',
    'hospital-ai/MAPA_PRODUCTO.md',
    'hospital-ai/ESTADO_DEV.md',
    'docker-compose.yml',
    'docker-compose.prod.yml',
    'docker-compose.lab.yml',
    'installer/S_Hospital.iss',
    'backend/composer.json',
    'backend/composer.lock',
    'backend/phpunit.xml',
    'backend/routes/api.php',
    'backend/app/Actions/Billing/CreateInvoiceAction.php',
    'backend/app/Actions/Billing/CalculateInvoiceTotalsAction.php',
    'backend/app/Actions/Billing/ResolveInvoiceDialysisPrescriptionAction.php',
    'backend/app/Http/Controllers/InvoiceController.php',
    'backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptPdfService.php',
    'backend/app/Actions/Reports/ExecutiveReportService.php',
    'backend/database/migrations/2026_09_18_000001_add_settlement_to_invoices_table.php',
    'backend/database/migrations/2026_09_18_000002_add_rule_adjustment_to_invoice_items.php',
    'backend/database/migrations/2026_09_18_000003_adopt_new_receipt_delivery_profile.php',
    'backend/database/seeders/DatabaseSeeder.php',
    'backend/resources/views/pdf/institutional-receipts/compact.blade.php',
    'frontend/package.json',
    'frontend/pnpm-lock.yaml',
    'frontend/vite.config.ts',
    'frontend/index.html',
    'frontend/src/main.tsx',
    'frontend/src/App.tsx',
    'frontend/src/AppRoutes.tsx',
    'frontend/src/navigation/ledgerNavigation.ts',
    'frontend/src/shell/ledger/LedgerShell.tsx',
    'frontend/src/features/cobrar/CobrarView.tsx',
    'scripts/lab_local_up.ps1',
    'scripts/lab_local_down.ps1',
    'scripts/lab_local_smoke.ps1',
    'scripts/deploy_hospital_lan.ps1',
    'scripts/start_hospital_windows.ps1',
    'scripts/make_offline_release.ps1',
    'scripts/build_windows_installer.ps1',
    'scripts/restore_hospital_windows.ps1',
    'scripts/production_readiness_preflight.ps1',
    'scripts/generate_dev_manifest.ps1'
)
$includedSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::Ordinal)
foreach ($rel in $includedPaths) { [void] $includedSet.Add($rel) }
$critical = @($criticalCandidates | Where-Object { $includedSet.Contains($_) })

# ---------------------------------------------------------------------------
# Fingerprint determinista del manifiesto
# ---------------------------------------------------------------------------
$fingerprintPayload = New-Object 'System.Text.StringBuilder'
foreach ($entry in $fileEntries) {
    [void] $fingerprintPayload.Append($entry.sha256).Append('  ').Append($entry.ruta).Append("`n")
}
$manifestSha256 = Get-TextSha256 -Text $fingerprintPayload.ToString()

# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------
$manifest = [ordered]@{
    esquema            = 'hospital-ai/release/MANIFIESTO_DEV'
    version            = 1
    descripcion        = 'Manifiesto reconstruible de fuentes/artefactos del producto nuevo (reconstruccion 2026-09-18). Sin credenciales, sin datos reales, sin runtime verificado.'
    raiz               = $root
    generado_por       = 'scripts/generate_dev_manifest.ps1'
    determinista       = $true
    nota_determinismo  = 'El JSON no incluye fecha/hora. Dos corridas sobre los mismos bytes producen el mismo archivo y el mismo sha256_manifiesto.'
    resumen            = [ordered]@{
        archivos          = $fileEntries.Count
        bytes             = [int64] $totalBytes
        directorios       = $dirEntries.Count
        sha256_manifiesto = $manifestSha256
    }
    alcance            = [ordered]@{
        incluye = @(
            'frontend/src/** y configuracion/lockfile/build del frontend',
            'backend/app/**, routes, config, database (migraciones/seeders/factories), resources/views, tests, public, bootstrap',
            'migraciones nuevas 2026_09_18_* (settlement, rule_adjustment, perfil de recibo)',
            'backend/resources/views/pdf/institutional-receipts/compact.blade.php',
            'scripts/** (arranque, laboratorio no-Docker, LAN, backup/restauracion, instalador)',
            'docker-compose*.yml e installer/S_Hospital.iss',
            'documentos vivos hospital-ai/MANDATO_DEV.md, MAPA_PRODUCTO.md, ESTADO_DEV.md, diseno/**'
        )
        excluye = $exclusions
    }
    criticos           = $critical
    directorios        = $dirEntries.ToArray()
    archivos           = $fileEntries.ToArray()
    verificacion_secretos = [ordered]@{
        rutas_evaluadas        = $includedPaths.Count
        rutas_sospechosas      = 0
        coincidencias_contenido = 0
        patrones_ruta          = $secretPathRegexes
        patrones_contenido     = $secretContentRegexes
        nota                   = 'Si alguna ruta o contenido coincide, el script falla sin escribir el manifiesto.'
    }
}

$json = $manifest | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutputPath, $json, $utf8NoBom)

$sidecarPath = $OutputPath + '.sha256'
$jsonHash = (Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText($sidecarPath, "$jsonHash  $outputLeaf`n", $utf8NoBom)

Write-Host ''
Write-Host '=== S_Hospital - MANIFIESTO DEV ===' -ForegroundColor Cyan
Write-Host "Raiz          : $root"
Write-Host "JSON          : $OutputPath"
Write-Host "Sidecar       : $sidecarPath"
Write-Host "Archivos      : $($fileEntries.Count)"
Write-Host "Directorios   : $($dirEntries.Count)"
Write-Host "Bytes         : $totalBytes"
Write-Host "sha256 (man.) : $manifestSha256"
Write-Host "sha256 (json) : $jsonHash"
Write-Host "Criticos      : $($critical.Count)"
Write-Host 'Secretos      : 0 rutas, 0 contenidos' -ForegroundColor Green
Write-Host ''
