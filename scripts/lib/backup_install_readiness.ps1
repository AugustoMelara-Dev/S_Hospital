#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-InstallMapValue {
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

function Get-BackupAutomationReadiness {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Docker', 'BareMetal')]
        [string] $Mode,
        [hashtable] $ServiceStates = @{},
        [hashtable] $TaskStates = @{}
    )

    $reasons = [System.Collections.ArrayList]::new()

    if ($Mode -eq 'Docker') {
        foreach ($serviceName in @('queue-worker', 'scheduler')) {
            $state = [string] (Get-InstallMapValue -Map $ServiceStates -Name $serviceName -DefaultValue '')
            if ($state.ToLowerInvariant() -ne 'healthy') {
                [void] $reasons.Add("$serviceName no esta saludable.")
            }
        }
    }
    else {
        $worker = Get-InstallMapValue -Map $TaskStates -Name 'Worker'
        $daily = Get-InstallMapValue -Map $TaskStates -Name 'Daily'

        $workerInstalled = [bool] (Get-InstallMapValue -Map $worker -Name 'Installed' -DefaultValue $false)
        $workerEnabled = [bool] (Get-InstallMapValue -Map $worker -Name 'Enabled' -DefaultValue $false)
        $workerState = [string] (Get-InstallMapValue -Map $worker -Name 'State' -DefaultValue '')
        if (-not $workerInstalled -or -not $workerEnabled -or $workerState -ne 'Running') {
            [void] $reasons.Add('La tarea continua de respaldos no esta activa.')
        }

        $dailyInstalled = [bool] (Get-InstallMapValue -Map $daily -Name 'Installed' -DefaultValue $false)
        $dailyEnabled = [bool] (Get-InstallMapValue -Map $daily -Name 'Enabled' -DefaultValue $false)
        $dailyState = [string] (Get-InstallMapValue -Map $daily -Name 'State' -DefaultValue '')
        if (
            -not $dailyInstalled -or
            -not $dailyEnabled -or
            $dailyState -notin @('Ready', 'Running')
        ) {
            [void] $reasons.Add('La tarea diaria de respaldos no esta habilitada.')
        }
    }

    return [pscustomobject]@{
        Mode = $Mode
        Ready = ($reasons.Count -eq 0)
        Reasons = @($reasons)
    }
}

function Test-EncryptedBackupResult {
    param(
        [Parameter(Mandatory = $true)]
        [int] $ExitCode,
        [AllowEmptyString()]
        [string] $JsonOutput
    )

    $reasons = [System.Collections.ArrayList]::new()
    $payload = $null

    if ($ExitCode -ne 0) {
        [void] $reasons.Add("El comando de respaldo termino con codigo $ExitCode.")
    }

    try {
        $jsonLine = @(
            $JsonOutput -split '\r?\n' |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                Select-Object -Last 1
        )[0]
        $payload = $jsonLine | ConvertFrom-Json -ErrorAction Stop
    }
    catch {
        [void] $reasons.Add('El comando no devolvio evidencia JSON valida.')
    }

    if ($null -ne $payload) {
        $status = [string] (Get-InstallMapValue -Map $payload -Name 'status' -DefaultValue '')
        $backupLogId = Get-InstallMapValue -Map $payload -Name 'backup_log_id' -DefaultValue 0
        $filename = [string] (Get-InstallMapValue -Map $payload -Name 'filename' -DefaultValue '')
        $checksum = [string] (Get-InstallMapValue -Map $payload -Name 'checksum_sha256' -DefaultValue '')
        $encrypted = [bool] (Get-InstallMapValue -Map $payload -Name 'encrypted' -DefaultValue $false)
        $sizeBytes = [long] (Get-InstallMapValue -Map $payload -Name 'size_bytes' -DefaultValue 0)

        if (
            $status -ne 'success' -or
            [long] $backupLogId -le 0 -or
            $filename -notmatch '\.enc$' -or
            -not $encrypted -or
            $sizeBytes -le 0
        ) {
            [void] $reasons.Add('Laravel no confirmo un archivo cifrado registrado y no vacio.')
        }
        if ($checksum -notmatch '^[a-fA-F0-9]{64}$') {
            [void] $reasons.Add('El respaldo no tiene un checksum SHA-256 valido.')
        }
    }

    return [pscustomobject]@{
        Ready = ($reasons.Count -eq 0)
        Reasons = @($reasons)
        Payload = $payload
    }
}
