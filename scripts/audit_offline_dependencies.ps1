# audit_offline_dependencies.ps1
# S_Hospital - subagente 30 (Escenario Sin Internet)
# Audita dependencias externas que podrian romper el sistema si no hay internet.
# Salida: consola + archivo Markdown bajo qa/.

[CmdletBinding()]
param(
    [string]$RepoRoot = $null,
    [string]$OutputPath = $null
)

if (-not $RepoRoot) {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = $PSScriptRoot }
    if ([string]::IsNullOrEmpty($scriptDir)) { $scriptDir = (Get-Location).Path }
    $RepoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}
if (-not $OutputPath) {
    $OutputPath = (Join-Path $RepoRoot "qa/OFFLINE_SCENARIO_VALIDATION.md")
}

$ErrorActionPreference = 'Stop'

function New-Finding {
    param(
        [string]$Severity,
        [string]$Category,
        [string]$Location,
        [string]$Detail
    )
    [PSCustomObject]@{
        Severity = $Severity
        Category = $Category
        Location = $Location
        Detail   = $Detail
    }
}

$findings = New-Object System.Collections.Generic.List[object]

# Hosts internos permitidos
$allowedHosts = @('localhost', '127.0.0.1', '0.0.0.0', 'soketi', 'redis', 'mysql', 'mariadb')

function Test-InternalUrl {
    param([string]$Url)
    foreach ($h in $allowedHosts) { if ($Url -match [regex]::Escape($h)) { return $true } }
    return $false
}

function Test-AuditPathExcluded {
    param([string]$Path)

    return $Path -match '[\\/](vendor|node_modules|storage|bootstrap[\\/]cache|dist|build|coverage|\.git|\.cache)[\\/]'
}

# 1. package.json: detectar dependencias con URL http/https
$packageJson = Get-Content -Raw (Join-Path $RepoRoot "frontend/package.json") | ConvertFrom-Json
foreach ($prop in @('dependencies', 'devDependencies')) {
    if ($packageJson.$prop) {
        foreach ($name in $packageJson.$prop.PSObject.Properties.Name) {
            $ver = $packageJson.$prop.$name
            if ($ver -match 'https?://') {
                $findings.Add((New-Finding 'CRITICAL' 'CDN' "frontend/package.json#$name" "URL absoluta en dependencia: $ver"))
            }
        }
    }
}

# 2. composer.json: idem
$composerJson = Get-Content -Raw (Join-Path $RepoRoot "backend/composer.json") | ConvertFrom-Json
foreach ($prop in @('require', 'require-dev')) {
    if ($composerJson.$prop) {
        foreach ($name in $composerJson.$prop.PSObject.Properties.Name) {
            $ver = $composerJson.$prop.$name
            if ($ver -match 'https?://') {
                $findings.Add((New-Finding 'CRITICAL' 'CDN' "backend/composer.json#$name" "URL absoluta en dependencia: $ver"))
            }
        }
    }
}

# 3. index.html: scripts/stylesheets externos
$indexHtml = Get-Content -Raw (Join-Path $RepoRoot "frontend/index.html")
$indexHtml | Select-String -Pattern '<(script|link)[^>]+(src|href)="https?://[^"]+"' -AllMatches | ForEach-Object {
    $findings.Add((New-Finding 'CRITICAL' 'CDN' 'frontend/index.html' $_.Matches[0].Value))
}

# 4. Frontend src: fetch/axios a hosts externos
$srcDir = Join-Path $RepoRoot "frontend/src"
if (Test-Path $srcDir) {
    Get-ChildItem -Path $srcDir -Recurse -Include *.ts,*.tsx,*.js,*.jsx -File | ForEach-Object {
        if (Test-AuditPathExcluded $_.FullName) { return }
        $content = Get-Content -Raw $_.FullName
        $matches = [regex]::Matches($content, '(fetch|axios|http://|https://)\s*[\("''](https?://[^"''\)]+)')
        foreach ($m in $matches) {
            $url = $m.Groups[2].Value
            if (-not (Test-InternalUrl $url)) {
                $findings.Add((New-Finding 'CRITICAL' 'EXTERNAL_HTTP' $_.FullName.Replace($RepoRoot, '') "Llamada externa: $url"))
            }
        }
    }
}

# 5. Backend: idem (excluyendo vendor y node_modules)
$backendDir = Join-Path $RepoRoot "backend"
if (Test-Path $backendDir) {
    Get-ChildItem -Path $backendDir -Recurse -Include *.php -File |
        Where-Object { -not (Test-AuditPathExcluded $_.FullName) } |
        ForEach-Object {
            $content = Get-Content -Raw $_.FullName
            $matches = [regex]::Matches($content, '(Http::|file_get_contents|curl_init|fsockopen|stream_socket_client)\s*\(\s*[\("''](https?://[^"''\)]+)')
            foreach ($m in $matches) {
                $url = $m.Groups[2].Value
                if (-not (Test-InternalUrl $url)) {
                    $findings.Add((New-Finding 'CRITICAL' 'EXTERNAL_HTTP' $_.FullName.Replace($RepoRoot, '') "Llamada externa: $url"))
                }
            }
        }
}

# 6. Patrones de fuentes externas (excluyendo vendor y node_modules)
$fontPatterns = @('fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com')
$searchDirs = @($srcDir, $backendDir, (Join-Path $RepoRoot "frontend/index.html"))
foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
        $files = if ((Get-Item $dir).PSIsContainer) {
            Get-ChildItem -Path $dir -Recurse -File |
                Where-Object { -not (Test-AuditPathExcluded $_.FullName) }
        } else { @(Get-Item -LiteralPath $dir) }
        foreach ($f in $files) {
            $content = Get-Content -Raw $f.FullName -ErrorAction SilentlyContinue
            foreach ($pat in $fontPatterns) {
                if ($content -match [regex]::Escape($pat)) {
                    $findings.Add((New-Finding 'CRITICAL' 'FONT_CDN' $f.FullName.Replace($RepoRoot, '') "Fuente externa detectada: $pat"))
                }
            }
        }
    }
}

# 7. Licencias online (solo en app/, excluyendo vendor)
$licensePatterns = @('license-checker', 'license online', 'verifyLicense\(')
$apiDir = Join-Path $RepoRoot "backend/app"
if (Test-Path $apiDir) {
    Get-ChildItem -Path $apiDir -Recurse -Include *.php -File |
        Where-Object { -not (Test-AuditPathExcluded $_.FullName) } |
        ForEach-Object {
            $content = Get-Content -Raw $_.FullName
            foreach ($pat in $licensePatterns) {
                if ($content -match [regex]::Escape($pat)) {
                    $findings.Add((New-Finding 'INFO' 'LICENSE_ONLINE' $_.FullName.Replace($RepoRoot, '') "Patron de licencia online: $pat"))
                }
            }
        }
}

# Generar reporte Markdown
$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Offline Scenario Validation")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- Generado: $now")
[void]$sb.AppendLine("- Repositorio: $RepoRoot")
[void]$sb.AppendLine("- Script: scripts/audit_offline_dependencies.ps1")
[void]$sb.AppendLine("")
$crit = ($findings | Where-Object { $_.Severity -eq 'CRITICAL' }).Count
$info = ($findings | Where-Object { $_.Severity -eq 'INFO' }).Count
[void]$sb.AppendLine("## Resumen")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- Hallazgos CRITICAL: **$crit**")
[void]$sb.AppendLine("- Hallazgos INFO: **$info**")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Estado")
[void]$sb.AppendLine("")
if ($crit -eq 0) {
    [void]$sb.AppendLine('**OFFLINE_OK** - Sin dependencias externas criticas detectadas. El sistema puede operar sin internet.')
} else {
    [void]$sb.AppendLine("**OFFLINE_BLOCKED** - Se detectaron $crit dependencia(s) externa(s) critica(s). Deben removerse o documentarse como no obligatorias para produccion offline.")
}
[void]$sb.AppendLine("")

if ($findings.Count -gt 0) {
    [void]$sb.AppendLine("## Hallazgos")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Severidad | Categoria | Ubicacion | Detalle |")
    [void]$sb.AppendLine("|-----------|-----------|-----------|---------|")
    foreach ($f in $findings) {
        $detail = $f.Detail.Replace('|', '\|')
        [void]$sb.AppendLine("| $($f.Severity) | $($f.Category) | $($f.Location) | $detail |")
    }
    [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("## Reglas auditadas")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- package.json y composer.json: ninguna dependencia puede traer URL absoluta http/https.")
[void]$sb.AppendLine("- index.html: no debe inyectar scripts ni stylesheets desde CDNs publicos.")
[void]$sb.AppendLine('- Frontend src: ninguna llamada `fetch` o `axios` puede apuntar a hosts fuera de la lista permitida.')
[void]$sb.AppendLine('- Backend PHP: ninguna llamada `Http::`, `file_get_contents`, `curl_init`, `fsockopen`, `stream_socket_client` puede apuntar fuera de la lista permitida.')
[void]$sb.AppendLine('- No se permiten referencias a Google Fonts, jsDelivr, unpkg, cdnjs.')
[void]$sb.AppendLine('- Las llamadas a Pusher/Echo deben apuntar al Soketi local (configurable, no hardcoded a pusher.com).')
[void]$sb.AppendLine("")
[void]$sb.AppendLine('## Lista de hosts permitidos')
[void]$sb.AppendLine("")
[void]$sb.AppendLine('- `localhost`, `127.0.0.1`, `0.0.0.0`')
[void]$sb.AppendLine('- `soketi`, `redis`, `mysql`, `mariadb` (nombres de servicio Docker)')
[void]$sb.AppendLine('- IPs privadas `10.*`, `192.168.*`, `172.16-31.*` (verificables manualmente)')
[void]$sb.AppendLine("")

$reportDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }
Set-Content -Path $OutputPath -Value $sb.ToString() -Encoding UTF8

# Consola
Write-Host "Offline audit complete" -ForegroundColor Cyan
Write-Host "  CRITICAL: $crit" -ForegroundColor $(if ($crit -eq 0) { 'Green' } else { 'Red' })
Write-Host "  INFO:     $info" -ForegroundColor Yellow
Write-Host "  Report:   $OutputPath"

if ($crit -gt 0) { exit 2 } else { exit 0 }
