#Requires -Version 5.1

Set-StrictMode -Version Latest

function Resolve-ShortcutIcon {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    return (Resolve-Path -LiteralPath $Path).Path
}

function New-HospitalShortcutPlan {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ProjectRoot,
        [Parameter(Mandatory = $true)]
        [string] $Url,
        [Parameter(Mandatory = $true)]
        [string] $MaintenanceScript,
        [Parameter(Mandatory = $true)]
        [string] $OutputRoot,
        [string] $IconPath = '',
        [string] $MaintenanceIconPath = ''
    )

    $resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
    $resolvedMaintenance = (Resolve-Path -LiteralPath $MaintenanceScript).Path
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputRoot)
    $resolvedIcon = Resolve-ShortcutIcon -Path $IconPath
    $resolvedMaintenanceIcon = Resolve-ShortcutIcon -Path $MaintenanceIconPath
    if ([string]::IsNullOrWhiteSpace($resolvedMaintenanceIcon)) {
        $resolvedMaintenanceIcon = $resolvedIcon
    }

    return [pscustomobject]@{
        OutputRoot = $resolvedOutput
        Application = [pscustomobject]@{
            Name = 'S_Hospital'
            Url = $Url
            ShortcutPath = Join-Path $resolvedOutput 'S_Hospital.lnk'
            FallbackPath = Join-Path $resolvedOutput 'S_Hospital.url'
            IconPath = $resolvedIcon
        }
        Maintenance = [pscustomobject]@{
            Name = 'Mantenimiento S_Hospital'
            ScriptPath = $resolvedMaintenance
            TargetPath = Join-Path $PSHOME 'powershell.exe'
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$resolvedMaintenance`""
            ShortcutPath = Join-Path $resolvedOutput 'Mantenimiento S_Hospital.lnk'
            FallbackPath = Join-Path $resolvedOutput 'Mantenimiento S_Hospital.cmd'
            IconPath = $resolvedMaintenanceIcon
        }
        WorkingDirectory = $resolvedRoot
    }
}

function Install-HospitalShortcuts {
    param(
        [Parameter(Mandatory = $true)]
        [string] $ProjectRoot,
        [Parameter(Mandatory = $true)]
        [string] $Url,
        [Parameter(Mandatory = $true)]
        [string] $MaintenanceScript,
        [string] $OutputRoot = [Environment]::GetFolderPath('Desktop'),
        [string] $IconPath = '',
        [string] $MaintenanceIconPath = '',
        [switch] $WhatIfOnly
    )

    $plan = New-HospitalShortcutPlan `
        -ProjectRoot $ProjectRoot `
        -Url $Url `
        -MaintenanceScript $MaintenanceScript `
        -OutputRoot $OutputRoot `
        -IconPath $IconPath `
        -MaintenanceIconPath $MaintenanceIconPath

    if ($WhatIfOnly) {
        return $plan
    }

    New-Item -ItemType Directory -Path $plan.OutputRoot -Force | Out-Null

    try {
        $shell = New-Object -ComObject WScript.Shell

        $applicationShortcut = $shell.CreateShortcut($plan.Application.ShortcutPath)
        $applicationShortcut.TargetPath = Join-Path $env:WINDIR 'explorer.exe'
        $applicationShortcut.Arguments = $plan.Application.Url
        $applicationShortcut.WorkingDirectory = $plan.WorkingDirectory
        $applicationShortcut.Description = 'Abrir S_Hospital'
        if (-not [string]::IsNullOrWhiteSpace($plan.Application.IconPath)) {
            $applicationShortcut.IconLocation = $plan.Application.IconPath
        }
        $applicationShortcut.Save()

        $maintenanceShortcut = $shell.CreateShortcut($plan.Maintenance.ShortcutPath)
        $maintenanceShortcut.TargetPath = $plan.Maintenance.TargetPath
        $maintenanceShortcut.Arguments = $plan.Maintenance.Arguments
        $maintenanceShortcut.WorkingDirectory = $plan.WorkingDirectory
        $maintenanceShortcut.Description = 'Mantenimiento y respaldo de S_Hospital'
        if (-not [string]::IsNullOrWhiteSpace($plan.Maintenance.IconPath)) {
            $maintenanceShortcut.IconLocation = $plan.Maintenance.IconPath
        }
        $maintenanceShortcut.Save()

        return [pscustomobject]@{
            Success = $true
            UsedFallback = $false
            ApplicationPath = $plan.Application.ShortcutPath
            MaintenancePath = $plan.Maintenance.ShortcutPath
            Warning = ''
        }
    }
    catch {
        foreach ($partialPath in @($plan.Application.ShortcutPath, $plan.Maintenance.ShortcutPath)) {
            if (Test-Path -LiteralPath $partialPath) {
                Remove-Item -LiteralPath $partialPath -Force
            }
        }

        $urlContent = @(
            '[InternetShortcut]',
            "URL=$($plan.Application.Url)",
            "WorkingDirectory=$($plan.WorkingDirectory)"
        )
        Set-Content -LiteralPath $plan.Application.FallbackPath -Value $urlContent -Encoding ASCII

        $cmdContent = @(
            '@echo off',
            "`"$($plan.Maintenance.TargetPath)`" $($plan.Maintenance.Arguments)"
        )
        Set-Content -LiteralPath $plan.Maintenance.FallbackPath -Value $cmdContent -Encoding ASCII

        return [pscustomobject]@{
            Success = $true
            UsedFallback = $true
            ApplicationPath = $plan.Application.FallbackPath
            MaintenancePath = $plan.Maintenance.FallbackPath
            Warning = 'Windows no permitio crear accesos .lnk; se instalaron accesos compatibles.'
        }
    }
}
