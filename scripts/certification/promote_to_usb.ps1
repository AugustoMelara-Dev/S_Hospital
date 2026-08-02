<#
.SYNOPSIS
    Promueve el candidato certificado a la carpeta oficial de
    entrega USB, sin recompilar.

.DESCRIPTION
    Reglas duras:
    - No invoca ISCC. El binario ya existe.
    - Verifica que el SHA-256 de la copia candidata coincide con el
      SHA-256 declarado en el manifiesto (source of truth).
    - Verifica que existe un archivo de resultados de certificacion
      con status = PASSED en qa/pre-installation-final/windows-clean/.
      Sin ese archivo, esta funcion aborta.
    - Copia el .exe, el .sha256, el manifiesto y la evidencia a
      installer-output/ENTREGA-USB/.
    - Re-verifica el SHA origen y destino. Si difieren, aborta.
    - Actualiza el manifiesto a
      certification_status = CLEAN_WINDOWS_CERTIFIED.
#>

[CmdletBinding()]
param(
    [string] $ProjectRoot = "",
    [string] $EvidenceDir = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path (Join-Path $PSScriptRoot '..') '..')).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
    $EvidenceDir = Join-Path $ProjectRoot 'qa/pre-installation-final/windows-clean'
}

$Staging = Join-Path $ProjectRoot 'installer-output/STAGING-PENDING-CERTIFICACION'
$StagingExe = Join-Path $Staging 'S_Hospital-Instalador.exe'
$StagingHash = Join-Path $Staging 'S_Hospital-Instalador.exe.sha256'
$StagingManifest = Join-Path $Staging 'CANDIDATE-MANIFEST.json'

$UsbDir = Join-Path $ProjectRoot 'installer-output/ENTREGA-USB'
$UsbExe = Join-Path $UsbDir 'S_Hospital-Instalador.exe'
$UsbHash = Join-Path $UsbDir 'S_Hospital-Instalador.exe.sha256'
$UsbManifest = Join-Path $UsbDir 'CANDIDATE-MANIFEST.json'

$ResultFile = Join-Path $EvidenceDir 'RESULT.json'
$Validator = Join-Path $PSScriptRoot 'validate_windows_clean_result.ps1'
$NoEntregarFile = Join-Path $UsbDir 'NO_ENTREGAR_AUN.txt'

if (-not (Test-Path -LiteralPath $Validator -PathType Leaf)) {
    throw "Falta el validador obligatorio: $Validator"
}
$validatorOutput = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Validator -ProjectRoot $ProjectRoot -EvidenceDir $EvidenceDir 2>&1
$validatorExitCode = $LASTEXITCODE
foreach ($line in @($validatorOutput)) {
    Write-Host ([string]$line)
}
if ($validatorExitCode -ne 0) {
    throw 'El validador de Windows limpio rechazo la promocion.'
}

function Assert-EqualHash {
    param([string]$PathA, [string]$PathB, [string]$Label)
    $a = (Get-FileHash -LiteralPath $PathA -Algorithm SHA256).Hash.ToLowerInvariant()
    $b = (Get-FileHash -LiteralPath $PathB -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($a -ne $b) {
        throw "$Label divergen: $a vs $b"
    }
    Write-Host "[ OK ] $Label coinciden: $a"
}

# 1. El candidato en staging debe existir.
foreach ($p in @($StagingExe, $StagingHash, $StagingManifest)) {
    if (-not (Test-Path -LiteralPath $p)) {
        throw "Falta artefacto de staging: $p"
    }
}

# 2. El manifiesto declara el SHA-256 esperado y coincide con la copia.
$manifest = Get-Content -LiteralPath $StagingManifest -Raw | ConvertFrom-Json
$expectedSha = $manifest.installer_sha256
if (-not $expectedSha) {
    throw "El manifiesto no declara installer_sha256. Estado: $($manifest.certification_status)"
}
$expectedSha = $expectedSha.ToLowerInvariant()
$stagingHashContent = (Get-Content -LiteralPath $StagingHash -Raw).Trim().ToLowerInvariant()
if ($stagingHashContent -notmatch "^([0-9a-f]{64})\s") {
    throw "El archivo de hash $StagingHash no tiene formato valido. Contenido: $stagingHashContent"
}
$stagingHashFromFile = ($stagingHashContent -split '\s+')[0]
if ($stagingHashFromFile -ne $expectedSha) {
    throw "El SHA-256 del archivo .sha256 ($stagingHashFromFile) no coincide con el del manifiesto ($expectedSha)"
}
$actualStagingSha = (Get-FileHash -LiteralPath $StagingExe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualStagingSha -ne $expectedSha) {
    throw "El SHA-256 del .exe en staging ($actualStagingSha) no coincide con el del manifiesto ($expectedSha)"
}
Write-Host "[ OK ] Candidato en staging verificado contra el manifiesto"

# 3. La certificacion en Windows limpio debe estar marcada como PASSED.
if (-not (Test-Path -LiteralPath $ResultFile)) {
    throw "No existe $ResultFile. La certificacion en Windows limpio debe estar aprobada antes de promover."
}
$result = Get-Content -LiteralPath $ResultFile -Raw | ConvertFrom-Json
if ($result.status -ne 'PASSED') {
    throw "La certificacion en Windows limpio tiene status = $($result.status). Solo se promueve con status = PASSED."
}
Write-Host "[ OK ] Certificacion en Windows limpio = PASSED (timestamp: $($result.timestamp))"

# 4. Limpiar ENTREGA-USB (quitar NO_ENTREGAR_AUN.txt y cualquier artefacto previo).
if (Test-Path -LiteralPath $NoEntregarFile) { Remove-Item -LiteralPath $NoEntregarFile -Force }
Get-ChildItem -LiteralPath $UsbDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $UsbDir | Out-Null

# 5. Copiar sin recompilar. El .exe debe ser el mismo byte a byte.
Copy-Item -LiteralPath $StagingExe -Destination $UsbExe
Copy-Item -LiteralPath $StagingHash -Destination $UsbHash
Copy-Item -LiteralPath $StagingManifest -Destination $UsbManifest
Write-Host "[ OK ] Copia sin recompilacion completada"

# 6. Re-verificar SHA origen y destino. ESTE es el guard final.
Assert-EqualHash -PathA $StagingExe -PathB $UsbExe -Label 'Hash origen y destino del .exe'

# 7. Actualizar el manifiesto para reflejar el estado post-certificacion.
$manifestJson = Get-Content -LiteralPath $UsbManifest -Raw | ConvertFrom-Json
$manifestJson.certification_status = 'CLEAN_WINDOWS_CERTIFIED'
$manifestJson.usb_promoted_at = (Get-Date -Format 'o')
$manifestJson.delivery_ready = $true
$manifestJson.clean_windows_certification = 'PASSED'
$manifestJson | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $UsbManifest -Encoding UTF8
Write-Host "[ OK ] Manifiesto actualizado a CLEAN_WINDOWS_CERTIFIED"

Write-Host ""
Write-Host "Promocion completada. ENTREGA-USB esta listo para el hospital."
Write-Host "  - .exe:   $UsbExe"
Write-Host "  - SHA:   $expectedSha"
Write-Host "  - State: CLEAN_WINDOWS_CERTIFIED"
exit 0
