# ==============================================================================
# Sistema de Caja Hospitalaria - CORS / SANCTUM Helpers Library
# ==============================================================================
# Build canonical, minimal SANCTUM_STATEFUL_DOMAINS and CORS_ALLOWED_ORIGINS
# values for a production LAN install. The defaults are tight: only the
# configured LAN host and port. Localhost and the Vite dev port (5173) are
# NOT included by default because they only run on a developer laptop.
#
# Use Get-ProductionCorsValues -ServerIp <ip> -AppPort <port> when generating
# a fresh backend/.env for a server. Use Add-LocalhostIfNeeded to allow
# the server's own loopback origin for diagnostic runs.

function Get-ProductionCorsValues {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string] $ServerIp,
        [Parameter(Mandatory = $true)]
        [int] $AppPort,
        [switch] $IncludeLocalhost
    )

    if ($ServerIp -notmatch '^[0-9a-fA-F:.]+$') {
        throw "ServerIp '$ServerIp' contains characters outside IPv4/IPv6 syntax."
    }
    if ($AppPort -lt 1 -or $AppPort -gt 65535) {
        throw "AppPort $AppPort is out of range."
    }

    $sanctum = New-Object System.Collections.Generic.List[string]
    $sanctum.Add($ServerIp) | Out-Null
    $sanctum.Add("${ServerIp}:${AppPort}") | Out-Null

    $cors = New-Object System.Collections.Generic.List[string]
    $cors.Add("http://${ServerIp}:${AppPort}") | Out-Null
    $cors.Add("https://${ServerIp}:${AppPort}") | Out-Null

    if ($IncludeLocalhost) {
        # Only add the loopback origins when the operator explicitly
        # requested them, e.g. for diagnostic access from the server
        # itself. Do NOT include the Vite dev port (5173) here.
        $sanctum.Add("localhost") | Out-Null
        $sanctum.Add("127.0.0.1") | Out-Null
        $sanctum.Add("127.0.0.1:${AppPort}") | Out-Null
        $sanctum.Add("::1") | Out-Null
        $cors.Add("http://127.0.0.1:${AppPort}") | Out-Null
    }

    [pscustomobject]@{
        SanctumStatefulDomains = ($sanctum -join ',')
        CorsAllowedOrigins     = ($cors -join ',')
    }
}

function Test-CorsOriginSafeForProduction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $false)]
        [AllowEmptyString()]
        [string] $Value = ""
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $true  # Empty is same-origin and safe.
    }
    if ($Value -match '\*') {
        return $false
    }
    foreach ($origin in ($Value -split ',')) {
        $trimmed = $origin.Trim()
        if ($trimmed -eq '') { continue }
        if ($trimmed -notmatch '^https?://[A-Za-z0-9._:-]+(:[0-9]+)?$') {
            return $false
        }
    }
    return $true
}
