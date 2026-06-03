# =============================================================================
# Generate a local Certificate Authority + server certificate for HTTPS on
# the hospital LAN. The CA is self-signed and must be installed in the
# Trusted Root Certification Authorities store on every cashier PC.
#
# After this script runs:
#   nginx/ssl/hospital-ca.crt.pem     - the CA cert to install on clients
#   nginx/ssl/hospital-server.crt.pem - the server cert
#   nginx/ssl/hospital-server.key.pem - the server private key (keep on server)
#
# The generated materials are git-ignored.
# =============================================================================

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $ServerIp,
    [string] $CommonName = "hospital.local",
    [int] $ValidDays = 825,
    [string] $OutDir
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath "$PSScriptRoot\lib\openssl_helpers.ps1")) {
    Write-Error "Missing scripts/lib/openssl_helpers.ps1"
    exit 2
}
. "$PSScriptRoot\lib\openssl_helpers.ps1"

if (-not $OutDir) {
    $OutDir = (Resolve-Path (Join-Path $PSScriptRoot "..\nginx\ssl")).Path
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$caKey = Join-Path $OutDir "hospital-ca.key.pem"
$caCert = Join-Path $OutDir "hospital-ca.crt.pem"
$serverKey = Join-Path $OutDir "hospital-server.key.pem"
$serverCert = Join-Path $OutDir "hospital-server.crt.pem"
$serverCsr = Join-Path $OutDir "hospital-server.csr.pem"
$serial = Join-Path $OutDir "hospital-ca.srl"
$conf = Join-Path $OutDir "openssl.cnf"

Write-Host "[*] Generando CA local ($CommonName, valido $ValidDays dias)..." -ForegroundColor Yellow
New-HospitalCaKey -KeyPath $caKey
New-HospitalSelfSignedCert `
    -KeyPath $caKey `
    -CertPath $caCert `
    -Subject "/CN=$CommonName Hospital CA" `
    -ValidDays $ValidDays `
    -IsCa

Write-Host "[*] Generando certificado de servidor para $ServerIp..." -ForegroundColor Yellow
New-HospitalServerKey -KeyPath $serverKey
New-HospitalCsr `
    -KeyPath $serverKey `
    -CsrPath $serverCsr `
    -ConfigPath $conf `
    -ServerIp $ServerIp `
    -CommonName $CommonName

New-HospitalSignedCert `
    -CaKey $caKey `
    -CaCert $caCert `
    -SerialFile $serial `
    -CsrPath $serverCsr `
    -CertPath $serverCert `
    -ValidDays $ValidDays

Write-Host ""
Write-Host "[OK] Materiales generados en $OutDir" -ForegroundColor Green
Write-Host ""
Write-Host "  CA   : $caCert" -ForegroundColor White
Write-Host "  Cert : $serverCert" -ForegroundColor White
Write-Host "  Key  : $serverKey" -ForegroundColor White
Write-Host ""
Write-Host "SIGUIENTE PASO:" -ForegroundColor Yellow
Write-Host "  1. En cada PC cliente, instalar $caCert en" -ForegroundColor White
Write-Host "     'Entidades de certificacion raiz de confianza'." -ForegroundColor White
Write-Host "  2. Apuntar nginx a $serverCert y $serverKey." -ForegroundColor White
Write-Host "  3. Cambiar APP_URL a https://$ServerIp en backend/.env." -ForegroundColor White
Write-Host "  4. Activar el bloque 'server { listen 443 ssl ... }' en nginx/default.conf." -ForegroundColor White
exit 0
