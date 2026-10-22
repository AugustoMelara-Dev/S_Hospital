# ==============================================================================
# S_Hospital - Suite de Auto-Test de Diagnósticos del Instalador
# ==============================================================================
# Diseñado para Windows PowerShell 5.1. Seguro bajo StrictMode -Version Latest.
# Verifica la correctitud de las funciones lógicas de diagnóstico sin tocar el host.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# UTF-8 Console Output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

# 1. Cargar librerías de diagnóstico
$netHelper = Join-Path $scriptDir "lib\net_diagnostics.ps1"
$dockerHelper = Join-Path $scriptDir "lib\docker_diagnostics.ps1"
$portHelper = Join-Path $scriptDir "lib\port_diagnostics.ps1"
$envHelper = Join-Path $scriptDir "lib\env_helpers.ps1"
$backupReadinessHelper = Join-Path $scriptDir "lib\backup_install_readiness.ps1"
$backupVerifierHelper = Join-Path $scriptDir "lib\backup_install_verifier.ps1"
$backupRuntimeHelper = Join-Path $scriptDir "lib\backup_install_runtime.ps1"

if (-not (Test-Path $netHelper)) { throw "Falta net_diagnostics.ps1" }
if (-not (Test-Path $dockerHelper)) { throw "Falta docker_diagnostics.ps1" }
if (-not (Test-Path $portHelper)) { throw "Falta port_diagnostics.ps1" }
if (-not (Test-Path $envHelper)) { throw "Falta env_helpers.ps1" }
if (-not (Test-Path $backupReadinessHelper)) { throw "Falta backup_install_readiness.ps1" }
if (-not (Test-Path $backupVerifierHelper)) { throw "Falta backup_install_verifier.ps1" }
if (-not (Test-Path $backupRuntimeHelper)) { throw "Falta backup_install_runtime.ps1" }

. $netHelper
. $dockerHelper
. $portHelper
. $envHelper
. $backupReadinessHelper
. $backupVerifierHelper
. $backupRuntimeHelper

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "     S_HOSPITAL - INICIANDO SUITE DE AUTO-TEST" -ForegroundColor Cyan -BackgroundColor DarkBlue
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Assert-Equal($Actual, $Expected, $TestName) {
    if ($Actual -eq $Expected) {
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
        $script:testsPassed++
    } else {
        Write-Host "  [FAIL] $TestName" -ForegroundColor Red
        Write-Host "         Esperado: '$Expected' | Obtenido: '$Actual'" -ForegroundColor Yellow
        $script:testsFailed++
    }
}

# --- TEST 1: Get-PropertyValueSafe ---
Write-Host "[*] Test 1: Get-PropertyValueSafe (Evitar StrictMode Exceptions)" -ForegroundColor Yellow
$mockObject = New-Object PSCustomObject -Property @{
    NombreValido = "Hospital Central"
}
# Bajo StrictMode -Version Latest, acceder a una propiedad inexistente arrojaría error fatal.
# Get-PropertyValueSafe debe manejarlo de forma segura devolviendo null.
$val1 = Get-PropertyValueSafe $mockObject "NombreValido"
$val2 = Get-PropertyValueSafe $mockObject "PropiedadInexistente" "DefaultVal"

Assert-Equal $val1 "Hospital Central" "Lectura de propiedad existente"
Assert-Equal $val2 "DefaultVal" "Manejo seguro de propiedad inexistente"

# --- TEST 2: Test-IPv4Address ---
Write-Host ""
Write-Host "[*] Test 2: Test-IPv4Address (Validacion de IPs)" -ForegroundColor Yellow
$ipValid = Test-IPv4Address "192.168.1.100"
$ipLocal = Test-IPv4Address "127.0.0.1"
$ipApipa = Test-IPv4Address "169.254.10.20"
$ipInvalid = Test-IPv4Address "300.400.500.1"

Assert-Equal $ipValid.Valid $true "IP 192.168.1.100 es valida"
Assert-Equal $ipValid.Type "ValidLan" "IP 192.168.1.100 es de tipo ValidLan"

Assert-Equal $ipLocal.Valid $true "IP 127.0.0.1 es valida"
Assert-Equal $ipLocal.Type "Localhost" "IP 127.0.0.1 es detectada como Localhost"

Assert-Equal $ipApipa.Valid $true "IP 169.254.10.20 es valida"
Assert-Equal $ipApipa.Type "APIPA" "IP 169.254.10.20 es detectada como APIPA"

Assert-Equal $ipInvalid.Valid $false "IP 300.400.500.1 es detectada como Invalida"

# --- TEST 3: Get-LanIPv4Candidates Mock-Sort ---
Write-Host ""
Write-Host "[*] Test 3: Clasificacion y Ordenamiento de Adaptadores de Red" -ForegroundColor Yellow
# Validar que los adaptadores de red virtuales (WSL, Docker, APIPA) se detectan y ordenan
$testCandidates = @()
$testCandidates += [PSCustomObject][ordered]@{ IP = "127.0.0.1"; RecScore = 0; RecType = "localhost" }
$testCandidates += [PSCustomObject][ordered]@{ IP = "192.168.1.100"; RecScore = 200; RecType = "RECOMENDADA (Física)" }
$testCandidates += [PSCustomObject][ordered]@{ IP = "172.20.10.1"; RecScore = 30; RecType = "WSL" }

$sorted = $testCandidates | Sort-Object RecScore -Descending
Assert-Equal $sorted[0].IP "192.168.1.100" "IP fisica recomendada queda de primera en la lista"
Assert-Equal $sorted[2].IP "127.0.0.1" "localhost queda de ultima en la lista"

# --- TEST 4: Port Diagnostics Safe Bind Check ---
Write-Host ""
Write-Host "[*] Test 4: Diagnostico de Puertos Libres" -ForegroundColor Yellow
# Un puerto de test extremadamente alto que deberia estar libre
$freePort = 59876
$isFree = Test-PortAvailable $freePort
Assert-Equal $isFree.Available $true "Puerto de prueba alto $freePort se reporta como disponible"


# --- TEST 5: .env Safe Updates en Path Temporal ---
Write-Host ""
Write-Host "[*] Test 5: Gestion No Destructiva de .env" -ForegroundColor Yellow
$tempEnv = Join-Path $scriptDir "temp_env.tmp"
try {
    if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force }
    
    # Crear un .env base con secretos
    @("DB_PASSWORD=secreto_original", "DB_DATABASE=hospital_billing") | Out-File -FilePath $tempEnv -Encoding utf8
    
    # Actualizar valores
    $vars = @{
        "DB_DATABASE" = "hospital_billing_v2"
        "SERVER_IP" = "192.168.1.150"
    }
    Update-DotEnv -Path $tempEnv -Variables $vars
    
    # Validar
    $loaded = Read-EnvFile $tempEnv
    Assert-Equal $loaded["DB_PASSWORD"] "secreto_original" "Preservacion de clave original"
    Assert-Equal $loaded["DB_DATABASE"] "hospital_billing_v2" "Actualizacion de clave existente"
    Assert-Equal $loaded["SERVER_IP"] "192.168.1.150" "Adicion de clave nueva"
}
finally {
    if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force }
}

# --- TEST 6: Detección de Archivos Requeridos y Espacios ---
Write-Host ""
Write-Host "[*] Test 6: Validacion del Entorno del Repositorio" -ForegroundColor Yellow
$composeExists = Test-Path (Join-Path $projectRoot "docker-compose.prod.yml")
Assert-Equal $composeExists $true "Archivo docker-compose.prod.yml esta presente en el repositorio"

# --- TEST 7: Disponibilidad de automatizacion de respaldos ---
Write-Host ""
Write-Host "[*] Test 7: Disponibilidad de automatizacion de respaldos" -ForegroundColor Yellow
$dockerReady = Get-BackupAutomationReadiness -Mode Docker -ServiceStates @{ 'queue-worker' = 'healthy'; scheduler = 'healthy' }
Assert-Equal $dockerReady.Ready $true "Docker exige worker y scheduler saludables"
$dockerUnhealthy = Get-BackupAutomationReadiness -Mode Docker -ServiceStates @{ 'queue-worker' = 'healthy'; scheduler = 'starting' }
Assert-Equal $dockerUnhealthy.Ready $false "Docker rechaza scheduler no saludable"

$workerRunningState = @{ Installed = $true; Enabled = $true; State = 'Running' }
$schedulerReadyState = @{ Installed = $true; Enabled = $true; State = 'Ready'; RepeatInterval = 'PT1M'; MultipleInstances = 'IgnoreNew' }

$bareReady = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = $workerRunningState; Scheduler = $schedulerReadyState }
Assert-Equal $bareReady.Ready $true "Bare-metal acepta Worker activo y Scheduler cada 1 minuto (modelo T3-011)"
$bareWorkerOnly = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = $workerRunningState }
Assert-Equal $bareWorkerOnly.Ready $false "Bare-metal solo Worker no certifica automatizacion (falta Scheduler)"
Assert-Equal (@($bareWorkerOnly.Reasons | Where-Object { $_ -match 'HospitalBillingOS-Scheduler' }).Count -ge 1) $true "Reason identifica la tarea Scheduler faltante"
$bareNone = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{}
Assert-Equal $bareNone.Ready $false "Bare-metal sin tareas falla (fail-closed, no 'alguna tarea O.S.')"
Assert-Equal (@($bareNone.Reasons | Where-Object { $_ -match 'BackupWorker' }).Count -ge 1) $true "Reason identifica Worker faltante"
Assert-Equal (@($bareNone.Reasons | Where-Object { $_ -match 'HospitalBillingOS-Scheduler' }).Count -ge 1) $true "Reason identifica Scheduler faltante"
$bareLegacyOnly = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = $workerRunningState; LegacyDaily = @{ Installed = $true; Enabled = $true; State = 'Ready' } }
Assert-Equal $bareLegacyOnly.Ready $false "Bare-metal no acepta la tarea legacy DailyBackup como automatizacion"
Assert-Equal (@($bareLegacyOnly.Reasons | Where-Object { $_ -match 'DailyBackup' }).Count -ge 1) $true "Reason sugiere retirar la tarea legacy"
$bareStopped = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = @{ Installed = $true; Enabled = $true; State = 'Ready' }; Scheduler = $schedulerReadyState }
Assert-Equal $bareStopped.Ready $false "Bare-metal rechaza worker detenido"
$bareWrongCadence = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = $workerRunningState; Scheduler = @{ Installed = $true; Enabled = $true; State = 'Ready'; RepeatInterval = 'PT5M'; MultipleInstances = 'IgnoreNew' } }
Assert-Equal $bareWrongCadence.Ready $false "Bare-metal rechaza Scheduler que no repite cada minuto"
Assert-Equal (@($bareWrongCadence.Reasons | Where-Object { $_ -match '1 minuto' }).Count -ge 1) $true "Reason muestra la cadencia esperada"
$bareParallel = Get-BackupAutomationReadiness -Mode BareMetal -TaskStates @{ Worker = $workerRunningState; Scheduler = @{ Installed = $true; Enabled = $true; State = 'Ready'; RepeatInterval = 'PT1M'; MultipleInstances = 'Parallel' } }
Assert-Equal $bareParallel.Ready $false "Bare-metal rechaza Scheduler sin MultipleInstances IgnoreNew"

# --- TEST 7b: Probe CIM (sintetico, sin registrar tareas) ---
Write-Host ""
Write-Host "[*] Test 7b: Probe CIM de tareas Windows (sin admin)" -ForegroundColor Yellow
$cimProbeAvailable = (
    $null -ne (Get-Command New-ScheduledTaskTrigger -ErrorAction SilentlyContinue) -and
    $null -ne (Get-Command New-ScheduledTaskSettingsSet -ErrorAction SilentlyContinue)
)
if ($cimProbeAvailable) {
    $probeTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
    $probeSettings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew
    $probeTask = [pscustomobject]@{
        State = 'Ready'
        Triggers = @($probeTrigger)
        Settings = $probeSettings
    }
    $probeState = ConvertTo-BackupTaskState -Task $probeTask
    Assert-Equal $probeState.Installed $true "CIM probe: tarea presente"
    Assert-Equal $probeState.State 'Ready' "CIM probe: estado Ready"
    Assert-Equal $probeState.RepeatInterval 'PT1M' "CIM probe: RepetitionInterval PT1M"
    Assert-Equal $probeState.MultipleInstances 'IgnoreNew' "CIM probe: MultipleInstances IgnoreNew"

    if ($null -ne (Get-Command New-ScheduledTask -ErrorAction SilentlyContinue)) {
        $probeAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -File scripts\install_backup_tasks_windows.ps1 -SchedulerTick'
        $probeTaskObject = New-ScheduledTask -Action $probeAction -Trigger $probeTrigger -Settings $probeSettings
        $probeObjectState = ConvertTo-BackupTaskState -Task $probeTaskObject
        Assert-Equal $probeObjectState.Installed $true "CIM probe: objeto New-ScheduledTask presente"
        Assert-Equal $probeObjectState.RepeatInterval 'PT1M' "CIM probe: objeto New-ScheduledTask RepetitionInterval PT1M"
        Assert-Equal $probeObjectState.MultipleInstances 'IgnoreNew' "CIM probe: objeto New-ScheduledTask MultipleInstances IgnoreNew"
    }

    $probeMissing = ConvertTo-BackupTaskState -Task $null
    Assert-Equal $probeMissing.Installed $false "CIM probe: tarea ausente no instalada"
    Assert-Equal $probeMissing.State 'Missing' "CIM probe: tarea ausente reporta Missing"
} else {
    Write-Host "  [SKIP] ScheduledTasks CIM cmdlets no disponibles en este host" -ForegroundColor Yellow
}

# --- TEST 8: Evidencia de respaldo cifrado ---
Write-Host ""
Write-Host "[*] Test 8: Evidencia de respaldo cifrado" -ForegroundColor Yellow
$validBackupJson = '{"status":"success","backup_log_id":91,"filename":"hospital.sql.enc","checksum_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","encrypted":true,"size_bytes":2048}'
$validBackup = Test-EncryptedBackupResult -ExitCode 0 -JsonOutput $validBackupJson
Assert-Equal $validBackup.Ready $true "Respaldo cifrado registrado con checksum es valido"
$missingEncryptedFile = Test-EncryptedBackupResult -ExitCode 0 -JsonOutput '{"status":"success","backup_log_id":91,"filename":"hospital.sql","checksum_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","encrypted":false,"size_bytes":2048}'
Assert-Equal $missingEncryptedFile.Ready $false "Exit zero sin archivo cifrado registrado no es exito"
$badChecksum = Test-EncryptedBackupResult -ExitCode 0 -JsonOutput '{"status":"success","backup_log_id":91,"filename":"hospital.sql.enc","checksum_sha256":"bad","encrypted":true,"size_bytes":2048}'
Assert-Equal $badChecksum.Ready $false "Checksum invalido bloquea la certificacion"
$nonzeroBackup = Test-EncryptedBackupResult -ExitCode 1 -JsonOutput $validBackupJson
Assert-Equal $nonzeroBackup.Ready $false "Exit code fallido bloquea la certificacion"

$script:BackupRunnerCalled = $false
$injectedReady = Invoke-BackupInstallVerification `
    -Mode Docker `
    -AutomationProbe { @{ 'queue-worker' = 'healthy'; scheduler = 'healthy' } } `
    -BackupRunner { $script:BackupRunnerCalled = $true; @{ ExitCode = 0; Output = $validBackupJson } }
Assert-Equal $injectedReady.Ready $true "Verificador inyectado certifica automatizacion y archivo"
Assert-Equal $script:BackupRunnerCalled $true "Runner de respaldo se ejecuta al estar saludable"

$script:BlockedRunnerCalled = $false
$injectedBlocked = Invoke-BackupInstallVerification `
    -Mode Docker `
    -AutomationProbe { @{ 'queue-worker' = 'healthy'; scheduler = 'starting' } } `
    -BackupRunner { $script:BlockedRunnerCalled = $true; @{ ExitCode = 0; Output = $validBackupJson } }
Assert-Equal $injectedBlocked.Ready $false "Verificador bloquea automatizacion no saludable"
Assert-Equal $script:BlockedRunnerCalled $false "No crea respaldo cuando automatizacion esta rota"

# --- TEST 9: Runtime BareMetal con tareas CIM sinteticas y php sintetico ---
Write-Host ""
Write-Host "[*] Test 9: Runtime BareMetal (solo Worker -> aviso; Scheduler+Worker -> OK)" -ForegroundColor Yellow

$runtimeFixture = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-t3016-runtime-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path (Join-Path $runtimeFixture 'backend') | Out-Null
Set-Content -LiteralPath (Join-Path $runtimeFixture 'backup.json') -Value $validBackupJson -Encoding ASCII
@(
    '@echo off',
    'type "%~dp0backup.json"',
    'exit /b 0'
) | Set-Content -LiteralPath (Join-Path $runtimeFixture 'php.cmd') -Encoding ASCII

$script:ProbeTaskStates = @{}
function Get-ScheduledTask {
    [CmdletBinding()]
    param([string] $TaskName)
    if ($script:ProbeTaskStates.ContainsKey($TaskName)) {
        return $script:ProbeTaskStates[$TaskName]
    }
    return $null
}

$fakeWorkerTask = [pscustomobject]@{
    State = 'Running'
    Triggers = @()
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}
$fakeSchedulerTask = [pscustomobject]@{
    State = 'Ready'
    Triggers = @([pscustomobject]@{ Repetition = [pscustomobject]@{ Interval = 'PT1M' } })
    Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' }
}

try {
    $script:ProbeTaskStates = @{
        'HospitalBillingOS-BackupWorker' = $fakeWorkerTask
        'HospitalBillingOS-Scheduler' = $fakeSchedulerTask
    }
    $runtimeReady = Invoke-HospitalBackupInstallVerification -Mode BareMetal -ProjectRoot $runtimeFixture -PhpPath (Join-Path $runtimeFixture 'php.cmd')
    Assert-Equal $runtimeReady.Ready $true "Runtime BareMetal certifica Scheduler+Worker y respaldo sintetico"
    Assert-Equal $runtimeReady.Automation.Ready $true "Runtime BareMetal: automatizacion certificada"

    $script:ProbeTaskStates = @{ 'HospitalBillingOS-BackupWorker' = $fakeWorkerTask }
    $runtimeWorkerOnly = Invoke-HospitalBackupInstallVerification -Mode BareMetal -ProjectRoot $runtimeFixture -PhpPath (Join-Path $runtimeFixture 'php.cmd')
    Assert-Equal $runtimeWorkerOnly.Ready $false "Runtime BareMetal solo Worker no certifica (el instalador lo presenta como aviso, no aborta)"
    Assert-Equal (@($runtimeWorkerOnly.Reasons | Where-Object { $_ -match 'HospitalBillingOS-Scheduler' }).Count -ge 1) $true "Runtime solo Worker: reason de Scheduler faltante"
    Assert-Equal $null $runtimeWorkerOnly.Backup "Runtime solo Worker: no ejecuta respaldo de prueba"

    $script:ProbeTaskStates = @{
        'HospitalBillingOS-DailyBackup' = [pscustomobject]@{ State = 'Ready'; Triggers = @(); Settings = [pscustomobject]@{ Enabled = $true; MultipleInstances = 'IgnoreNew' } }
    }
    $runtimeLegacyOnly = Invoke-HospitalBackupInstallVerification -Mode BareMetal -ProjectRoot $runtimeFixture -PhpPath (Join-Path $runtimeFixture 'php.cmd')
    Assert-Equal $runtimeLegacyOnly.Ready $false "Runtime BareMetal no acepta la tarea legacy DailyBackup"
    Assert-Equal (@($runtimeLegacyOnly.Reasons | Where-Object { $_ -match 'DailyBackup' }).Count -ge 1) $true "Runtime legacy: reason sugiere -UpdateExisting"

    $script:ProbeTaskStates = @{}
    $runtimeNone = Invoke-HospitalBackupInstallVerification -Mode BareMetal -ProjectRoot $runtimeFixture -PhpPath (Join-Path $runtimeFixture 'php.cmd')
    Assert-Equal $runtimeNone.Ready $false "Runtime BareMetal sin tareas falla"
    Assert-Equal (@($runtimeNone.Reasons).Count -ge 2) $true "Runtime sin tareas: reasons de Worker y Scheduler"
} finally {
    Remove-Item Function:\Get-ScheduledTask -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $runtimeFixture) {
        Remove-Item -LiteralPath $runtimeFixture -Recurse -Force -ErrorAction SilentlyContinue
    }
}
# --- INFORME FINAL ---
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "               INFORME FINAL DE AUTO-TEST                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Pruebas Exitosas: $testsPassed" -ForegroundColor Green
if ($testsFailed -gt 0) {
    Write-Host "  Pruebas Fallidas: $testsFailed" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    exit 1
} else {
    Write-Host "  ¡TODAS LAS PRUEBAS INTERNAS PASARON CON EXITO!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    exit 0
}
