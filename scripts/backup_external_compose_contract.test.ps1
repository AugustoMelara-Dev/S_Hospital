#Requires -Version 5.1
# Contrato de despliegue de la copia externa de respaldos (HS-BK-EXT).
# Parseo YAML real con js-yaml de frontend/node_modules/.pnpm (pnpm) y respaldo
# en Python/PyYAML. No requiere Docker ni destino externo real.
# T3-006: backend/queue-worker NO deben mapear HOSPITAL_BACKUP_EXTERNAL_* (no
# montan /external-backups); solo el scheduler, que ejecuta la copia y monta el
# destino, debe conservar las 6 variables con sus defaults.

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:Checks = 0
$script:Errors = @()
$script:ParserName = ''

function Assert-BackupExternalContract {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

# --- Localizar un parser YAML real ---
$jsYamlModule = $null
$pnpmDir = Join-Path $projectRoot 'frontend\node_modules\.pnpm'
if (Test-Path -LiteralPath $pnpmDir) {
    foreach ($candidate in @(Get-ChildItem -LiteralPath $pnpmDir -Directory -Filter 'js-yaml@*' | Sort-Object Name -Descending)) {
        $modulePath = Join-Path $candidate.FullName 'node_modules\js-yaml'
        if (Test-Path -LiteralPath (Join-Path $modulePath 'package.json')) {
            $jsYamlModule = $modulePath.Replace('\', '/')
            break
        }
    }
}

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$pythonCommand = Get-Command python -ErrorAction SilentlyContinue

function ConvertFrom-YamlDocument {
    param([Parameter(Mandatory = $true)][string] $Path)

    if ($null -ne $jsYamlModule -and $null -ne $nodeCommand) {
        $script:ParserName = 'js-yaml'
        $nodeScript = "const y=require('$jsYamlModule');const fs=require('fs');process.stdout.write(JSON.stringify(y.load(fs.readFileSync(process.argv[1],'utf8'))));"
        $json = (@(& node -e $nodeScript $Path) -join "`n")
        if ($LASTEXITCODE -ne 0 -or $json.Trim() -eq '') {
            throw "js-yaml no pudo parsear $Path"
        }

        return $json | ConvertFrom-Json
    }

    if ($null -ne $pythonCommand) {
        $script:ParserName = 'PyYAML'
        $json = (@(& python -c "import sys, yaml, json; print(json.dumps(yaml.safe_load(open(sys.argv[1], encoding='utf-8'))))" $Path) -join "`n")
        if ($LASTEXITCODE -ne 0 -or $json.Trim() -eq '') {
            throw "PyYAML no pudo parsear $Path"
        }

        return $json | ConvertFrom-Json
    }

    throw 'No hay parser YAML real disponible: falta js-yaml (frontend/node_modules/.pnpm) y Python/PyYAML.'
}

function Get-ServiceEnvironment {
    param($Service)

    $map = @{}
    if ($null -eq $Service -or $null -eq $Service.environment) {
        return $map
    }

    foreach ($property in $Service.environment.PSObject.Properties) {
        $map[$property.Name] = [string] $property.Value
    }

    return $map
}

function Get-ServiceVolumes {
    param($Service)

    if ($null -eq $Service -or $null -eq $Service.volumes) {
        return @()
    }

    return @($Service.volumes | ForEach-Object { [string] $_ })
}

$prodComposePath = Join-Path $projectRoot 'docker-compose.prod.yml'
$devComposePath = Join-Path $projectRoot 'docker-compose.yml'
$tlsOverlayPath = Join-Path $projectRoot 'docker-compose.tls.yml'
$rootEnvPath = Join-Path $projectRoot '.env.example'
$backendEnvPath = Join-Path $projectRoot 'backend\.env.example'

$prod = ConvertFrom-YamlDocument -Path $prodComposePath
$dev = ConvertFrom-YamlDocument -Path $devComposePath

$expectedEnvironment = [ordered]@{
    HOSPITAL_BACKUP_EXTERNAL_ENABLED = '${HOSPITAL_BACKUP_EXTERNAL_ENABLED:-false}'
    HOSPITAL_BACKUP_EXTERNAL_DISK = '${HOSPITAL_BACKUP_EXTERNAL_DISK:-backup_external}'
    HOSPITAL_BACKUP_EXTERNAL_ROOT = '${HOSPITAL_BACKUP_EXTERNAL_ROOT:-/external-backups}'
    HOSPITAL_BACKUP_EXTERNAL_PATH = '${HOSPITAL_BACKUP_EXTERNAL_PATH:-hospital-backups}'
    HOSPITAL_BACKUP_EXTERNAL_LABEL = '${HOSPITAL_BACKUP_EXTERNAL_LABEL:-externo}'
    HOSPITAL_BACKUP_EXTERNAL_VERIFY = '${HOSPITAL_BACKUP_EXTERNAL_VERIFY:-true}'
}

# 1. Produccion: solo el scheduler mapea la copia externa (es el unico que
#    monta /external-backups y ejecuta hospital:backup-copy-external).
#    Si las variables reaparecen en backend/queue-worker, un `exec` manual sin
#    bind podria escribir en la capa efimera y marcar verified/deployed.
$externalPrefix = 'HOSPITAL_BACKUP_EXTERNAL'
$isolatedServices = @('backend', 'queue-worker')

foreach ($serviceName in $isolatedServices) {
    $service = $prod.services.$serviceName
    Assert-BackupExternalContract ($null -ne $service) "docker-compose.prod.yml debe definir el servicio $serviceName."
    $environment = Get-ServiceEnvironment -Service $service

    foreach ($key in $expectedEnvironment.Keys) {
        Assert-BackupExternalContract (-not $environment.ContainsKey($key)) "El servicio $serviceName NO debe mapear ${key}: no monta /external-backups y un exec manual podria escribir en la capa efimera y marcar verified/deployed en el ledger."
    }

    $strayKeys = @($environment.Keys | Where-Object { $_.StartsWith($externalPrefix) } | Sort-Object)
    Assert-BackupExternalContract ($strayKeys.Count -eq 0) "El servicio $serviceName no debe mapear ninguna variable ${externalPrefix}_*; encontradas: $($strayKeys -join ', ')."

    $volumes = Get-ServiceVolumes -Service $service
    Assert-BackupExternalContract (-not (($volumes -join ' ') -match '/external-backups')) "El servicio $serviceName no debe montar /external-backups: solo el scheduler monta el destino externo."
}

$schedulerService = $prod.services.scheduler
Assert-BackupExternalContract ($null -ne $schedulerService) 'docker-compose.prod.yml debe definir el servicio scheduler.'
$schedulerEnvironment = Get-ServiceEnvironment -Service $schedulerService

foreach ($key in $expectedEnvironment.Keys) {
    Assert-BackupExternalContract ($schedulerEnvironment.ContainsKey($key)) "El scheduler (servicio que copia) debe mapear $key."
    if ($schedulerEnvironment.ContainsKey($key)) {
        Assert-BackupExternalContract ($schedulerEnvironment[$key] -eq $expectedEnvironment[$key]) "En scheduler, $key debe ser '$($expectedEnvironment[$key])' y es '$($schedulerEnvironment[$key])'."
    }
}

# 2. El root externo se monta solo en el servicio que copia
$externalMount = '${HOSPITAL_BACKUP_EXTERNAL_HOST_PATH:-./backup-external}:/external-backups'
$schedulerVolumes = Get-ServiceVolumes -Service $prod.services.scheduler
Assert-BackupExternalContract ($schedulerVolumes -contains $externalMount) 'El scheduler (servicio que copia) debe montar el destino externo configurable en /external-backups.'

$prodContent = Get-Content -LiteralPath $prodComposePath -Raw
$mountOccurrences = ([regex]::Matches($prodContent, [regex]::Escape($externalMount))).Count
Assert-BackupExternalContract ($mountOccurrences -eq 1) "El bind externo debe montarse una sola vez (en el servicio que copia); ocurrencias: $mountOccurrences."
Assert-BackupExternalContract ($prodContent -match 'MISMO host') 'El compose productivo debe advertir que un bind del mismo host no es copia externa.'
Assert-BackupExternalContract ($prodContent -match 'USB') 'El compose productivo debe indicar USB, disco externo o recurso de red como destino valido.'
Assert-BackupExternalContract ($prodContent -match 'NO esta desplegada') 'El compose productivo debe declarar que sin destino real la copia NO esta desplegada.'

# 3. Desarrollo y overlay TLS no aplican: sin mapeo ni montaje externo
foreach ($serviceName in @('backend', 'queue-worker', 'realtime-worker', 'scheduler')) {
    $devService = $dev.services.$serviceName
    Assert-BackupExternalContract ($null -ne $devService) "docker-compose.yml debe definir el servicio $serviceName."
    $devEnvironment = Get-ServiceEnvironment -Service $devService

    foreach ($key in $expectedEnvironment.Keys) {
        Assert-BackupExternalContract (-not $devEnvironment.ContainsKey($key)) "docker-compose.yml (dev) no debe mapear $key; la copia externa es despliegue de produccion."
    }

    $devVolumes = Get-ServiceVolumes -Service $devService
    Assert-BackupExternalContract (-not (($devVolumes -join ' ') -match '/external-backups')) "docker-compose.yml (dev) no debe montar /external-backups en $serviceName."
}

Assert-BackupExternalContract (Test-Path -LiteralPath $tlsOverlayPath -PathType Leaf) 'Debe existir docker-compose.tls.yml.'
$tlsContent = Get-Content -LiteralPath $tlsOverlayPath -Raw
Assert-BackupExternalContract ($tlsContent -notmatch 'HOSPITAL_BACKUP_EXTERNAL') 'El overlay TLS no debe mapear la copia externa: solo agrega TLS.'

$gitIgnoreContent = Get-Content -LiteralPath (Join-Path $projectRoot '.gitignore') -Raw
Assert-BackupExternalContract ($gitIgnoreContent -match '(?m)^backup-external/\s*$') '.gitignore debe excluir el directorio placeholder backup-external/ del bind por defecto.'

# 4. Plantillas de entorno documentan las variables y la advertencia
$requiredVariables = @(
    'HOSPITAL_BACKUP_EXTERNAL_ENABLED',
    'HOSPITAL_BACKUP_EXTERNAL_DISK',
    'HOSPITAL_BACKUP_EXTERNAL_ROOT',
    'HOSPITAL_BACKUP_EXTERNAL_PATH',
    'HOSPITAL_BACKUP_EXTERNAL_LABEL',
    'HOSPITAL_BACKUP_EXTERNAL_VERIFY',
    'HOSPITAL_BACKUP_EXTERNAL_HOST_PATH'
)

foreach ($envPath in @($rootEnvPath, $backendEnvPath)) {
    $envContent = Get-Content -LiteralPath $envPath -Raw

    foreach ($variableName in $requiredVariables) {
        Assert-BackupExternalContract ($envContent.Contains($variableName)) "$([System.IO.Path]::GetFileName($envPath)) debe documentar $variableName."
    }

    Assert-BackupExternalContract ($envContent -match 'HOSPITAL_BACKUP_EXTERNAL_ENABLED=false') "$([System.IO.Path]::GetFileName($envPath)) debe dejar la copia externa desactivada por defecto."
    Assert-BackupExternalContract ($envContent -match 'NO esta desplegada') "$([System.IO.Path]::GetFileName($envPath)) debe advertir que sin destino real la copia NO esta desplegada."
}

if ($script:Errors.Count -gt 0) {
    Write-Host ("Backup external compose contract found {0} failing assertions:" -f $script:Errors.Count) -ForegroundColor Red
    foreach ($err in $script:Errors) {
        Write-Host ("  - {0}" -f $err) -ForegroundColor Red
    }
    throw 'Backup external compose contract test failed.'
}

Write-Host "Backup external compose contract passed: $script:Checks checks (parser: $script:ParserName)."
