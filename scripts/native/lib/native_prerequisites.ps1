#Requires -Version 5.1

Set-StrictMode -Version Latest

function ConvertTo-NativeSafeInstallFailureMessage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$Phase,
        [string]$Message=''
    )
    $diagnosticPhases=@(
        'starting','payload_validation','prerequisites',
        'repair_prior_release_acl','validate_prior_release_integrity','stage_release',
        'prepare_data_root'
    )
    if($Phase-notin$diagnosticPhases){return "Installation failed during phase '$Phase'."}
    $safe=([string]$Message-replace'[\r\n]+',' ').Trim()
    $safe=[regex]::Replace($safe,'(?i)\b(password|secret|token|app_key|db_password|encryption_key)\b\s*[:=]\s*(?:"[^"]*"|''[^'']*''|\S+)',{param($match) $match.Groups[1].Value+'=[redacted]'})
    $safe=[regex]::Replace($safe,'(?i)IDENTIFIED\s+BY\s+''[^'']*''',"IDENTIFIED BY '[redacted]'")
    if([string]::IsNullOrWhiteSpace($safe)){return "Installation failed during phase '$Phase'."}
    if($safe.Length-gt512){$safe=$safe.Substring(0,512)}
    $safe
}

function Get-NativeVisualCppRuntimeRegistration {
    foreach ($path in @(
        'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64'
    )) {
        $registration = Get-ItemProperty -LiteralPath $path -ErrorAction SilentlyContinue
        if ($registration -and [int]$registration.Installed -eq 1) { return $registration }
    }
    $null
}

function Install-NativeVisualCppRuntime {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $InstallerPath,
        [Parameter(Mandatory = $true)][version] $RequiredVersion,
        [Parameter(Mandatory = $true)][string] $LogPath
    )

    if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
        throw "Bundled Microsoft Visual C++ Redistributable is missing: $InstallerPath"
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $InstallerPath
    if ($signature.Status -ne [Management.Automation.SignatureStatus]::Valid -or
        -not $signature.SignerCertificate -or
        $signature.SignerCertificate.Subject -notmatch '(^|, )O=Microsoft Corporation(,|$)') {
        throw 'Bundled Microsoft Visual C++ Redistributable does not have a valid Microsoft signature.'
    }
    $packageVersion = [version](Get-Item -LiteralPath $InstallerPath).VersionInfo.FileVersion
    if ($packageVersion -lt $RequiredVersion) {
        throw "Bundled Microsoft Visual C++ Redistributable is older than required ($packageVersion < $RequiredVersion)."
    }

    $process = Start-Process -FilePath $InstallerPath -ArgumentList @(
        '/install', '/quiet', '/norestart', '/log', ('"' + $LogPath + '"')
    ) -Wait -PassThru
    if (@(0, 1638, 3010) -notcontains $process.ExitCode) {
        throw "Microsoft Visual C++ Redistributable installation failed with code $($process.ExitCode)."
    }
    if ($process.ExitCode -eq 1638) {
        $installed = Get-NativeVisualCppRuntimeRegistration
        if (-not $installed) { throw 'Visual C++ installer reported another version, but no installed x64 v14 runtime was found.' }
    }

    [pscustomobject]@{
        Ready = $true
        PackageVersion = $packageVersion.ToString()
        ExitCode = $process.ExitCode
        RestartRequired = ($process.ExitCode -eq 3010)
    }
}

function Test-NativeBundledRuntimeDependencies {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $ReleaseRoot,
        [Parameter(Mandatory = $true)][string] $PhpIniPath
    )

    $php = Join-Path $ReleaseRoot 'runtime\php\php.exe'
    $mariaServer = Join-Path $ReleaseRoot 'runtime\mariadb\bin\mariadbd.exe'
    $mariaClient = Join-Path $ReleaseRoot 'runtime\mariadb\bin\mariadb.exe'
    foreach ($binary in @($php, $mariaServer, $mariaClient)) {
        if (-not (Test-Path -LiteralPath $binary -PathType Leaf)) { throw "Bundled runtime binary is missing: $binary" }
    }

    $probeCode = '<?php $required=["curl","dom","fileinfo","gd","intl","mbstring","openssl","pdo_mysql","sodium","xml","xmlwriter","zip"];$missing=array_values(array_filter($required,fn($e)=>!extension_loaded($e)));$sodium=function_exists("sodium_crypto_pwhash")&&defined("SODIUM_CRYPTO_PWHASH_ALG_ARGON2ID13");echo json_encode(["php"=>PHP_VERSION,"missing"=>$missing,"sodium_argon2id13"=>$sodium]);exit($missing===[]&&$sodium?0:1);'
    $phpProcess = Invoke-NativePhpCodeFromStandardInput -PhpPath $php -PhpIniPath $PhpIniPath -Code $probeCode
    $phpOutput = @($phpProcess.Output)
    $phpExit = $phpProcess.ExitCode
    if ($phpExit -ne 0) { throw "Bundled PHP or one of its DLL dependencies failed to load (code $phpExit)." }
    $phpProbe = (($phpOutput -join "`n") | ConvertFrom-Json)
    if (@($phpProbe.missing).Count -gt 0 -or $phpProbe.sodium_argon2id13 -ne $true) {
        throw 'Bundled PHP extension probe did not satisfy the production contract.'
    }

    & $mariaServer '--version' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Bundled MariaDB server or one of its DLL dependencies failed to load.' }
    & $mariaClient '--version' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Bundled MariaDB client or one of its DLL dependencies failed to load.' }

    [pscustomobject]@{ Ready = $true; PhpVersion = [string]$phpProbe.php; MariaDbBinaries = 'loaded' }
}

function Invoke-NativePhpCodeFromStandardInput {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string] $PhpPath,
        [Parameter(Mandatory = $true)][string] $PhpIniPath,
        [Parameter(Mandatory = $true)][string] $Code
    )
    foreach ($path in @($PhpPath,$PhpIniPath)) {
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "PHP probe input is missing: $path" }
        if ($path.Contains('"')) { throw 'PHP probe paths must not contain quotation marks.' }
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $PhpPath
    # PHP CLI on Windows reads standard input when no script/-r option is given.
    # `-f -` is not portable here (PHP reports "Could not open input file: -").
    $start.Arguments = '-c "' + $PhpIniPath + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    try {
        if (-not $process.Start()) { throw 'Bundled PHP probe process could not start.' }
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($Code)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Bundled PHP probe timed out.' }
        $process.WaitForExit()
        if (-not $outputTask.Wait(5000) -or -not $errorTask.Wait(5000)) { throw 'Bundled PHP probe output did not complete.' }
        [pscustomobject]@{ ExitCode=$process.ExitCode; Output=$outputTask.Result; Error=$errorTask.Result }
    }
    finally { $process.Dispose() }
}
