# audit_offline_dependencies.ps1
# S_Hospital - subagente 30 (Escenario Sin Internet)
# Audita dependencias externas que podrian romper el sistema si no hay internet.
# Salida: consola + qa/OFFLINE_SCENARIO_VALIDATION.md.

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
$ProgressPreference = 'SilentlyContinue'

# Filtros para reducir falsos positivos
$excludeFilePatterns = @('\.test\.', '\.spec\.', '__tests__', 'tests/Feature', 'tests/Unit', 'tests/Concurrent')
$placeholderPatterns = @('IP_DEL_SERVIDOR','IP-DEL-SERVIDOR','EXAMPLE\.COM','EXAMPLE\.ORG','PLACEHOLDER','<HOST>','<URL>','YOUR_','CHANGEME','hospital\.test$')

function Should-SkipFile {
    param([string]$FilePath)
    foreach ($p in $excludeFilePatterns) {
        if ($FilePath -match $p) { return $true }
    }
    return $false
}

function Is-PlaceholderUrl {
    param([string]$Url)
    foreach ($p in $placeholderPatterns) {
        if ($Url -match $p) { return $true }
    }
    return $false
}

$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
    param([string]$Severity, [string]$Category, [string]$Location, [string]$Detail)
    $findings.Add([PSCustomObject]@{
        Severity = $Severity
        Category = $Category
        Location = $Location
        Detail   = $Detail
    })
}

# Hosts internos permitidos
$allowedPattern = '(localhost|127\.0\.0\.1|0\.0\.0\.0|soketi|redis|mysql|mariadb|10\.\d+|192\.168\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+)'

# 1. package.json: deps con URL http/https
$pkgPath = Join-Path $RepoRoot 'frontend/package.json'
if (Test-Path $pkgPath) {
    $pkg = Get-Content -Raw $pkgPath | ConvertFrom-Json
    foreach ($prop in @('dependencies','devDependencies')) {
        if ($pkg.$prop) {
            foreach ($name in $pkg.$prop.PSObject.Properties.Name) {
                $ver = [string]$pkg.$prop.$name
                if ($ver -match 'https?://') {
                    Add-Finding 'CRITICAL' 'CDN' "frontend/package.json#$name" "URL absoluta: $ver"
                }
            }
        }
    }
}

# 2. composer.json
$compPath = Join-Path $RepoRoot 'backend/composer.json'
if (Test-Path $compPath) {
    $comp = Get-Content -Raw $compPath | ConvertFrom-Json
    foreach ($prop in @('require','require-dev')) {
        if ($comp.$prop) {
            foreach ($name in $comp.$prop.PSObject.Properties.Name) {
                $ver = [string]$comp.$prop.$name
                if ($ver -match 'https?://') {
                    Add-Finding 'CRITICAL' 'CDN' "backend/composer.json#$name" "URL absoluta: $ver"
                }
            }
        }
    }
}

# 3. index.html: scripts/stylesheets externos
$idxPath = Join-Path $RepoRoot 'frontend/index.html'
if (Test-Path $idxPath) {
    $idx = Get-Content -Raw $idxPath
    $htmlMatches = [regex]::Matches($idx, '<(?:script|link)[^>]+(?:src|href)="(https?://[^"]+)"')
    foreach ($m in $htmlMatches) {
        Add-Finding 'CRITICAL' 'CDN' 'frontend/index.html' "Recurso externo: $($m.Groups[1].Value)"
    }
}

# 4. Frontend src: fetch/axios a hosts externos (Select-String es mas rapido)
$srcDir = Join-Path $RepoRoot 'frontend/src'
if (Test-Path $srcDir) {
    Get-ChildItem -Path $srcDir -Recurse -Include *.ts,*.tsx,*.js,*.jsx -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (Should-SkipFile $_.FullName) { return }
        $rel = $_.FullName.Substring($RepoRoot.Length).TrimStart('\','/')
        Select-String -Path $_.FullName -Pattern 'https?://[^\s"''\)]+' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object {
            foreach ($hit in $_.Matches) {
                $url = $hit.Value
                if ($url -notmatch $allowedPattern -and -not (Is-PlaceholderUrl $url)) {
                    Add-Finding 'CRITICAL' 'EXTERNAL_HTTP' $rel "URL externa: $url"
                }
            }
        }
    }
}

# 5. Backend: idem (solo app/, excluyendo vendor y tests)
$appDir = Join-Path $RepoRoot 'backend/app'
if (Test-Path $appDir) {
    Get-ChildItem -Path $appDir -Recurse -Include *.php -File -ErrorAction SilentlyContinue | ForEach-Object {
        if (Should-SkipFile $_.FullName) { return }
        $rel = $_.FullName.Substring($RepoRoot.Length).TrimStart('\','/')
        Select-String -Path $_.FullName -Pattern 'https?://[^\s"''\)]+' -AllMatches -ErrorAction SilentlyContinue | ForEach-Object {
            foreach ($hit in $_.Matches) {
                $url = $hit.Value
                if ($url -notmatch $allowedPattern -and -not (Is-PlaceholderUrl $url)) {
                    Add-Finding 'CRITICAL' 'EXTERNAL_HTTP' $rel "URL externa: $url"
                }
            }
        }
    }
}

# 6. Patrones de fuentes externas (solo frontend/src y frontend/index.html)
$fontPatterns = @('fonts.googleapis.com','fonts.gstatic.com','use.typekit.net','cdn.jsdelivr.net','unpkg.com','cdnjs.cloudflare.com')
if (Test-Path $srcDir) {
    $fontFiles = Get-ChildItem -Path $srcDir -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.html,*.css -File -ErrorAction SilentlyContinue
    foreach ($f in $fontFiles) {
        $rel = $f.FullName.Substring($RepoRoot.Length).TrimStart('\','/')
        $content = Get-Content -Raw $f.FullName -ErrorAction SilentlyContinue
        if ($content) {
            foreach ($pat in $fontPatterns) {
                if ($content -match [regex]::Escape($pat)) {
                    Add-Finding 'CRITICAL' 'FONT_CDN' $rel "Fuente externa: $pat"
                }
            }
        }
    }
}
if (Test-Path $idxPath) {
    $content = Get-Content -Raw $idxPath -ErrorAction SilentlyContinue
    if ($content) {
        foreach ($pat in $fontPatterns) {
            if ($content -match [regex]::Escape($pat)) {
                Add-Finding 'CRITICAL' 'FONT_CDN' 'frontend/index.html' "Fuente externa: $pat"
            }
        }
    }
}

# Generar reporte
$now = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$crit = ($findings | Where-Object { $_.Severity -eq 'CRITICAL' }).Count
$info = ($findings | Where-Object { $_.Severity -eq 'INFO' }).Count

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Offline Scenario Validation')
[void]$sb.AppendLine('')
[void]$sb.AppendLine("- Generado: $now")
[void]$sb.AppendLine("- Repositorio: $RepoRoot")
[void]$sb.AppendLine('- Script: scripts/audit_offline_dependencies.ps1')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Resumen')
[void]$sb.AppendLine('')
[void]$sb.AppendLine("- Hallazgos CRITICAL: **$crit**")
[void]$sb.AppendLine("- Hallazgos INFO: **$info**")
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Estado')
[void]$sb.AppendLine('')
if ($crit -eq 0) {
    [void]$sb.AppendLine('**OFFLINE_OK** - Sin dependencias externas criticas detectadas. El sistema puede operar sin internet.')
} else {
    [void]$sb.AppendLine("**OFFLINE_BLOCKED** - Se detectaron $crit dependencia(s) externa(s) critica(s). Deben removerse o documentarse como no obligatorias para produccion offline.")
}
[void]$sb.AppendLine('')

if ($findings.Count -gt 0) {
    [void]$sb.AppendLine('## Hallazgos')
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| Severidad | Categoria | Ubicacion | Detalle |')
    [void]$sb.AppendLine('|-----------|-----------|-----------|---------|')
    foreach ($f in $findings) {
        $detail = $f.Detail.Replace('|','\|')
        [void]$sb.AppendLine("| $($f.Severity) | $($f.Category) | $($f.Location) | $detail |")
    }
    [void]$sb.AppendLine('')
}

[void]$sb.AppendLine('## Reglas auditadas')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('- package.json y composer.json sin URL absolutas http/https en dependencias.')
[void]$sb.AppendLine('- index.html sin scripts/stylesheets desde CDNs publicos.')
[void]$sb.AppendLine('- Frontend src sin URL externas (fetch, axios, imports, templates).')
[void]$sb.AppendLine('- Backend app/ sin URL externas (Http::, file_get_contents, curl, etc.).')
[void]$sb.AppendLine('- Sin referencias a Google Fonts, jsDelivr, unpkg, cdnjs.')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## Lista de hosts permitidos')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('- `localhost`, `127.0.0.1`, `0.0.0.0`')
[void]$sb.AppendLine('- `soketi`, `redis`, `mysql`, `mariadb` (nombres de servicio Docker)')
[void]$sb.AppendLine('- IPs privadas `10.*`, `192.168.*`, `172.16-31.*`')
[void]$sb.AppendLine('')

$reportDir = Split-Path -Parent $OutputPath
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutputPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))

Write-Host 'Offline audit complete' -ForegroundColor Cyan
Write-Host "  CRITICAL: $crit" -ForegroundColor $(if ($crit -eq 0) { 'Green' } else { 'Red' })
Write-Host "  INFO:     $info" -ForegroundColor Yellow
Write-Host "  Report:   $OutputPath"

if ($crit -gt 0) { exit 2 } else { exit 0 }
