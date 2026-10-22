#Requires -Version 5.1
<#
.SYNOPSIS
    Genera una CA local y un certificado de servidor TLS para la LAN del hospital.

.DESCRIPTION
    Crea los materiales que consume nginx/tls.conf:
        hospital-ca.crt.pem        Certificado raiz (se instala como CA de confianza)
        hospital-ca.key.pem        Clave privada de la CA (custodia local, NO compartir)
        hospital-server.crt.pem    Certificado del servidor con SAN
        hospital-server.key.pem    Clave privada del servidor
        hospital-server.csr.pem    CSR (solo ruta openssl)
        openssl.cnf                Plantilla SAN (solo ruta openssl)

    Rutas de generacion:
      1. openssl (PATH, Git for Windows, XAMPP u OpenSSL-Win64). Permite REUTILIZAR
         la CA existente al renovar el certificado del servidor.
      2. Sin openssl: New-SelfSignedCertificate + exportacion .NET (PowerShell 5.1).
         La clave del servidor se exporta como PKCS#1 PEM con un codificador DER
         propio; la CA se regenera porque .NET Framework no puede releer una clave
         PEM para firmar. Si la CA ya existe y no hay openssl, use -Force solo si
         acepta reinstalar la CA en cada PC cliente.

    El script NUNCA imprime material de clave: solo rutas, huellas y fechas.

.PARAMETER ServerIp
    IP fija del servidor en la LAN. Se agrega como SAN IPAddress.

.PARAMETER ServerNames
    Nombres DNS adicionales (opcional). Se agregan como SAN DNS.

.PARAMETER OutDir
    Carpeta destino. Por defecto <repo>\nginx\ssl (ignorada por git).

.PARAMETER Force
    Regenera/sobrescribe. Con CA existente y openssl: renueva solo el certificado
    del servidor conservando la CA (los clientes no reinstalan nada).

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\generate_local_ca.ps1 -ServerIp 192.168.1.10 -ServerNames hospital.local -Force
#>
[CmdletBinding()]
param(
    [string] $ServerIp = "",

    [string[]] $ServerNames = @(),

    [string] $OutDir = "",

    [string] $CaCommonName = "S_Hospital Local CA",

    [string] $Organization = "Hospital General San Isidro",

    [ValidateRange(1, 36500)]
    [int] $CaValidDays = 3650,

    [ValidateRange(1, 825)]
    [int] $ServerValidDays = 825,

    [switch] $Force,

    # Fuerza la ruta New-SelfSignedCertificate + exportacion .NET aunque exista
    # openssl. Util para probar el fallback en cualquier maquina.
    [switch] $UseWindowsCertificateStore,

    # Solo para pruebas: define funciones y retorna antes de generar nada.
    [switch] $DefinitionsOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# ---------------------------------------------------------------------------
# Helpers (tambien disponibles con -DefinitionsOnly para los tests)
# ---------------------------------------------------------------------------

function Join-Bytes([byte[][]] $Parts) {
    $result = New-Object System.Collections.Generic.List[byte]
    foreach ($part in $Parts) {
        foreach ($byte in $part) {
            $result.Add($byte)
        }
    }

    return , $result.ToArray()
}

function ConvertTo-DerLength([int] $Length) {
    if ($Length -lt 0) {
        throw "DER length must be non-negative."
    }

    if ($Length -lt 0x80) {
        return , ([byte[]] @([byte] $Length))
    }

    $buffer = New-Object System.Collections.Generic.List[byte]
    $remaining = $Length
    while ($remaining -gt 0) {
        $buffer.Insert(0, [byte] ($remaining -band 0xFF))
        $remaining = $remaining -shr 8
    }

    $result = New-Object System.Collections.Generic.List[byte]
    $result.Add([byte] (0x80 -bor $buffer.Count))
    foreach ($byte in $buffer) {
        $result.Add($byte)
    }

    return , $result.ToArray()
}

function ConvertTo-DerInteger([byte[]] $Value) {
    if ($Value.Length -eq 0) {
        throw "DER integer cannot be empty."
    }

    $start = 0
    while (($start -lt $Value.Length - 1) -and ($Value[$start] -eq 0x00)) {
        $start++
    }

    $minimal = New-Object System.Collections.Generic.List[byte]
    for ($index = $start; $index -lt $Value.Length; $index++) {
        $minimal.Add($Value[$index])
    }

    if (($minimal[0] -band 0x80) -ne 0) {
        $minimal.Insert(0, [byte] 0x00)
    }

    $body = New-Object System.Collections.Generic.List[byte]
    $body.Add([byte] 0x02)
    foreach ($byte in (ConvertTo-DerLength $minimal.Count)) {
        $body.Add($byte)
    }
    foreach ($byte in $minimal) {
        $body.Add($byte)
    }

    return , $body.ToArray()
}

function ConvertTo-DerSequence([byte[][]] $Items) {
    $content = Join-Bytes $Items

    return Join-Bytes @(
        [byte[]] @(0x30),
        (ConvertTo-DerLength $content.Length),
        $content
    )
}

function ConvertTo-PemText([string] $Label, [byte[]] $Der) {
    $builder = New-Object System.Text.StringBuilder
    [void] $builder.AppendLine("-----BEGIN $Label-----")
    $base64 = [Convert]::ToBase64String($Der)
    for ($index = 0; $index -lt $base64.Length; $index += 64) {
        [void] $builder.AppendLine($base64.Substring($index, [Math]::Min(64, $base64.Length - $index)))
    }
    [void] $builder.AppendLine("-----END $Label-----")

    return $builder.ToString()
}

function ConvertTo-RsaPrivateKeyPem([System.Security.Cryptography.RSA] $Rsa) {
    $parameters = $Rsa.ExportParameters($true)
    $der = ConvertTo-DerSequence @(
        (ConvertTo-DerInteger ([byte[]] @(0x00))),
        (ConvertTo-DerInteger $parameters.Modulus),
        (ConvertTo-DerInteger $parameters.Exponent),
        (ConvertTo-DerInteger $parameters.D),
        (ConvertTo-DerInteger $parameters.P),
        (ConvertTo-DerInteger $parameters.Q),
        (ConvertTo-DerInteger $parameters.DP),
        (ConvertTo-DerInteger $parameters.DQ),
        (ConvertTo-DerInteger $parameters.InverseQ)
    )

    return ConvertTo-PemText 'RSA PRIVATE KEY' $der
}

function Read-PemCertificate([string] $Path) {
    $content = [System.IO.File]::ReadAllText($Path)
    $match = [regex]::Match(
        $content,
        '-----BEGIN CERTIFICATE-----(?<body>[A-Za-z0-9+/=\s]+)-----END CERTIFICATE-----'
    )
    if (-not $match.Success) {
        throw "No PEM certificate found at $Path"
    }

    $der = [Convert]::FromBase64String(($match.Groups['body'].Value -replace '\s', ''))

    return [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($der)
}

function Get-SanGeneralNames([System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate) {
    $extension = $Certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.17' } | Select-Object -First 1
    if ($null -eq $extension) {
        return @()
    }

    $raw = $extension.RawData
    $names = New-Object System.Collections.Generic.List[object]

    function Read-DerElement([byte[]] $Data, [ref] $Offset) {
        $index = $Offset.Value
        if ($index -ge $Data.Length) {
            throw 'Malformed DER element.'
        }

        $tag = $Data[$index]
        $index++
        $lengthByte = $Data[$index]
        $index++
        if (($lengthByte -band 0x80) -ne 0) {
            $lengthBytes = $lengthByte -band 0x7F
            $length = 0
            for ($i = 0; $i -lt $lengthBytes; $i++) {
                $length = ($length -shl 8) -bor $Data[$index]
                $index++
            }
        } else {
            $length = $lengthByte
        }

        if (($index + $length) -gt $Data.Length) {
            throw 'Malformed DER length.'
        }

        $value = $Data[$index..($index + $length - 1)]
        $Offset.Value = $index + $length

        return [pscustomobject]@{ Tag = [int] $tag; Value = [byte[]] $value }
    }

    $offset = 0
    $sequence = Read-DerElement $raw ([ref] $offset)
    if ($sequence.Tag -ne 0x30) {
        throw 'SAN extension is not a DER sequence.'
    }

    $innerOffset = 0
    $inner = $sequence.Value
    while ($innerOffset -lt $inner.Length) {
        $names.Add((Read-DerElement $inner ([ref] $innerOffset)))
    }

    return , $names.ToArray()
}

function Test-CertificateHasIpSan(
    [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
    [string] $Ip
) {
    $expected = [System.Net.IPAddress]::Parse($Ip).GetAddressBytes()
    foreach ($name in (Get-SanGeneralNames $Certificate)) {
        if (($name.Tag -eq 0x87) -and ($name.Value.Length -eq $expected.Length)) {
            $matches = $true
            for ($i = 0; $i -lt $expected.Length; $i++) {
                if ($name.Value[$i] -ne $expected[$i]) {
                    $matches = $false
                }
            }
            if ($matches) {
                return $true
            }
        }
    }

    return $false
}

function Test-CertificateHasDnsSan(
    [System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate,
    [string] $Name
) {
    foreach ($generalName in (Get-SanGeneralNames $Certificate)) {
        if ($generalName.Tag -eq 0x82) {
            $candidate = [System.Text.Encoding]::ASCII.GetString($generalName.Value)
            if ($candidate -ieq $Name) {
                return $true
            }
        }
    }

    return $false
}

function Format-CertificateSan([System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate) {
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($generalName in (Get-SanGeneralNames $Certificate)) {
        if ($generalName.Tag -eq 0x82) {
            $parts.Add("DNS:$([System.Text.Encoding]::ASCII.GetString($generalName.Value))")
        } elseif ($generalName.Tag -eq 0x87) {
            $parts.Add("IP:$([System.Net.IPAddress]::new($generalName.Value))")
        }
    }

    return ($parts -join ', ')
}

function Get-CertificateFingerprint([System.Security.Cryptography.X509Certificates.X509Certificate2] $Certificate) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash($Certificate.RawData)
    } finally {
        $sha256.Dispose()
    }

    return ($hash | ForEach-Object { $_.ToString('X2') }) -join ''
}

function Find-OpenSsl {
    $candidates = New-Object System.Collections.Generic.List[string]

    $command = Get-Command openssl -ErrorAction SilentlyContinue
    if (($null -ne $command) -and $command.Source) {
        $candidates.Add($command.Source)
    }

    foreach ($candidate in @(
            "C:\Program Files\Git\usr\bin\openssl.exe",
            "C:\Program Files\Git\mingw64\bin\openssl.exe",
            "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
            "C:\xampp\apache\bin\openssl.exe"
        )) {
        if (Test-Path -LiteralPath $candidate) {
            $candidates.Add($candidate)
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    return $null
}

function Invoke-OpenSsl([string] $OpenSslPath, [string[]] $Arguments) {
    # OpenSSL 3 writes key-generation progress to stderr. Keep that noise from
    # turning into a terminating NativeCommandError; only the exit code decides.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $OpenSslPath @Arguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }

    if ($exitCode -ne 0) {
        throw "openssl $($Arguments -join ' ') failed with exit code $exitCode."
    }

    return $output
}

function Test-IsValidIpAddress([string] $Value) {
    $parsed = $null

    return [System.Net.IPAddress]::TryParse($Value, [ref] $parsed)
}

function Test-IsValidDnsName([string] $Value) {
    return [regex]::IsMatch(
        $Value,
        '^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$'
    )
}

function New-OpenSslConfig([string] $Path, [string] $Ip, [string[]] $Names) {
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add('[req]')
    $lines.Add('default_bits = 2048')
    $lines.Add('prompt = no')
    $lines.Add('distinguished_name = req_distinguished_name')
    $lines.Add('')
    $lines.Add('[req_distinguished_name]')
    $lines.Add("CN = $Ip")
    $lines.Add('')
    $lines.Add('[v3_ca]')
    $lines.Add('basicConstraints = critical, CA:TRUE')
    $lines.Add('keyUsage = critical, keyCertSign, cRLSign')
    $lines.Add('subjectKeyIdentifier = hash')
    $lines.Add('authorityKeyIdentifier = keyid:always')
    $lines.Add('')
    $lines.Add('[server_cert]')
    $lines.Add('basicConstraints = critical, CA:FALSE')
    $lines.Add('keyUsage = critical, digitalSignature, keyEncipherment')
    $lines.Add('extendedKeyUsage = serverAuth')
    $lines.Add('subjectKeyIdentifier = hash')
    $lines.Add('authorityKeyIdentifier = keyid,issuer')
    $lines.Add('subjectAltName = @alt_names')
    $lines.Add('')
    $lines.Add('[alt_names]')
    $lines.Add("IP.1 = $Ip")
    $index = 1
    foreach ($name in $Names) {
        $lines.Add("DNS.$index = $name")
        $index++
    }

    [System.IO.File]::WriteAllLines($Path, $lines, (New-Object System.Text.UTF8Encoding($false)))
}

function New-LegacyCertificates(
    [string] $Ip,
    [string[]] $Names,
    [string] $CaCrtPath,
    [string] $CaKeyPath,
    [string] $ServerCrtPath,
    [string] $ServerKeyPath,
    [string] $CaCommonName,
    [int] $CaValidDays,
    [int] $ServerValidDays
) {
    if ($null -eq (Get-Command New-SelfSignedCertificate -ErrorAction SilentlyContinue)) {
        throw "openssl was not found and New-SelfSignedCertificate is unavailable. Install OpenSSL (or Git for Windows/XAMPP) and retry."
    }

    $sanEntries = New-Object System.Collections.Generic.List[string]
    foreach ($name in $Names) {
        $sanEntries.Add("DNS=$name")
    }
    $sanEntries.Add("IPAddress=$Ip")

    $storeCertificates = New-Object System.Collections.Generic.List[System.Security.Cryptography.X509Certificates.X509Certificate2]
    try {
        $ca = New-SelfSignedCertificate `
            -Subject "CN=$CaCommonName" `
            -KeyAlgorithm RSA `
            -KeyLength 4096 `
            -HashAlgorithm SHA256 `
            -CertStoreLocation 'Cert:\CurrentUser\My' `
            -NotAfter (Get-Date).AddDays($CaValidDays) `
            -KeyUsage CertSign, CRLSign, DigitalSignature `
            -TextExtension @('2.5.29.19={critical}{text}ca=1') `
            -KeyExportPolicy Exportable
        $storeCertificates.Add($ca)

        $server = New-SelfSignedCertificate `
            -Subject "CN=$Ip" `
            -Type SSLServerAuthentication `
            -Signer $ca `
            -CertStoreLocation 'Cert:\CurrentUser\My' `
            -NotAfter (Get-Date).AddDays($ServerValidDays) `
            -KeyAlgorithm RSA `
            -KeyLength 2048 `
            -HashAlgorithm SHA256 `
            -KeyExportPolicy Exportable `
            -TextExtension @("2.5.29.17={text}$($sanEntries -join '&')")
        $storeCertificates.Add($server)

        $caRsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($ca)
        $serverRsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($server)
        if (($null -eq $caRsa) -or ($null -eq $serverRsa)) {
            throw "Could not export the RSA keys from the generated certificates."
        }

        [System.IO.File]::WriteAllText($CaCrtPath, (ConvertTo-PemText 'CERTIFICATE' $ca.RawData))
        [System.IO.File]::WriteAllText($CaKeyPath, (ConvertTo-RsaPrivateKeyPem $caRsa))
        [System.IO.File]::WriteAllText($ServerCrtPath, (ConvertTo-PemText 'CERTIFICATE' $server.RawData))
        [System.IO.File]::WriteAllText($ServerKeyPath, (ConvertTo-RsaPrivateKeyPem $serverRsa))
    } finally {
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('My', 'CurrentUser')
        $store.Open('ReadWrite')
        try {
            foreach ($certificate in $storeCertificates) {
                try {
                    $store.Remove($certificate)
                } catch {
                    # Store cleanup must never mask the generation error.
                }
            }
        } finally {
            $store.Close()
        }
    }
}

function Write-TrustInstructions([string] $CaPath, [System.Security.Cryptography.X509Certificates.X509Certificate2] $CaCertificate) {
    Write-Host ""
    Write-Host "Confianza en cada PC cliente (una sola vez por CA):" -ForegroundColor Cyan
    Write-Host "  1. Copie: $CaPath"
    Write-Host "  2. Doble clic > Instalar certificado > Equipo local (o Usuario actual)."
    Write-Host "  3. Ubicacion: Entidades de certificacion raiz de confianza."
    Write-Host "  4. Verifique la huella SHA-256: $(Get-CertificateFingerprint $CaCertificate)"
    Write-Host ""
    Write-Host "Activacion del modo TLS:" -ForegroundColor Cyan
    Write-Host "  1. Defina HOSPITAL_TLS_ORIGIN en .env (ejemplo: https://$ServerIp)."
    Write-Host "  2. docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d"
    Write-Host ""
    Write-Host "Renovacion (misma CA, sin reinstalar en clientes):" -ForegroundColor Cyan
    Write-Host "  powershell -File scripts\generate_local_ca.ps1 -ServerIp $ServerIp -Force"
}

# ---------------------------------------------------------------------------
# Ejecucion
# ---------------------------------------------------------------------------

if ($DefinitionsOnly) {
    return
}

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    throw "ServerIp is required (example: -ServerIp 192.168.1.10)."
}

if (-not (Test-IsValidIpAddress $ServerIp)) {
    throw "ServerIp must be a valid IP address (got '$ServerIp')."
}

foreach ($name in $ServerNames) {
    if (-not (Test-IsValidDnsName $name)) {
        throw "ServerNames contains an invalid DNS name: '$name'."
    }
}

if ($OutDir -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $OutDir = (Join-Path $scriptRoot "..\nginx\ssl")
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
if (-not (Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$caCrtPath = Join-Path $OutDir 'hospital-ca.crt.pem'
$caKeyPath = Join-Path $OutDir 'hospital-ca.key.pem'
$serverCrtPath = Join-Path $OutDir 'hospital-server.crt.pem'
$serverKeyPath = Join-Path $OutDir 'hospital-server.key.pem'
$serverCsrPath = Join-Path $OutDir 'hospital-server.csr.pem'
$configPath = Join-Path $OutDir 'openssl.cnf'

$targetFiles = @($caCrtPath, $caKeyPath, $serverCrtPath, $serverKeyPath, $serverCsrPath, $configPath)
$existingFiles = @($targetFiles | Where-Object { Test-Path -LiteralPath $_ })
if (($existingFiles.Count -gt 0) -and (-not $Force)) {
    throw "Certificate material already exists in $OutDir. Use -Force to renew (the CA is reused when openssl is available)."
}

$openSsl = if ($UseWindowsCertificateStore) { $null } else { Find-OpenSsl }
$hasExistingCa = (Test-Path -LiteralPath $caCrtPath) -and (Test-Path -LiteralPath $caKeyPath)

if (($null -eq $openSsl) -and $hasExistingCa -and (-not $Force)) {
    throw "An existing PEM CA was found but openssl is not available to reuse it. Install OpenSSL or run with -Force to regenerate the CA (clients must re-trust it)."
}

if ($null -ne $openSsl) {
    Write-Host "[*] Usando openssl: $openSsl" -ForegroundColor Green
    New-OpenSslConfig -Path $configPath -Ip $ServerIp -Names $ServerNames

    if (-not $hasExistingCa) {
        Write-Host "[*] Generando CA local..." -ForegroundColor Yellow
        Invoke-OpenSsl $openSsl @(
            'req', '-x509', '-new', '-nodes',
            '-keyout', $caKeyPath,
            '-out', $caCrtPath,
            '-days', "$CaValidDays",
            '-sha256',
            '-subj', "/O=$Organization/CN=$CaCommonName",
            '-config', $configPath,
            '-extensions', 'v3_ca'
        ) | Out-Null
    } else {
        Write-Host "[*] Reutilizando la CA existente (renovacion sin reinstalar en clientes)." -ForegroundColor Green
    }

    Write-Host "[*] Generando clave y CSR del servidor..." -ForegroundColor Yellow
    Invoke-OpenSsl $openSsl @(
        'req', '-new', '-nodes', '-newkey', 'rsa:2048',
        '-keyout', $serverKeyPath,
        '-out', $serverCsrPath,
        '-subj', "/O=$Organization/CN=$ServerIp",
        '-config', $configPath
    ) | Out-Null

    Write-Host "[*] Firmando el certificado del servidor con la CA..." -ForegroundColor Yellow
    Invoke-OpenSsl $openSsl @(
        'x509', '-req',
        '-in', $serverCsrPath,
        '-CA', $caCrtPath,
        '-CAkey', $caKeyPath,
        '-CAcreateserial',
        '-out', $serverCrtPath,
        '-days', "$ServerValidDays",
        '-sha256',
        '-extfile', $configPath,
        '-extensions', 'server_cert'
    ) | Out-Null

    Invoke-OpenSsl $openSsl @('verify', '-CAfile', $caCrtPath, $serverCrtPath) | Out-Null
} else {
    Write-Host "[*] openssl no disponible: usando New-SelfSignedCertificate + exportacion .NET." -ForegroundColor Yellow
    if ($hasExistingCa -and $Force) {
        Write-Host "[WARN] La CA existente no puede reutilizarse sin openssl; se regenera y cada PC debe reinstalar la CA." -ForegroundColor Yellow
    }

    New-LegacyCertificates `
        -Ip $ServerIp `
        -Names $ServerNames `
        -CaCrtPath $caCrtPath `
        -CaKeyPath $caKeyPath `
        -ServerCrtPath $serverCrtPath `
        -ServerKeyPath $serverKeyPath `
        -CaCommonName $CaCommonName `
        -CaValidDays $CaValidDays `
        -ServerValidDays $ServerValidDays
}

# ---------------------------------------------------------------------------
# Verificacion (sin imprimir claves)
# ---------------------------------------------------------------------------

$caCertificate = Read-PemCertificate $caCrtPath
$serverCertificate = Read-PemCertificate $serverCrtPath
$serverSan = Format-CertificateSan $serverCertificate

if (-not (Test-CertificateHasIpSan $serverCertificate $ServerIp)) {
    throw "Generated server certificate does not contain the expected IP SAN ($ServerIp). Found: $serverSan"
}
foreach ($name in $ServerNames) {
    if (-not (Test-CertificateHasDnsSan $serverCertificate $name)) {
        throw "Generated server certificate does not contain the expected DNS SAN ($name). Found: $serverSan"
    }
}
if ($serverCertificate.Issuer -ne $caCertificate.Subject) {
    throw "Server certificate was not signed by the generated CA."
}
if ($serverCertificate.NotAfter -le (Get-Date)) {
    throw "Generated server certificate is already expired."
}

Write-Host ""
Write-Host "[OK] CA:     $caCrtPath" -ForegroundColor Green
Write-Host "     SHA-256: $(Get-CertificateFingerprint $caCertificate)" -ForegroundColor Gray
Write-Host "[OK] Server: $serverCrtPath" -ForegroundColor Green
Write-Host "     Subject: $($serverCertificate.Subject)" -ForegroundColor Gray
Write-Host "     SAN:     $serverSan" -ForegroundColor Gray
Write-Host "     Expira:  $($serverCertificate.NotAfter.ToString('yyyy-MM-dd'))" -ForegroundColor Gray
Write-Host "[OK] Clave del servidor: $serverKeyPath (no se imprime su contenido)." -ForegroundColor Green

Write-TrustInstructions -CaPath $caCrtPath -CaCertificate $caCertificate
