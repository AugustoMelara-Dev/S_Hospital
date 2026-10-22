#Requires -Version 5.1
# Test de proceso real de la consola de mantenimiento contra un restore falso.
# No usa Docker (daemon apagado): inyecta un docker.cmd de fixture en PATH y
# stubs de archivos. No ejecuta restores reales ni toca bases de datos.

$ErrorActionPreference = 'Stop'

$consoleScript = Join-Path $PSScriptRoot 'maintenance_hospital_windows.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore_hospital_windows.ps1'
$repoLibs = Join-Path $PSScriptRoot 'lib'

$script:Checks = 0

function Assert-ConsoleTest {
    param([bool]$Condition, [string]$Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

function New-ConsoleFixture {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-console-' + [guid]::NewGuid().ToString('N'))
    $libs = Join-Path $root 'scripts\lib'
    $bin = Join-Path $root 'bin'
    $null = New-Item -ItemType Directory -Path $libs -Force
    $null = New-Item -ItemType Directory -Path $bin -Force

    foreach ($lib in @('recovery_contract.ps1', 'recovery_runtime.ps1', 'recovery_validation.ps1', 'recovery_docker.ps1')) {
        Copy-Item -LiteralPath (Join-Path $repoLibs $lib) -Destination (Join-Path $libs $lib) -Force
    }

    Set-Content -LiteralPath (Join-Path $root 'docker-compose.prod.yml') -Value 'services: {}' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $root '.env') -Value 'DB_DATABASE=hospital_billing' -Encoding ASCII

    $restoreStub = @'
param(
    [switch]$SelfTest,
    [switch]$WhatIf,
    [string]$BackupFile = "",
    [string]$ExpectedSha256 = "",
    [string]$TargetDatabase = "hospital_billing_test",
    [switch]$UseExistingEnv,
    [switch]$ProductionRecovery,
    [string]$ProductionDatabaseConfirmation = "",
    [string]$ProductionActionConfirmation = "",
    [switch]$ForceProductionRestore
)
$record = [ordered]@{
    Invoked = $true
    Parameters = @($PSBoundParameters.Keys)
    Values = @{}
    ProductionRecovery = [bool]$ProductionRecovery
    TargetDatabase = $TargetDatabase
    BackupFile = $BackupFile
    ActionConfirmation = $ProductionActionConfirmation
}
foreach ($key in $PSBoundParameters.Keys) {
    $record.Values[$key] = [string]$PSBoundParameters[$key]
}
$record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'restore-stub.json') -Encoding UTF8
exit 0
'@
    Set-Content -LiteralPath (Join-Path $root 'scripts\restore_hospital_windows.ps1') -Value $restoreStub -Encoding ASCII

    $dockerStub = @'
@echo off
echo %*>> "%~dp0docker-calls.log"
type "%~dp0docker-json.txt" 2>nul
exit /b 0
'@
    Set-Content -LiteralPath (Join-Path $bin 'docker.cmd') -Value $dockerStub -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $bin 'docker-json.txt') -Value '{"status":"success"}' -Encoding ASCII

    return $root
}

function Invoke-FixtureProcess {
    param(
        [string]$ScriptPath,
        [string]$Arguments,
        [string]$PathPrefix = '',
        [string[]]$InputLines = @(),
        [int]$TimeoutMs = 90000
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = Join-Path $PSHOME 'powershell.exe'
    $processInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" {1}' -f $ScriptPath, $Arguments
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardInput = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    if (-not [string]::IsNullOrWhiteSpace($PathPrefix)) {
        $processInfo.EnvironmentVariables['PATH'] = $PathPrefix + ';' + $processInfo.EnvironmentVariables['PATH']
    }

    $process = [System.Diagnostics.Process]::Start($processInfo)
    if ($InputLines.Count -gt 0) {
        $process.StandardInput.Write(($InputLines -join [Environment]::NewLine) + [Environment]::NewLine)
    }
    $process.StandardInput.Close()

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($TimeoutMs)) {
        $process.Kill()
        $process.Dispose()
        throw "Timeout esperando $ScriptPath"
    }

    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $exitCode = $process.ExitCode
    $process.Dispose()

    return [pscustomobject]@{
        ExitCode = $exitCode
        StdOut = $stdout
        StdErr = $stderr
    }
}

function Invoke-ConsoleProcess {
    param(
        [string]$ProjectRoot,
        [string]$Command,
        [string[]]$InputLines = @()
    )

    return Invoke-FixtureProcess `
        -ScriptPath $consoleScript `
        -Arguments ('-ProjectRoot "{0}" -Command {1}' -f $ProjectRoot, $Command) `
        -PathPrefix (Join-Path $ProjectRoot 'bin') `
        -InputLines $InputLines
}

function New-RestoreFixture {
    param([switch]$Docker)

    $root = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-restore-' + [guid]::NewGuid().ToString('N'))
    $scriptsDir = Join-Path $root 'scripts'
    $libsDir = Join-Path $scriptsDir 'lib'
    $binDir = Join-Path $root 'bin'
    $backendDir = Join-Path $root 'backend'
    foreach ($dir in @($scriptsDir, $libsDir, $binDir, $backendDir)) {
        $null = New-Item -ItemType Directory -Path $dir -Force
    }

    Copy-Item -LiteralPath $restoreScript -Destination (Join-Path $scriptsDir 'restore_hospital_windows.ps1') -Force
    foreach ($lib in @('recovery_contract.ps1', 'recovery_runtime.ps1', 'recovery_validation.ps1', 'recovery_docker.ps1', 'recovery_orchestrator.ps1')) {
        Copy-Item -LiteralPath (Join-Path $repoLibs $lib) -Destination (Join-Path $libsDir $lib) -Force
    }

    Set-Content -LiteralPath (Join-Path $backendDir 'artisan') -Value '<?php // fixture' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $backendDir '.env') -Value @(
        'DB_HOST=127.0.0.1',
        'DB_PORT=3306',
        'DB_DATABASE=hospital_billing',
        'DB_USERNAME=hospital',
        'DB_PASSWORD='
    ) -Encoding ASCII

    Set-Content -LiteralPath (Join-Path $binDir 'php.cmd') -Value "@echo off`r`nexit /b 0" -Encoding ASCII
    $mysqlStub = "@echo off`r`necho %*>> `"%~dp0mysql-calls.log`"`r`nexit /b 0"
    Set-Content -LiteralPath (Join-Path $binDir 'mysql.cmd') -Value $mysqlStub -Encoding ASCII

    if ($Docker) {
        Set-Content -LiteralPath (Join-Path $root 'docker-compose.prod.yml') -Value 'services: {}' -Encoding ASCII
        Set-Content -LiteralPath (Join-Path $root '.env') -Value 'DB_DATABASE=hospital_billing' -Encoding ASCII
        $dockerStub = "@echo off`r`necho %*>> `"%~dp0docker-calls.log`"`r`nexit /b 0"
        Set-Content -LiteralPath (Join-Path $binDir 'docker.cmd') -Value $dockerStub -Encoding ASCII
    }

    return $root
}

function Get-RestoreRecord {
    param([string]$ProjectRoot)

    $recordPath = Join-Path $ProjectRoot 'scripts\restore-stub.json'
    if (-not (Test-Path -LiteralPath $recordPath)) {
        return $null
    }

    return (Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json)
}

$fixtureRoot = New-ConsoleFixture

try {
    # 1) La consola abre en Docker-only sin backend\artisan ni PHP del host.
    $status = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Status'
    Assert-ConsoleTest ($status.ExitCode -eq 0) "Status debe salir 0 en Docker-only. stderr=$($status.StdErr)"
    Assert-ConsoleTest ($status.StdOut -match 'Runtime:\s+Docker') 'Status debe detectar el runtime Docker.'
    Assert-ConsoleTest (-not ($status.StdOut -match 'backend\\artisan')) 'Status no debe exigir backend\artisan del host.'
    Assert-ConsoleTest (-not ($status.StdOut -match 'No se encontro backend')) 'Status no debe fallar por backend ausente.'
    $expectedDockerCli = Join-Path $fixtureRoot 'bin\docker.cmd'
    Assert-ConsoleTest ($status.StdOut -match [regex]::Escape($expectedDockerCli)) 'Status debe resolver el docker.cmd inyectado y no otro cliente Docker.'
    Assert-ConsoleTest ($status.StdOut -match 'Correlativos:\s+al dia') 'Status debe informar el estado de correlativos post-restore.'

    # 2) El respaldo usa el contenedor backend, no php del host.
    $backup = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Backup'
    Assert-ConsoleTest ($backup.ExitCode -eq 0) "Backup debe salir 0 con docker simulado. stderr=$($backup.StdErr)"
    Assert-ConsoleTest ($backup.StdOut -match 'Respaldo creado correctamente') 'Backup debe reportar exito.'
    $dockerCalls = Join-Path $fixtureRoot 'bin\docker-calls.log'
    Assert-ConsoleTest (Test-Path -LiteralPath $dockerCalls) 'El respaldo Docker debe invocar docker.'
    $dockerLog = Get-Content -LiteralPath $dockerCalls -Raw
    Assert-ConsoleTest ($dockerLog -match 'compose .*exec -T backend php artisan hospital:backup') 'El respaldo debe ejecutarse dentro del contenedor backend.'

    # 3) Cancelar la produccion aborta con codigo 1 y no invoca restore.
    $cancel = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Restore' -InputLines @('hospital_billing', 'NO')
    Assert-ConsoleTest ($cancel.ExitCode -eq 1) 'Cancelar la recuperacion productiva debe salir con codigo 1.'
    Assert-ConsoleTest ($cancel.StdOut -match 'cancelada') 'Cancelar debe informar la cancelacion.'
    Assert-ConsoleTest ($null -eq (Get-RestoreRecord -ProjectRoot $fixtureRoot)) 'Cancelar no debe ejecutar restore.'

    # 4) La confirmacion exacta ejecuta el restore falso con el contrato real.
    $dummyBackup = Join-Path $fixtureRoot 'hospital_billing.sql.gz.enc'
    Set-Content -LiteralPath $dummyBackup -Value 'fixture' -Encoding ASCII
    $expectedHash = ('a' * 64)
    $production = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Restore' -InputLines @('hospital_billing', 'RESTAURAR', $dummyBackup, $expectedHash)
    Assert-ConsoleTest ($production.ExitCode -eq 0) "La produccion confirmada debe completar con stub. stderr=$($production.StdErr)"
    $productionRecord = Get-RestoreRecord -ProjectRoot $fixtureRoot
    Assert-ConsoleTest ($null -ne $productionRecord) 'La produccion confirmada debe invocar restore.'
    Assert-ConsoleTest ($productionRecord.ProductionRecovery -eq $true) 'El restore debe recibir -ProductionRecovery.'
    Assert-ConsoleTest ($productionRecord.ActionConfirmation -ceq 'RESTAURAR') 'El restore debe recibir la frase RESTAURAR.'
    Assert-ConsoleTest ($productionRecord.Values.ProductionDatabaseConfirmation -ceq 'hospital_billing') 'El restore debe recibir el nombre exacto de la DB.'
    Assert-ConsoleTest ($productionRecord.Parameters -notcontains 'ProjectRoot') 'La consola no debe enviar -ProjectRoot.'
    Assert-ConsoleTest ($productionRecord.Parameters -notcontains 'WhatIfOnly') 'La consola no debe enviar -WhatIfOnly.'
    Assert-ConsoleTest ($productionRecord.Values.BackupFile -eq $dummyBackup) 'La consola debe enviar la ruta absoluta del backup.'

    # 5) La prueba descartable usa la DB prefijada segura.
    Remove-Item -LiteralPath (Join-Path $fixtureRoot 'scripts\restore-stub.json') -Force
    $disposable = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'TestRestore' -InputLines @($dummyBackup, $expectedHash)
    Assert-ConsoleTest ($disposable.ExitCode -eq 0) "La prueba descartable debe completar con stub. stderr=$($disposable.StdErr)"
    $disposableRecord = Get-RestoreRecord -ProjectRoot $fixtureRoot
    Assert-ConsoleTest ($null -ne $disposableRecord) 'La prueba descartable debe invocar restore.'
    Assert-ConsoleTest ($disposableRecord.TargetDatabase -like 'hospital_billing_test_*') 'La prueba descartable debe usar un recurso desechable unico.'
    Assert-ConsoleTest ($disposableRecord.Parameters -contains 'UseExistingEnv') 'La prueba descartable debe usar la configuracion existente.'
    Assert-ConsoleTest ($disposableRecord.Parameters -notcontains 'ProjectRoot') 'La prueba descartable no debe enviar -ProjectRoot.'
    Assert-ConsoleTest ($disposableRecord.Parameters -notcontains 'WhatIfOnly') 'La prueba descartable no debe enviar -WhatIfOnly.'

    # 6) restore -WhatIf bare-metal, con y sin -BackupFile: plan sin escrituras.
    $bareFixture = New-RestoreFixture
    try {
        $bareRestoreScript = Join-Path $bareFixture 'scripts\restore_hospital_windows.ps1'
        $bareBin = Join-Path $bareFixture 'bin'
        $mysqlLog = Join-Path $bareBin 'mysql-calls.log'

        $whatIfNoBackup = Invoke-FixtureProcess -ScriptPath $bareRestoreScript -Arguments '-UseExistingEnv -WhatIf' -PathPrefix $bareBin
        Assert-ConsoleTest ($whatIfNoBackup.ExitCode -eq 0) "WhatIf bare sin backup debe salir 0. stdout=$($whatIfNoBackup.StdOut) stderr=$($whatIfNoBackup.StdErr)"
        Assert-ConsoleTest ($whatIfNoBackup.StdOut -match '\[RECOVERY_PLAN\]') 'WhatIf bare sin backup debe emitir un plan.'
        Assert-ConsoleTest ($whatIfNoBackup.StdOut -match '"Mode":"BareMetal"') 'WhatIf bare debe declarar modo BareMetal.'
        Assert-ConsoleTest ($whatIfNoBackup.StdOut -match '"WritesPerformed":false') 'WhatIf debe declarar que no escribio.'
        Assert-ConsoleTest (-not ($whatIfNoBackup.StdOut -match 'Recreando base de datos')) 'WhatIf no debe recrear la base.'
        Assert-ConsoleTest (-not (Test-Path -LiteralPath $mysqlLog)) 'WhatIf bare sin backup no debe invocar mysql.'

        $bareBackup = Join-Path $bareFixture 'restore.sql'
        Set-Content -LiteralPath $bareBackup -Value 'fixture-sql' -Encoding ASCII
        $bareHash = (Get-FileHash -LiteralPath $bareBackup -Algorithm SHA256).Hash.ToLowerInvariant()

        $whatIfWithBackup = Invoke-FixtureProcess -ScriptPath $bareRestoreScript -Arguments ('-BackupFile "{0}" -ExpectedSha256 {1} -UseExistingEnv -WhatIf' -f $bareBackup, $bareHash) -PathPrefix $bareBin
        Assert-ConsoleTest ($whatIfWithBackup.ExitCode -eq 0) "WhatIf bare con backup debe salir 0. stderr=$($whatIfWithBackup.StdErr)"
        Assert-ConsoleTest ($whatIfWithBackup.StdOut -match '\[RECOVERY_PLAN\]') 'WhatIf bare con backup debe emitir plan.'
        Assert-ConsoleTest (-not (Test-Path -LiteralPath $mysqlLog)) 'WhatIf bare con backup no debe invocar mysql.'

        $wrongHash = ('b' * 64)
        $whatIfBadHash = Invoke-FixtureProcess -ScriptPath $bareRestoreScript -Arguments ('-BackupFile "{0}" -ExpectedSha256 {1} -UseExistingEnv -WhatIf' -f $bareBackup, $wrongHash) -PathPrefix $bareBin
        Assert-ConsoleTest ($whatIfBadHash.ExitCode -eq 1) 'WhatIf con hash incorrecto debe abortar con codigo 1.'
        Assert-ConsoleTest (-not (Test-Path -LiteralPath $mysqlLog)) 'WhatIf con hash incorrecto no debe invocar mysql.'
    } finally {
        Remove-Item -LiteralPath $bareFixture -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 7) restore -WhatIf Docker, con y sin -BackupFile: plan sin invocar docker.
    $dockerRestoreFixture = New-RestoreFixture -Docker
    try {
        $dockerRestoreScript = Join-Path $dockerRestoreFixture 'scripts\restore_hospital_windows.ps1'
        $dockerBin = Join-Path $dockerRestoreFixture 'bin'
        $dockerLog = Join-Path $dockerBin 'docker-calls.log'

        $dockerWhatIf = Invoke-FixtureProcess -ScriptPath $dockerRestoreScript -Arguments '-UseExistingEnv -WhatIf' -PathPrefix $dockerBin
        Assert-ConsoleTest ($dockerWhatIf.ExitCode -eq 0) "WhatIf Docker sin backup debe salir 0. stderr=$($dockerWhatIf.StdErr)"
        Assert-ConsoleTest ($dockerWhatIf.StdOut -match '"Mode":"Docker"') 'WhatIf Docker debe declarar modo Docker.'
        Assert-ConsoleTest (-not (Test-Path -LiteralPath $dockerLog)) 'WhatIf Docker sin backup no debe invocar docker.'

        $dockerBackup = Join-Path $dockerRestoreFixture 'restore.sql'
        Set-Content -LiteralPath $dockerBackup -Value 'fixture-sql' -Encoding ASCII
        $dockerHash = (Get-FileHash -LiteralPath $dockerBackup -Algorithm SHA256).Hash.ToLowerInvariant()

        $dockerWhatIfWithBackup = Invoke-FixtureProcess -ScriptPath $dockerRestoreScript -Arguments ('-BackupFile "{0}" -ExpectedSha256 {1} -UseExistingEnv -WhatIf' -f $dockerBackup, $dockerHash) -PathPrefix $dockerBin
        Assert-ConsoleTest ($dockerWhatIfWithBackup.ExitCode -eq 0) "WhatIf Docker con backup debe salir 0. stderr=$($dockerWhatIfWithBackup.StdErr)"
        Assert-ConsoleTest ($dockerWhatIfWithBackup.StdOut -match '\[RECOVERY_PLAN\]') 'WhatIf Docker con backup debe emitir plan.'
        Assert-ConsoleTest (-not (Test-Path -LiteralPath $dockerLog)) 'WhatIf Docker con backup no debe invocar docker.'
    } finally {
        Remove-Item -LiteralPath $dockerRestoreFixture -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 8) Reconciliacion de correlativos post-restore: cancelar no confirma; la
    #    frase exacta ejecuta el comando real del backend por contenedor.
    $dockerJsonPath = Join-Path $fixtureRoot 'bin\docker-json.txt'
    $consoleDockerLog = Join-Path $fixtureRoot 'bin\docker-calls.log'
    Set-Content -LiteralPath $dockerJsonPath -Value '{"status":"ok","pending":true}' -Encoding ASCII

    $statusPending = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Status'
    Assert-ConsoleTest ($statusPending.ExitCode -eq 0) 'Status con bloqueo pendiente debe salir 0.'
    Assert-ConsoleTest ($statusPending.StdOut -match 'Correlativos:\s+BLOQUEADOS') 'Status debe reportar el bloqueo de correlativos.'

    Remove-Item -LiteralPath $consoleDockerLog -Force -ErrorAction SilentlyContinue
    $reconciliationCancel = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Reconciliation' -InputLines @('C:\evidencia\manifiesto.json', 'evidencia externa revisada', 'soporte tecnico', 'NO')
    Assert-ConsoleTest ($reconciliationCancel.ExitCode -eq 1) 'La frase de reconciliacion incorrecta debe salir con codigo 1.'
    Assert-ConsoleTest ($reconciliationCancel.StdOut -match 'Frase incorrecta') 'La reconciliacion cancelada debe informarse.'
    Assert-ConsoleTest (-not ((Get-Content -LiteralPath $consoleDockerLog -Raw) -match 'restore-reconciliation confirm')) 'Cancelar no debe confirmar la reconciliacion.'

    Remove-Item -LiteralPath $consoleDockerLog -Force -ErrorAction SilentlyContinue
    $reconciliationOk = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'Reconciliation' -InputLines @('C:\evidencia\manifiesto.json', 'evidencia externa revisada', 'soporte tecnico', 'RECONCILIAR')
    Assert-ConsoleTest ($reconciliationOk.ExitCode -eq 0) "La reconciliacion confirmada debe salir 0. stderr=$($reconciliationOk.StdErr)"
    Assert-ConsoleTest ($reconciliationOk.StdOut -match 'Reconciliacion confirmada') 'La reconciliacion debe confirmarse.'
    $reconciliationLog = Get-Content -LiteralPath $consoleDockerLog -Raw
    Assert-ConsoleTest ($reconciliationLog -match 'hospital:restore-reconciliation confirm') 'La reconciliacion debe ejecutarse en el contenedor backend.'
    Assert-ConsoleTest ($reconciliationLog -match '--phrase=RECONCILIAR') 'La reconciliacion debe enviar la frase canonica.'
    Assert-ConsoleTest ($reconciliationLog -match '--authorized-by=') 'La reconciliacion debe registrar quien autoriza.'

    # 9) Reanudar servicio tras un fallo: no libera el bloqueo pendiente.
    Remove-Item -LiteralPath $consoleDockerLog -Force -ErrorAction SilentlyContinue
    $resumeCancel = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'ResumeService' -InputLines @('NO')
    Assert-ConsoleTest ($resumeCancel.ExitCode -eq 1) 'Cancelar la reanudacion debe salir con codigo 1.'
    Assert-ConsoleTest (-not (Test-Path -LiteralPath $consoleDockerLog)) 'Cancelar la reanudacion no debe invocar docker.'

    Remove-Item -LiteralPath $consoleDockerLog -Force -ErrorAction SilentlyContinue
    $resume = Invoke-ConsoleProcess -ProjectRoot $fixtureRoot -Command 'ResumeService' -InputLines @('REANUDAR')
    Assert-ConsoleTest ($resume.ExitCode -eq 0) "La reanudacion confirmada debe salir 0. stderr=$($resume.StdErr)"
    Assert-ConsoleTest ($resume.StdOut -match 'sigue BLOQUEADA') 'La reanudacion debe conservar el bloqueo de correlativos pendiente.'
    $resumeLog = Get-Content -LiteralPath $consoleDockerLog -Raw
    Assert-ConsoleTest ($resumeLog -match 'up -d queue-worker realtime-worker scheduler') 'La reanudacion debe levantar los writers.'
    Assert-ConsoleTest ($resumeLog -match 'hospital:maintenance off') 'La reanudacion debe salir de mantenimiento.'

    Set-Content -LiteralPath $dockerJsonPath -Value '{"status":"success"}' -Encoding ASCII

    Write-Host "Maintenance console process test passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
