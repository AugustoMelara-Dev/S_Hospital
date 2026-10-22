#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-BackupWindowsTaskProbeState {
    # Bare-metal automation probe for the WindowsTasks mechanism (F027).
    # ConvertTo-BackupTaskState lives in backup_install_readiness.ps1 and both
    # libraries are dot-sourced together by the installer and the tests.
    $workerTask = Get-ScheduledTask `
        -TaskName 'HospitalBillingOS-BackupWorker' `
        -ErrorAction SilentlyContinue
    $schedulerTask = Get-ScheduledTask `
        -TaskName 'HospitalBillingOS-Scheduler' `
        -ErrorAction SilentlyContinue
    $legacyDailyTask = Get-ScheduledTask `
        -TaskName 'HospitalBillingOS-DailyBackup' `
        -ErrorAction SilentlyContinue

    return @{
        Worker = ConvertTo-BackupTaskState -Task $workerTask
        Scheduler = ConvertTo-BackupTaskState -Task $schedulerTask
        LegacyDaily = ConvertTo-BackupTaskState -Task $legacyDailyTask
    }
}

function Invoke-HospitalBackupInstallVerification {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Docker', 'BareMetal')]
        [string] $Mode,
        [Parameter(Mandatory = $true)]
        [string] $ProjectRoot,
        [string] $PhpPath = 'php'
    )

    if ($Mode -eq 'Docker') {
        $composePath = Join-Path $ProjectRoot 'docker-compose.prod.yml'

        return Invoke-BackupInstallVerification `
            -Mode Docker `
            -AutomationProbe {
                $serviceStates = @{}
                foreach ($attempt in 1..18) {
                    $healthLines = @(
                        & docker compose -f $composePath ps `
                            --format '{{.Service}}|{{.Health}}' `
                            queue-worker scheduler 2>&1
                    )
                    if ($LASTEXITCODE -ne 0) {
                        throw 'Docker Compose no pudo consultar queue-worker y scheduler.'
                    }
                    $serviceStates = ConvertFrom-DockerBackupHealthLines -Lines $healthLines
                    if ($serviceStates['queue-worker'] -eq 'healthy' -and $serviceStates['scheduler'] -eq 'healthy') {
                        return $serviceStates
                    }
                    if ($attempt -lt 18) { Start-Sleep -Seconds 5 }
                }
                return $serviceStates
            } `
            -BackupRunner {
                $output = @(
                    & docker compose -f $composePath exec -T backend `
                        php artisan hospital:backup --type=manual --json 2>&1
                )
                $exitCode = $LASTEXITCODE
                return @{
                    ExitCode = $exitCode
                    Output = $output -join [Environment]::NewLine
                }
            }
    }

    return Invoke-BackupInstallVerification `
        -Mode BareMetal `
        -AutomationProbe { Get-BackupWindowsTaskProbeState } `
        -BackupRunner {
            Push-Location (Join-Path $ProjectRoot 'backend')
            try {
                $output = @(
                    & $PhpPath artisan hospital:backup --type=manual --json 2>&1
                )
                $exitCode = $LASTEXITCODE
                return @{
                    ExitCode = $exitCode
                    Output = $output -join [Environment]::NewLine
                }
            }
            finally {
                Pop-Location
            }
        }
}
