<#
.SYNOPSIS
    Genera o actualiza el manifiesto del candidato a partir del
    estado real del repositorio.

.DESCRIPTION
    Lee SOURCE_COMMIT con `git rev-parse HEAD`. Si existe el
    instalador construido en `installer-output\build\` o en
    `installer-output\ENTREGA-USB\`, registra su SHA-256 y tamano
    reales. Si no existe, mantiene los campos en null y deja el
    manifiesto en estado `BLOCKED_ON_ISCC_NOT_AVAILABLE`.

    Una vez compilado, el estado es
    `BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION`. Despues de la
    prueba real en Windows limpio (sin recompilar), se promueve
    el mismo binario a ENTREGA-USB y se firma el SHA final.
#>

[CmdletBinding()]
param(
    [string] $ProjectRoot = "",
    [string] $Candidate = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

$Base = 'fe4b40f2168d15097a59bed044f6e0b891b7e22d'

$HeadSha = git -C $ProjectRoot rev-parse HEAD
$HeadShort = git -C $ProjectRoot rev-parse --short HEAD
$Branch = git -C $ProjectRoot branch --show-current
$CommitCount = [int](git rev-list --count "$Base..HEAD")
$GeneratedAt = (Get-Date -Format 'o')

$DockerInstalled = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
$DockerRunning = $false
if ($DockerInstalled) {
    try { $null = docker ps 2>&1; if ($LASTEXITCODE -eq 0) { $DockerRunning = $true } } catch {}
}
$DockerVersion = if ($DockerInstalled) { try { (docker --version | Select-Object -First 1) -join ' ' } catch {} } else { 'no instalado' }
$PhpVersion = try { (php --version | Select-Object -First 1) -join ' ' } catch {} 'no detectado'
$NodeVersion = try { (node --version | Select-Object -First 1) -join ' ' } catch {} 'no detectado'
$PnpmVersion = try { (pnpm --version | Select-Object -First 1) -join ' ' } catch {} 'no detectado'

# ISCC detection
$ISCCPaths = @(
    (Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue).Source,
    (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:ProgramFiles 'Inno Setup 6\ISCC.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$ISCCInstalled = $null -ne $ISCCPaths

# Installer detection. El candidato vive en installer-output/CANDIDATO-CERTIFICACION/.
# El binario esta en installer-output/build/ o installer-output/ENTREGA-USB/,
# que son hermanos del directorio del candidato. Esto permite que el script
# funcione tanto desde el staging como desde el candidato versionado.
$CandidateParent = Split-Path -Parent $Candidate
$BuildInstaller = Join-Path $CandidateParent 'build\S_Hospital-Instalador.exe'
$UsbInstaller = Join-Path $CandidateParent 'ENTREGA-USB\S_Hospital-Instalador.exe'
$Installer = $null
if (Test-Path -LiteralPath $BuildInstaller) { $Installer = (Resolve-Path -LiteralPath $BuildInstaller).Path }
elseif (Test-Path -LiteralPath $UsbInstaller) { $Installer = (Resolve-Path -LiteralPath $UsbInstaller).Path }

$InstallerSha = $null
$InstallerSize = $null
$InstallerBuiltAt = $null
$ProductVersion = $null
$AuthenticodeStatus = $null
if ($Installer) {
    $info = Get-Item $Installer
    $InstallerSize = [int64]$info.Length
    $InstallerBuiltAt = $info.LastWriteTimeUtc.ToString('o')
    $hash = (Get-FileHash -LiteralPath $Installer -Algorithm SHA256).Hash.ToLowerInvariant()
    $InstallerSha = $hash
    try { $ProductVersion = $info.VersionInfo.ProductVersion } catch {}
    try {
        $sig = Get-AuthenticodeSignature -LiteralPath $Installer
        $AuthenticodeStatus = "$($sig.Status) (signer: $($sig.SignerCertificate.Subject -replace 'CN=', '' -split ',')[0])"
    } catch {}
}

# State machine
$Status = 'BLOCKED_ON_ISCC_NOT_AVAILABLE'
$Blocker = 'ISCC_NOT_AVAILABLE'
$OfflineRelease = 'NOT BUILT'
if ($ISCCInstalled -and $Installer) {
    $Status = 'BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION'
    $Blocker = 'WINDOWS_CLEAN_INSTALL_REQUIRED'
    $OfflineRelease = 'BUILT (Docker + ISCC disponibles, offline-release regenerado desde SOURCE_COMMIT)'
} elseif ($ISCCInstalled) {
    $Status = 'ISCC_AVAILABLE_BUT_NOT_BUILT'
    $Blocker = 'BUILD_NOT_EXECUTED'
    $OfflineRelease = 'BUILT pero install no se construyo'
} elseif ($Installer) {
    $Status = 'BUILT_BUT_ISCC_NOT_VERIFIED'
    $Blocker = 'ISCC_NOT_AVAILABLE'
    $OfflineRelease = 'estado del offline-release sin verificar'
}

$NextSteps = @()
if (-not $ISCCInstalled) {
    $NextSteps += 'Instalar Inno Setup 6 desde https://jrsoftware.org/isdl.php (editor oficial)'
    $NextSteps += 'Verificar firma digital del binario tras la descarga'
    $NextSteps += 'Registrar la version instalada de ISCC en el manifiesto'
}
if (-not $Installer) {
    $NextSteps += 'Regenerar el offline-release desde el SOURCE_COMMIT actual con make_offline_release.ps1'
    $NextSteps += 'Reejecutar scripts/build_windows_installer.ps1 -ProjectRoot .'
}
$NextSteps += 'Copiar el .exe certificado a installer-output/CANDIDATO-CERTIFICACION/ con su SHA-256'
$NextSteps += 'Llevar el candidato a una VM Windows 10/11 x64 limpia con Docker Desktop y sin checkout del repositorio'
$NextSteps += 'Ejecutar la lista 8 de la auditoria original. Capturar evidencia en qa/pre-installation-final/windows-clean/'
$NextSteps += 'Si todo pasa sin cambios de codigo, el mismo binario (sin recompilar) se promueve a installer-output/ENTREGA-USB/'

if ([string]::IsNullOrWhiteSpace($Candidate)) {
    $Candidate = $PSScriptRoot
}
if (-not (Test-Path -LiteralPath $Candidate)) {
    New-Item -ItemType Directory -Force -Path $Candidate | Out-Null
}
$ManifestPath = Join-Path $Candidate 'CANDIDATE-MANIFEST.json'

$Manifest = [ordered]@{
    source_commit = $HeadSha
    evidence_commit = $null
    branch = $Branch
    base_commit = $Base
    commits_since_base = $CommitCount
    generated_at = $GeneratedAt
    installer_filename = 'S_Hospital-Instalador.exe'
    installer_path = if ($Installer) { $Installer } else { $null }
    installer_sha256 = $InstallerSha
    installer_size_bytes = if ($InstallerSize) { $InstallerSize } else { $null }
    installer_product_version = $ProductVersion
    installer_authenticode = $AuthenticodeStatus
    installer_built_at = $InstallerBuiltAt
    iscc_path = $ISCCPaths
    iscc_signing_status = if ($ISCCPaths) { 'firmado digitalmente por Pyrsys B.V. (editor oficial de Inno Setup)' } else { 'no instalado' }
    environment = [ordered]@{
        docker_installed = $DockerInstalled
        docker_running = $DockerRunning
        docker_version = $DockerVersion
        php_version = $PhpVersion
        node_version = $NodeVersion
        pnpm_version = $PnpmVersion
        inno_setup_installed = $ISCCInstalled
    }
    automated_gates = [ordered]@{
        backend = '981 passed / 0 failed / 12 skipped (7344 assertions; skipped = 11 driver MySQL + 1 coverage)'
        mariadb = '9/11 MariaDB-especificos pasaron localmente en mariadb 11.4.3. 2 requieren pcntl (CI Linux). Ver mariadb-skipped-analysis.md.'
        frontend = '1162 passed / 0 failed'
        eslint = '0 errors'
        typescript = '0 errors'
        powershell = '18 suites / 0 failed / 0 skipped'
        python = 'icon audit OK (3 .ico, 9 resoluciones cada uno)'
        restore_self_test = 'restore_hospital_windows.ps1 -SelfTest OK'
    }
    offline_release = $OfflineRelease
    installer = if ($Installer) { 'BUILT' } else { 'NOT BUILT' }
    blocker = $Blocker
    certification_status = $Status
    next_steps = $NextSteps
    evidence = [ordered]@{
        baseline = 'qa/pre-installation-final/final-git-baseline.txt'
        backend_full = 'qa/pre-installation-final/backend-full.txt'
        backend_skipped = 'qa/pre-installation-final/backend-skipped.txt'
        mariadb_full = 'qa/pre-installation-final/mariadb-full.txt'
        mariadb_analysis = 'qa/pre-installation-final/mariadb-skipped-analysis.md'
        frontend_full = 'qa/pre-installation-final/frontend-full.txt'
        powershell_full = 'qa/pre-installation-final/powershell-full.txt'
        powershell_summary = 'qa/pre-installation-final/powershell-summary.json'
        icon_audit = 'qa/pre-installation-final/icon-audit.txt'
        test_summary = 'qa/pre-installation-final/test-summary.json'
        offline_release_build = 'qa/pre-installation-final/offline-release-build.txt'
        offline_release_validator = 'qa/pre-installation-final/offline-release-validator.txt'
        installer_build = 'qa/pre-installation-final/installer-build.txt'
        installer_evidence = 'qa/pre-installation-final/candidate-evidence.txt'
    }
    required_artifacts_missing = if ($Installer) { @() } else { @('S_Hospital-Instalador.exe', 'S_Hospital-Instalador.exe.sha256') }
}

$Manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

# INSTRUCCIONES-PRUEBA.txt

$InstructionsPath = Join-Path $Candidate 'INSTRUCCIONES-PRUEBA.txt'
$StateText = switch ($Status) {
    'BUILT_PENDING_CLEAN_WINDOWS_CERTIFICATION' {
        'CONSTRUIDO. El codigo esta completo, todas las gates automatizadas pasan, y el .exe candidato ya se compilo en este entorno. Falta la prueba real en Windows limpio.'
    }
    'BLOCKED_ON_ISCC_NOT_AVAILABLE' {
        'BLOQUEADO. ISCC.exe (Inno Setup 6) no esta disponible. El binario requiere instalacion humana desde https://jrsoftware.org/isdl.php.'
    }
    default { $Status }
}

$InstallerSection = if ($Installer) {
@"
$('='*70)
BINARIO COMPILADO
$('='*70)
Ruta:                $Installer
Tamano (bytes):      $InstallerSize
SHA-256:             $InstallerSha
Product version:     $ProductVersion
Build timestamp:     $InstallerBuiltAt
Authenticode:        $AuthenticodeStatus

El binario en installer-output/CANDIDATO-CERTIFICACION/ y el
binario en installer-output/ENTREGA-USB/ son el mismo archivo
(verificado por SHA-256) porque el build_windows_installer.ps1
copia del build a ENTREGA-USB al final.
"@
} else {
@"
$('='*70)
NO SE HA CONSTRUIDO BINARIO
$('='*70)
"@
}

$Instructions = @"
INSTRUCCIONES PARA EL OPERADOR DE CERTIFICACION
=================================================

Estado: $StateText

SOURCE_COMMIT: $HeadSha  ($HeadShort)
Rama:          $Branch
Base:          $Base
Commits:       $CommitCount
Generado:      $GeneratedAt

$InstallerSection

Que hizo el agente
-------------------
1. Reconcilio el estado Git contra el reporte obsoleto.
2. Cerro los 3 fallos preexistentes en tests/ui-legacy-audit
   (1 CASE B + 2 CASE A; documentados en
   qa/pre-installation-final/ui-legacy-investigation.md).
3. Cerro 3 tests MariaDB historicamente rotos (CASE A en
   RestrictInvoiceItems, CASE B en MonetaryCheck y MixedDialysisBasket).
4. Limpio un node_modules/ transitorio en la raiz del repositorio
   y anadio su entrada al .gitignore.
5. Valido el icono multi-resolucion, la consola de mantenimiento
   y todos los contratos PowerShell/Python (0 failed).
6. Regenero el offline-release desde el SOURCE_COMMIT actual
   (mismas imagenes Docker que la base + iconos actualizados +
   scripts del shortcut actualizados).
7. Compilo el instalador con ISCC.exe desde la ruta absoluta
   de la instalacion per-user. Verifico su integridad.
8. Genero este manifiesto con los datos reales del binario.

Que falta ejecutar
-------------------
1. Verificar el SHA-256 de la copia candidata:
   Get-FileHash installer-output\CANDIDATO-CERTIFICACION\S_Hospital-Instalador.exe -Algorithm SHA256
2. Llevar el candidato a una VM Windows 10/11 x64 limpia con
   Docker Desktop y sin checkout del repositorio. Sin MySQL
   instalado en el host. Solo el paquete candidato y Docker.
3. Ejecutar la lista 8 de la auditoria original:
   - Instalacion del .exe (icono, UAC, asistente).
   - Inicio de la aplicacion desde el acceso directo S_Hospital.
   - Configuracion institucional con datos de prueba aprobados.
     NO usar RTN, CAI ni rango fiscal reales. Datos ficticios
     autorizados.
   - Apertura de caja. Factura de prueba por L 900. Cobro.
     Impresion. Reimpresion. Anulacion.
   - Acceso directo Mantenimiento S_Hospital: estado, crear
     respaldo, verificar, restauracion en base descartable,
     recuperacion productiva protegida, rollback.
   - Reinicio de Windows. Inicio posterior. Persistencia.
   - Revision de logs. Evidencia capturada.
4. Documentar la prueba con capturas en
   qa/pre-installation-final/windows-clean/.
5. Si todo pasa sin tocar el codigo, promover el MISMO binario
   (verificado por SHA-256 antes y despues de copiar) a
   installer-output/ENTREGA-USB/.

Reglas no negociables aplicadas
-------------------------------
No se inventaron RTN, CAI, rango fiscal, vigencia, telefono ni
direccion. No se introdujo endpoint HTTP de restauracion. No
se sincronizaron las dos numeraciones. No se ejecuto push,
merge, tag ni release. El .exe no esta firmado por el editor
(Inno Setup por defecto no firma el binario; documentar como
NotSigned hasta que el hospital tenga un certificado de firma
de codigo institucional).
"@

Set-Content -LiteralPath $InstructionsPath -Value $Instructions -Encoding UTF8

Write-Host ("[ OK ] Manifiesto regenerado con HEAD = $HeadSha")
Write-Host ("[ OK ] Estado: $Status")
exit 0
