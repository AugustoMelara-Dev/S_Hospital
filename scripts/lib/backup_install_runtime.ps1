#Requires -Version 5.1

Set-StrictMode -Version Latest

function Get-TaskEnabledForInstall {
    param($Task)

    if ($null -eq $Task) {
        return $false
    }
    try {
        if ($null -ne $Task.Settings -and $null -ne $Task.Settings.Enabled) {
            return [bool] $Task.Settings.Enabled
        }
    }
    catch {
        return $true
    }

    return $true
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
        -AutomationProbe {
            $workerTask = Get-ScheduledTask `
                -TaskName 'HospitalBillingOS-BackupWorker' `
                -ErrorAction SilentlyContinue
            $dailyTask = Get-ScheduledTask `
                -TaskName 'HospitalBillingOS-DailyBackup' `
                -ErrorAction SilentlyContinue

            return @{
                Worker = @{
                    Installed = ($null -ne $workerTask)
                    Enabled = Get-TaskEnabledForInstall -Task $workerTask
                    State = if ($null -ne $workerTask) { [string] $workerTask.State } else { 'Missing' }
                }
                Daily = @{
                    Installed = ($null -ne $dailyTask)
                    Enabled = Get-TaskEnabledForInstall -Task $dailyTask
                    State = if ($null -ne $dailyTask) { [string] $dailyTask.State } else { 'Missing' }
                }
            }
        } `
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
