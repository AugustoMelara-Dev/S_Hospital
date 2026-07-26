#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-UnattendedAdminRandomBytes {
    param([int] $Length)

    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }
    return $bytes
}

function New-UnattendedAdminPassword {
    param([int] $Length = 20)

    if ($Length -lt 16) {
        throw 'La contrasena temporal automatica debe tener al menos 16 caracteres.'
    }

    $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%*-_'
    $characters = [System.Collections.Generic.List[char]]::new()
    foreach ($required in @('a', 'A', '2', '!')) {
        [void] $characters.Add([char] $required)
    }

    $randomBytes = Get-UnattendedAdminRandomBytes -Length ($Length * 2)
    for ($index = 0; $characters.Count -lt $Length; $index++) {
        [void] $characters.Add($alphabet[$randomBytes[$index] % $alphabet.Length])
    }
    for ($index = $characters.Count - 1; $index -gt 0; $index--) {
        $swapIndex = $randomBytes[$Length + $index] % ($index + 1)
        $temporary = $characters[$index]
        $characters[$index] = $characters[$swapIndex]
        $characters[$swapIndex] = $temporary
    }

    return -join $characters
}

function Get-UnattendedAdminPlan {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Password,
        [string] $AppUrl = 'http://127.0.0.1:8000'
    )

    return [pscustomobject]@{
        Username = 'admin.local'
        Email = 'admin@hospital.local'
        Name = 'Administrador del Hospital'
        Password = $Password
        AppUrl = $AppUrl
        MustChangePassword = $true
    }
}

function Write-UnattendedAdminHandoff {
    param(
        [Parameter(Mandatory = $true)]
        $Plan,
        [Parameter(Mandatory = $true)]
        [string] $OutputDirectory
    )

    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $handoffPath = Join-Path $OutputDirectory 'CREDENCIALES INICIALES S_HOSPITAL.txt'
    $content = @"
S_HOSPITAL - PRIMER INGRESO

Direccion: $($Plan.AppUrl)
Usuario: $($Plan.Username)
Contrasena temporal: $($Plan.Password)

Al ingresar, el sistema exigira cambiar esta contrasena.
Despues de cambiarla, elimine este archivo.
Las claves de base de datos y respaldos se generaron automaticamente y no se muestran aqui.
"@
    Set-Content -LiteralPath $handoffPath -Value $content -Encoding UTF8

    $protected = $false
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        & icacls.exe $handoffPath /inheritance:r /grant:r "${identity}:(F)" 'SYSTEM:(F)' *> $null
        $protected = ($LASTEXITCODE -eq 0)
    }
    catch {
        $protected = $false
    }

    return [pscustomobject]@{
        Path = $handoffPath
        Protected = $protected
    }
}
