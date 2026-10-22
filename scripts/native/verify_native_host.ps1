#Requires -Version 5.1

[CmdletBinding(DefaultParameterSetName = 'Verify')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Baseline')]
    [switch] $CaptureXamppBaseline,

    [Parameter(Mandatory = $true, ParameterSetName = 'Verify')]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $ExePath,

    [Parameter(Mandatory = $true, ParameterSetName = 'Verify')]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string] $ExpectedExeSha256,

    [Parameter(Mandatory = $true, ParameterSetName = 'Verify')]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string] $XamppBaselinePath,

    [Parameter(Mandatory = $true)]
    [string] $OutputPath,

    [Parameter(ParameterSetName = 'Verify')]
    [string] $InstallRoot = "$env:ProgramFiles\S_Hospital",

    [Parameter(ParameterSetName = 'Verify')]
    [string] $DataRoot = "$env:ProgramData\S_Hospital",

    [Parameter(ParameterSetName = 'Verify')]
    [ValidatePattern('^http://127\.0\.0\.1:[0-9]+$')]
    [string] $AppUrl = 'http://127.0.0.1:8000'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-FullNormalizedPath {
    param([Parameter(Mandatory = $true)][string] $Path)
    return [IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Test-PathBelowRoot {
    param([string] $Path, [string] $Root)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $fullPath = Get-FullNormalizedPath $Path
    $fullRoot = Get-FullNormalizedPath $Root
    return $fullPath.StartsWith($fullRoot + '\', [StringComparison]::OrdinalIgnoreCase)
}

function Get-ManifestIdentity {
    param([Parameter(Mandatory = $true)][string] $ReleaseRoot)
    $manifestPath = Join-Path $ReleaseRoot 'native-payload.manifest.json'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $lines = New-Object 'Collections.Generic.List[string]'
    $seen = @{}
    foreach ($entry in @($manifest.files)) {
        $relative = [string]$entry.path
        if ($relative -eq '' -or $relative -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($relative)) { throw "Unsafe manifest path: $relative" }
        $key = $relative.ToLowerInvariant()
        if ($seen.ContainsKey($key)) { throw "Duplicate manifest path: $relative" }
        $seen[$key] = $true
        $filePath = Join-Path $ReleaseRoot $relative.Replace('/', '\')
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw "Manifest file is missing: $relative" }
        $file = Get-Item -LiteralPath $filePath
        if ([int64]$file.Length -ne [int64]$entry.bytes) { throw "Manifest byte count differs: $relative" }
        $hash = (Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hash -ne ([string]$entry.sha256).ToLowerInvariant()) { throw "Manifest hash differs: $relative" }
        $lines.Add(($relative + "`0" + [string]$entry.bytes + "`0" + ([string]$entry.sha256).ToLowerInvariant() + "`n"))
    }
    $actualFiles = @(Get-ChildItem -LiteralPath $ReleaseRoot -Recurse -File | Where-Object Name -ne 'native-payload.manifest.json')
    if ($actualFiles.Count -ne $seen.Count) { throw "Installed file count differs from manifest ($($actualFiles.Count) vs $($seen.Count))." }
    $lines.Sort([StringComparer]::Ordinal)
    $builder = New-Object Text.StringBuilder
    foreach ($line in $lines) { [void]$builder.Append($line) }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($builder.ToString())))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    $version = [string]$manifest.version
    if ($version -notmatch '^[0-9A-Za-z][0-9A-Za-z._-]+$') { throw 'Manifest version is invalid.' }
    [pscustomobject]@{
        version = $version
        release_id = $version + '-' + $digest.Substring(0, 12)
        content_sha256 = $digest
        files_checked = $seen.Count
    }
}

function Get-XamppInventory {
    $serviceRows = @()
    foreach ($service in @(Get-CimInstance Win32_Service -ErrorAction Stop | Where-Object { [string]$_.PathName -match '(?i)[\\/]xampp[\\/]' })) {
        $serviceRows += [pscustomobject]@{
            name = [string]$service.Name
            state = [string]$service.State
            start_mode = [string]$service.StartMode
            start_name = [string]$service.StartName
            path_name = [string]$service.PathName
        }
    }

    $processRows = @()
    foreach ($process in @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { [string]$_.ExecutablePath -match '(?i)[\\/]xampp[\\/]' })) {
        if ([string]::IsNullOrWhiteSpace([string]$process.ExecutablePath)) {
            throw "Cannot read the executable path for XAMPP process $($process.ProcessId)."
        }
        $listeners = @(Get-NetTCPConnection -State Listen -OwningProcess ([int]$process.ProcessId) -ErrorAction SilentlyContinue | ForEach-Object {
            [pscustomobject]@{ address = [string]$_.LocalAddress; port = [int]$_.LocalPort }
        })
        $processRows += [pscustomobject]@{
            name = [string]$process.Name
            executable_path = [string]$process.ExecutablePath
            listeners = @($listeners | Sort-Object address, port -Unique)
        }
    }

    [pscustomobject]@{
        captured_at_utc = [DateTime]::UtcNow.ToString('o')
        services = @($serviceRows | Sort-Object name)
        processes = @($processRows | Sort-Object executable_path, name)
    }
}

function Write-JsonEvidence {
    param([Parameter(Mandatory = $true)] $Value)
    $fullOutput = [IO.Path]::GetFullPath($OutputPath)
    $parent = Split-Path -Parent $fullOutput
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [IO.File]::WriteAllText($fullOutput, ($Value | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}

if ($PSCmdlet.ParameterSetName -eq 'Baseline') {
    try {
        $baseline = [pscustomobject]@{
            schema = 's-hospital-xampp-baseline/v1'
            ok = $true
            xampp = Get-XamppInventory
        }
        Write-JsonEvidence $baseline
        $baseline | ConvertTo-Json -Depth 12
        exit 0
    }
    catch {
        $failure = [pscustomobject]@{ schema = 's-hospital-xampp-baseline/v1'; ok = $false; error = $_.Exception.Message }
        Write-JsonEvidence $failure
        $failure | ConvertTo-Json -Depth 6
        exit 2
    }
}

$checks = New-Object Collections.Generic.List[object]
function Add-Check {
    param([string] $Name, [bool] $Passed, [string] $Observed, [string] $Expected, [string] $Error = '')
    $checks.Add([pscustomobject]@{ name = $Name; passed = $Passed; observed = $Observed; expected = $Expected; error = $Error })
}

function Invoke-ObservedCheck {
    param([string] $Name, [string] $Expected, [scriptblock] $Observation, [scriptblock] $Predicate)
    try {
        $value = & $Observation
        $passed = [bool](& $Predicate $value)
        Add-Check -Name $Name -Passed $passed -Observed (($value | ConvertTo-Json -Depth 6 -Compress)) -Expected $Expected
        return $value
    }
    catch {
        Add-Check -Name $Name -Passed $false -Observed '' -Expected $Expected -Error $_.Exception.Message
        return $null
    }
}

$installFull = Get-FullNormalizedPath $InstallRoot
$dataFull = Get-FullNormalizedPath $DataRoot
$canonicalInstall = Get-FullNormalizedPath (Join-Path $env:ProgramFiles 'S_Hospital')
$canonicalData = Get-FullNormalizedPath (Join-Path $env:ProgramData 'S_Hospital')
if (-not $installFull.Equals($canonicalInstall, [StringComparison]::OrdinalIgnoreCase) -or -not $dataFull.Equals($canonicalData, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Host verification only accepts the canonical protected S_Hospital roots.'
}
$releasesRoot = Join-Path $installFull 'releases'
$currentPath = Join-Path $installFull 'current'
$statePath = Join-Path $dataFull 'state\native-install-state.json'
$serviceIds = @('SHospitalMariaDB','SHospitalPhp','SHospitalWeb','SHospitalQueueDefault','SHospitalQueueBackups','SHospitalScheduler')
$expectedPorts = @(3307, 9070, ([uri]$AppUrl).Port)

$exeHash = Invoke-ObservedCheck 'installer.sha256' $ExpectedExeSha256.ToLowerInvariant() {
    (Get-FileHash -LiteralPath $ExePath -Algorithm SHA256).Hash.ToLowerInvariant()
} { param($value) $value -eq $ExpectedExeSha256.ToLowerInvariant() }

$currentTarget = Invoke-ObservedCheck 'release.current_target' "junction below $releasesRoot" {
    $item = Get-Item -LiteralPath $currentPath -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or -not $item.Target) { throw 'current is not a junction.' }
    $target = [string]@($item.Target)[0]
    if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $item.Parent.FullName $target }
    Get-FullNormalizedPath $target
} { param($value) Test-PathBelowRoot -Path $value -Root $releasesRoot }

$releaseMetadata = $null
if ($null -ne $currentTarget) {
    $releaseMetadata = Invoke-ObservedCheck 'release.manifest_integrity' 'every installed byte matches the manifest and computed ReleaseId matches current directory' {
        $identity = Get-ManifestIdentity -ReleaseRoot $currentTarget
        $identity | Add-Member -NotePropertyName directory -NotePropertyValue (Split-Path $currentTarget -Leaf) -PassThru
    } { param($value) $value.release_id -eq $value.directory }
}

$installState = Invoke-ObservedCheck 'install.journal' 'status=complete, phase=completed, ReleaseId=current' {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    [pscustomobject]@{ status = [string]$state.status; phase = [string]$state.phase; version = [string]$state.version; release_id = [string]$state.release_id }
} {
    param($value)
    $value.status -eq 'complete' -and $value.phase -eq 'completed' -and $null -ne $releaseMetadata -and $value.release_id -eq $releaseMetadata.release_id
}

$serviceEvidence = @()
foreach ($serviceId in $serviceIds) {
    $serviceEvidence += Invoke-ObservedCheck "service.$serviceId" 'Running, Auto, LocalService, binary under protected install root' {
        $service = Get-CimInstance Win32_Service -Filter ("Name='" + $serviceId.Replace("'", "''") + "'") -ErrorAction Stop
        if ($null -eq $service) { throw 'Service is not installed.' }
        $registryPath = 'HKLM:\SYSTEM\CurrentControlSet\Services\' + $serviceId
        $delayed = [int](Get-ItemProperty -LiteralPath $registryPath -Name DelayedAutoStart -ErrorAction Stop).DelayedAutoStart
        [pscustomobject]@{
            name = [string]$service.Name
            state = [string]$service.State
            start_mode = [string]$service.StartMode
            delayed_auto_start = $delayed
            start_name = [string]$service.StartName
            path_name = [string]$service.PathName
        }
    } {
        param($value)
        $value.state -eq 'Running' -and $value.start_mode -eq 'Auto' -and $value.delayed_auto_start -eq 1 -and
            $value.start_name -eq 'NT AUTHORITY\LocalService' -and $value.path_name.IndexOf($installFull, [StringComparison]::OrdinalIgnoreCase) -ge 0
    }
}

$listenerEvidence = @()
foreach ($port in $expectedPorts) {
    $listenerEvidence += Invoke-ObservedCheck "network.loopback.$port" "one listener on 127.0.0.1:$port with executable under $installFull" {
        $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop)
        if ($connections.Count -ne 1) { throw "Expected one listener, found $($connections.Count)." }
        $connection = $connections[0]
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)" -ErrorAction Stop
        if ($null -eq $process -or [string]::IsNullOrWhiteSpace([string]$process.ExecutablePath)) { throw 'Listener executable path is unreadable.' }
        [pscustomobject]@{ address = [string]$connection.LocalAddress; port = [int]$connection.LocalPort; executable_path = [string]$process.ExecutablePath }
    } {
        param($value)
        $value.address -eq '127.0.0.1' -and (Test-PathBelowRoot -Path $value.executable_path -Root $installFull)
    }
}

$httpEvidence = Invoke-ObservedCheck 'http.health_and_static_assets' 'health 200; application 200; all referenced URLs local; JS/CSS assets return 200' {
    $health = Invoke-WebRequest -Uri ($AppUrl.TrimEnd('/') + '/up') -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10
    $application = Invoke-WebRequest -Uri ($AppUrl.TrimEnd('/') + '/') -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10
    $references = @([regex]::Matches([string]$application.Content, '(?:src|href)=["'']([^"'']+)["'']') | ForEach-Object { $_.Groups[1].Value })
    $external = @($references | Where-Object {
        $_ -match '^https?://' -and -not $_.StartsWith($AppUrl, [StringComparison]::OrdinalIgnoreCase)
    })
    $assets = @($references | Where-Object { $_ -match '\.(?:js|css)(?:\?|$)' } | Sort-Object -Unique)
    $assetResults = @()
    foreach ($asset in $assets) {
        $uri = if ($asset -match '^https?://') { $asset } else { [uri]::new([uri]($AppUrl.TrimEnd('/') + '/'), $asset).AbsoluteUri }
        $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 10
        $assetResults += [pscustomobject]@{ uri = $uri; status = [int]$response.StatusCode }
    }
    [pscustomobject]@{ health_status = [int]$health.StatusCode; application_status = [int]$application.StatusCode; external_references = $external; assets = $assetResults }
} {
    param($value)
    $value.health_status -eq 200 -and $value.application_status -eq 200 -and @($value.external_references).Count -eq 0 -and
        @($value.assets).Count -gt 0 -and @($value.assets | Where-Object status -ne 200).Count -eq 0
}

$startupShortcut = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup\S_Hospital.lnk'
$shortcutEvidence = Invoke-ObservedCheck 'startup.shortcut' 'common Startup shortcut invokes protected start_native_app.ps1 through System32 Windows PowerShell' {
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($startupShortcut)
    [pscustomobject]@{ path = $startupShortcut; target_path = [string]$shortcut.TargetPath; arguments = [string]$shortcut.Arguments; working_directory = [string]$shortcut.WorkingDirectory }
} {
    param($value)
    (Test-Path -LiteralPath $startupShortcut -PathType Leaf) -and
        $value.target_path.Equals((Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'), [StringComparison]::OrdinalIgnoreCase) -and
        $value.arguments.IndexOf((Join-Path $installFull 'current\scripts\native\start_native_app.ps1'), [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $value.working_directory.Equals($installFull, [StringComparison]::OrdinalIgnoreCase)
}

$firewallEvidence = Invoke-ObservedCheck 'network.firewall' 'no S_Hospital firewall rule; native single-PC service remains loopback-only' {
    @((Get-NetFirewallRule -ErrorAction Stop) | Where-Object { [string]$_.DisplayName -match '(?i)S[_ -]?Hospital' } | Select-Object DisplayName, Enabled, Direction, Action)
} { param($value) @($value).Count -eq 0 }

$xamppComparison = Invoke-ObservedCheck 'coexistence.xampp' 'same XAMPP service definitions/states and executable/listener set as pre-install baseline' {
    $baseline = Get-Content -LiteralPath $XamppBaselinePath -Raw | ConvertFrom-Json
    if ($baseline.schema -ne 's-hospital-xampp-baseline/v1' -or -not $baseline.ok) { throw 'XAMPP baseline is invalid or incomplete.' }
    $after = Get-XamppInventory
    $beforeServices = @($baseline.xampp.services | ForEach-Object { '{0}|{1}|{2}|{3}|{4}' -f $_.name,$_.state,$_.start_mode,$_.start_name,$_.path_name } | Sort-Object)
    $afterServices = @($after.services | ForEach-Object { '{0}|{1}|{2}|{3}|{4}' -f $_.name,$_.state,$_.start_mode,$_.start_name,$_.path_name } | Sort-Object)
    # Worker counts and PIDs may change normally. Preserve the executable/listener
    # contract instead of requiring an identical transient process list.
    $beforeProcesses = @($baseline.xampp.processes | Where-Object { @($_.listeners).Count -gt 0 } | ForEach-Object { '{0}|{1}|{2}' -f $_.name,$_.executable_path,(@($_.listeners | ForEach-Object { "$($_.address):$($_.port)" } | Sort-Object) -join ',') } | Sort-Object -Unique)
    $afterProcesses = @($after.processes | Where-Object { @($_.listeners).Count -gt 0 } | ForEach-Object { '{0}|{1}|{2}' -f $_.name,$_.executable_path,(@($_.listeners | ForEach-Object { "$($_.address):$($_.port)" } | Sort-Object) -join ',') } | Sort-Object -Unique)
    [pscustomobject]@{
        preserved = (($beforeServices -join "`n") -ceq ($afterServices -join "`n")) -and (($beforeProcesses -join "`n") -ceq ($afterProcesses -join "`n"))
        before = [pscustomobject]@{ services = $baseline.xampp.services; processes = $baseline.xampp.processes }
        after = $after
    }
} { param($value) $value.preserved }

$result = [pscustomobject]@{
    schema = 's-hospital-native-host-verification/v1'
    generated_at_utc = [DateTime]::UtcNow.ToString('o')
    ok = @($checks | Where-Object { -not $_.passed }).Count -eq 0
    scope = 'read-only-post-install-inventory'
    installer = [pscustomobject]@{ path = [IO.Path]::GetFullPath($ExePath); sha256 = $exeHash }
    installation = [pscustomobject]@{ install_root = $installFull; data_root = $dataFull; current_target = $currentTarget; release = $releaseMetadata; journal = $installState }
    services = $serviceEvidence
    listeners = $listenerEvidence
    http = $httpEvidence
    startup = $shortcutEvidence
    firewall = $firewallEvidence
    xampp = $xamppComparison
    checks = @($checks)
    unobserved = @(
        'UAC consent cannot be proven by read-only post-install inventory.',
        'Initial administrator creation and credentials are not read or claimed.',
        'Backup integrity and recovery require their authenticated or elevated verification phase.',
        'Windows restart and physical printer behavior are outside this check.'
    )
}

Write-JsonEvidence $result
$result | ConvertTo-Json -Depth 12
if ($result.ok) { exit 0 }
exit 1
