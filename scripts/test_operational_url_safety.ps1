$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "lib\operational_url_safety.ps1")

function Assert-Equal([string] $Expected, [string] $Actual, [string] $Message) {
    if ($Expected -ne $Actual) {
        throw "$Message Expected '$Expected' but got '$Actual'."
    }
}

function Assert-Rejects([string] $Url, [string] $ExpectedMessagePart) {
    try {
        Test-HospitalOperationalUrlInput $Url | Out-Null
    } catch {
        if ($_.Exception.Message -notlike "*$ExpectedMessagePart*") {
            throw "Expected rejection containing '$ExpectedMessagePart' for '$Url', got '$($_.Exception.Message)'."
        }

        return
    }

    throw "Expected '$Url' to be rejected."
}

Assert-Equal "https://192.168.1.10" (Test-HospitalOperationalUrlInput " https://192.168.1.10/ ") "LAN URL should normalize trailing slash."
Assert-Equal "https://hospital.local" (Test-HospitalOperationalUrlInput "https://hospital.local") "Local domain URL should pass."

Assert-Rejects "ftp://192.168.1.10:8000" "debe iniciar con http:// o https://"
Assert-Rejects "http://admin:secret@192.168.1.10:8000" "no debe incluir usuario ni contrasena"
Assert-Rejects "http://192.168.1.10:8000?token=secret" "no debe incluir parametros ni fragmentos"
Assert-Rejects "http://192.168.1.10:8000/#secret" "no debe incluir parametros ni fragmentos"

$protectedText = Protect-HospitalOperationalText "Fallo contra https://soporte:clave-secreta@192.168.1.10/login"
Assert-Equal "Fallo contra https://192.168.1.10/login" $protectedText "Operational text should redact URL credentials without hiding the LAN host."

Write-Host "[OK] operational_url_safety.ps1 validation passed."
