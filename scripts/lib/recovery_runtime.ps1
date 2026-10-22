#Requires -Version 5.1
# Adaptador de runtime de recuperacion.
#
# Modo Docker: toda operacion de base de datos o artisan corre dentro de los
# contenedores del compose productivo:
#   docker compose -f docker-compose.prod.yml --env-file .env exec -T backend php artisan ...
#   docker compose -f docker-compose.prod.yml --env-file .env exec -T mysql sh -lc 'mariadb ...'
# Modo BareMetal: se usa php.exe + mysql.exe del host y backend\artisan.
#
# La deteccion se hace una sola vez por proceso con Resolve-RecoveryRuntime y
# los consumidores usan DockerReady/BareReady para enrutar sin volver a probar.

function Get-RecoveryActionConfirmation {
    # Frase canonica unica para confirmar la restauracion productiva.
    # La usan la consola, restore_hospital_windows.ps1 y recovery_docker.ps1.
    return 'RESTAURAR'
}

function Test-RecoveryActionConfirmation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return $Value -ceq (Get-RecoveryActionConfirmation)
}

function Get-RecoveryDefaultDisposableDatabase {
    return 'hospital_billing_test'
}

function Test-RecoveryDisposableTargetDatabase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Database
    )

    if ([string]::IsNullOrWhiteSpace($Database) -or $Database -notmatch '^[A-Za-z0-9_]+$') {
        return $false
    }

    $default = Get-RecoveryDefaultDisposableDatabase
    if ($Database -ceq $default) {
        return $true
    }

    return $Database -clike ($default + '_*')
}

function Test-RecoveryDockerCommandAvailable {
    [CmdletBinding()]
    param()

    return $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
}

function Resolve-RecoveryRuntime {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectRoot,

        [bool]$DockerComposeAvailable = $false,

        [string]$PhpPath = '',

        [string]$MySqlPath = ''
    )

    $resolvedRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
    $composeFile = Join-Path $resolvedRoot 'docker-compose.prod.yml'
    $envFile = Join-Path $resolvedRoot '.env'
    $artisanPath = Join-Path $resolvedRoot 'backend\artisan'

    if ([string]::IsNullOrWhiteSpace($PhpPath)) {
        $phpCommand = Get-Command php -ErrorAction SilentlyContinue
        if ($phpCommand) {
            $PhpPath = $phpCommand.Source
        }
    }

    if ([string]::IsNullOrWhiteSpace($MySqlPath)) {
        $mysqlCommand = Get-Command mysql -ErrorAction SilentlyContinue
        if ($mysqlCommand) {
            $MySqlPath = $mysqlCommand.Source
        }
    }

    $dockerComplete = $DockerComposeAvailable `
        -and (Test-Path -LiteralPath $composeFile) `
        -and (Test-Path -LiteralPath $envFile)
    $bareComplete = (Test-Path -LiteralPath $artisanPath) `
        -and (-not [string]::IsNullOrWhiteSpace($PhpPath)) `
        -and (Test-Path -LiteralPath $PhpPath) `
        -and (-not [string]::IsNullOrWhiteSpace($MySqlPath)) `
        -and (Test-Path -LiteralPath $MySqlPath)

    $blockers = @()
    $mode = $null

    if ($dockerComplete -and $bareComplete) {
        $blockers += [pscustomobject]@{
            Code = 'AMBIGUOUS_RUNTIME'
            Message = 'Se detectaron Docker y bare metal completos; seleccione una instalacion sin mezclar runtimes.'
        }
    } elseif ($dockerComplete) {
        $mode = 'Docker'
    } elseif ($bareComplete) {
        $mode = 'BareMetal'
    } else {
        $blockers += [pscustomobject]@{
            Code = 'RUNTIME_INCOMPLETE'
            Message = 'La instalacion local no contiene todos los archivos o binarios requeridos para recuperar.'
        }
    }

    return [pscustomobject]@{
        Mode = $mode
        DockerReady = $dockerComplete
        BareReady = $bareComplete
        ProjectRoot = $resolvedRoot
        ComposeFile = $composeFile
        EnvFile = $envFile
        ArtisanPath = $artisanPath
        PhpPath = $PhpPath
        MySqlPath = $MySqlPath
        Blockers = @($blockers)
    }
}

function Get-RecoveryRuntimeReadiness {
    param([object]$Runtime)

    $dockerReady = $false
    $bareReady = $false

    if ($null -ne $Runtime.PSObject.Properties['DockerReady']) {
        $dockerReady = [bool]$Runtime.DockerReady
    }
    if ($null -ne $Runtime.PSObject.Properties['BareReady']) {
        $bareReady = [bool]$Runtime.BareReady
    }

    if (-not $dockerReady -and $Runtime.Mode -eq 'Docker') { $dockerReady = $true }
    if (-not $bareReady -and $Runtime.Mode -eq 'BareMetal') { $bareReady = $true }

    return [pscustomobject]@{
        DockerReady = $dockerReady
        BareReady = $bareReady
    }
}

function Invoke-RecoveryProcess {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Invoker,

        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $exitCode = & $Invoker $FilePath $Arguments
    if ([int]$exitCode -ne 0) {
        throw "El comando local de recuperacion fallo con codigo $exitCode."
    }

    return [int]$exitCode
}

function Invoke-HospitalCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Invoker
    )

    $readiness = Get-RecoveryRuntimeReadiness -Runtime $Runtime

    if ($readiness.DockerReady) {
        $commandArguments = @(
            'compose',
            '-f', $Runtime.ComposeFile,
            '--env-file', $Runtime.EnvFile,
            'exec', '-T', 'backend',
            'php', 'artisan'
        ) + $Arguments

        return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments $commandArguments
    }

    if ($readiness.BareReady) {
        $commandArguments = @($Runtime.ArtisanPath) + $Arguments

        return Invoke-RecoveryProcess -Invoker $Invoker -FilePath $Runtime.PhpPath -Arguments $commandArguments
    }

    throw 'Runtime de recuperacion no resuelto.'
}

function Invoke-HospitalCommandOutput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [scriptblock]$Invoker = $null
    )

    $readiness = Get-RecoveryRuntimeReadiness -Runtime $Runtime
    $runner = $Invoker
    if ($null -eq $runner) {
        $runner = {
            param([string]$FilePath, [string[]]$Arguments)
            $output = & $FilePath @Arguments 2>&1
            return [pscustomobject]@{
                ExitCode = [int]$LASTEXITCODE
                Output = @($output | ForEach-Object { [string]$_ })
            }
        }
    }

    if ($readiness.DockerReady) {
        $commandArguments = @(
            'compose',
            '-f', $Runtime.ComposeFile,
            '--env-file', $Runtime.EnvFile,
            'exec', '-T', 'backend',
            'php', 'artisan'
        ) + $Arguments

        return (& $runner 'docker' $commandArguments)
    }

    if ($readiness.BareReady) {
        $commandArguments = @($Runtime.ArtisanPath) + $Arguments

        return (& $runner $Runtime.PhpPath $commandArguments)
    }

    throw 'Runtime de recuperacion no resuelto.'
}

function Enter-HospitalMaintenance {
    param([object]$Runtime, [scriptblock]$Invoker)
    return Invoke-HospitalCommand -Runtime $Runtime -Arguments @(
        'hospital:maintenance',
        'on',
        '--message=Restauracion local en progreso'
    ) -Invoker $Invoker
}

function Exit-HospitalMaintenance {
    param([object]$Runtime, [scriptblock]$Invoker)
    return Invoke-HospitalCommand -Runtime $Runtime -Arguments @(
        'hospital:maintenance',
        'off'
    ) -Invoker $Invoker
}

function Stop-HospitalWriters {
    param([object]$Runtime, [scriptblock]$Invoker)

    $readiness = Get-RecoveryRuntimeReadiness -Runtime $Runtime
    if (-not $readiness.DockerReady) {
        throw 'La parada automatica de writers bare metal requiere el instalador de servicios.'
    }

    return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments @(
        'compose',
        '-f', $Runtime.ComposeFile,
        '--env-file', $Runtime.EnvFile,
        'stop', 'queue-worker', 'realtime-worker', 'scheduler'
    )
}

function Start-HospitalWriters {
    param([object]$Runtime, [scriptblock]$Invoker)

    $readiness = Get-RecoveryRuntimeReadiness -Runtime $Runtime
    if (-not $readiness.DockerReady) {
        throw 'El arranque automatico de writers bare metal requiere el instalador de servicios.'
    }

    return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments @(
        'compose',
        '-f', $Runtime.ComposeFile,
        '--env-file', $Runtime.EnvFile,
        'up', '-d', 'queue-worker', 'realtime-worker', 'scheduler'
    )
}

function Get-RestoreReconciliationCommandName {
    # Comando artisan dueno del bloqueo de correlativos post-restore (HS-RESTORE-SEQUENCE).
    return 'hospital:restore-reconciliation'
}

function Get-RecoveryReconciliationReason {
    # Motivo canonico del bloqueo; supera el minimo exigido por el backend.
    return 'Restauracion de respaldo completada; reconciliar correlativos antes de emitir'
}

function Get-RecoveryResumeConfirmation {
    # Frase canonica para reanudar el servicio tras un fallo de recuperacion.
    return 'REANUDAR'
}

function Test-RecoveryResumeConfirmation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return $Value -ceq (Get-RecoveryResumeConfirmation)
}

function Get-RecoveryReconciliationConfirmPhrase {
    # Debe coincidir con RestoreReconciliation::CONFIRM_PHRASE del backend.
    return 'RECONCILIAR'
}

function Test-RecoveryReconciliationConfirmPhrase {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return $Value -ceq (Get-RecoveryReconciliationConfirmPhrase)
}

function Start-RestoreReconciliation {
    # Bloquea la emision de correlativos hasta reconciliar con evidencia externa.
    # Se invoca despues de sustituir la base y ejecutar migraciones, antes de
    # reanudar writers. Falla cerrado: si no puede marcar el pendiente, el
    # llamador no debe reabrir la operacion.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Invoker,

        [string]$Reason = (Get-RecoveryReconciliationReason)
    )

    if ([string]::IsNullOrWhiteSpace($Reason)) {
        throw 'El bloqueo de correlativos requiere un motivo verificable.'
    }

    return Invoke-HospitalCommand -Runtime $Runtime -Arguments @(
        (Get-RestoreReconciliationCommandName),
        'start',
        "--reason=$Reason",
        '--json'
    ) -Invoker $Invoker
}

function Get-RestoreReconciliationState {
    # Estado del bloqueo post-restore. Ok=$false cuando el comando no responde
    # o no devuelve JSON parseable: el llamador debe tratarlo como no verificado.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [scriptblock]$OutputInvoker = $null
    )

    $result = Invoke-HospitalCommandOutput -Runtime $Runtime -Arguments @(
        (Get-RestoreReconciliationCommandName),
        'status',
        '--json'
    ) -Invoker $OutputInvoker

    $pending = $null
    $parsed = $null
    foreach ($line in @($result.Output | Select-Object -Last 20)) {
        $candidate = ([string]$line).Trim()
        if (-not ($candidate.StartsWith('{') -and $candidate.EndsWith('}'))) { continue }
        try {
            $parsed = $candidate | ConvertFrom-Json
        } catch {
            continue
        }
        break
    }

    if ($null -ne $parsed -and $null -ne $parsed.PSObject.Properties['pending']) {
        $pending = [bool]$parsed.pending
    }

    return [pscustomobject]@{
        Ok = ([int]$result.ExitCode -eq 0 -and $null -ne $parsed)
        ExitCode = [int]$result.ExitCode
        Pending = $pending
        Raw = @($result.Output)
    }
}

function Confirm-RestoreReconciliation {
    # Confirma la reconciliacion con manifiesto externo verificado y doble
    # control. No valida el manifiesto en PowerShell: el backend es la autoridad
    # y rechaza sin evidencia (fail-closed).
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [Parameter(Mandatory = $true)]
        [string]$ManifestPath,

        [Parameter(Mandatory = $true)]
        [string]$Reason,

        [Parameter(Mandatory = $true)]
        [string]$AuthorizedBy,

        [string]$Phrase = (Get-RecoveryReconciliationConfirmPhrase),

        [scriptblock]$OutputInvoker = $null
    )

    if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
        throw 'Sin manifiesto externo no hay reconciliacion posible.'
    }
    if ([string]::IsNullOrWhiteSpace($Reason) -or $Reason.Trim().Length -lt 5) {
        throw 'El motivo de reconciliacion debe describir la evidencia revisada.'
    }
    if ([string]::IsNullOrWhiteSpace($AuthorizedBy)) {
        throw 'La reconciliacion requiere registrar quien autoriza (doble control).'
    }
    if (-not (Test-RecoveryReconciliationConfirmPhrase -Value $Phrase)) {
        throw 'La frase de confirmacion de reconciliacion no coincide.'
    }

    return Invoke-HospitalCommandOutput -Runtime $Runtime -Arguments @(
        (Get-RestoreReconciliationCommandName),
        'confirm',
        "--manifest=$ManifestPath",
        "--phrase=$Phrase",
        "--reason=$Reason",
        "--authorized-by=$AuthorizedBy",
        '--json'
    ) -Invoker $OutputInvoker
}

function Resume-HospitalOperations {
    # Recuperacion de servicio tras un fallo: exige que la base responda antes
    # de reabrir writers y salir de mantenimiento. El bloqueo de correlativos,
    # si esta pendiente, sigue vigente: reanudar servicio no libera la emision.
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [object]$Runtime,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Invoker,

        [scriptblock]$StateOutputInvoker = $null
    )

    $reconciliation = Get-RestoreReconciliationState -Runtime $Runtime -OutputInvoker $StateOutputInvoker
    if (-not $reconciliation.Ok) {
        throw 'La base no respondio al estado de reconciliacion; no se reanuda el servicio.'
    }

    Start-HospitalWriters -Runtime $Runtime -Invoker $Invoker | Out-Null
    Exit-HospitalMaintenance -Runtime $Runtime -Invoker $Invoker | Out-Null

    return [pscustomobject]@{
        Resumed = $true
        ReconciliationPending = [bool]$reconciliation.Pending
    }
}
