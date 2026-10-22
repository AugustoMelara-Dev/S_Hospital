#Requires -Version 5.1

Set-StrictMode -Version Latest

function New-NativeServiceDefinition {
    param(
        [string] $Id,
        [string] $DisplayName,
        [string] $Role,
        [string[]] $DependsOn = @()
    )

    [pscustomobject]@{
        Id = $Id
        DisplayName = $DisplayName
        Role = $Role
        DependsOn = @($DependsOn)
        StartMode = 'AutomaticDelayed'
        Account = 'NT AUTHORITY\LocalService'
        Recovery = 'restart/5000'
    }
}

function Get-NativeInstallPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] $Layout,
        [Parameter(Mandatory = $true)][string] $PayloadRoot,
        [ValidateRange(1024, 65535)][int] $AppPort = 8000,
        [ValidateRange(1024, 65535)][int] $PhpPort = 9070,
        [ValidateRange(1024, 65535)][int] $DatabasePort = 3307,
        [switch] $ExistingInstall
    )

    if (@($AppPort, $PhpPort, $DatabasePort | Sort-Object -Unique).Count -ne 3) {
        throw 'AppPort, PhpPort and DatabasePort must be different.'
    }

    $services = @(
        New-NativeServiceDefinition -Id 'SHospitalMariaDB' -DisplayName 'S_Hospital Base de datos' -Role 'database'
        New-NativeServiceDefinition -Id 'SHospitalPhp' -DisplayName 'S_Hospital Aplicación PHP' -Role 'php-fastcgi' -DependsOn @('SHospitalMariaDB')
        New-NativeServiceDefinition -Id 'SHospitalWeb' -DisplayName 'S_Hospital Servidor web' -Role 'web' -DependsOn @('SHospitalPhp')
        New-NativeServiceDefinition -Id 'SHospitalQueueDefault' -DisplayName 'S_Hospital Procesos en segundo plano' -Role 'queue-default' -DependsOn @('SHospitalMariaDB')
        New-NativeServiceDefinition -Id 'SHospitalQueueBackups' -DisplayName 'S_Hospital Respaldos' -Role 'queue-backups' -DependsOn @('SHospitalMariaDB')
        New-NativeServiceDefinition -Id 'SHospitalScheduler' -DisplayName 'S_Hospital Programador' -Role 'scheduler' -DependsOn @('SHospitalMariaDB')
    )

    [pscustomobject]@{
        SchemaVersion = 1
        PayloadRoot = $PayloadRoot
        Layout = $Layout
        Network = [pscustomobject]@{
            AppUrl = "http://127.0.0.1:$AppPort"
            ListenAddress = "127.0.0.1:$AppPort"
            PhpEndpoint = "127.0.0.1:$PhpPort"
            DatabaseEndpoint = "127.0.0.1:$DatabasePort"
            LanEnabled = $false
        }
        Authentication = [pscustomobject]@{
            Mode = 'hospital-session'
            AutomaticLogin = $false
        }
        Realtime = [pscustomobject]@{
            Driver = 'null'
            Reason = 'single-pc-no-cross-client-sync'
        }
        Services = $services
        Steps = @(
            'validate-elevation',
            'validate-manifest-integrity',
            'stage-versioned-release',
            'prepare-programdata',
            'initialize-or-reuse-database',
            'install-services-stopped',
            $(if ($ExistingInstall) { 'verify-pre-migration-backup' }),
            'run-migrations',
            'health-check-staged-release',
            'switch-current-release',
            'start-services',
            'install-login-launcher',
            'verify-health-and-backup'
        )
    }
}

