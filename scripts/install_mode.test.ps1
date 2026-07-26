#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$modulePath = Join-Path $PSScriptRoot 'lib\install_mode.ps1'
if (-not (Test-Path -LiteralPath $modulePath)) {
    throw "Install mode module is missing: $modulePath"
}
. $modulePath

$script:Checks = 0
function Assert-Equal {
    param([object] $Expected, [object] $Actual, [string] $Message)
    $script:Checks++
    if ($Expected -ne $Actual) {
        throw "$Message. Expected=[$Expected] Actual=[$Actual]"
    }
}

$single = Resolve-InstallMode -Choice SinglePc -DetectedIp '192.168.1.10' -AppPort 8000
Assert-Equal '127.0.0.1' $single.AppHost 'Single-PC must bind the operator URL to loopback'
Assert-Equal 'http://127.0.0.1:8000' $single.AppUrl 'Single-PC URL must be local'
Assert-Equal $false $single.LanEnabled 'Single-PC must not enable LAN'
Assert-Equal $false $single.FirewallRequired 'Single-PC must not require a firewall rule'

$lan = Resolve-InstallMode -Choice Lan -DetectedIp '192.168.1.10' -AppPort 8080
Assert-Equal '192.168.1.10' $lan.AppHost 'LAN mode must use the selected LAN address'
Assert-Equal 'http://192.168.1.10:8080' $lan.AppUrl 'LAN URL must use the selected port'
Assert-Equal $true $lan.LanEnabled 'LAN mode must be explicit'
Assert-Equal $true $lan.FirewallRequired 'LAN mode must require a firewall rule'

foreach ($unsafeAddress in @('127.0.0.1', '169.254.10.20', '0.0.0.0', '224.0.0.1')) {
    $blocked = $false
    try {
        Resolve-InstallMode -Choice Lan -DetectedIp $unsafeAddress -AppPort 8000 | Out-Null
    } catch {
        $blocked = $true
    }
    Assert-Equal $true $blocked "LAN mode must reject $unsafeAddress"
}

$badChoiceBlocked = $false
try {
    Resolve-InstallMode -Choice Other -DetectedIp '192.168.1.10' -AppPort 8000 | Out-Null
} catch {
    $badChoiceBlocked = $true
}
Assert-Equal $true $badChoiceBlocked 'Unknown installation choice must be rejected'

Write-Host "Install mode self-test passed: $script:Checks checks."
