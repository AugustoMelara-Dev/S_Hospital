#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$maintenanceScript = Join-Path $PSScriptRoot 'maintenance_hospital_windows.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-audit-maintenance-' + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $testRoot 'Hospital'
$recoveryRuntimeStub = Join-Path $PSScriptRoot 'lib\recovery_runtime.ps1'
$recoveryValidationStub = Join-Path $PSScriptRoot 'lib\recovery_validation.ps1'
$recoveryDockerStub = Join-Path $PSScriptRoot 'lib\recovery_docker.ps1'
$recoveryContractStub = Join-Path $PSScriptRoot 'lib\recovery_contract.ps1'
$recoveryOrchestratorStub = Join-Path $PSScriptRoot 'lib\recovery_orchestrator.ps1'

$script:Checks = 0
$script:Errors = @()

function Assert-MaintenanceAuditTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

try {
    Assert-MaintenanceAuditTest (Test-Path -LiteralPath $maintenanceScript) 'Debe existir scripts\maintenance_hospital_windows.ps1 como consola de mantenimiento.'

    if (Test-Path -LiteralPath $maintenanceScript) {
        $source = Get-Content -LiteralPath $maintenanceScript -Raw

        foreach ($expectedFunction in @(
            'Show-MaintenanceStatus',
            'New-MaintenanceBackup',
            'Test-MaintenanceBackup',
            'Invoke-DisposableRestore',
            'Invoke-ProductionRecovery',
            'Show-MaintenanceLogs',
        )) {
            Assert-MaintenanceAuditTest ($source -match "function\s+$([regex]::Escape($expectedFunction))\b") "Debe existir la funcion $expectedFunction en la consola de mantenimiento."
        }

        Assert-MaintenanceAuditTest ($source -match 'docker compose') 'La consola de mantenimiento debe usar el adaptador Docker, no depender de mysql.exe del host.'
        Assert-MaintenanceAuditTest ($source -notmatch 'mysql\.exe') 'La consola de mantenimiento NO debe depender de mysql.exe del host para distribuciones Docker.'
        Assert-MaintenanceAuditTest ($source -match 'NoCloseOnError|Read-Host|Pause') 'La consola de mantenimiento debe permanecer abierta en caso de error para mostrar el mensaje.'
    }

    if ($script:Errors.Count -gt 0) {
        Write-Host ('Maintenance console audit found {0} failing assertions:' -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ('  - {0}' -f $err) -ForegroundColor Red
        }
        throw 'Maintenance console audit failed.'
    }

    Write-Host "Maintenance console audit passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
