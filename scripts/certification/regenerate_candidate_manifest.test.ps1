#Requires -Version 5.1

# Pruebas de regenerate_candidate_manifest.ps1.
#
# Contrato de seguridad (HS-RECON-01):
#   - Este test NUNCA borra, crea ni modifica instalaciones reales de Inno
#     Setup. Todo ISCC.exe de prueba vive en un sandbox bajo %TEMP% y se
#     inyecta con S_HOSPITAL_CERT_ISCC_DIR, un override de uso exclusivo para
#     certificacion que hace que el script bajo prueba ignore el PATH y las
#     rutas de sistema.
#   - T0 audita el propio archivo: prohibe referencias a rutas reales de
#     instalacion y Remove-Item con rutas absolutas.
#   - El finally restaura las variables de entorno y elimina el sandbox.

$ErrorActionPreference = 'Stop'

$script:Tests = [ordered]@{}
$script:Errors = New-Object System.Collections.Generic.List[string]

function Assert-State {
    param([string]$Name, [string]$Actual, [string]$Expected)
    $script:Tests[$Name] = $Actual
    if ($Actual -ne $Expected) {
        $script:Errors.Add("${Name}: esperado '$Expected', obtenido '$Actual'") | Out-Null
    }
}

function Assert-Contains {
    param([string]$Name, [string]$Value, [string]$Expected)
    $script:Tests[$Name] = $Value
    if (-not ($Value -like "*$Expected*")) {
        $script:Errors.Add("${Name}: '$Value' no contiene '$Expected'") | Out-Null
    }
}

function Assert-NotContains {
    param([string]$Name, [string]$Value, [string]$Forbidden)
    $script:Tests[$Name] = 'AUSENTE'
    if ($Value -like "*$Forbidden*") {
        $script:Tests[$Name] = 'HALLADO'
        $script:Errors.Add("${Name}: no debe contener '$Forbidden'") | Out-Null
    }
}

function Assert-NotNull {
    param([string]$Name, [object]$Value)
    $script:Tests[$Name] = if ($null -eq $Value) { 'NULL' } else { 'NOT NULL' }
    if ($null -eq $Value) {
        $script:Errors.Add("${Name}: es NULL") | Out-Null
    }
}

function Assert-Null {
    param([string]$Name, [object]$Value)
    $script:Tests[$Name] = if ($null -eq $Value) { 'NULL' } else { 'NOT NULL' }
    if ($null -ne $Value) {
        $script:Errors.Add("${Name}: deberia ser NULL pero es '$Value'") | Out-Null
    }
}

function New-Sandbox {
    param([string]$Name)
    $root = Join-Path $script:SandboxRoot ("case-" + $Name + "-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    return $root
}

function Initialize-RealGit {
    param([string]$Repo)
    # Inicializa un repo git real dentro del sandbox para que el script
    # encuentre HEAD y rama sin depender del repositorio del proyecto.
    & git -C $Repo init -q -b main 2>&1 | Out-Null
    $probeFile = Join-Path $Repo '.git-probe'
    Set-Content -LiteralPath $probeFile -Value 'init'
    & git -C $Repo add .git-probe 2>&1 | Out-Null
    & git -C $Repo -c user.email=test@example.com -c user.name=test commit -m init -q 2>&1 | Out-Null
    Remove-Item -LiteralPath $probeFile -Force -ErrorAction SilentlyContinue
    & git -C $Repo commit --allow-empty -m 'second' -q 2>&1 | Out-Null
}

function Run-Regenerate {
    param([string]$ProjectRoot, [string]$Candidate)
    & "$PSScriptRoot\regenerate_candidate_manifest.ps1" -ProjectRoot $ProjectRoot -Candidate $Candidate 2>&1 | Out-Null
    return Get-Content -LiteralPath (Join-Path $Candidate 'CANDIDATE-MANIFEST.json') -Raw | ConvertFrom-Json
}

$originalPath = $env:PATH
$isccOverrideWasDefined = Test-Path Env:S_HOSPITAL_CERT_ISCC_DIR
$originalIsccOverride = $env:S_HOSPITAL_CERT_ISCC_DIR
$tempRoot = [System.IO.Path]::GetTempPath()
$script:SandboxRoot = Join-Path $tempRoot ("s-hospital-cert-test-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $script:SandboxRoot | Out-Null

try {
    # PATH base: solo git + temp (sin ISCC) para todos los casos.
    $gitExe = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
    $gitDir = if ($gitExe) { Split-Path -Parent $gitExe } else { $null }
    $env:PATH = if ($gitDir) { "$gitDir;$tempRoot" } else { $tempRoot }

    # --- T0: auditoria estatica del propio test (nunca tocar rutas reales) ---
    $selfSource = Get-Content -LiteralPath $PSCommandPath -Raw
    $forbiddenPatterns = [ordered]@{
        'remove-real-iscc'    = ('Remove' + '-RealIscc')
        'restore-real-iscc'   = ('Restore' + '-RealIscc')
        'ruta-inno-real'      = ('Inno' + ' Setup' + ' 6')
        'ruta-program-files'  = ('Program' + ' Files')
        'env-programfiles'    = ('$env:' + 'ProgramFiles')
        'env-programfilesx86' = ('${env:' + 'ProgramFiles')
        'env-localappdata'    = ('$env:' + 'LOCALAPPDATA')
    }
    foreach ($entry in $forbiddenPatterns.GetEnumerator()) {
        Assert-NotContains ("T0.sin-" + $entry.Key) $selfSource $entry.Value
    }

    $absoluteRemoveLines = @([regex]::Matches($selfSource, '(?im)^.*\bRemove-Item\b.*$') |
        Where-Object { $_.Value -match '[A-Za-z]:\\' })
    Assert-State 'T0.remove-item-sin-ruta-absoluta' ([string]$absoluteRemoveLines.Count) '0'
    Assert-State 'T0.sandbox-bajo-temp' ([string]$script:SandboxRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase)) 'True'

    # --- Test 1: estado BLOCKED_ON_ISCC_NOT_AVAILABLE ---
    $repo1 = New-Sandbox -Name 'no-iscc-no-build'
    $candidate1 = Join-Path $repo1 'installer-output/STAGING-PENDING-CERTIFICACION'
    New-Item -ItemType Directory -Force -Path $candidate1 | Out-Null
    Initialize-RealGit -Repo $repo1

    # Override hacia un directorio sandbox que no contiene ISCC.exe.
    $env:S_HOSPITAL_CERT_ISCC_DIR = Join-Path $script:SandboxRoot 'iscc-ausente'
    $m1 = Run-Regenerate -ProjectRoot $repo1 -Candidate $candidate1
    Assert-State 'T1.status' $m1.certification_status 'BLOCKED_ON_ISCC_NOT_AVAILABLE'
    Assert-State 'T1.installer' $m1.installer 'NOT BUILT'
    Assert-State 'T1.blocker' $m1.blocker 'ISCC_NOT_AVAILABLE'
    Assert-Contains 'T1.required_artifacts' ($m1.required_artifacts_missing -join ',') 'S_Hospital-Instalador.exe'
    Assert-Null 'T1.sha' $m1.installer_sha256
    Assert-Null 'T1.iscc_path' $m1.iscc_path

    # --- Test 2: estado ISCC_AVAILABLE_BUT_NOT_BUILT ---
    $repo2 = New-Sandbox -Name 'iscc-no-build'
    $candidate2 = Join-Path $repo2 'installer-output/STAGING-PENDING-CERTIFICACION'
    New-Item -ItemType Directory -Force -Path $candidate2 | Out-Null
    Initialize-RealGit -Repo $repo2

    $isccSandbox = Join-Path $script:SandboxRoot 'iscc-sandbox'
    New-Item -ItemType Directory -Force -Path $isccSandbox | Out-Null
    Set-Content -LiteralPath (Join-Path $isccSandbox 'ISCC.exe') -Value 'fake-iscc' -Encoding ASCII
    $env:S_HOSPITAL_CERT_ISCC_DIR = $isccSandbox

    $m2 = Run-Regenerate -ProjectRoot $repo2 -Candidate $candidate2
    Assert-State 'T2.status' $m2.certification_status 'ISCC_AVAILABLE_BUT_NOT_BUILT'
    Assert-State 'T2.installer' $m2.installer 'NOT BUILT'
    Assert-NotNull 'T2.iscc_path' $m2.iscc_path
    Assert-Contains 'T2.iscc_path.sandbox' ([string]$m2.iscc_path) $script:SandboxRoot

    # --- Test 3: estado BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION ---
    $repo3 = New-Sandbox -Name 'iscc-and-build'
    $candidate3 = Join-Path $repo3 'installer-output/STAGING-PENDING-CERTIFICACION'
    $buildDir3 = Join-Path $repo3 'installer-output/build'
    New-Item -ItemType Directory -Force -Path $buildDir3 | Out-Null
    $exe3 = Join-Path $buildDir3 'S_Hospital-Instalador.exe'
    # Crear un ejecutable de tamano > 0 con contenido fijo.
    $exeBytes = New-Object byte[] 1024
    for ($i = 0; $i -lt 1024; $i++) { $exeBytes[$i] = [byte]($i % 256) }
    [System.IO.File]::WriteAllBytes($exe3, $exeBytes)
    New-Item -ItemType Directory -Force -Path $candidate3 | Out-Null
    Initialize-RealGit -Repo $repo3

    $env:S_HOSPITAL_CERT_ISCC_DIR = $isccSandbox
    $m3 = Run-Regenerate -ProjectRoot $repo3 -Candidate $candidate3
    Assert-State 'T3.status' $m3.certification_status 'BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION'
    Assert-State 'T3.installer' $m3.installer 'BUILT'
    Assert-NotNull 'T3.sha' $m3.installer_sha256
    Assert-Contains 'T3.iscc_path.sandbox' ([string]$m3.iscc_path) $script:SandboxRoot
    if ($m3.installer_size_bytes -ne 1024) {
        $script:Errors.Add("T3.size: esperado 1024, obtenido $($m3.installer_size_bytes)") | Out-Null
    }
    $script:Tests['T3.size'] = $m3.installer_size_bytes
    Assert-State 'T3.blocker' $m3.blocker 'WINDOWS_CLEAN_INSTALL_REQUIRED'

    if ($script:Errors.Count -gt 0) {
        Write-Host "FAIL: $($script:Errors.Count) error(es) en $($script:Tests.Count) verificaciones"
        foreach ($err in $script:Errors) {
            Write-Host "  - $err"
        }
        throw "Tests fallaron."
    }

    Write-Host "OK: regenerate_candidate_manifest.ps1 cubrio los 3 estados (BLOCKED_ON_ISCC_NOT_AVAILABLE, ISCC_AVAILABLE_BUT_NOT_BUILT, BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION) en $($script:Tests.Count) verificaciones, con auditoria estatica T0 y sandbox hermetico."
    exit 0
} finally {
    if ($isccOverrideWasDefined) {
        $env:S_HOSPITAL_CERT_ISCC_DIR = $originalIsccOverride
    } else {
        Remove-Item Env:S_HOSPITAL_CERT_ISCC_DIR -ErrorAction SilentlyContinue
    }
    $env:PATH = $originalPath
    if (Test-Path -LiteralPath $script:SandboxRoot) {
        Remove-Item -LiteralPath $script:SandboxRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
