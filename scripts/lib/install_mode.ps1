#Requires -Version 5.1

Set-StrictMode -Version Latest

function Test-UsableLanIpv4Address {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Address
    )

    $parsed = $null
    if (-not [System.Net.IPAddress]::TryParse($Address, [ref] $parsed)) {
        return $false
    }
    if ($parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        return $false
    }

    $bytes = $parsed.GetAddressBytes()
    if (
        $bytes[0] -eq 0 -or
        $bytes[0] -eq 127 -or
        ($bytes[0] -eq 169 -and $bytes[1] -eq 254) -or
        $bytes[0] -ge 224
    ) {
        return $false
    }

    return $true
}

function Resolve-InstallMode {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('SinglePc', 'Lan')]
        [string] $Choice,
        [string] $DetectedIp = '',
        [ValidateRange(1, 65535)]
        [int] $AppPort = 8000
    )

    if ($Choice -eq 'SinglePc') {
        return [pscustomobject]@{
            Choice = 'SinglePc'
            AppHost = '127.0.0.1'
            AppUrl = "http://127.0.0.1:$AppPort"
            LanEnabled = $false
            FirewallRequired = $false
        }
    }

    if (-not (Test-UsableLanIpv4Address -Address $DetectedIp)) {
        throw "LAN mode requires a usable non-loopback IPv4 address."
    }

    return [pscustomobject]@{
        Choice = 'Lan'
        AppHost = $DetectedIp
        AppUrl = "http://${DetectedIp}:$AppPort"
        LanEnabled = $true
        FirewallRequired = $true
    }
}
