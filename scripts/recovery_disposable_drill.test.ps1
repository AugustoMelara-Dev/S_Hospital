#Requires -Version 5.1
# Contrato del drill de restauracion descartable. No requiere daemon Docker:
# usa un docker.cmd de fixture y valida plan, guardas y limpieza acotada.
# No ejecuta restores reales ni toca bases de datos.

$ErrorActionPreference = 'Stop'

$drillScript = Join-Path $PSScriptRoot 'recovery_disposable_drill.ps1'
$libraryRoot = Join-Path $PSScriptRoot 'lib'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-drill-' + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $testRoot 'Hospital'
$script:Checks = 0

function Assert-DrillTest {
    param([bool]$Condition, [string]$Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

function Invoke-DrillProcess {
    param(
        [string]$ScriptPath,
        [string[]]$Arguments,
        [string]$PathPrefix = ''
    )

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = Join-Path $PSHOME 'powershell.exe'
    $processInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "{0}" {1}' -f $ScriptPath, ($Arguments -join ' ')
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    if (-not [string]::IsNullOrWhiteSpace($PathPrefix)) {
        $processInfo.EnvironmentVariables['PATH'] = $PathPrefix + ';' + $processInfo.EnvironmentVariables['PATH']
    }

    $process = [System.Diagnostics.Process]::Start($processInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $process.Dispose()

    return [pscustomobject]@{
        ExitCode = $exitCode
        StdOut = $stdout
        StdErr = $stderr
    }
}

try {
    $libs = Join-Path $projectRoot 'scripts\lib'
    $bin = Join-Path $projectRoot 'bin'
    New-Item -ItemType Directory -Path $libs -Force | Out-Null
    New-Item -ItemType Directory -Path $bin -Force | Out-Null
    foreach ($library in @('recovery_contract.ps1', 'recovery_runtime.ps1', 'recovery_validation.ps1', 'recovery_docker.ps1')) {
        Copy-Item -LiteralPath (Join-Path $libraryRoot $library) -Destination (Join-Path $libs $library) -Force
    }
    Set-Content -LiteralPath (Join-Path $projectRoot 'docker-compose.prod.yml') -Value 'services: {}' -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $projectRoot '.env') -Value 'DB_DATABASE=hospital_billing' -Encoding ASCII

    $dockerStub = @'
@echo off
echo %*>> "%~dp0docker-calls.log"
exit /b %HOSPITAL_FAKE_DOCKER_EXIT%
'@
    Set-Content -LiteralPath (Join-Path $bin 'docker.cmd') -Value $dockerStub -Encoding ASCII

    # 1) Guarda: el destino debe ser descartable.
    $unsafe = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-TargetDatabase', 'hospital_billing', '-Plan') -PathPrefix $bin
    Assert-DrillTest ($unsafe.ExitCode -eq 1) 'Un destino productivo debe rechazarse con codigo 1.'
    Assert-DrillTest ($unsafe.StdOut -match 'no es una base descartable') 'La guarda debe explicar el destino inseguro.'

    # 2) Plan con daemon disponible: recurso unico, sin escrituras ni docker de importacion.
    $env:HOSPITAL_FAKE_DOCKER_EXIT = '0'
    Remove-Item -LiteralPath (Join-Path $bin 'docker-calls.log') -Force -ErrorAction SilentlyContinue
    $planA = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-Plan', '-TargetDatabase', 'hospital_billing_test_plan_a') -PathPrefix $bin
    Assert-DrillTest ($planA.ExitCode -eq 0) "El plan con daemon debe salir 0. stdout=$($planA.StdOut) stderr=$($planA.StdErr)"
    Assert-DrillTest ($planA.StdOut -match '\[RECOVERY_DRILL_PLAN\]') 'El plan debe emitir su contrato.'
    Assert-DrillTest ($planA.StdOut -match '"TargetDatabase":"hospital_billing_test_plan_a"') 'El plan debe conservar el destino indicado.'
    Assert-DrillTest ($planA.StdOut -match '"DockerDaemonAvailable":true') 'El plan debe declarar el daemon detectado.'
    Assert-DrillTest ($planA.StdOut -match '"WritesPerformed":false') 'El plan no debe escribir.'
    Assert-DrillTest ($planA.StdOut -match '"ProductionWrites":"none"') 'El plan no debe prometer escrituras a produccion.'
    Assert-DrillTest ($planA.StdOut -match 'DROP DATABASE IF EXISTS') 'El plan debe declarar la limpieza acotada.'
    $planCalls = Get-Content -LiteralPath (Join-Path $bin 'docker-calls.log') -Raw
    Assert-DrillTest (-not ($planCalls -match '\bcp\b')) 'El plan no debe copiar paquetes.'
    Assert-DrillTest (-not ($planCalls -match 'DROP DATABASE')) 'El plan no debe limpiar bases.'
    Assert-DrillTest (-not ($planCalls -match 'decrypt-backup')) 'El plan no debe descifrar.'

    # 3) El destino por defecto es unico por corrida.
    $planUniqueOne = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-Plan') -PathPrefix $bin
    Start-Sleep -Seconds 1
    $planUniqueTwo = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-Plan') -PathPrefix $bin
    $targetOne = [regex]::Match($planUniqueOne.StdOut, '"TargetDatabase":"(?<db>[^"]+)"').Groups['db'].Value
    $targetTwo = [regex]::Match($planUniqueTwo.StdOut, '"TargetDatabase":"(?<db>[^"]+)"').Groups['db'].Value
    Assert-DrillTest ($targetOne -like 'hospital_billing_test_*') 'El destino por defecto debe usar el prefijo descartable.'
    Assert-DrillTest ($targetOne -ne $targetTwo) 'Dos corridas no deben compartir el mismo recurso descartable.'

    # 4) Sin daemon: BLOQUEADO_EXTERNO con plan, sin escrituras.
    $env:HOSPITAL_FAKE_DOCKER_EXIT = '1'
    Remove-Item -LiteralPath (Join-Path $bin 'docker-calls.log') -Force -ErrorAction SilentlyContinue
    $blocked = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-Plan') -PathPrefix $bin
    Assert-DrillTest ($blocked.ExitCode -eq 3) 'Sin daemon el drill debe declararse BLOQUEADO_EXTERNO (exit 3).'
    Assert-DrillTest ($blocked.StdOut -match 'BLOQUEADO_EXTERNO') 'La salida debe declarar el bloqueo externo.'
    Assert-DrillTest ($blocked.StdOut -match '"DockerDaemonAvailable":false') 'El plan debe reportar el daemon no disponible.'

    $env:HOSPITAL_FAKE_DOCKER_EXIT = '0'

    # 5) Sin daemon el drill real ni siquiera intenta importar.
    $env:HOSPITAL_FAKE_DOCKER_EXIT = '1'
    $blockedReal = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-BackupFile', ('"{0}"' -f (Join-Path $projectRoot 'noexiste.sql')), '-ExpectedSha256', ('a' * 64)) -PathPrefix $bin
    Assert-DrillTest ($blockedReal.ExitCode -eq 3) 'El drill real sin daemon debe ser BLOQUEADO_EXTERNO.'
    Assert-DrillTest (-not ($blockedReal.StdOut -match 'decrypt-backup')) 'El bloqueo externo no debe descifrar.'
    $env:HOSPITAL_FAKE_DOCKER_EXIT = '0'

    # 6) Limpieza acotada: solo elimina la base descartable indicada.
    $cleanupRunner = Join-Path $projectRoot 'run-cleanup.ps1'
    $cleanupSource = @'
param([string]$Database)
. (Join-Path $PSScriptRoot 'scripts\lib\recovery_contract.ps1')
. (Join-Path $PSScriptRoot 'scripts\lib\recovery_runtime.ps1')
. (Join-Path $PSScriptRoot 'scripts\lib\recovery_validation.ps1')
. (Join-Path $PSScriptRoot 'scripts\lib\recovery_docker.ps1')
Remove-DockerDisposableDatabase -ProjectRoot $PSScriptRoot -Database $Database | Out-Null
exit 0
'@
    Set-Content -LiteralPath $cleanupRunner -Value $cleanupSource -Encoding ASCII
    Remove-Item -LiteralPath (Join-Path $bin 'docker-calls.log') -Force -ErrorAction SilentlyContinue
    $cleanup = Invoke-DrillProcess -ScriptPath $cleanupRunner -Arguments @('-Database', 'hospital_billing_test_cleanup_proof') -PathPrefix $bin
    Assert-DrillTest ($cleanup.ExitCode -eq 0) "La limpieza acotada debe completar. stderr=$($cleanup.StdErr)"
    $cleanupCalls = Get-Content -LiteralPath (Join-Path $bin 'docker-calls.log') -Raw
    Assert-DrillTest ($cleanupCalls -match 'DROP DATABASE IF EXISTS `hospital_billing_test_cleanup_proof`') 'La limpieza debe eliminar solo el recurso de prueba.'
    Assert-DrillTest (-not ($cleanupCalls -match 'DROP DATABASE IF EXISTS `hospital_billing`;')) 'La limpieza no debe tocar la base productiva.'
    Assert-DrillTest (-not ($cleanupCalls -match 'DROP DATABASE IF EXISTS ``hospital_billing``')) 'La limpieza no debe tocar la base productiva (comillas escapadas).'

    $cleanupRejected = Invoke-DrillProcess -ScriptPath $cleanupRunner -Arguments @('-Database', 'hospital_billing') -PathPrefix $bin
    Assert-DrillTest ($cleanupRejected.ExitCode -eq 1) 'La limpieza debe rechazar la base productiva.'

    # 7) Guarda anti-colision con la base productiva configurada.
    $collision = Invoke-DrillProcess -ScriptPath $drillScript -Arguments @('-ProjectRoot', ('"{0}"' -f $projectRoot), '-TargetDatabase', 'hospital_billing_test_x', '-Plan') -PathPrefix $bin
    Assert-DrillTest ($collision.ExitCode -eq 0) 'Un destino descartable con prefijo valido debe planificar.'

    Write-Host "Disposable recovery drill self-test passed: $script:Checks checks."
} finally {
    Remove-Item Env:\HOSPITAL_FAKE_DOCKER_EXIT -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
