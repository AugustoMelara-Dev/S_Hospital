#Requires -Version 5.1
# Prueba del cargador offline: verificacion SHA-256 previa a docker load.
# Usa fixtures sinteticos en %TEMP% y un shim de docker; no requiere Docker real.

$ErrorActionPreference = 'Stop'

$loaderPath = Join-Path $PSScriptRoot 'load_offline_images.ps1'
if (-not (Test-Path -LiteralPath $loaderPath -PathType Leaf)) {
    throw "Falta el cargador offline: $loaderPath"
}

$script:Checks = 0
$script:Errors = @()

function Assert-LoaderTest {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        $script:Errors += $Message
    }
}

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-offline-loader-' + [guid]::NewGuid().ToString('N'))
$shimDir = Join-Path $fixtureRoot 'shim'
$dockerLog = Join-Path $fixtureRoot 'docker-invocations.log'
$savedPath = $env:PATH
$savedShimLog = $env:SHIM_LOG

function New-LoaderFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name
    )

    $root = Join-Path $fixtureRoot $Name
    $imagesDir = Join-Path $root 'offline-images'
    New-Item -ItemType Directory -Path $imagesDir -Force | Out-Null

    $tarNames = @('backend.tar', 'mariadb.tar')
    $manifestLines = @()

    foreach ($tarName in $tarNames) {
        $tarPath = Join-Path $imagesDir $tarName
        Set-Content -LiteralPath $tarPath -Value "fake-tar-content-$tarName" -Encoding ASCII
        $hash = (Get-FileHash -LiteralPath $tarPath -Algorithm SHA256).Hash.ToLowerInvariant()
        Set-Content -LiteralPath "$tarPath.sha256" -Value $hash -Encoding ASCII
        $manifestLines += "$hash  offline-images/$tarName"
    }

    Set-Content -LiteralPath (Join-Path $root 'checksums.sha256') -Value $manifestLines -Encoding ASCII

    return $root
}

function Invoke-LoaderFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ProjectRoot,

        [Parameter(Mandatory = $true)]
        [string] $LogPath
    )

    if (Test-Path -LiteralPath $LogPath) {
        Remove-Item -LiteralPath $LogPath -Force
    }

    $env:PATH = "$shimDir;$savedPath"
    $env:SHIM_LOG = $LogPath

    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $loaderPath -ProjectRoot $ProjectRoot 2>&1 | ForEach-Object { [string] $_ }
    $exitCode = [int] $LASTEXITCODE

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = @($output)
    }
}

function Get-LoadedTarNames {
    param([string] $LogPath)

    if (-not (Test-Path -LiteralPath $LogPath)) {
        return @()
    }

    $loaded = @()
    foreach ($line in (Get-Content -LiteralPath $LogPath)) {
        $match = [regex]::Match([string] $line, '^load\s+-i\s+(?<path>.+)$')
        if ($match.Success) {
            $loaded += Split-Path -Leaf $match.Groups['path'].Value.Trim()
        }
    }

    return @($loaded)
}

try {
    New-Item -ItemType Directory -Path $shimDir -Force | Out-Null

    $shimContent = @(
        '@echo off',
        'if "%~1"=="ps" exit /b 0',
        'if "%~1"=="load" (',
        '  echo load %~2 %~3>>"%SHIM_LOG%"',
        '  exit /b 0',
        ')',
        'if "%~1"=="images" (',
        '  echo s_hospital-prod-backend:latest',
        '  echo s_hospital-prod-queue-worker:latest',
        '  echo s_hospital-prod-scheduler:latest',
        '  echo nginx:1.25.4-alpine',
        '  echo mariadb:11.4.3',
        '  echo quay.io/soketi/soketi:1.6-16-alpine',
        '  exit /b 0',
        ')',
        'exit /b 0'
    )
    Set-Content -LiteralPath (Join-Path $shimDir 'docker.cmd') -Value $shimContent -Encoding ASCII

    # Caso 1: checksums correctos -> carga simulada de cada tar
    $okRoot = New-LoaderFixture -Name 'ok'
    $okResult = Invoke-LoaderFixture -ProjectRoot $okRoot -LogPath (Join-Path $fixtureRoot 'ok.log')
    Assert-LoaderTest ($okResult.ExitCode -eq 0) "El cargador debe aceptar checksums correctos. Exit=$($okResult.ExitCode) Output=$($okResult.Output -join ' | ')"
    $okLoaded = Get-LoadedTarNames -LogPath (Join-Path $fixtureRoot 'ok.log')
    Assert-LoaderTest (($okLoaded -contains 'backend.tar') -and ($okLoaded -contains 'mariadb.tar')) "El cargador debe ejecutar docker load para cada tar verificado. Cargados: $($okLoaded -join ', ')"

    # Caso 2: tar alterado despues de generar checksums -> fallo cerrado sin docker load
    $tamperedRoot = New-LoaderFixture -Name 'tampered'
    Add-Content -LiteralPath (Join-Path $tamperedRoot 'offline-images\backend.tar') -Value 'tampered'
    $tamperedResult = Invoke-LoaderFixture -ProjectRoot $tamperedRoot -LogPath (Join-Path $fixtureRoot 'tampered.log')
    Assert-LoaderTest ($tamperedResult.ExitCode -ne 0) 'Un tar alterado debe producir exit code distinto de cero.'
    Assert-LoaderTest (@(Get-LoadedTarNames -LogPath (Join-Path $fixtureRoot 'tampered.log')).Count -eq 0) 'Un tar alterado no debe ejecutar docker load.'
    Assert-LoaderTest (($tamperedResult.Output -join ' ') -match 'backend\.tar') 'El mensaje debe identificar el archivo alterado.'
    Assert-LoaderTest (($tamperedResult.Output -join ' ') -match '(?i)no coincide') 'El mensaje debe declarar el mismatch de hash.'

    # Caso 3: manifiesto checksums.sha256 ausente -> fallo cerrado sin docker load
    $missingManifestRoot = New-LoaderFixture -Name 'missing-manifest'
    Remove-Item -LiteralPath (Join-Path $missingManifestRoot 'checksums.sha256') -Force
    $missingManifestResult = Invoke-LoaderFixture -ProjectRoot $missingManifestRoot -LogPath (Join-Path $fixtureRoot 'missing-manifest.log')
    Assert-LoaderTest ($missingManifestResult.ExitCode -ne 0) 'La ausencia de checksums.sha256 debe fallar cerrado.'
    Assert-LoaderTest (@(Get-LoadedTarNames -LogPath (Join-Path $fixtureRoot 'missing-manifest.log')).Count -eq 0) 'Sin manifiesto no debe ejecutarse docker load.'
    Assert-LoaderTest (($missingManifestResult.Output -join ' ') -match 'checksums\.sha256') 'El mensaje debe indicar el manifiesto faltante.'

    # Caso 4: sidecar <imagen>.tar.sha256 ausente -> fallo cerrado sin docker load
    $missingSidecarRoot = New-LoaderFixture -Name 'missing-sidecar'
    Remove-Item -LiteralPath (Join-Path $missingSidecarRoot 'offline-images\backend.tar.sha256') -Force
    $missingSidecarResult = Invoke-LoaderFixture -ProjectRoot $missingSidecarRoot -LogPath (Join-Path $fixtureRoot 'missing-sidecar.log')
    Assert-LoaderTest ($missingSidecarResult.ExitCode -ne 0) 'La ausencia del sidecar .sha256 debe fallar cerrado.'
    Assert-LoaderTest (@(Get-LoadedTarNames -LogPath (Join-Path $fixtureRoot 'missing-sidecar.log')).Count -eq 0) 'Sin sidecar no debe ejecutarse docker load.'
    Assert-LoaderTest (($missingSidecarResult.Output -join ' ') -match 'backend\.tar\.sha256') 'El mensaje debe indicar el sidecar faltante.'

    # Caso 5: hash manipulado en el manifiesto -> fallo cerrado sin docker load
    $manifestMismatchRoot = New-LoaderFixture -Name 'manifest-mismatch'
    $manifestPath = Join-Path $manifestMismatchRoot 'checksums.sha256'
    $manifestContent = Get-Content -LiteralPath $manifestPath -Raw
    $fakeHash = ('a' * 64)
    $manifestContent = [regex]::Replace($manifestContent, '^[0-9a-fA-F]{64}(\s+offline-images/backend\.tar)', "$fakeHash`$1", 'Multiline')
    Set-Content -LiteralPath $manifestPath -Value $manifestContent -Encoding ASCII
    $manifestMismatchResult = Invoke-LoaderFixture -ProjectRoot $manifestMismatchRoot -LogPath (Join-Path $fixtureRoot 'manifest-mismatch.log')
    Assert-LoaderTest ($manifestMismatchResult.ExitCode -ne 0) 'Un manifiesto manipulado debe fallar cerrado.'
    Assert-LoaderTest (@(Get-LoadedTarNames -LogPath (Join-Path $fixtureRoot 'manifest-mismatch.log')).Count -eq 0) 'Con manifiesto manipulado no debe ejecutarse docker load.'

    if ($script:Errors.Count -gt 0) {
        Write-Host ("Offline loader test found {0} failing assertions:" -f $script:Errors.Count) -ForegroundColor Red
        foreach ($err in $script:Errors) {
            Write-Host ("  - {0}" -f $err) -ForegroundColor Red
        }
        throw 'Offline loader contract test failed.'
    }

    Write-Host "Offline loader contract test passed: $script:Checks checks."
}
finally {
    $env:PATH = $savedPath
    if ($null -eq $savedShimLog) {
        Remove-Item Env:\SHIM_LOG -ErrorAction SilentlyContinue
    }
    else {
        $env:SHIM_LOG = $savedShimLog
    }

    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
