#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$maintenanceScript = Join-Path $PSScriptRoot 'maintenance_hospital_windows.ps1'
$restoreScript = Join-Path $PSScriptRoot 'restore_hospital_windows.ps1'
$runtimeLibrary = Join-Path $PSScriptRoot 'lib\recovery_runtime.ps1'
$dockerLibrary = Join-Path $PSScriptRoot 'lib\recovery_docker.ps1'

$script:Checks = 0
$script:Errors = @()

function Assert-MaintenanceAuditTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

function Get-CommandAsts {
    param([System.Management.Automation.Language.Ast] $Ast)
    return @($Ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true))
}

function Get-RestoreCallParameters {
    param([System.Management.Automation.Language.Ast] $Ast)

    $calls = @()
    foreach ($command in (Get-CommandAsts -Ast $Ast)) {
        $first = $command.CommandElements[0]
        if ($first -is [System.Management.Automation.Language.VariableExpressionAst] -and
            $first.VariablePath.UserPath -eq 'restoreScript') {
            $parameters = @($command.CommandElements |
                Where-Object { $_ -is [System.Management.Automation.Language.CommandParameterAst] } |
                ForEach-Object { $_.ParameterName })
            $calls += ,$parameters
        }
    }

    return @($calls)
}

function Get-InvokedCommandNames {
    param([System.Management.Automation.Language.Ast] $Ast)

    $names = @()
    foreach ($command in (Get-CommandAsts -Ast $Ast)) {
        $first = $command.CommandElements[0]
        if ($first -is [System.Management.Automation.Language.VariableExpressionAst]) {
            $names += $first.VariablePath.UserPath
        } elseif ($first -is [System.Management.Automation.Language.StringConstantExpressionAst]) {
            $names += $first.Value
        } elseif ($null -ne $command.GetCommandName()) {
            $names += $command.GetCommandName()
        }
    }

    return @($names)
}

function Get-StringConstants {
    param([System.Management.Automation.Language.Ast] $Ast)

    return @($Ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.StringConstantExpressionAst]
    }, $true) | ForEach-Object { $_.Value })
}

function Assert-ParsesClean {
    param([string] $Path, [string] $Label)

    $tokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref] $tokens, [ref] $parseErrors)
    Assert-MaintenanceAuditTest ($parseErrors.Count -eq 0) "$Label no debe tener errores de parseo: $($parseErrors | ForEach-Object { $_.Message } | Select-Object -First 1)"
}

Assert-ParsesClean -Path $maintenanceScript -Label 'maintenance_hospital_windows.ps1'
Assert-ParsesClean -Path $restoreScript -Label 'restore_hospital_windows.ps1'
Assert-ParsesClean -Path $runtimeLibrary -Label 'recovery_runtime.ps1'
    Assert-ParsesClean -Path $dockerLibrary -Label 'recovery_docker.ps1'

    Assert-MaintenanceAuditTest (Test-Path -LiteralPath $maintenanceScript) 'Debe existir scripts\maintenance_hospital_windows.ps1 como consola de mantenimiento.'

    if (Test-Path -LiteralPath $maintenanceScript) {
        $source = Get-Content -LiteralPath $maintenanceScript -Raw

        foreach ($expectedFunction in @(
            'Show-MaintenanceStatus',
            'New-MaintenanceBackup',
            'Test-MaintenanceBackup',
            'Invoke-DisposableRestore',
            'Invoke-ProductionRecovery',
            'Show-SequenceReconciliation',
            'Restore-HospitalService',
            'Show-MaintenanceLogs'
        )) {
            $escapedName = [regex]::Escape($expectedFunction)
            $pattern = 'function\s+' + $escapedName + '\b'
            Assert-MaintenanceAuditTest ($source -match $pattern) "Debe existir la funcion $expectedFunction en la consola de mantenimiento."
        }

        Assert-MaintenanceAuditTest (-not ($source -match 'RESTAURAR PRODUCCION')) 'La consola no debe conservar la frase vieja RESTAURAR PRODUCCION.'
        Assert-MaintenanceAuditTest (-not ($source -match 'WhatIfOnly')) 'La consola no debe enviar -WhatIfOnly.'
        Assert-MaintenanceAuditTest (-not [bool]($source -match 'mysql\.exe[^a-z]')) 'La consola de mantenimiento NO debe depender de mysql.exe del host.'
        Assert-MaintenanceAuditTest ($source -match 'Read-Host') 'La consola de mantenimiento debe permanecer abierta en caso de error para mostrar el mensaje.'
        Assert-MaintenanceAuditTest ($source -match "'Reconciliation'") 'La consola debe exponer el comando Reconciliation.'
        Assert-MaintenanceAuditTest ($source -match "'ResumeService'") 'La consola debe exponer el comando ResumeService.'
        Assert-MaintenanceAuditTest (-not ($source -match 'hospital:restore-reconciliation')) 'La consola no debe reimplementar el nombre del comando de reconciliacion.'

        $tokens = $null
        $parseErrors = $null
        $consoleAst = [System.Management.Automation.Language.Parser]::ParseFile($maintenanceScript, [ref] $tokens, [ref] $parseErrors)

        Assert-MaintenanceAuditTest ($parseErrors.Count -eq 0) 'La consola debe parsear sin errores.'

        $prerequisiteFunctions = @($consoleAst.FindAll({
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
            $node.Name -eq 'Test-MaintenancePrerequisites'
        }, $true))
        Assert-MaintenanceAuditTest ($prerequisiteFunctions.Count -eq 1) 'Debe existir la funcion Test-MaintenancePrerequisites.'
        if ($prerequisiteFunctions.Count -eq 1) {
            Assert-MaintenanceAuditTest (-not ($prerequisiteFunctions[0].Extent.Text -match 'backend\\artisan')) 'Los prerrequisitos no deben exigir backend\artisan del host.'
        }

        $hostPhpCommands = @(Get-CommandAsts -Ast $consoleAst | Where-Object {
            $_.GetCommandName() -eq 'php' -or $_.GetCommandName() -eq 'php.exe'
        })
        Assert-MaintenanceAuditTest ($hostPhpCommands.Count -eq 0) 'La consola no debe invocar php del host como comando directo.'

        $consoleCommandNames = Get-InvokedCommandNames -Ast $consoleAst
        foreach ($requiredConsoleCommand in @(
            'Invoke-HospitalCommandOutput',
            'Resolve-RecoveryRuntime',
            'Get-RecoveryActionConfirmation',
            'Test-RecoveryActionConfirmation',
            'Get-RecoveryDefaultDisposableDatabase',
            'Test-RecoveryDisposableTargetDatabase',
            'Get-RestoreReconciliationState',
            'Confirm-RestoreReconciliation',
            'Resume-HospitalOperations',
            'Test-RecoveryReconciliationConfirmPhrase',
            'Test-RecoveryResumeConfirmation'
        )) {
            Assert-MaintenanceAuditTest ($consoleCommandNames -contains $requiredConsoleCommand) "La consola debe invocar $requiredConsoleCommand en codigo, no solo mencionarlo."
        }

        $restoreTokens = $null
        $restoreErrors = $null
        $restoreAst = [System.Management.Automation.Language.Parser]::ParseFile($restoreScript, [ref] $restoreTokens, [ref] $restoreErrors)
        $restoreParameterNames = @($restoreAst.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })

        $restoreCalls = Get-RestoreCallParameters -Ast $consoleAst
        Assert-MaintenanceAuditTest ($restoreCalls.Count -eq 2) 'La consola debe invocar restore en los flujos descartable y productivo.'
        foreach ($call in $restoreCalls) {
            foreach ($passedParameter in $call) {
                Assert-MaintenanceAuditTest ($restoreParameterNames -contains $passedParameter) "La consola envia al restore el parametro inexistente -$passedParameter."
            }
            Assert-MaintenanceAuditTest (-not ($call -contains 'ProjectRoot')) 'La consola no debe enviar -ProjectRoot al restore.'
            Assert-MaintenanceAuditTest (-not ($call -contains 'WhatIfOnly')) 'La consola no debe enviar -WhatIfOnly al restore.'
            Assert-MaintenanceAuditTest ($call -contains 'BackupFile') 'Toda invocacion de restore debe declarar -BackupFile.'
            Assert-MaintenanceAuditTest ($call -contains 'ExpectedSha256') 'Toda invocacion de restore debe declarar -ExpectedSha256.'
        }

        $dockerTokens = $null
        $dockerErrors = $null
        $dockerAst = [System.Management.Automation.Language.Parser]::ParseFile($dockerLibrary, [ref] $dockerTokens, [ref] $dockerErrors)
        Assert-MaintenanceAuditTest ($dockerErrors.Count -eq 0) 'recovery_docker.ps1 debe parsear sin errores.'
        $dockerCommandNames = Get-InvokedCommandNames -Ast $dockerAst
        foreach ($runtimeHelper in @(
            'Enter-HospitalMaintenance',
            'Exit-HospitalMaintenance',
            'Stop-HospitalWriters',
            'Start-HospitalWriters',
            'Start-RestoreReconciliation',
            'Test-RecoveryDockerDaemonAvailable',
            'Get-DockerDatabaseIntegrity',
            'Get-DockerDatabaseFingerprint',
            'Test-RecoveryFingerprintUnchanged'
        )) {
            Assert-MaintenanceAuditTest ($dockerCommandNames -contains $runtimeHelper) "recovery_docker debe usar el helper real $runtimeHelper en el camino de produccion."
        }
        Assert-MaintenanceAuditTest ((Get-Content -LiteralPath $dockerLibrary -Raw) -match 'function\s+Remove-DockerDisposableDatabase\b') 'recovery_docker debe definir la limpieza acotada de la base descartable.'
        $dockerStringConstants = Get-StringConstants -Ast $dockerAst
        foreach ($serviceName in @('queue-worker', 'realtime-worker', 'scheduler')) {
            Assert-MaintenanceAuditTest ($dockerStringConstants -notcontains $serviceName) "recovery_docker no debe reimplementar el nombre de servicio $serviceName."
        }
        Assert-MaintenanceAuditTest ($dockerStringConstants -notcontains 'hospital:restore-reconciliation') 'recovery_docker no debe reimplementar el comando de reconciliacion.'

        $runtimeTokens = $null
        $runtimeErrors = $null
        $runtimeAst = [System.Management.Automation.Language.Parser]::ParseFile($runtimeLibrary, [ref] $runtimeTokens, [ref] $runtimeErrors)
        $runtimeStringConstants = Get-StringConstants -Ast $runtimeAst
        foreach ($serviceName in @('queue-worker', 'realtime-worker', 'scheduler')) {
            Assert-MaintenanceAuditTest ($runtimeStringConstants -contains $serviceName) "recovery_runtime debe ser el dueno unico del nombre de servicio $serviceName."
        }
        Assert-MaintenanceAuditTest ($runtimeStringConstants -contains 'hospital:restore-reconciliation') 'recovery_runtime debe ser el dueno unico del comando de reconciliacion.'
        Assert-MaintenanceAuditTest ($runtimeStringConstants -contains 'RECONCILIAR') 'recovery_runtime debe ser el dueno unico de la frase de reconciliacion.'
        Assert-MaintenanceAuditTest ($runtimeStringConstants -contains 'REANUDAR') 'recovery_runtime debe ser el dueno unico de la frase de reanudacion.'
    }

    if ($script:Errors.Count -gt 0) {
        Write-Host ('Maintenance console audit found {0} failing assertions:' -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ('  - {0}' -f $err) -ForegroundColor Red
        }
        throw 'Maintenance console audit failed.'
    }

    Write-Host "Maintenance console audit passed: $script:Checks checks."
