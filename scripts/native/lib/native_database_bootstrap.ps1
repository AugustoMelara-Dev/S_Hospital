#Requires -Version 5.1

Set-StrictMode -Version Latest

function Invoke-NativeMariaDbPipeClient {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$ClientPath,
        [Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_-]{1,80}$')][string]$PipeName,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Sql,
        [string]$DefaultsExtraFile='',
        [ValidateRange(1,120)][int]$TimeoutSeconds=15
    )
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$ClientPath
    if(-not[string]::IsNullOrWhiteSpace($DefaultsExtraFile)){
        if(-not(Test-Path -LiteralPath $DefaultsExtraFile -PathType Leaf)-or$DefaultsExtraFile.Contains('"')){throw'MariaDB pipe credential file is invalid.'}
        $info.Arguments='--defaults-extra-file="'+$DefaultsExtraFile+'" --protocol=PIPE --socket="'+$PipeName+'" --batch --skip-column-names'
    }
    else{$info.Arguments='--no-defaults --protocol=PIPE --socket="'+$PipeName+'" --user=root --batch --skip-column-names'}
    $info.UseShellExecute=$false;$info.CreateNoWindow=$true
    $info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
    $process=[Diagnostics.Process]::new();$process.StartInfo=$info
    try{
        if(-not$process.Start()){throw'MariaDB isolated pipe client could not start.'}
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        $process.StandardInput.Write($Sql);$process.StandardInput.Close()
        if(-not$process.WaitForExit($TimeoutSeconds*1000)){$process.Kill();throw'MariaDB isolated pipe client timed out.'}
        $process.WaitForExit();if(-not$stdout.Wait(5000)-or-not$stderr.Wait(5000)){throw'MariaDB isolated pipe client output did not complete.'}
        [pscustomobject]@{ExitCode=$process.ExitCode;Output=$stdout.Result;Error=$stderr.Result}
    }
    finally{$process.Dispose()}
}

function Invoke-NativeMariaDbInitialSecurity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$ServerPath,
        [Parameter(Mandatory=$true)][string]$ClientPath,
        [Parameter(Mandatory=$true)][string]$ConfigPath,
        [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{32,256}$')][string]$ApplicationPassword,
        [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{32,256}$')][string]$RootPassword,
        [Parameter(Mandatory=$true)][string]$CredentialDirectory
    )
    foreach($path in @($ServerPath,$ClientPath,$ConfigPath)){
        if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw'MariaDB isolated initialization input is missing.'}
        if($path.Contains('"')){throw'MariaDB isolated initialization paths must not contain quotation marks.'}
    }
    if(-not(Test-Path -LiteralPath $CredentialDirectory -PathType Container)-or$CredentialDirectory.Contains('"')){throw'MariaDB administrator credential directory is invalid.'}
    $pipeName='SHospitalBootstrap'+[guid]::NewGuid().ToString('N')
    $credentialFile=Join-Path $CredentialDirectory ('mariadb-bootstrap-'+[guid]::NewGuid().ToString('N')+'.ini')
    [IO.File]::WriteAllText($credentialFile,"[client]`r`nuser=root`r`npassword=`"$RootPassword`"`r`n",[Text.UTF8Encoding]::new($false))
    $serverInfo=[Diagnostics.ProcessStartInfo]::new();$serverInfo.FileName=$ServerPath
    $serverInfo.Arguments='--defaults-file="'+$ConfigPath+'" --skip-networking --named-pipe --socket="'+$pipeName+'" --console'
    $serverInfo.UseShellExecute=$false;$serverInfo.CreateNoWindow=$true;$serverInfo.RedirectStandardOutput=$true;$serverInfo.RedirectStandardError=$true
    $server=[Diagnostics.Process]::new();$server.StartInfo=$serverInfo;$serverStarted=$false
    $sql=$null
    try{
        if(-not$server.Start()){throw'MariaDB isolated initialization server could not start.'};$serverStarted=$true
        $serverOutput=$server.StandardOutput.ReadToEndAsync();$serverError=$server.StandardError.ReadToEndAsync()
        $ready=$false;$initialAuthentication=''
        foreach($attempt in 1..30){
            if($server.HasExited){break}
            try{$probe=Invoke-NativeMariaDbPipeClient -ClientPath $ClientPath -PipeName $pipeName -Sql "SELECT 1;`n" -TimeoutSeconds 3;if($probe.ExitCode-eq0){$ready=$true;$initialAuthentication='unsecured'}}catch{$ready=$false}
            if(-not$ready){try{$probe=Invoke-NativeMariaDbPipeClient -ClientPath $ClientPath -PipeName $pipeName -DefaultsExtraFile $credentialFile -Sql "SELECT 1;`n" -TimeoutSeconds 3;if($probe.ExitCode-eq0){$ready=$true;$initialAuthentication='secured'}}catch{$ready=$false}}
            if($ready){break};Start-Sleep -Milliseconds 500
        }
        if(-not$ready){throw'MariaDB isolated initialization server did not become ready.'}
        $sql=@"
CREATE DATABASE IF NOT EXISTS hospital_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'hospital'@'127.0.0.1' IDENTIFIED BY '$ApplicationPassword';
ALTER USER 'hospital'@'127.0.0.1' IDENTIFIED BY '$ApplicationPassword';
GRANT ALL PRIVILEGES ON hospital_billing.* TO 'hospital'@'127.0.0.1';
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$RootPassword';
ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '$RootPassword';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
ALTER USER 'root'@'localhost' IDENTIFIED BY '$RootPassword';
FLUSH PRIVILEGES;
SHUTDOWN;
"@
        $secure=if($initialAuthentication-eq'secured'){Invoke-NativeMariaDbPipeClient -ClientPath $ClientPath -PipeName $pipeName -DefaultsExtraFile $credentialFile -Sql $sql -TimeoutSeconds 30}else{Invoke-NativeMariaDbPipeClient -ClientPath $ClientPath -PipeName $pipeName -Sql $sql -TimeoutSeconds 30}
        if($secure.ExitCode-ne0){throw'MariaDB isolated security statements failed.'}
        if(-not$server.WaitForExit(30000)){$server.Kill();throw'MariaDB isolated initialization server did not stop after securing accounts.'}
        $server.WaitForExit();if(-not$serverOutput.Wait(5000)-or-not$serverError.Wait(5000)){throw'MariaDB isolated initialization server output did not complete.'}
        if($server.ExitCode-ne0){throw'MariaDB isolated initialization server stopped with an error.'}
        [pscustomobject]@{Ready=$true;Transport='named-pipe';TcpDisabled=$true;InitialAuthentication=$initialAuthentication;ServerExitCode=$server.ExitCode;ClientExitCode=$secure.ExitCode}
    }
    finally{
        $sql=$null
        if($serverStarted-and-not$server.HasExited){try{$server.Kill()}catch{};try{$server.WaitForExit(5000)|Out-Null}catch{}}
        $server.Dispose()
        if(Test-Path -LiteralPath $credentialFile){Remove-Item -LiteralPath $credentialFile -Force}
    }
}
