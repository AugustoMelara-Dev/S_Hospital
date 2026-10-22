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

function ConvertTo-BackupTaskState {
    # Converts a Get-ScheduledTask/Get-CimInstance object (or $null) into the
    # flat evidence hashtable consumed by Get-BackupAutomationReadiness.
    # RepeatInterval/MultipleInstances stay empty when the task object does not
    # expose them; readiness treats empty evidence as a failed verification.
    param($Task)

    $state = @{
        Installed = $false
        Enabled = $false
        State = 'Missing'
        RepeatInterval = ''
        MultipleInstances = ''
    }

    if ($null -eq $Task) {
        return $state
    }

    $state.Installed = $true
    $state.Enabled = $true
    $state.State = ''

    $stateValue = Get-InstallMapValue -Map $Task -Name 'State'
    if ($null -ne $stateValue) {
        $state.State = [string] $stateValue
    }

    try {
        $settings = Get-InstallMapValue -Map $Task -Name 'Settings'
        if ($null -ne $settings) {
            $enabled = Get-InstallMapValue -Map $settings -Name 'Enabled'
            if ($null -ne $enabled) {
                $state.Enabled = [bool] $enabled
            }

            $multipleInstances = Get-InstallMapValue -Map $settings -Name 'MultipleInstances'
            if ($null -ne $multipleInstances) {
                $state.MultipleInstances = [string] $multipleInstances
            }
        }
    }
    catch {
        $state.Enabled = $true
        $state.MultipleInstances = ''
    }

    try {
        $triggers = Get-InstallMapValue -Map $Task -Name 'Triggers'
        if ($null -ne $triggers) {
            foreach ($trigger in @($triggers)) {
                if ($null -eq $trigger) {
                    continue
                }

                $repetition = Get-InstallMapValue -Map $trigger -Name 'Repetition'
                if ($null -eq $repetition) {
                    continue
                }

                $interval = Get-InstallMapValue -Map $repetition -Name 'Interval'
                if ($null -ne $interval -and -not [string]::IsNullOrWhiteSpace([string] $interval)) {
                    $state.RepeatInterval = [string] $interval
                    break
                }
            }
        }
    }
    catch {
        $state.RepeatInterval = ''
    }

    return $state
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
        # Single source of truth (F027 / T3-011): the Laravel schedule run by
        # HospitalBillingOS-Scheduler owns backup automation; the legacy direct
        # HospitalBillingOS-DailyBackup task is not accepted as that signal.
        # The queue BackupWorker requirement is kept unchanged.
        $worker = Get-InstallMapValue -Map $TaskStates -Name 'Worker'
        $scheduler = Get-InstallMapValue -Map $TaskStates -Name 'Scheduler'
        $legacyDaily = Get-InstallMapValue -Map $TaskStates -Name 'LegacyDaily'
        if ($null -eq $legacyDaily) {
            $legacyDaily = Get-InstallMapValue -Map $TaskStates -Name 'Daily'
        }

        $workerInstalled = [bool] (Get-InstallMapValue -Map $worker -Name 'Installed' -DefaultValue $false)
        $workerEnabled = [bool] (Get-InstallMapValue -Map $worker -Name 'Enabled' -DefaultValue $false)
        $workerState = [string] (Get-InstallMapValue -Map $worker -Name 'State' -DefaultValue '')
        if (-not $workerInstalled -or -not $workerEnabled -or $workerState -ne 'Running') {
            [void] $reasons.Add('La tarea continua de respaldos (HospitalBillingOS-BackupWorker) no esta activa.')
        }

        $schedulerInstalled = [bool] (Get-InstallMapValue -Map $scheduler -Name 'Installed' -DefaultValue $false)
        $schedulerEnabled = [bool] (Get-InstallMapValue -Map $scheduler -Name 'Enabled' -DefaultValue $false)
        $schedulerState = [string] (Get-InstallMapValue -Map $scheduler -Name 'State' -DefaultValue '')
        $schedulerInterval = [string] (Get-InstallMapValue -Map $scheduler -Name 'RepeatInterval' -DefaultValue '')
        $schedulerInstances = [string] (Get-InstallMapValue -Map $scheduler -Name 'MultipleInstances' -DefaultValue '')
        $legacyDailyInstalled = [bool] (Get-InstallMapValue -Map $legacyDaily -Name 'Installed' -DefaultValue $false)

        if (-not $schedulerInstalled) {
            $schedulerReason = 'La tarea de automatizacion de respaldos (HospitalBillingOS-Scheduler) no esta instalada.'
            if ($legacyDailyInstalled) {
                $schedulerReason += ' Se detecto la tarea legacy HospitalBillingOS-DailyBackup; ejecute scripts\install_backup_tasks_windows.ps1 -UpdateExisting para reemplazarla.'
            }
            [void] $reasons.Add($schedulerReason)
        }
        elseif (-not $schedulerEnabled -or $schedulerState -notin @('Ready', 'Running')) {
            [void] $reasons.Add("La tarea de automatizacion de respaldos (HospitalBillingOS-Scheduler) no esta activa (enabled=$schedulerEnabled, state='$schedulerState').")
        }
        elseif ($schedulerInterval -ne 'PT1M') {
            [void] $reasons.Add("La tarea HospitalBillingOS-Scheduler no repite cada 1 minuto (RepeatInterval actual: '$schedulerInterval').")
        }
        elseif ($schedulerInstances -ne 'IgnoreNew') {
            [void] $reasons.Add("La tarea HospitalBillingOS-Scheduler debe usar MultipleInstances IgnoreNew (valor actual: '$schedulerInstances').")
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
