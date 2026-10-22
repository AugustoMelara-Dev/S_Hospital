#Requires -Version 5.1
<#
.SYNOPSIS
    Consola de mantenimiento de S_Hospital.

.DESCRIPTION
    Punto de entrada unico para soporte tecnico. Reemplaza el acceso
    directo que antes apuntaba al helper tecnico de restore.

    La consola no exige PHP ni backend\artisan del host. Detecta el
    runtime una sola vez:
      - Docker: ejecuta artisan con
        docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan ...
      - BareMetal: usa php.exe y backend\artisan del host.

    La recuperacion se canaliza al contrato real de
    scripts\restore_hospital_windows.ps1. La ventana permanece abierta
    aunque ocurra un error para que el operador pueda leer el mensaje.

    Exit codes: 0 exito; 1 fallo o cancelacion.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string] $ProjectRoot,

    [Parameter(Mandatory = $false)]
    [ValidateSet('Menu', 'Status', 'Backup', 'Verify', 'TestRestore', 'Restore', 'Reconciliation', 'ResumeService', 'Logs', 'SelfTest')]
    [string] $Command = 'Menu',

    [Parameter(Mandatory = $false)]
    [string] $BackupFile = ''
)

$ErrorActionPreference = 'Stop'
$script:ExitCode = 0
$script:RuntimeContext = $null

function Resolve-MaintenanceRoot {
    param([string]$Root)

    if (-not [string]::IsNullOrWhiteSpace($Root)) {
        return (Resolve-Path -LiteralPath $Root).Path
    }

    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    return (Resolve-Path -LiteralPath (Join-Path $scriptDir '..')).Path
}

function Test-MaintenancePrerequisites {
    param([string]$Root)

    foreach ($relativePath in @(
        'scripts\lib\recovery_contract.ps1',
        'scripts\lib\recovery_runtime.ps1'
    )) {
        $candidate = Join-Path $Root $relativePath
        if (-not (Test-Path -LiteralPath $candidate)) {
            throw "No se encontro $relativePath. La consola requiere una instalacion completa de S_Hospital."
        }
    }
}

function Get-MaintenanceRuntime {
    param([string]$Root)

    if ($null -eq $script:RuntimeContext) {
        $dockerCommandAvailable = Test-RecoveryDockerCommandAvailable
        $script:RuntimeContext = Resolve-RecoveryRuntime `
            -ProjectRoot $Root `
            -DockerComposeAvailable $dockerCommandAvailable
    }

    return $script:RuntimeContext
}

function Get-MaintenanceRuntimeLabel {
    param([object]$Runtime)

    if ($Runtime.DockerReady -and $Runtime.BareReady) { return 'Docker + BareMetal (revisar)' }
    if ($Runtime.DockerReady) { return 'Docker' }
    if ($Runtime.BareReady) { return 'BareMetal' }
    return 'No resuelto'
}

function Get-MaintenanceRuntimeBlockers {
    param([object]$Runtime)

    return (@($Runtime.Blockers) | ForEach-Object { "$($_.Code): $($_.Message)" }) -join ' | '
}

function Test-MaintenanceRuntimeUsable {
    param([object]$Runtime)

    return [bool]($Runtime.DockerReady -or $Runtime.BareReady)
}

function Format-Bytes {
    param([long]$Bytes)
    if ($Bytes -lt 1KB) { return "$Bytes B" }
    if ($Bytes -lt 1MB) { return ('{0:N1} KB' -f ($Bytes / 1KB)) }
    if ($Bytes -lt 1GB) { return ('{0:N1} MB' -f ($Bytes / 1MB)) }
    return ('{0:N2} GB' -f ($Bytes / 1GB))
}

function Get-MaintenanceProcessInvoker {
    # Invoker para los helpers de runtime que operan por efecto (mantenimiento,
    # writers, reanudacion). En Docker ejecuta el binario docker disponible.
    return {
        param([string]$FilePath, [string[]]$Arguments)
        & $FilePath @Arguments 2>&1 | Out-Null
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            throw "El comando de recuperacion fallo con codigo $exitCode."
        }
        return [int]$exitCode
    }
}

function Show-MaintenanceStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  ESTADO DEL SISTEMA S_HOSPITAL' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host ("Instalacion: $ProjectRoot") -ForegroundColor Gray

    $runtime = Get-MaintenanceRuntime -Root $ProjectRoot
    $runtimeLabel = Get-MaintenanceRuntimeLabel -Runtime $runtime
    $runtimeColor = if (Test-MaintenanceRuntimeUsable -Runtime $runtime) { 'Green' } else { 'Yellow' }
    Write-Host ("Runtime:     {0}" -f $runtimeLabel) -ForegroundColor $runtimeColor

    if ($runtime.DockerReady) {
        Write-Host ("Compose:     {0}" -f $runtime.ComposeFile) -ForegroundColor Green
        Write-Host ("Env:         {0}" -f $runtime.EnvFile) -ForegroundColor Green
        Write-Host 'PHP host:    no requerido (los comandos corren en contenedores)' -ForegroundColor Gray
    } elseif ($runtime.BareReady) {
        Write-Host ("PHP:         {0}" -f $runtime.PhpPath) -ForegroundColor Green
        Write-Host ("Artisan:     {0}" -f $runtime.ArtisanPath) -ForegroundColor Green
    } else {
        Write-Host ("Runtime no resuelto: {0}" -f (Get-MaintenanceRuntimeBlockers -Runtime $runtime)) -ForegroundColor Yellow
    }

    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCmd) {
        Write-Host ("Docker CLI:  {0}" -f $dockerCmd.Source) -ForegroundColor Green
    } else {
        Write-Host 'Docker CLI:  no detectado' -ForegroundColor Yellow
    }

    $disk = Get-PSDrive -PSProvider FileSystem -ErrorAction SilentlyContinue |
        Where-Object { $_.Used -gt 0 -and $ProjectRoot.StartsWith($_.Root) } |
        Select-Object -First 1
    if ($disk) {
        $diskLine = "Disco:       {0} libres de {1:N1} GB en {2}" -f @(
            (Format-Bytes $disk.Free),
            (($disk.Used + $disk.Free) / 1GB),
            $disk.Root
        )
        Write-Host $diskLine -ForegroundColor Green
    }

    $backupDir = Join-Path $ProjectRoot 'backend\storage\app\private\backups'
    Write-Host ("Backups:     {0}" -f $backupDir) -ForegroundColor Gray

    if (Test-MaintenanceRuntimeUsable -Runtime $runtime) {
        $state = Get-RestoreReconciliationState -Runtime $runtime
        if (-not $state.Ok) {
            Write-Host 'Correlativos: no verificable (la base no respondio).' -ForegroundColor Yellow
        } elseif ($state.Pending) {
            Write-Host 'Correlativos: BLOQUEADOS hasta reconciliar el ultimo restore.' -ForegroundColor Red
            Write-Host '              Use la opcion 7 para revisar y confirmar la reconciliacion.' -ForegroundColor Yellow
        } else {
            Write-Host 'Correlativos: al dia (sin reconciliacion pendiente).' -ForegroundColor Green
        }
    }
}

function New-MaintenanceBackup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  CREAR RESPALDO AHORA' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    $runtime = Get-MaintenanceRuntime -Root $ProjectRoot
    if (-not (Test-MaintenanceRuntimeUsable -Runtime $runtime)) {
        throw "Runtime de recuperacion no resuelto. $(Get-MaintenanceRuntimeBlockers -Runtime $runtime)"
    }
    if ($runtime.DockerReady -and $runtime.BareReady) {
        Write-Host 'ADVERTENCIA: se detectaron Docker y bare metal; el respaldo usara contenedores Docker.' -ForegroundColor Yellow
    }

    $result = Invoke-HospitalCommandOutput -Runtime $runtime -Arguments @(
        'hospital:backup',
        '--type=manual',
        '--json'
    )
    foreach ($line in @($result.Output)) {
        Write-Host $line
    }

    if ([int]$result.ExitCode -ne 0) {
        throw "Respaldo fallo con codigo $($result.ExitCode)."
    }

    Write-Host 'Respaldo creado correctamente.' -ForegroundColor Green
}

function Test-MaintenanceBackup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [Parameter(Mandatory = $false)]
        [string]$BackupFile
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  VERIFICAR UN RESPALDO' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    if ([string]::IsNullOrWhiteSpace($BackupFile)) {
        $BackupFile = Read-Host 'Ruta del archivo de respaldo a verificar'
    }

    if (-not (Test-Path -LiteralPath $BackupFile)) {
        throw "Archivo no encontrado: $BackupFile"
    }

    $resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
    Write-Host ("Archivo:    $resolvedBackup")
    $size = (Get-Item -LiteralPath $resolvedBackup).Length
    Write-Host ("Tamanio:    {0}" -f (Format-Bytes $size))

    $hash = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host ("SHA-256:    $hash")
    Write-Host ''
    Write-Host 'Si su respaldo es .sql.enc o .sql.gz.enc, conserve este hash para la recuperacion productiva.' -ForegroundColor Gray
}

function Invoke-DisposableRestore {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  PRUEBA DE RESTAURACION (BASE DESCARTABLE)' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host 'Esta operacion SOLO escribe sobre una base hospital_billing_test.' -ForegroundColor Yellow
    Write-Host 'No modifica la base activa.' -ForegroundColor Yellow
    Write-Host ''

    $restoreScript = Join-Path $ProjectRoot 'scripts\restore_hospital_windows.ps1'
    if (-not (Test-Path -LiteralPath $restoreScript)) {
        throw "No se encontro scripts\restore_hospital_windows.ps1. La prueba de restauracion requiere el helper de recuperacion."
    }

    $targetDatabase = (Get-RecoveryDefaultDisposableDatabase) + '_' + (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
    if (-not (Test-RecoveryDisposableTargetDatabase -Database $targetDatabase)) {
        throw "Destino descartable invalido: $targetDatabase"
    }

    $backupFile = Read-Host 'Ruta del archivo de respaldo a probar'
    $hash = Read-Host 'SHA-256 esperado (64 caracteres hexadecimales)'

    if ([string]::IsNullOrWhiteSpace($backupFile) -or [string]::IsNullOrWhiteSpace($hash)) {
        throw 'Debe proporcionar ruta y hash.'
    }
    if ($hash -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'El SHA-256 debe tener 64 caracteres hexadecimales.'
    }

    $backupPath = [System.IO.Path]::GetFullPath($backupFile)
    Write-Host ("Backup:      {0}" -f $backupPath) -ForegroundColor Cyan
    Write-Host ("Destino:     {0}" -f $targetDatabase) -ForegroundColor Cyan

    $global:LASTEXITCODE = 0
    & $restoreScript -BackupFile $backupPath -ExpectedSha256 $hash -UseExistingEnv -TargetDatabase $targetDatabase
    $restoreExitCode = $LASTEXITCODE
    if ($null -eq $restoreExitCode) { $restoreExitCode = 0 }
    if ([int]$restoreExitCode -ne 0) {
        throw "La prueba de restauracion descartable fallo con codigo $restoreExitCode."
    }
}

function Invoke-ProductionRecovery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  RECUPERACION PRODUCTIVA' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host 'ADVERTENCIA: Esta operacion modifica la base activa.' -ForegroundColor Red
    Write-Host 'Antes de continuar, debe verificar que:' -ForegroundColor Yellow
    Write-Host '  - No haya caja abierta (se validara por runbook).' -ForegroundColor Yellow
    Write-Host '  - El paquete sea integro (hash SHA-256).' -ForegroundColor Yellow
    Write-Host '  - Soporte tecnico autorizado haya confirmado la operacion.' -ForegroundColor Yellow
    Write-Host ''

    $canonicalAction = [string](Get-RecoveryActionConfirmation)
    $databaseConfirmation = Read-Host 'Escriba EXACTAMENTE el nombre de la base de produccion para confirmar'
    $actionConfirmation = Read-Host ("Escriba `"{0}`" para confirmar la accion" -f $canonicalAction)

    if (-not (Test-RecoveryActionConfirmation -Value $actionConfirmation)) {
        Write-Host 'Confirmacion incorrecta. Operacion cancelada. No se inicio ninguna restauracion.' -ForegroundColor Yellow
        $script:ExitCode = 1
        return
    }

    $restoreScript = Join-Path $ProjectRoot 'scripts\restore_hospital_windows.ps1'
    if (-not (Test-Path -LiteralPath $restoreScript)) {
        throw "No se encontro scripts\restore_hospital_windows.ps1."
    }

    $backupFile = Read-Host 'Ruta del archivo de respaldo'
    $hash = Read-Host 'SHA-256 esperado (64 caracteres hexadecimales)'

    if ([string]::IsNullOrWhiteSpace($backupFile) -or [string]::IsNullOrWhiteSpace($hash)) {
        throw 'Debe proporcionar ruta y hash.'
    }
    if ($hash -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'El SHA-256 debe tener 64 caracteres hexadecimales.'
    }

    $backupPath = [System.IO.Path]::GetFullPath($backupFile)
    Write-Host ("Backup:      {0}" -f $backupPath) -ForegroundColor Cyan

    $global:LASTEXITCODE = 0
    & $restoreScript `
        -BackupFile $backupPath `
        -ExpectedSha256 $hash `
        -UseExistingEnv `
        -ProductionRecovery `
        -ProductionDatabaseConfirmation $databaseConfirmation `
        -ProductionActionConfirmation $actionConfirmation

    $restoreExitCode = $LASTEXITCODE
    if ($null -eq $restoreExitCode) { $restoreExitCode = 0 }
    if ([int]$restoreExitCode -ne 0) {
        throw "La recuperacion productiva fallo con codigo $restoreExitCode."
    }

    Write-Host 'RECUPERACION PRODUCTIVA COMPLETADA' -ForegroundColor Green
}

function Show-SequenceReconciliation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  RECONCILIACION DE CORRELATIVOS' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    $runtime = Get-MaintenanceRuntime -Root $ProjectRoot
    if (-not (Test-MaintenanceRuntimeUsable -Runtime $runtime)) {
        throw "Runtime de recuperacion no resuelto. $(Get-MaintenanceRuntimeBlockers -Runtime $runtime)"
    }

    $state = Get-RestoreReconciliationState -Runtime $runtime
    if (-not $state.Ok) {
        Write-Host 'No se pudo leer el estado de reconciliacion. La emision no se considera liberada.' -ForegroundColor Yellow
        $script:ExitCode = 1
        return
    }

    if (-not $state.Pending) {
        Write-Host 'No hay reconciliacion pendiente. La emision esta habilitada.' -ForegroundColor Green
        return
    }

    Write-Host 'BLOQUEO ACTIVO: el ultimo restore exige reconciliar correlativos con evidencia externa.' -ForegroundColor Red
    Write-Host 'Sin manifiesto verificado la emision de facturas y recibos permanece bloqueada.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Se requiere el manifiesto JSON producido desde la custodia externa (hs-backups).' -ForegroundColor Gray

    $manifestPath = Read-Host 'Ruta del manifiesto externo verificable'
    $reason = Read-Host 'Motivo de la reconciliacion (evidencia revisada)'
    $authorizedBy = Read-Host 'Responsable que autoriza (doble control)'
    $canonicalPhrase = [string](Get-RecoveryReconciliationConfirmPhrase)
    $phrase = Read-Host ("Escriba `"{0}`" para confirmar" -f $canonicalPhrase)

    if (-not (Test-RecoveryReconciliationConfirmPhrase -Value $phrase)) {
        Write-Host 'Frase incorrecta. Reconciliacion cancelada; el bloqueo permanece.' -ForegroundColor Yellow
        $script:ExitCode = 1
        return
    }

    $result = Confirm-RestoreReconciliation `
        -Runtime $runtime `
        -ManifestPath $manifestPath `
        -Reason $reason `
        -AuthorizedBy $authorizedBy `
        -Phrase $phrase

    foreach ($line in @($result.Output)) {
        Write-Host $line
    }
    if ([int]$result.ExitCode -ne 0) {
        Write-Host 'La reconciliacion fue rechazada. El bloqueo permanece.' -ForegroundColor Red
        $script:ExitCode = 1
        return
    }

    Write-Host 'Reconciliacion confirmada. La emision puede reanudarse.' -ForegroundColor Green
}

function Restore-HospitalService {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  REANUDAR SERVICIO TRAS UN FALLO' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host 'Esta operacion reabre writers y sale de mantenimiento, pero NO libera' -ForegroundColor Yellow
    Write-Host 'la emision de correlativos si hay una reconciliacion pendiente.' -ForegroundColor Yellow
    Write-Host ''

    $runtime = Get-MaintenanceRuntime -Root $ProjectRoot
    if (-not (Test-MaintenanceRuntimeUsable -Runtime $runtime)) {
        throw "Runtime de recuperacion no resuelto. $(Get-MaintenanceRuntimeBlockers -Runtime $runtime)"
    }

    $canonicalResume = [string](Get-RecoveryResumeConfirmation)
    $confirmation = Read-Host ("Escriba `"{0}`" para reanudar el servicio" -f $canonicalResume)
    if (-not (Test-RecoveryResumeConfirmation -Value $confirmation)) {
        Write-Host 'Confirmacion incorrecta. No se reanudo el servicio.' -ForegroundColor Yellow
        $script:ExitCode = 1
        return
    }

    $invoker = Get-MaintenanceProcessInvoker
    $result = Resume-HospitalOperations -Runtime $runtime -Invoker $invoker
    if ($result.ReconciliationPending) {
        Write-Host 'Servicio reanudado. ATENCION: la emision de correlativos sigue BLOQUEADA.' -ForegroundColor Yellow
        Write-Host 'Use la opcion 7 con el manifiesto externo para liberarla.' -ForegroundColor Yellow
    } else {
        Write-Host 'Servicio reanudado y emision habilitada.' -ForegroundColor Green
    }
}

function Show-MaintenanceLogs {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Magenta
    Write-Host '  REGISTROS DE SOPORTE' -ForegroundColor Magenta
    Write-Host '========================================' -ForegroundColor Magenta

    $candidates = @(
        @{ Path = (Join-Path $ProjectRoot 'storage\logs'); Label = 'storage\logs' },
        @{ Path = (Join-Path $ProjectRoot 'install-logs'); Label = 'install-logs' },
        @{ Path = (Join-Path $ProjectRoot 'installer-output'); Label = 'installer-output' }
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate.Path) {
            Write-Host ("- {0} -> {1}" -f $candidate.Label, $candidate.Path) -ForegroundColor Cyan
        }
    }

    Write-Host ''
    Write-Host 'Los registros pueden contener credenciales. No los comparta sin depurar antes.' -ForegroundColor Yellow
}

function Show-MaintenanceMenu {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot
    )

    while ($true) {
        Write-Host ''
        Write-Host '========================================' -ForegroundColor Magenta
        Write-Host '  MANTENIMIENTO S_HOSPITAL' -ForegroundColor Magenta
        Write-Host '========================================' -ForegroundColor Magenta
        Write-Host '  1) Estado del sistema' -ForegroundColor White
        Write-Host '  2) Crear respaldo ahora' -ForegroundColor White
        Write-Host '  3) Verificar un respaldo' -ForegroundColor White
        Write-Host '  4) Probar restauracion en base descartable' -ForegroundColor White
        Write-Host '  5) Restaurar el sistema (produccion)' -ForegroundColor White
        Write-Host '  6) Abrir registros de soporte' -ForegroundColor White
        Write-Host '  7) Reconciliar correlativos post-restore' -ForegroundColor White
        Write-Host '  8) Reanudar servicio tras un fallo' -ForegroundColor White
        Write-Host '  0) Salir' -ForegroundColor Gray
        Write-Host ''

        $choice = Read-Host 'Seleccione una opcion'
        try {
            switch ($choice) {
                '1' { Show-MaintenanceStatus -ProjectRoot $ProjectRoot }
                '2' { New-MaintenanceBackup -ProjectRoot $ProjectRoot }
                '3' { Test-MaintenanceBackup -ProjectRoot $ProjectRoot }
                '4' { Invoke-DisposableRestore -ProjectRoot $ProjectRoot }
                '5' { Invoke-ProductionRecovery -ProjectRoot $ProjectRoot }
                '6' { Show-MaintenanceLogs -ProjectRoot $ProjectRoot }
                '7' { Show-SequenceReconciliation -ProjectRoot $ProjectRoot }
                '8' { Restore-HospitalService -ProjectRoot $ProjectRoot }
                '0' { return }
                default { Write-Host 'Opcion no reconocida.' -ForegroundColor Yellow }
            }
        } catch {
            Write-Host ("[ERROR] {0}" -f $_.Exception.Message) -ForegroundColor Red
            Write-Host 'Regresando al menu. Para salir elija 0.' -ForegroundColor Gray
        }
    }
}

try {
    $root = Resolve-MaintenanceRoot -Root $ProjectRoot
    Test-MaintenancePrerequisites -Root $root

    . (Join-Path $root 'scripts\lib\recovery_contract.ps1')
    . (Join-Path $root 'scripts\lib\recovery_runtime.ps1')

    switch ($Command) {
        'Status' { Show-MaintenanceStatus -ProjectRoot $root }
        'Backup' { New-MaintenanceBackup -ProjectRoot $root }
        'Verify' { Test-MaintenanceBackup -ProjectRoot $root -BackupFile $BackupFile }
        'TestRestore' { Invoke-DisposableRestore -ProjectRoot $root }
        'Restore' { Invoke-ProductionRecovery -ProjectRoot $root }
        'Reconciliation' { Show-SequenceReconciliation -ProjectRoot $root }
        'ResumeService' { Restore-HospitalService -ProjectRoot $root }
        'Logs' { Show-MaintenanceLogs -ProjectRoot $root }
        'SelfTest' {
            $runtime = Get-MaintenanceRuntime -Root $root
            if (Test-MaintenanceRuntimeUsable -Runtime $runtime) {
                Write-Host ("Self-test: consola operativa. Runtime={0}; confirmacion={1}." -f `
                    (Get-MaintenanceRuntimeLabel -Runtime $runtime), (Get-RecoveryActionConfirmation)) -ForegroundColor Green
            } else {
                Write-Host ("Self-test: consola operativa; runtime no resuelto ({0})." -f `
                    (Get-MaintenanceRuntimeBlockers -Runtime $runtime)) -ForegroundColor Yellow
            }
        }
        'Menu' { Show-MaintenanceMenu -ProjectRoot $root }
    }
} catch {
    $script:ExitCode = 1
    Write-Host ''
    Write-Host ("[ERROR FATAL] {0}" -f $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    Write-Host 'La ventana permanecera abierta para que pueda leer el mensaje.' -ForegroundColor Yellow
    Write-Host 'Presione Enter para salir.' -ForegroundColor Gray
    [void](Read-Host)
}

exit $script:ExitCode
