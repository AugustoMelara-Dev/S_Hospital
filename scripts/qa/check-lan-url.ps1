param(
    [Parameter(Mandatory = $true)]
    [Alias("Url")]
    [string] $BaseUrl,

    [int] $TimeoutSeconds = 8
)

$ErrorActionPreference = "Stop"

if ($BaseUrl.EndsWith("/")) {
    $BaseUrl = $BaseUrl.TrimEnd("/")
}

$paths = @(
    "/",
    "/login",
    "/api/health",
    "/api/system/health",
    "/api/system/setup-status"
)

$failures = 0

Write-Host "Checking LAN URL with safe GET requests only: $BaseUrl"

foreach ($path in $paths) {
    $url = "$BaseUrl$path"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSeconds -Method GET
        Write-Host ("PASS {0} HTTP {1}" -f $path, [int] $response.StatusCode)
    } catch {
        $failures++
        $message = $_.Exception.Message
        Write-Host ("FAIL {0} {1}" -f $path, $message)
    }
}

if ($failures -gt 0) {
    throw "$failures LAN checks failed. Confirm server, firewall, port and network profile."
}

Write-Host "LAN URL safe checks: PASS"
