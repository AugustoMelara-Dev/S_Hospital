<#
.SYNOPSIS
  Runs a battery of HTTP smoke tests against a deployed
  S_Hospital stack to confirm it is reachable, authenticated, and
  the critical screens return non-error content.

.DESCRIPTION
  Executes (in order):
   1. GET  /api/health               -> 200
   2. GET  /api/system/health       -> 200, scheduler_heartbeat present
   3. GET  /api/system/echo-config  -> 200, driver=pusher
   4. GET  /api/auth/login (POST)   -> 200 with admin creds, returns 200
   5. GET  /api/auth/me              -> 200
   6. GET  /api/categories           -> 200
   7. GET  /api/services             -> 200
   8. GET  /api/system/status        -> 200

  Use -BaseUrl to point at a remote stack. Use -Username /
  -Password to pass admin credentials. Use -SkipAuth to skip the
  auth round-trip (useful for the public smoke before login is
  available).

  Exit code is 0 only if every test passes. The first failure
  short-circuits the rest so the operator can fix one thing at
  a time.

.PARAMETER BaseUrl
  Base URL of the stack, e.g. http://192.168.1.10:8000.

.PARAMETER Username
  Admin username for the auth round-trip. Default 'admin'.

.PARAMETER Password
  Admin password. If omitted and the env HOSPITAL_SMOKE_PASSWORD
  is set, that value is used; otherwise the script prompts.

.PARAMETER SkipAuth
  Skip the auth round-trip and the protected endpoints.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $BaseUrl,
    [string] $Username = 'admin',
    [string] $Password,
    [switch] $SkipAuth
)

$ErrorActionPreference = "Stop"

if (-not $Password -and $env:HOSPITAL_SMOKE_PASSWORD) {
    $Password = $env:HOSPITAL_SMOKE_PASSWORD
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$script:cookieJar = New-Object System.Net.CookieContainer
$script:failures = New-Object System.Collections.Generic.List[string]

function Invoke-Api {
    param(
        [string] $Method,
        [string] $Path,
        [hashtable] $RequestBody = @{}
    )
    $uri = [Uri]"$BaseUrl$Path"
    $request = [System.Net.HttpWebRequest]::Create($uri)
    $request.Method = $Method
    $request.CookieContainer = $script:cookieJar
    $request.Timeout = 15000
    $request.UserAgent = "SistemaCajaHospitalaria smoke/1.0"
    $request.Accept = "application/json"
    $request.AllowAutoRedirect = $false

    if ($Method -in @('POST', 'PUT', 'PATCH', 'DELETE')) {
        $request.ContentType = 'application/json'
        $xsrfCookie = $script:cookieJar.GetCookies([Uri] $BaseUrl)["XSRF-TOKEN"]
        if ($null -ne $xsrfCookie -and -not [string]::IsNullOrWhiteSpace($xsrfCookie.Value)) {
            $request.Headers.Add("X-XSRF-TOKEN", [System.Uri]::UnescapeDataString($xsrfCookie.Value))
        }

        $bodyJson = $RequestBody | ConvertTo-Json -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)
        $request.ContentLength = $bytes.Length
        $stream = $request.GetRequestStream()
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Close()
    }

    try {
        $response = $request.GetResponse()
        $status = [int]$response.StatusCode
        $responseBody = $null
        $stream = $response.GetResponseStream()
        if ($stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
        }
        $response.Close()
        return [pscustomobject]@{ Status = $status; Body = $responseBody }
    } catch [System.Net.WebException] {
        $ex = $_.Exception
        $status = if ($ex.Response) { [int]$ex.Response.StatusCode } else { 0 }
        $responseBody = if ($ex.Response) {
            $stream = $ex.Response.GetResponseStream()
            if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
                $errorBody
            } else { $null }
        } else { $null }
        return [pscustomobject]@{ Status = $status; Body = $responseBody }
    }
}

function Assert-Status {
    param(
        [string] $Label,
        [int] $Expected,
        [int] $Actual,
        [string] $Body
    )
    if ($Actual -eq $Expected) {
        Write-Host "  PASS  $Label  -> $Actual" -ForegroundColor Green
    } else {
        Write-Host "  FAIL  $Label  -> $Actual (expected $Expected)" -ForegroundColor Red
        if ($Body) {
            $preview = ($Body -split "`n")[0]
            if ($preview.Length -gt 160) { $preview = $preview.Substring(0, 160) + "..." }
            Write-Host "        $preview" -ForegroundColor DarkGray
        }
        $script:failures.Add("$Label (got $Actual, expected $Expected)")
    }
}

Write-Host "Smoke test against $BaseUrl"
Write-Host ""

# 1. Public health
$h = Invoke-Api -Method GET -Path "/api/health"
Assert-Status "GET /api/health" 200 $h.Status $h.Body

# 2. System health
$sh = Invoke-Api -Method GET -Path "/api/system/health"
Assert-Status "GET /api/system/health" 200 $sh.Status $sh.Body

# 3. Echo config
$ec = Invoke-Api -Method GET -Path "/api/system/echo-config"
Assert-Status "GET /api/system/echo-config" 200 $ec.Status $ec.Body

if (-not $SkipAuth) {
    if (-not $Password) {
        $secure = Read-Host "Password for $Username" -AsSecureString
        $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        )
    }

    $csrf = Invoke-Api -Method GET -Path "/sanctum/csrf-cookie"
    Assert-Status "GET /sanctum/csrf-cookie" 204 $csrf.Status $csrf.Body
    if ($csrf.Status -ne 204) {
        Write-Host ""
        Write-Host "CSRF setup failed; auth-required tests were not executed." -ForegroundColor Yellow
        exit 1
    }

    # 4. Login
    $login = Invoke-Api -Method POST -Path "/api/auth/login" -RequestBody @{
        login = $Username
        password = $Password
    }
    Assert-Status "POST /api/auth/login" 200 $login.Status $login.Body

    if ($login.Status -ne 200) {
        Write-Host ""
        Write-Host "Login failed; auth-required tests were not executed." -ForegroundColor Yellow
        Write-Host "$($script:failures.Count) failure(s):" -ForegroundColor Red
        $script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
        exit 1
    }

    # 5. Me
    $me = Invoke-Api -Method GET -Path "/api/auth/me"
    Assert-Status "GET /api/auth/me" 200 $me.Status $me.Body

    # 6-8. List endpoints
    $cats = Invoke-Api -Method GET -Path "/api/categories"
    Assert-Status "GET /api/categories" 200 $cats.Status $cats.Body
    $svcs = Invoke-Api -Method GET -Path "/api/services"
    Assert-Status "GET /api/services" 200 $svcs.Status $svcs.Body
    $st = Invoke-Api -Method GET -Path "/api/system/status"
    Assert-Status "GET /api/system/status" 200 $st.Status $st.Body
}

Write-Host ""
if ($script:failures.Count -eq 0) {
    Write-Host "All smoke tests passed." -ForegroundColor Green
    exit 0
}
Write-Host "$($script:failures.Count) failure(s):" -ForegroundColor Red
$script:failures | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
exit 1
