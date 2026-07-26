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
} finally {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Recovery runtime self-test passed: $script:Checks checks."
exit 0
