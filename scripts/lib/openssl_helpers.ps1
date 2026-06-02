# ==============================================================================
# Sistema de Caja Hospitalaria - OpenSSL Helpers Library
# ==============================================================================
# Thin wrapper around openssl.exe for the S_Hospital local CA workflow.
# Uses only openssl features available in the Git for Windows package that
# ships with most dev machines, plus the copy in C:\Program Files\Git\usr\bin.

function Get-OpenSslPath {
    $candidates = @(
        "C:\Program Files\Git\usr\bin\openssl.exe"
        "C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
        "C:\Program Files (x86)\OpenSSL-Win32\bin\openssl.exe"
    )
    foreach ($p in $candidates) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    $fromPath = (Get-Command openssl.exe -ErrorAction SilentlyContinue)
    if ($fromPath) { return $fromPath.Path }
    throw "openssl.exe not found. Install Git for Windows or OpenSSL-Win64."
}

function New-HospitalCaKey {
    param([string] $KeyPath)
    & (Get-OpenSslPath) genrsa -out $KeyPath 4096 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "openssl genrsa failed for $KeyPath" }
}

function New-HospitalSelfSignedCert {
    param(
        [string] $KeyPath,
        [string] $CertPath,
        [string] $Subject,
        [int] $ValidDays,
        [bool] $IsCa = $false
    )
    $args = @(
        "req", "-x509", "-new", "-nodes",
        "-key", $KeyPath,
        "-sha256",
        "-days", $ValidDays,
        "-subj", "`"$Subject`"",
        "-out", $CertPath
    )
    if ($IsCa) {
        $args += @("-addext", "keyUsage=critical,keyCertSign,cRLSign")
        $args += @("-addext", "basicConstraints=critical,CA:TRUE")
    } else {
        $args += @("-addext", "keyUsage=digitalSignature,keyEncipherment")
        $args += @("-addext", "extendedKeyUsage=serverAuth")
    }
    & (Get-OpenSslPath) @args 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "openssl x509 self-sign failed for $CertPath" }
}

function New-HospitalServerKey {
    param([string] $KeyPath)
    & (Get-OpenSslPath) genrsa -out $KeyPath 2048 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "openssl genrsa failed for $KeyPath" }
}

function New-HospitalCsr {
    param(
        [string] $KeyPath,
        [string] $CsrPath,
        [string] $ConfigPath,
        [string] $ServerIp,
        [string] $CommonName
    )

    # Sanitize IP for Subject Alternative Name list.
    if ($ServerIp -notmatch '^[0-9a-fA-F:.]+$') {
        throw "ServerIp '$ServerIp' has unexpected characters."
    }

    $cnf = @"
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = v3_req

[dn]
CN = $CommonName

[v3_req]
keyUsage         = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName   = @alt_names

[alt_names]
DNS.1 = $CommonName
IP.1  = $ServerIp
"@
    Set-Content -LiteralPath $ConfigPath -Value $cnf -NoNewline -Encoding ASCII

    & (Get-OpenSslPath) req -new -key $KeyPath -out $CsrPath -config $ConfigPath 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "openssl req (CSR) failed for $CsrPath" }
}

function New-HospitalSignedCert {
    param(
        [string] $CaKey,
        [string] $CaCert,
        [string] $SerialFile,
        [string] $CsrPath,
        [string] $CertPath,
        [int] $ValidDays
    )

    $serialDir = Split-Path $SerialFile -Parent
    New-Item -ItemType Directory -Path $serialDir -Force | Out-Null
    if (-not (Test-Path -LiteralPath $SerialFile)) {
        Set-Content -LiteralPath $SerialFile -Value "1000" -NoNewline
    }

    & (Get-OpenSslPath) x509 -req `
        -in $CsrPath `
        -CA $CaCert `
        -CAkey $CaKey `
        -CAcreateserial `
        -CAserial $SerialFile `
        -out $CertPath `
        -days $ValidDays `
        -sha256 `
        -extfile ((Get-Content -Raw -LiteralPath (Get-HospitalCsrConfigPath $CsrPath))) 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "openssl x509 sign failed for $CertPath" }
}

function Get-HospitalCsrConfigPath {
    param([string] $CsrPath)
    $dir = Split-Path $CsrPath -Parent
    return (Join-Path $dir "openssl.cnf")
}
