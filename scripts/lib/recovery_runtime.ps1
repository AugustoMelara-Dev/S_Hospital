#Requires -Version 5.1

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
        $phpCommand = Get-Command php.exe -ErrorAction SilentlyContinue
        if ($phpCommand) {
            $PhpPath = $phpCommand.Source
        }
    }

    if ([string]::IsNullOrWhiteSpace($MySqlPath)) {
        $mysqlCommand = Get-Command mysql.exe -ErrorAction SilentlyContinue
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
        ProjectRoot = $resolvedRoot
        ComposeFile = $composeFile
        EnvFile = $envFile
        ArtisanPath = $artisanPath
        PhpPath = $PhpPath
        MySqlPath = $MySqlPath
        Blockers = @($blockers)
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

    if ($Runtime.Mode -eq 'Docker') {
        $commandArguments = @(
            'compose',
            '-f', $Runtime.ComposeFile,
            '--env-file', $Runtime.EnvFile,
            'exec', '-T', 'backend',
            'php', 'artisan'
        ) + $Arguments

        return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments $commandArguments
    }

    if ($Runtime.Mode -eq 'BareMetal') {
        $commandArguments = @($Runtime.ArtisanPath) + $Arguments

        return Invoke-RecoveryProcess -Invoker $Invoker -FilePath $Runtime.PhpPath -Arguments $commandArguments
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

    if ($Runtime.Mode -ne 'Docker') {
        throw 'La parada automatica de writers bare metal requiere el instalador de servicios.'
    }

    return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments @(
        'compose',
        '-f', $Runtime.ComposeFile,
        '--env-file', $Runtime.EnvFile,
        'stop', 'queue', 'scheduler'
    )
}

function Start-HospitalWriters {
    param([object]$Runtime, [scriptblock]$Invoker)

    if ($Runtime.Mode -ne 'Docker') {
        throw 'El arranque automatico de writers bare metal requiere el instalador de servicios.'
    }

    return Invoke-RecoveryProcess -Invoker $Invoker -FilePath 'docker' -Arguments @(
        'compose',
        '-f', $Runtime.ComposeFile,
        '--env-file', $Runtime.EnvFile,
        'up', '-d', 'queue', 'scheduler'
    )
}
