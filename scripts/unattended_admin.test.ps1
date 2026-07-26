#Requires -Version 5.1

$ErrorActionPreference = 'Stop'

$libraryPath = Join-Path $PSScriptRoot 'lib\unattended_admin.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-admin-' + [guid]::NewGuid().ToString('N'))

$script:Checks = 0
function Assert-UnattendedAdmin {
    param([bool] $Condition, [string] $Message)
    $script:Checks++
    if (-not $Condition) {
        throw $Message
    }
}

try {
    Assert-UnattendedAdmin (Test-Path -LiteralPath $libraryPath -PathType Leaf) 'Unattended admin library is missing.'
    . $libraryPath

    $password = New-UnattendedAdminPassword
    Assert-UnattendedAdmin ($password.Length -ge 16) 'Generated admin password must contain at least 16 characters.'
    Assert-UnattendedAdmin ($password -cmatch '[a-z]') 'Generated admin password needs a lowercase letter.'
    Assert-UnattendedAdmin ($password -cmatch '[A-Z]') 'Generated admin password needs an uppercase letter.'
    Assert-UnattendedAdmin ($password -match '\d') 'Generated admin password needs a number.'
    Assert-UnattendedAdmin ($password -match '[^A-Za-z0-9]') 'Generated admin password needs a symbol.'

    $plan = Get-UnattendedAdminPlan -Password $password
    Assert-UnattendedAdmin ($plan.Username -eq 'admin.local') 'Automatic username must be predictable for the operator.'
    Assert-UnattendedAdmin ($plan.Email -eq 'admin@hospital.local') 'Automatic email must remain local.'
    Assert-UnattendedAdmin ($plan.MustChangePassword) 'Automatic admin must change the temporary password.'

    New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
    $handoff = Write-UnattendedAdminHandoff -Plan $plan -OutputDirectory $testRoot
    Assert-UnattendedAdmin (Test-Path -LiteralPath $handoff.Path -PathType Leaf) 'Initial credential handoff file was not created.'

    $content = Get-Content -LiteralPath $handoff.Path -Raw
    Assert-UnattendedAdmin ($content -match [regex]::Escape($plan.Username)) 'Handoff must contain the initial username.'
    Assert-UnattendedAdmin ($content -match [regex]::Escape($password)) 'Handoff must contain the one-time password.'
    Assert-UnattendedAdmin ($content -match 'cambiar') 'Handoff must require changing the password.'
    Assert-UnattendedAdmin ($content -notmatch '(APP_KEY|DB_PASSWORD|HOSPITAL_BACKUP_ENCRYPTION_KEY)') 'Handoff must not expose technical secrets.'

    Write-Host "Unattended admin self-test passed: $script:Checks checks."
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
