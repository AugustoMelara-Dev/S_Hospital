#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-InstallResultValue {
    param(
        $Map,
        [Parameter(Mandatory = $true)]
        [string] $Name,
        $DefaultValue = $null
    )

    if ($null -eq $Map) {
        return $DefaultValue
    }
    if ($Map -is [System.Collections.IDictionary]) {
        if ($Map.Contains($Name)) {
            return $Map[$Name]
        }
        return $DefaultValue
    }

    $property = $Map.PSObject.Properties[$Name]
    if ($null -ne $property) {
        return $property.Value
    }

    return $DefaultValue
}

function Protect-InstallSummaryPath {
    param(
        [AllowEmptyString()]
        [string] $Value,
        [AllowEmptyString()]
        [string] $ProjectRoot
    )

    if ([string]::IsNullOrWhiteSpace($Value) -or [string]::IsNullOrWhiteSpace($ProjectRoot)) {
        return $Value
    }

    return [regex]::Replace(
        $Value,
        [regex]::Escape($ProjectRoot),
        '%PROJECT_ROOT%',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
}

function Get-InstallResult {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable] $Checks,
        [hashtable] $Details = @{},
        [string] $ProjectRoot = ''
    )

    $requiredChecks = @(
        'runtime',
        'database',
        'migrations',
        'admin',
        'web-health',
        'queue-worker',
        'scheduler',
        'encrypted-backup',
        'app-shortcut'
    )
    $blockers = [System.Collections.ArrayList]::new()
    foreach ($checkName in $requiredChecks) {
        if (-not [bool] (Get-InstallResultValue -Map $Checks -Name $checkName -DefaultValue $false)) {
            [void] $blockers.Add($checkName)
        }
    }

    $warnings = [System.Collections.ArrayList]::new()
    if (
        $Checks.ContainsKey('maintenance-shortcut') -and
        -not [bool] $Checks['maintenance-shortcut']
    ) {
        [void] $warnings.Add('maintenance-shortcut')
    }

    $safeSummary = [pscustomobject]@{
        Mode = [string] (Get-InstallResultValue -Map $Details -Name 'Mode' -DefaultValue '')
        LocalUrl = [string] (Get-InstallResultValue -Map $Details -Name 'LocalUrl' -DefaultValue '')
        LanUrl = [string] (Get-InstallResultValue -Map $Details -Name 'LanUrl' -DefaultValue '')
        BackupTime = [string] (Get-InstallResultValue -Map $Details -Name 'BackupTime' -DefaultValue '')
        ShortcutStatus = [string] (Get-InstallResultValue -Map $Details -Name 'ShortcutStatus' -DefaultValue '')
        LogLocation = Protect-InstallSummaryPath `
            -Value ([string] (Get-InstallResultValue -Map $Details -Name 'LogLocation' -DefaultValue '')) `
            -ProjectRoot $ProjectRoot
    }

    return [pscustomobject]@{
        Success = ($blockers.Count -eq 0)
        Warnings = @($warnings)
        Blockers = @($blockers)
        SafeSummary = $safeSummary
    }
}
