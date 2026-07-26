#Requires -Version 5.1

Set-StrictMode -Version Latest

function ConvertFrom-DockerBackupHealthLines {
    param(
        [Parameter(Mandatory = $true)]
        [object[]] $Lines
    )

    $states = @{}
    foreach ($lineValue in $Lines) {
        $line = [string] $lineValue
        if ([string]::IsNullOrWhiteSpace($line) -or $line -notmatch '^([^|]+)\|([^|]+)$') {
            continue
        }
        $states[$matches[1].Trim()] = $matches[2].Trim().ToLowerInvariant()
    }

    return $states
}

function Invoke-BackupInstallVerification {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Docker', 'BareMetal')]
        [string] $Mode,
        [Parameter(Mandatory = $true)]
        [scriptblock] $AutomationProbe,
        [Parameter(Mandatory = $true)]
        [scriptblock] $BackupRunner
    )

    $reasons = [System.Collections.ArrayList]::new()
    $automation = $null
    $backup = $null

    try {
        $probeResult = & $AutomationProbe
        if ($Mode -eq 'Docker') {
            $automation = Get-BackupAutomationReadiness `
                -Mode Docker `
                -ServiceStates $probeResult
        }
        else {
            $automation = Get-BackupAutomationReadiness `
                -Mode BareMetal `
                -TaskStates $probeResult
        }
    }
    catch {
        [void] $reasons.Add("No se pudo verificar la automatizacion: $($_.Exception.Message)")
    }

    if ($null -ne $automation -and -not $automation.Ready) {
        foreach ($reason in $automation.Reasons) {
            [void] $reasons.Add($reason)
        }
    }

    if ($null -ne $automation -and $automation.Ready) {
        try {
            $runResult = & $BackupRunner
            $backup = Test-EncryptedBackupResult `
                -ExitCode ([int] (Get-InstallMapValue -Map $runResult -Name 'ExitCode' -DefaultValue 1)) `
                -JsonOutput ([string] (Get-InstallMapValue -Map $runResult -Name 'Output' -DefaultValue ''))
            if (-not $backup.Ready) {
                foreach ($reason in $backup.Reasons) {
                    [void] $reasons.Add($reason)
                }
            }
        }
        catch {
            [void] $reasons.Add("No se pudo crear el respaldo de prueba: $($_.Exception.Message)")
        }
    }

    return [pscustomobject]@{
        Ready = ($reasons.Count -eq 0 -and $null -ne $automation -and $null -ne $backup)
        Automation = $automation
        Backup = $backup
        Reasons = @($reasons)
        VerifiedAt = if ($null -ne $backup -and $backup.Ready) {
            [DateTimeOffset]::UtcNow.ToString('o')
        }
        else {
            $null
        }
    }
}
