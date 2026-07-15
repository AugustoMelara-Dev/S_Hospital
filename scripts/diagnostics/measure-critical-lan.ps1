param(
    [string]$BaseUrl = 'http://127.0.0.1:8000',
    [int]$Iterations = 5,
    [string]$Login = $env:E2E_REAL_LOGIN,
    [string]$Password = $env:E2E_REAL_PASSWORD,
    [string]$Output = 'qa/operational-ux/critical-lan-timings.json'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

if ($Iterations -lt 1) {
    throw 'Iterations must be at least 1.'
}

if ([string]::IsNullOrWhiteSpace($Login) -or [string]::IsNullOrWhiteSpace($Password)) {
    throw 'Set E2E_REAL_LOGIN and E2E_REAL_PASSWORD, or pass -Login and -Password.'
}

function Invoke-TimedRequest {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        $Session,
        [hashtable]$Headers = @{},
        [string]$Body = ''
    )

    $watch = [Diagnostics.Stopwatch]::StartNew()
    $status = 0
    $errorMessage = $null

    try {
        $parameters = @{
            Uri = "$BaseUrl$Path"
            Method = $Method
            Headers = $Headers
            UseBasicParsing = $true
            TimeoutSec = 10
        }

        if ($null -ne $Session) {
            $parameters.WebSession = $Session
        }

        if (-not [string]::IsNullOrEmpty($Body)) {
            $parameters.Body = $Body
        }

        $response = Invoke-WebRequest @parameters
        $status = [int]$response.StatusCode
    }
    catch {
        if ($null -ne $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        $errorMessage = $_.Exception.Message
    }
    finally {
        $watch.Stop()
    }

    [pscustomobject]@{
        name = $Name
        method = $Method
        path = $Path
        status = $status
        duration_ms = $watch.ElapsedMilliseconds
        error = $errorMessage
    }
}

$results = [Collections.Generic.List[object]]::new()
$authenticatedSession = $null

foreach ($iteration in 1..$Iterations) {
    $setupResult = Invoke-TimedRequest `
        -Name 'setup-status' `
        -Method 'GET' `
        -Path '/api/system/setup-status' `
        -Headers @{ Accept = 'application/json' }
    $setupResult | Add-Member -NotePropertyName iteration -NotePropertyValue $iteration
    $results.Add($setupResult)

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    Invoke-WebRequest `
        -UseBasicParsing `
        -Uri "$BaseUrl/sanctum/csrf-cookie" `
        -WebSession $session `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 10 | Out-Null

    $xsrfCookie = $session.Cookies.GetCookies([Uri]$BaseUrl)['XSRF-TOKEN']
    if ($null -eq $xsrfCookie) {
        throw 'The server did not issue an XSRF-TOKEN cookie.'
    }

    $loginResult = Invoke-TimedRequest `
        -Name 'login' `
        -Method 'POST' `
        -Path '/api/auth/login' `
        -Session $session `
        -Headers @{
            Accept = 'application/json'
            'Content-Type' = 'application/json'
            'X-XSRF-TOKEN' = [Uri]::UnescapeDataString($xsrfCookie.Value)
            'Idempotency-Key' = [Guid]::NewGuid().ToString()
        } `
        -Body (@{ login = $Login; password = $Password } | ConvertTo-Json -Compress)
    $loginResult | Add-Member -NotePropertyName iteration -NotePropertyValue $iteration
    $results.Add($loginResult)

    if ($loginResult.status -ge 200 -and $loginResult.status -lt 300) {
        $authenticatedSession = $session
    }
}

if ($null -eq $authenticatedSession) {
    throw 'No login attempt produced an authenticated session.'
}

foreach ($iteration in 1..$Iterations) {
    $serviceResult = Invoke-TimedRequest `
        -Name 'billing-service-search' `
        -Method 'GET' `
        -Path '/api/services?billing=1&search=glucosa&per_page=24' `
        -Session $authenticatedSession `
        -Headers @{ Accept = 'application/json' }
    $serviceResult | Add-Member -NotePropertyName iteration -NotePropertyValue $iteration
    $results.Add($serviceResult)
}

$outputDirectory = Split-Path -Parent $Output
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$payload = [pscustomobject]@{
    generated_at = [DateTimeOffset]::Now.ToString('o')
    base_url = $BaseUrl
    threshold_ms = 2000
    iterations = $Iterations
    results = $results
}

$payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Output -Encoding utf8

$failures = $results | Where-Object {
    $_.status -lt 200 -or $_.status -ge 300 -or $_.duration_ms -ge 2000
}

$results | Format-Table name, iteration, status, duration_ms

if ($failures.Count -gt 0) {
    Write-Error "$($failures.Count) critical request measurement(s) failed or reached 2000 ms."
    exit 1
}
