$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$validator = Join-Path $scriptRoot "validate_lan_client.ps1"

if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) {
    throw "No se encontro scripts\validate_lan_client.ps1."
}

$validatorContent = Get-Content -LiteralPath $validator -Raw
if ($validatorContent -notmatch '\[redacted\]' -or
    $validatorContent -notmatch '\(\?i\)/\(var\|home\|srv\|opt\|tmp\|usr\|mnt\)/' -or
    $validatorContent -notmatch '\[xml-protegido\]') {
    throw "validate_lan_client.ps1 debe redactar secretos, rutas Unix locales y XML de tareas."
}

$fixtureRoot = Join-Path ([System.IO.Path]::GetTempPath()) "s-hospital-lan-validation-$([System.Guid]::NewGuid().ToString('N'))"

function Invoke-Validator([string[]] $Arguments) {
    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $validator @Arguments 2>&1 |
        ForEach-Object { $_.ToString() }

    return @{
        ExitCode = $LASTEXITCODE
        Output = ($output -join "`n")
    }
}

function Assert-ExitCode([int] $Expected, [hashtable] $Result, [string] $Message) {
    if ($Result.ExitCode -ne $Expected) {
        throw "$Message Expected exit code $Expected, got $($Result.ExitCode). Output: $($Result.Output)"
    }
}

function Assert-NoFile([string] $Path, [string] $Message) {
    if (Test-Path -LiteralPath $Path) {
        throw $Message
    }
}

try {
    New-Item -ItemType Directory -Force -Path (Join-Path $fixtureRoot "qa") | Out-Null

    $validEvidence = Join-Path $fixtureRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md"
    $outsideEvidence = Join-Path $fixtureRoot "LAN_CLIENT_VALIDATION_PROOF.md"

    $validWhatIf = Invoke-Validator @(
        "-ProjectRoot", $fixtureRoot,
        "-BaseUrl", "http://192.168.1.10:8000",
        "-EvidencePath", "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "-WhatIfOnly"
    )
    Assert-ExitCode 0 $validWhatIf "WhatIf validacion LAN segura debe pasar."
    Assert-NoFile $validEvidence "WhatIf no debe escribir evidencia LAN."

    $credentialUrl = Invoke-Validator @(
        "-ProjectRoot", $fixtureRoot,
        "-BaseUrl", "http://soporte:secreto@192.168.1.10:8000",
        "-EvidencePath", "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "-WhatIfOnly"
    )
    Assert-ExitCode 1 $credentialUrl "El validador LAN debe rechazar URLs con usuario o contrasena."
    Assert-NoFile $validEvidence "Una URL rechazada no debe escribir evidencia LAN."
    if ($credentialUrl.Output -match "soporte:secreto") {
        throw "La salida no debe exponer credenciales embebidas en la URL."
    }

    $outsidePath = Invoke-Validator @(
        "-ProjectRoot", $fixtureRoot,
        "-BaseUrl", "http://192.168.1.10:8000",
        "-EvidencePath", "LAN_CLIENT_VALIDATION_PROOF.md",
        "-WhatIfOnly"
    )
    Assert-ExitCode 1 $outsidePath "La evidencia LAN debe rechazarse fuera de qa."
    Assert-NoFile $outsideEvidence "Una ruta fuera de qa no debe crear evidencia."

    Set-Content -LiteralPath $validEvidence -Value "# Evidencia previa" -Encoding ASCII
    $overwriteWithoutForce = Invoke-Validator @(
        "-ProjectRoot", $fixtureRoot,
        "-BaseUrl", "http://192.168.1.10:8000",
        "-EvidencePath", "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "-WhatIfOnly"
    )
    Assert-ExitCode 1 $overwriteWithoutForce "No debe reemplazar evidencia LAN existente sin -Force."

    Write-Host "[OK] VALIDATE_LAN_CLIENT_SAFETY: YES"
    Write-Host "[OK] WhatIf no escribe evidencia, URLs peligrosas se rechazan y la evidencia queda dentro de qa."
} finally {
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}
