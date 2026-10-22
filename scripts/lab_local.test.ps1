#Requires -Version 5.1
<#
    Pruebas de contrato del laboratorio local NO-Docker (C1-INST-02).

    Son hermeticas: NO levantan servidores, NO tocan MariaDB y NO escriben fuera
    de un directorio temporal desechable. Verifican las guardas que impiden que
    el laboratorio toque datos, bases o arboles ajenos.
#>
$ErrorActionPreference = 'Stop'

$script:Checks = 0

function Assert-LabTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) { throw $Message }
}

function Assert-LabThrows {
    param([scriptblock] $Action, [string] $MessagePattern, [string] $Label)
    $script:Checks++
    $threw = $false
    $message = ''
    try {
        & $Action | Out-Null
    } catch {
        $threw = $true
        $message = [string] $_.Exception.Message
    }

    if (-not $threw) { throw "$Label debe fallar y no fallo." }
    if ($message -notmatch $MessagePattern) {
        throw "$Label fallo con un mensaje inesperado: $message"
    }
}

. (Join-Path $PSScriptRoot 'lib\lab_local.ps1')

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-lab-local-' + [guid]::NewGuid().ToString('N'))

try {
    # ------------------------------------------------------------------
    # Guarda de nombre de base: allowlist estricta
    # ------------------------------------------------------------------
    $validNames = @('sh_ai_lab_local', 'sh_ai_lab_local_2', 'sh_ai_lab_local_abc123')
foreach ($name in $validNames) {
    $script:Checks++
    try {
        Assert-LabLocalDatabaseName -DatabaseName $name
    } catch {
        throw "El nombre de base valido '$name' fue rechazado: $($_.Exception.Message)"
    }
}

$invalidNames = @(
    '',
    'hospital_billing',
    'mysql',
    'test',
    'sh_ai_lab',
    'ai_lab_local',
    'sh_ai_lab_local;DROP DATABASE hospital_billing',
    'sh_ai_lab_local`;DROP DATABASE hospital_billing',
    'SH_AI_LAB_LOCAL',
    'sh_ai_lab_local_'
)
foreach ($name in $invalidNames) {
    Assert-LabThrows -Action { Assert-LabLocalDatabaseName -DatabaseName $name } -MessagePattern 'Refusing to operate on database|must not be empty' -Label "Assert-LabLocalDatabaseName('$name')"
}

# ------------------------------------------------------------------
# Guarda de puertos
# ------------------------------------------------------------------
Assert-LabThrows -Action { Assert-LabLocalPort -Port 80 -Label 'P' } -MessagePattern 'unprivileged port' -Label 'Assert-LabLocalPort(80)'
Assert-LabThrows -Action { Assert-LabLocalPort -Port 70000 -Label 'P' } -MessagePattern 'unprivileged port' -Label 'Assert-LabLocalPort(70000)'
$script:Checks++
Assert-LabLocalPort -Port 18080 -Label 'P'

# ------------------------------------------------------------------
# Guarda de raiz protegida
# ------------------------------------------------------------------
Assert-LabThrows -Action { Assert-LabLocalRoot -ProjectRoot 'C:\Projects\S_Hospital' } -MessagePattern 'protected original tree|missing|does not exist' -Label 'Assert-LabLocalRoot(arbol original)'

$fakeRoot = Join-Path $testRoot 'worktree'
New-Item -ItemType Directory -Path (Join-Path $fakeRoot 'backend') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $fakeRoot 'frontend') -Force | Out-Null
New-Item -ItemType File -Path (Join-Path $fakeRoot 'backend\artisan') -Force | Out-Null
'{}' | ForEach-Object { Set-LabLocalFileText -Path (Join-Path $fakeRoot 'frontend\package.json') -Content $_ }

$script:Checks++
$resolvedFake = Assert-LabLocalRoot -ProjectRoot $fakeRoot
Assert-LabTest ($resolvedFake -eq (Resolve-Path -LiteralPath $fakeRoot).Path.TrimEnd('\')) 'Assert-LabLocalRoot debe devolver la ruta resuelta.'

# WORKSPACE.json con writable_root distinto => rechazo
$mismatchRoot = Join-Path $testRoot 'mismatch'
New-Item -ItemType Directory -Path (Join-Path $mismatchRoot 'backend') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $mismatchRoot 'frontend') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $mismatchRoot 'hospital-ai') -Force | Out-Null
New-Item -ItemType File -Path (Join-Path $mismatchRoot 'backend\artisan') -Force | Out-Null
Set-LabLocalFileText -Path (Join-Path $mismatchRoot 'frontend\package.json') -Content '{}'
Set-LabLocalFileText -Path (Join-Path $mismatchRoot 'hospital-ai\WORKSPACE.json') -Content '{ "writable_root": "C:\\Projects\\OtroSitio", "source_repo": "C:\\Projects\\S_Hospital" }'
Assert-LabThrows -Action { Assert-LabLocalRoot -ProjectRoot $mismatchRoot } -MessagePattern 'does not match WORKSPACE.json writable_root' -Label 'Assert-LabLocalRoot(WORKSPACE.json discordante)'

# ------------------------------------------------------------------
# Guarda del archivo de entorno: nunca pisar un .env.local ajeno
# ------------------------------------------------------------------
$foreignEnv = Join-Path $testRoot 'foreign\.env.local'
Set-LabLocalFileText -Path $foreignEnv -Content "APP_ENV=production`r`nDB_DATABASE=hospital_billing`r`n"
Assert-LabThrows -Action { Write-LabLocalEnvFile -EnvFile $foreignEnv -DatabaseName 'sh_ai_lab_local' -BackendPort 18080 -FrontendPort 15173 } -MessagePattern 'Refusing to overwrite' -Label 'Write-LabLocalEnvFile(.env.local ajeno)'

$script:Checks++
$foreignEnvContent = [System.IO.File]::ReadAllText($foreignEnv)
Assert-LabTest ($foreignEnvContent -match 'hospital_billing') 'El .env.local ajeno no debe ser modificado.'

# ------------------------------------------------------------------
# Escritura del entorno de laboratorio: contenido, BOM e idempotencia
# ------------------------------------------------------------------
$labEnv = Join-Path $testRoot 'ours\.env.local'
Write-LabLocalEnvFile -EnvFile $labEnv -DatabaseName 'sh_ai_lab_local' -BackendPort 18080 -FrontendPort 15173 -DbUsername 'sh_ai_lab_local' -DbPassword 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' | Out-Null

$script:Checks++
$bytes = [System.IO.File]::ReadAllBytes($labEnv)
$hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
Assert-LabTest (-not $hasBom) 'El .env.local de laboratorio NO debe tener BOM UTF-8.'

$envText = [System.IO.File]::ReadAllText($labEnv)
$expectedFragments = @(
    '# SH-AI LAB LOCAL',
    'APP_ENV=local',
    'APP_VERSION=lab-local',
    'DB_DATABASE=sh_ai_lab_local',
    'DB_USERNAME=sh_ai_lab_local',
    'SESSION_DRIVER=database',
    'CACHE_STORE=database',
    'QUEUE_CONNECTION=database',
    'SANCTUM_STATEFUL_DOMAINS=localhost,localhost:15173,127.0.0.1,127.0.0.1:15173,127.0.0.1:18080,::1',
    'CORS_ALLOWED_ORIGINS=http://localhost:15173,http://127.0.0.1:15173',
    'HOSPITAL_BACKUP_EXTERNAL_ENABLED=false'
)
foreach ($fragment in $expectedFragments) {
    $script:Checks++
    Assert-LabTest ($envText.Contains($fragment)) "Falta '$fragment' en el .env.local de laboratorio."
}

$script:Checks++
Assert-LabTest ($envText -match 'APP_KEY=base64:') 'El .env.local debe incluir una APP_KEY generada.'

$script:Checks++
Assert-LabTest ($envText -notmatch 'Password123|hospital_billing') 'El .env.local no debe contener credenciales ni bases del hospital.'

# Idempotencia: reescribir el propio archivo esta permitido.
$script:Checks++
Write-LabLocalEnvFile -EnvFile $labEnv -DatabaseName 'sh_ai_lab_local' -BackendPort 18080 -FrontendPort 15173 -DbUsername 'sh_ai_lab_local' -DbPassword 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' | Out-Null
Assert-LabTest ((Test-Path -LiteralPath $labEnv)) 'La reescritura idempotente del .env.local debe funcionar.'

# ------------------------------------------------------------------
# Usuario acotado: validacion de nombre y token
# ------------------------------------------------------------------
Assert-LabThrows -Action { New-LabLocalDatabaseUser -MySqlExe 'x' -DatabaseName 'sh_ai_lab_local' -Username 'root' -Password ('a' * 48) } -MessagePattern 'not allowed' -Label 'New-LabLocalDatabaseUser(root)'
Assert-LabThrows -Action { New-LabLocalDatabaseUser -MySqlExe 'x' -DatabaseName 'sh_ai_lab_local' -Username 'sh_ai_lab_x' -Password 'short' } -MessagePattern 'hex token' -Label 'New-LabLocalDatabaseUser(password corto)'
Assert-LabThrows -Action { Remove-LabLocalDatabaseUser -MySqlExe 'x' -Username 'hospital' } -MessagePattern 'Refusing to drop' -Label 'Remove-LabLocalDatabaseUser(ajeno)'

# ------------------------------------------------------------------
# Comparador de huellas de bases ajenas
# ------------------------------------------------------------------
$before = @('hospital_billing:40', 'conecta_hn:12')
$same = Compare-LabLocalForeignDatabases -Before $before -After @('hospital_billing:40', 'conecta_hn:12')
$script:Checks++
Assert-LabTest ($same.Unchanged) 'Huellas iguales deben reportar Unchanged.'

$drifted = Compare-LabLocalForeignDatabases -Before $before -After @('hospital_billing:42', 'conecta_hn:12')
$script:Checks++
Assert-LabTest (-not $drifted.Unchanged) 'Una base ajena que cambia de tablas debe hacer fallar la comparacion.'
$script:Checks++
Assert-LabTest ($drifted.Changed.Count -eq 1 -and $drifted.Changed[0] -match 'hospital_billing') 'El cambio debe atribuirse a hospital_billing.'

$concurrent = Compare-LabLocalForeignDatabases -Before $before -After @('hospital_billing:40', 'conecta_hn:12', 's_hospital_test_c1qa01_schema:42')
$script:Checks++
Assert-LabTest ($concurrent.Unchanged) 'Una base ajena NUEVA (otro agente) no debe hacer fallar la corrida.'
$script:Checks++
Assert-LabTest ($concurrent.Added.Count -eq 1) 'La base nueva debe reportarse como Added.'

# ------------------------------------------------------------------
# El smoke no debe aceptar una base ajena
# ------------------------------------------------------------------
Assert-LabThrows -Action { Assert-LabLocalDatabaseName -DatabaseName 'hospital_billing' } -MessagePattern 'Refusing to operate on database' -Label 'Smoke contra base ajena'

Write-Host "Lab local contract self-test passed: $script:Checks checks."
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
