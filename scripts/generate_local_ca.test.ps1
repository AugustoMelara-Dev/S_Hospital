#Requires -Version 5.1
<#
    Contract test for scripts/generate_local_ca.ps1 and the TLS wiring.
    Generates throwaway materials under %TEMP% and never prints private keys.
#>

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptPath = Join-Path $PSScriptRoot 'generate_local_ca.ps1'
if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "generate_local_ca.ps1 is missing: $scriptPath"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. $scriptPath -DefinitionsOnly

function Invoke-TestOpenSsl([string] $OpenSslPath, [string[]] $Arguments) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $OpenSslPath @Arguments 2>&1 | Out-String
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }

    return [pscustomobject]@{ ExitCode = $exitCode; Output = $output }
}

$script:Checks = 0
function Assert-True {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Assert-Equal {
    param([object] $Expected, [object] $Actual, [string] $Message)
    $script:Checks++

    $equal = $false
    if (($Expected -is [System.Array]) -and ($Actual -is [System.Array])) {
        $equal = $Expected.Length -eq $Actual.Length
        if ($equal) {
            for ($index = 0; $index -lt $Expected.Length; $index++) {
                if ($Expected[$index] -ne $Actual[$index]) {
                    $equal = $false
                    break
                }
            }
        }
    } else {
        $equal = $Expected -eq $Actual
    }

    if (-not $equal) {
        throw "$Message. Expected=[$Expected] Actual=[$Actual]"
    }
}

# ---------------------------------------------------------------------------
# 1. DER helpers contract (fallback PKCS#1 exporter)
# ---------------------------------------------------------------------------
$length127 = ConvertTo-DerLength 127
Assert-Equal 1 $length127.Length '127 encodes as short-form length'
Assert-Equal 0x7F $length127[0] '127 must stay 0x7F'

$length128 = ConvertTo-DerLength 128
Assert-Equal ([byte[]] @(0x81, 0x80)) $length128 '128 uses 0x81 0x80'

$lengthBig = ConvertTo-DerLength 0x0102
Assert-Equal ([byte[]] @(0x82, 0x01, 0x02)) $lengthBig '0x0102 uses 0x82 0x01 0x02'

$integerPositive = ConvertTo-DerInteger ([byte[]] @(0x7F))
Assert-Equal ([byte[]] @(0x02, 0x01, 0x7F)) $integerPositive 'positive 0x7F integer'

$integerHighBit = ConvertTo-DerInteger ([byte[]] @(0x80))
Assert-Equal ([byte[]] @(0x02, 0x02, 0x00, 0x80)) $integerHighBit 'high-bit integer gains a leading zero'

$integerTrimmed = ConvertTo-DerInteger ([byte[]] @(0x00, 0x00, 0x01))
Assert-Equal ([byte[]] @(0x02, 0x01, 0x01)) $integerTrimmed 'leading zero bytes are trimmed'

Assert-True (Test-IsValidDnsName 'hospital.local') 'hospital.local is a valid DNS name'
Assert-True (-not (Test-IsValidDnsName 'bad_name.local')) 'underscores are rejected as DNS names'
Assert-True (Test-IsValidIpAddress '192.168.1.10') '192.168.1.10 is a valid IP'
Assert-True (-not (Test-IsValidIpAddress 'not-an-ip')) 'invalid IP is rejected'

# ---------------------------------------------------------------------------
# 2. Real generation in %TEMP% (no keys in logs)
# ---------------------------------------------------------------------------
$tempDir = Join-Path $env:TEMP ('s-hospital-ca-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$openSsl = Find-OpenSsl

try {
    $output = & $scriptPath -ServerIp '192.168.1.10' -ServerNames 'hospital.local' -OutDir $tempDir -Force *>&1 | Out-String
    Assert-True ($output -notmatch 'BEGIN (?:RSA )?PRIVATE KEY') 'script output must not print private key material'
    Assert-True ($output -match '\[OK\] CA:') 'script reports the generated CA'
    Assert-True ($output -match 'Entidades de certificacion raiz de confianza') 'script prints trust instructions'

    $caCrtPath = Join-Path $tempDir 'hospital-ca.crt.pem'
    $caKeyPath = Join-Path $tempDir 'hospital-ca.key.pem'
    $serverCrtPath = Join-Path $tempDir 'hospital-server.crt.pem'
    $serverKeyPath = Join-Path $tempDir 'hospital-server.key.pem'

    foreach ($path in @($caCrtPath, $caKeyPath, $serverCrtPath, $serverKeyPath)) {
        Assert-True (Test-Path -LiteralPath $path) "expected file: $path"
    }

    $caCertificate = Read-PemCertificate $caCrtPath
    $serverCertificate = Read-PemCertificate $serverCrtPath
    $san = Format-CertificateSan $serverCertificate

    Assert-True (Test-CertificateHasIpSan $serverCertificate '192.168.1.10') "server SAN must include the LAN IP. Found: $san"
    Assert-True (Test-CertificateHasDnsSan $serverCertificate 'hospital.local') "server SAN must include the DNS name. Found: $san"
    Assert-Equal $caCertificate.Subject $serverCertificate.Issuer 'server certificate must be signed by the generated CA'
    Assert-True ($serverCertificate.NotAfter -gt (Get-Date)) 'server certificate must not be expired'
    Assert-True ($serverCertificate.NotAfter -le (Get-Date).AddDays(826)) 'server certificate validity must stay within the configured window'
    Assert-True ($caCertificate.NotAfter -gt $serverCertificate.NotAfter) 'CA must outlive the server certificate'

    $serverKeyPem = [System.IO.File]::ReadAllText($serverKeyPath)
    Assert-True ($serverKeyPem -match '-----BEGIN .*PRIVATE KEY-----') 'server key must be PEM encoded'
    Assert-True ($serverKeyPem -notmatch '-----BEGIN CERTIFICATE-----') 'server key file must not contain the certificate'

    if ($null -ne $openSsl) {
        $verify = Invoke-TestOpenSsl $openSsl @('verify', '-CAfile', $caCrtPath, $serverCrtPath)
        Assert-Equal 0 $verify.ExitCode "openssl verify must accept the chain. Output: $($verify.Output)"

        $keyCheck = Invoke-TestOpenSsl $openSsl @('rsa', '-in', $serverKeyPath, '-check', '-noout')
        Assert-Equal 0 $keyCheck.ExitCode "openssl rsa -check must accept the exported key. Output: $($keyCheck.Output)"
        Assert-True ($keyCheck.Output -match 'RSA key ok') 'openssl reports the exported RSA key as valid'

        $certModulus = (Invoke-TestOpenSsl $openSsl @('x509', '-in', $serverCrtPath, '-noout', '-modulus')).Output.Trim()
        $keyModulus = (Invoke-TestOpenSsl $openSsl @('rsa', '-in', $serverKeyPath, '-noout', '-modulus')).Output.Trim()
        Assert-Equal $certModulus $keyModulus 'certificate and private key must match'

        # Renewal must reuse the CA when openssl is available.
        $caFingerprintBefore = Get-CertificateFingerprint $caCertificate
        $renewOutput = & $scriptPath -ServerIp '192.168.1.10' -ServerNames 'hospital.local' -OutDir $tempDir -Force *>&1 | Out-String
        Assert-True ($renewOutput -notmatch 'BEGIN (?:RSA )?PRIVATE KEY') 'renewal output must not print private key material'
        $caFingerprintAfter = Get-CertificateFingerprint (Read-PemCertificate $caCrtPath)
        Assert-Equal $caFingerprintBefore $caFingerprintAfter 'renewal with -Force must reuse the existing CA'

        # Without -Force the script must refuse to overwrite silently.
        $overwriteBlocked = $false
        try {
            & $scriptPath -ServerIp '192.168.1.10' -OutDir $tempDir *>&1 | Out-Null
        } catch {
            $overwriteBlocked = $true
        }
        Assert-True $overwriteBlocked 'existing material must not be overwritten without -Force'
    } else {
        Write-Host '[INFO] openssl not found; crypto verification limited to .NET parsing.' -ForegroundColor Yellow
    }

    # Windows fallback path (forced) must also produce a usable PEM pair.
    if ($null -ne (Get-Command New-SelfSignedCertificate -ErrorAction SilentlyContinue)) {
        $legacyDir = Join-Path $env:TEMP ('s-hospital-ca-legacy-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $legacyDir -Force | Out-Null
        try {
            $legacyOutput = & $scriptPath -ServerIp '10.0.0.25' -ServerNames 'caja.hospital.local' -OutDir $legacyDir -Force -UseWindowsCertificateStore *>&1 | Out-String
            Assert-True ($legacyOutput -notmatch 'BEGIN (?:RSA )?PRIVATE KEY') 'fallback output must not print private key material'
            $legacyCrt = Join-Path $legacyDir 'hospital-server.crt.pem'
            $legacyKey = Join-Path $legacyDir 'hospital-server.key.pem'
            Assert-True (Test-Path -LiteralPath $legacyCrt) 'fallback server certificate must exist'
            Assert-True (Test-Path -LiteralPath $legacyKey) 'fallback server key must exist'

            $legacyCertificate = Read-PemCertificate $legacyCrt
            Assert-True (Test-CertificateHasIpSan $legacyCertificate '10.0.0.25') 'fallback SAN must include the LAN IP'
            Assert-True (Test-CertificateHasDnsSan $legacyCertificate 'caja.hospital.local') 'fallback SAN must include the DNS name'

            $legacyKeyPem = [System.IO.File]::ReadAllText($legacyKey)
            Assert-True ($legacyKeyPem -match '-----BEGIN RSA PRIVATE KEY-----') 'fallback key must be PKCS#1 PEM'

            if ($null -ne $openSsl) {
                $legacyKeyCheck = Invoke-TestOpenSsl $openSsl @('rsa', '-in', $legacyKey, '-check', '-noout')
                Assert-Equal 0 $legacyKeyCheck.ExitCode "openssl must accept the fallback key. Output: $($legacyKeyCheck.Output)"
            }
        } finally {
            Remove-Item -LiteralPath $legacyDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host '[INFO] New-SelfSignedCertificate unavailable; fallback path not exercised.' -ForegroundColor Yellow
    }
} finally {
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# 3. TLS wiring contract (default HTTP untouched)
# ---------------------------------------------------------------------------
$defaultConf = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'nginx\default.conf'))
Assert-True ($defaultConf -match 'listen 80 default_server;') 'default.conf must keep the HTTP server'
Assert-True ($defaultConf -notmatch 'add_header\s+Strict-Transport-Security') 'HTTP server must not send HSTS'
Assert-True ($defaultConf -notmatch 'listen 443') 'HTTP default config must not load a 443 block'

$tlsConfPath = Join-Path $repoRoot 'nginx\tls.conf'
Assert-True (Test-Path -LiteralPath $tlsConfPath) 'nginx/tls.conf must exist'
$tlsConf = [System.IO.File]::ReadAllText($tlsConfPath)
Assert-True ($tlsConf -match 'listen 443 ssl;') 'tls.conf must listen on 443 with TLS'
Assert-True ($tlsConf -match 'ssl_certificate\s+/etc/nginx/ssl/hospital-server\.crt\.pem;') 'tls.conf must load the generated server certificate'
Assert-True ($tlsConf -match 'fastcgi_param HTTPS on;') 'tls.conf must tell Laravel the request is secure'
Assert-True ($tlsConf -match 'location /app') 'tls.conf must proxy pusher-js WebSockets'
Assert-True ($tlsConf -match 'proxy_set_header Upgrade \$http_upgrade;') 'WebSocket proxy must forward Upgrade'
Assert-True ($tlsConf -notmatch 'add_header\s+Strict-Transport-Security') 'HSTS must not be duplicated by nginx (Laravel owns it, TLS-only)'

$prodCompose = [System.IO.File]::ReadAllText((Join-Path $repoRoot 'docker-compose.prod.yml'))
Assert-True ($prodCompose -match '\$\{APP_BIND_IP:-127\.0\.0\.1\}:\$\{APP_PORT:-8000\}:80') 'prod compose keeps the HTTP mapping by default'
Assert-True ($prodCompose -notmatch ':443:') 'prod compose must not publish 443 without the TLS overlay'

$backendComposeBlock = [regex]::Match($prodCompose, '(?s)\n  backend:.*?(?=\n  nginx:)').Value
Assert-True ($backendComposeBlock -match 'HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS:\s*\$\{HOSPITAL_MIGRATION_BACKUP_MAX_AGE_HOURS:-72\}') 'prod backend must map the pre-migration backup window with a 72h default'

$tlsComposePath = Join-Path $repoRoot 'docker-compose.tls.yml'
Assert-True (Test-Path -LiteralPath $tlsComposePath) 'docker-compose.tls.yml must exist'
$tlsCompose = [System.IO.File]::ReadAllText($tlsComposePath)
Assert-True ($tlsCompose -match '\$\{TLS_PORT:-443\}:443') 'TLS overlay must publish 443'
Assert-True ($tlsCompose -match 'nginx/ssl:/etc/nginx/ssl:ro') 'TLS overlay must mount the certificates read-only'
Assert-True ($tlsCompose -match 'HOSPITAL_TLS_ORIGIN') 'TLS overlay must require the public TLS origin'
Assert-True ($tlsCompose -match 'SESSION_SECURE_COOKIE:\s*"true"') 'TLS overlay must enable secure cookies'
Assert-True ($tlsCompose -match 'PUSHER_CLIENT_SCHEME:\s*wss') 'TLS overlay must switch realtime to WSS'

$envExample = [System.IO.File]::ReadAllText((Join-Path $repoRoot '.env.example'))
Assert-True ($envExample -match '(?m)^TLS_PORT=443$') '.env.example must document TLS_PORT'
Assert-True ($envExample -match '(?m)^TLS_BIND_IP=') '.env.example must document TLS_BIND_IP'
Assert-True ($envExample -match '(?m)^HOSPITAL_TLS_ORIGIN=$') '.env.example must document HOSPITAL_TLS_ORIGIN'

Write-Host "generate_local_ca self-test passed: $script:Checks checks." -ForegroundColor Green
