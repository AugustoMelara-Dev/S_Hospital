#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$runtimePath = Join-Path $PSScriptRoot 'lib\recovery_runtime.ps1'

if (-not (Test-Path -LiteralPath $runtimePath)) {
    throw "Falta el adaptador de recuperacion: $runtimePath"
}

. $runtimePath

$script:Checks = 0

function Assert-Equal {
    param([object]$Expected, [object]$Actual, [string]$Message)
    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Esperado=[$Expected] Actual=[$Actual]"
    }
}

function Assert-Contains {
    param([object[]]$Values, [object]$Expected, [string]$Message)
    $script:Checks++
    if ($Values -notcontains $Expected) {
        throw "$Message. No se encontro [$Expected] en [$($Values -join ', ')]"
    }
}

$fixtureRoot = Join-Path $env:TEMP "hospital-recovery-runtime-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null

try {
    $dockerRoot = Join-Path $fixtureRoot 'docker'
    New-Item -ItemType Directory -Path $dockerRoot -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dockerRoot 'docker-compose.prod.yml') -Value 'services: {}'
    Set-Content -LiteralPath (Join-Path $dockerRoot '.env') -Value 'COMPOSE_PROJECT_NAME=hospital'

    $dockerRuntime = Resolve-RecoveryRuntime `
        -ProjectRoot $dockerRoot `
        -DockerComposeAvailable $true
    Assert-Equal 'Docker' $dockerRuntime.Mode 'Debe detectar instalacion Docker completa'
    Assert-Equal 0 $dockerRuntime.Blockers.Count 'Docker completo no debe tener bloqueos'
    Assert-Equal (Join-Path $dockerRoot 'docker-compose.prod.yml') $dockerRuntime.ComposeFile 'Debe resolver compose productivo'

    $bareRoot = Join-Path $fixtureRoot 'bare'
    $bareBackend = Join-Path $bareRoot 'backend'
    $bareBin = Join-Path $bareRoot 'bin'
    New-Item -ItemType Directory -Path $bareBackend -Force | Out-Null
    New-Item -ItemType Directory -Path $bareBin -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $bareBackend 'artisan') -Value '<?php'
    $phpPath = Join-Path $bareBin 'php.exe'
    $mysqlPath = Join-Path $bareBin 'mysql.exe'
    Set-Content -LiteralPath $phpPath -Value ''
    Set-Content -LiteralPath $mysqlPath -Value ''

    $bareRuntime = Resolve-RecoveryRuntime `
        -ProjectRoot $bareRoot `
        -DockerComposeAvailable $false `
        -PhpPath $phpPath `
        -MySqlPath $mysqlPath
    Assert-Equal 'BareMetal' $bareRuntime.Mode 'Debe detectar instalacion Windows completa'
    Assert-Equal 0 $bareRuntime.Blockers.Count 'Bare metal completo no debe tener bloqueos'
    Assert-Equal $phpPath $bareRuntime.PhpPath 'Debe conservar PHP resuelto'
    Assert-Equal $mysqlPath $bareRuntime.MySqlPath 'Debe conservar MySQL resuelto'

    Set-Content -LiteralPath (Join-Path $bareRoot 'docker-compose.prod.yml') -Value 'services: {}'
    Set-Content -LiteralPath (Join-Path $bareRoot '.env') -Value 'COMPOSE_PROJECT_NAME=hospital'
    $ambiguous = Resolve-RecoveryRuntime `
        -ProjectRoot $bareRoot `
        -DockerComposeAvailable $true `
        -PhpPath $phpPath `
        -MySqlPath $mysqlPath
    Assert-Equal $null $ambiguous.Mode 'No debe adivinar entre dos runtimes completos'
    Assert-Contains $ambiguous.Blockers.Code 'AMBIGUOUS_RUNTIME' 'Debe bloquear layout ambiguo'

    $incompleteRoot = Join-Path $fixtureRoot 'incomplete'
    New-Item -ItemType Directory -Path $incompleteRoot -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $incompleteRoot 'docker-compose.prod.yml') -Value 'services: {}'
    $incomplete = Resolve-RecoveryRuntime `
        -ProjectRoot $incompleteRoot `
        -DockerComposeAvailable $true
    Assert-Equal $null $incomplete.Mode 'No debe aceptar layout incompleto'
    Assert-Contains $incomplete.Blockers.Code 'RUNTIME_INCOMPLETE' 'Debe explicar runtime incompleto'

    $script:Invocations = @()
    $fakeInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        $script:Invocations += [pscustomobject]@{
            FilePath = $FilePath
            Arguments = @($Arguments)
        }
        return 0
    }

    Invoke-HospitalCommand `
        -Runtime $dockerRuntime `
        -Arguments @('migrate', '--force') `
        -Invoker $fakeInvoker | Out-Null
    Assert-Equal 'docker' $script:Invocations[0].FilePath 'Docker debe usar el binario docker'
    Assert-Contains $script:Invocations[0].Arguments 'backend' 'Docker debe ejecutar en backend'
    Assert-Contains $script:Invocations[0].Arguments 'migrate' 'Docker debe pasar argumentos artisan'

    Invoke-HospitalCommand `
        -Runtime $bareRuntime `
        -Arguments @('up') `
        -Invoker $fakeInvoker | Out-Null
    Assert-Equal $phpPath $script:Invocations[1].FilePath 'Bare metal debe usar PHP resuelto'
    Assert-Contains $script:Invocations[1].Arguments (Join-Path $bareRoot 'backend\artisan') 'Bare metal debe usar artisan local'
    Assert-Contains $script:Invocations[1].Arguments 'up' 'Bare metal debe pasar argumentos artisan'

    Assert-Equal $true $dockerRuntime.DockerReady 'Docker completo debe marcar DockerReady'
    Assert-Equal $false $dockerRuntime.BareReady 'Docker completo no debe marcar BareReady'
    Assert-Equal $true $bareRuntime.BareReady 'Bare metal completo debe marcar BareReady'
    Assert-Equal $false $bareRuntime.DockerReady 'Bare metal no debe marcar DockerReady'

    Assert-Equal 'RESTAURAR' (Get-RecoveryActionConfirmation) 'La frase canonica debe ser RESTAURAR'
    Assert-Equal $true (Test-RecoveryActionConfirmation -Value 'RESTAURAR') 'La frase exacta debe validar'
    Assert-Equal $false (Test-RecoveryActionConfirmation -Value 'RESTAURAR PRODUCCION') 'La frase vieja de la consola no debe validar'
    Assert-Equal $false (Test-RecoveryActionConfirmation -Value 'restaurar') 'La validacion debe distinguir mayusculas'

    Assert-Equal $true (Test-RecoveryDisposableTargetDatabase -Database 'hospital_billing_test') 'El destino por defecto debe validar'
    Assert-Equal $true (Test-RecoveryDisposableTargetDatabase -Database 'hospital_billing_test_1700000000') 'El destino prefijado debe validar'
    foreach ($forbiddenTarget in @('hospital_billing', 'mysql', 'hospital_billing_prod', 'hospital_billing_testx', 'hospital_restore_validation')) {
        Assert-Equal $false (Test-RecoveryDisposableTargetDatabase -Database $forbiddenTarget) "El destino $forbiddenTarget no debe validar en la consola"
    }

    $script:Invocations = @()
    Stop-HospitalWriters -Runtime $dockerRuntime -Invoker $fakeInvoker | Out-Null
    Assert-Equal 'docker' $script:Invocations[0].FilePath 'Docker debe detener writers con el binario docker'
    Assert-Contains $script:Invocations[0].Arguments 'queue-worker' 'Debe detener queue-worker'
    Assert-Contains $script:Invocations[0].Arguments 'realtime-worker' 'Debe detener realtime-worker'
    Assert-Contains $script:Invocations[0].Arguments 'scheduler' 'Debe detener scheduler'
    Assert-Equal $false ($script:Invocations[0].Arguments -contains 'queue') 'No debe usar el nombre de servicio obsoleto queue'

    $script:Invocations = @()
    Start-HospitalWriters -Runtime $dockerRuntime -Invoker $fakeInvoker | Out-Null
    Assert-Equal 'docker' $script:Invocations[0].FilePath 'Docker debe arrancar writers con el binario docker'
    Assert-Contains $script:Invocations[0].Arguments 'up' 'Debe reanudar servicios'
    Assert-Contains $script:Invocations[0].Arguments 'queue-worker' 'Debe arrancar queue-worker'
    Assert-Contains $script:Invocations[0].Arguments 'realtime-worker' 'Debe arrancar realtime-worker'
    Assert-Contains $script:Invocations[0].Arguments 'scheduler' 'Debe arrancar scheduler'

    $script:OutputInvocations = @()
    $outputInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        $script:OutputInvocations += [pscustomobject]@{
            FilePath = $FilePath
            Arguments = @($Arguments)
        }
        return [pscustomobject]@{
            ExitCode = 0
            Output = @('{"status":"success"}')
        }
    }

    $dockerOutput = Invoke-HospitalCommandOutput `
        -Runtime $dockerRuntime `
        -Arguments @('hospital:backup', '--type=manual', '--json') `
        -Invoker $outputInvoker
    Assert-Equal 'docker' $script:OutputInvocations[0].FilePath 'La salida Docker debe usar el binario docker'
    Assert-Contains $script:OutputInvocations[0].Arguments 'backend' 'La salida Docker debe ejecutar en backend'
    Assert-Contains $script:OutputInvocations[0].Arguments 'hospital:backup' 'La salida Docker debe pasar el comando artisan'
    Assert-Equal '{"status":"success"}' $dockerOutput.Output[0] 'La salida debe conservar el JSON del contenedor'

    $bareOutput = Invoke-HospitalCommandOutput `
        -Runtime $bareRuntime `
        -Arguments @('about') `
        -Invoker $outputInvoker
    Assert-Equal $phpPath $script:OutputInvocations[1].FilePath 'La salida bare metal debe usar PHP resuelto'
    Assert-Contains $script:OutputInvocations[1].Arguments (Join-Path $bareRoot 'backend\artisan') 'La salida bare metal debe usar artisan local'

    # HS-RESTORE-SEQUENCE: bloqueo de correlativos y reanudacion de servicio.
    Assert-Equal 'hospital:restore-reconciliation' (Get-RestoreReconciliationCommandName) 'El comando de reconciliacion debe ser el del backend'
    Assert-Equal 'RECONCILIAR' (Get-RecoveryReconciliationConfirmPhrase) 'La frase de reconciliacion debe ser RECONCILIAR'
    Assert-Equal $true (Test-RecoveryReconciliationConfirmPhrase -Value 'RECONCILIAR') 'La frase exacta de reconciliacion debe validar'
    Assert-Equal $false (Test-RecoveryReconciliationConfirmPhrase -Value 'reconciliar') 'La frase de reconciliacion distingue mayusculas'
    Assert-Equal 'REANUDAR' (Get-RecoveryResumeConfirmation) 'La frase de reanudacion debe ser REANUDAR'
    Assert-Equal $true (Test-RecoveryResumeConfirmation -Value 'REANUDAR') 'La frase exacta de reanudacion debe validar'
    Assert-Equal $false (Test-RecoveryResumeConfirmation -Value 'REANUDAR SERVICIO') 'La frase vieja no debe validar'
    Assert-Equal $true ((Get-RecoveryReconciliationReason).Length -ge 5) 'El motivo del bloqueo debe ser verificable'

    $script:SequenceInvocations = @()
    $sequenceInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        $script:SequenceInvocations += [pscustomobject]@{ FilePath = $FilePath; Arguments = @($Arguments) }
        return 0
    }

    Start-RestoreReconciliation -Runtime $dockerRuntime -Invoker $sequenceInvoker | Out-Null
    Assert-Equal 'docker' $script:SequenceInvocations[0].FilePath 'El bloqueo de correlativos debe usar el binario docker'
    Assert-Contains $script:SequenceInvocations[0].Arguments 'start' 'El bloqueo debe invocar la accion start'
    Assert-Contains $script:SequenceInvocations[0].Arguments '--json' 'El bloqueo debe pedir JSON'
    $reasonArgument = @($script:SequenceInvocations[0].Arguments | Where-Object { $_ -like '--reason=*' })
    Assert-Equal 1 $reasonArgument.Count 'El bloqueo debe declarar un motivo verificable'

    $script:StateInvocations = @()
    $pendingOutputInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        $script:StateInvocations += [pscustomobject]@{ FilePath = $FilePath; Arguments = @($Arguments) }
        return [pscustomobject]@{
            ExitCode = 0
            Output = @('{"status":"ok","pending":true,"max_invoice_number":{"current_number":10}}')
        }
    }
    $pendingState = Get-RestoreReconciliationState -Runtime $dockerRuntime -OutputInvoker $pendingOutputInvoker
    Assert-Equal $true $pendingState.Ok 'El estado pendiente debe leerse'
    Assert-Equal $true $pendingState.Pending 'El estado pendiente debe reportarse'
    Assert-Contains $script:StateInvocations[0].Arguments 'status' 'El estado debe invocar la accion status'
    Assert-Contains $script:StateInvocations[0].Arguments '--json' 'El estado debe pedir JSON'

    $cleanOutputInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        return [pscustomobject]@{ ExitCode = 0; Output = @('{"status":"ok","pending":false}') }
    }
    $cleanState = Get-RestoreReconciliationState -Runtime $dockerRuntime -OutputInvoker $cleanOutputInvoker
    Assert-Equal $false $cleanState.Pending 'Sin marcador no debe reportarse pendiente'

    $unparseableOutputInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        return [pscustomobject]@{ ExitCode = 0; Output = @('salida no estructurada') }
    }
    $unparseableState = Get-RestoreReconciliationState -Runtime $dockerRuntime -OutputInvoker $unparseableOutputInvoker
    Assert-Equal $false $unparseableState.Ok 'Sin JSON verificable el estado no debe darse por bueno'

    $script:ResumeInvocations = @()
    $resumeInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        $script:ResumeInvocations += (@($Arguments) -join ' ')
        return 0
    }
    $resume = Resume-HospitalOperations -Runtime $dockerRuntime -Invoker $resumeInvoker -StateOutputInvoker $cleanOutputInvoker
    Assert-Equal $true $resume.Resumed 'La reanudacion de servicio debe completar'
    Assert-Equal $false $resume.ReconciliationPending 'Sin bloqueo pendiente la reanudacion libera emision'
    Assert-Equal 2 $script:ResumeInvocations.Count 'La reanudacion debe ejecutar writers y salir de mantenimiento'
    Assert-Equal $true ($script:ResumeInvocations[0] -match 'up -d queue-worker') 'Primero debe reabrir writers'
    Assert-Equal $true ($script:ResumeInvocations[1] -match 'hospital:maintenance off') 'Despues debe salir de mantenimiento'

    $pendingResume = Resume-HospitalOperations -Runtime $dockerRuntime -Invoker $resumeInvoker -StateOutputInvoker $pendingOutputInvoker
    Assert-Equal $true $pendingResume.ReconciliationPending 'La reanudacion debe conservar el bloqueo de correlativos'

    $script:ResumeCallsWhileBlocked = @()
    $brokenStateInvoker = {
        param([string]$FilePath, [string[]]$Arguments)
        return [pscustomobject]@{ ExitCode = 1; Output = @() }
    }
    $resumeBlocked = $false
    try {
        Resume-HospitalOperations `
            -Runtime $dockerRuntime `
            -Invoker {
                param([string]$FilePath, [string[]]$Arguments)
                $script:ResumeCallsWhileBlocked += (@($Arguments) -join ' ')
                return 0
            } `
            -StateOutputInvoker $brokenStateInvoker | Out-Null
    } catch {
        $resumeBlocked = $true
    }
    Assert-Equal $true $resumeBlocked 'Sin base verificable no se reanuda el servicio'
    Assert-Equal 0 $script:ResumeCallsWhileBlocked.Count 'No debe reabrir writers si la base no responde'
} finally {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Recovery runtime self-test passed: $script:Checks checks."
exit 0
