#Requires -Version 5.1

[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ReleaseRoot)

$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$source=Join-Path ([IO.Path]::GetFullPath($ReleaseRoot)) 'runtime\winsw\WinSW-x64.exe'
if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw 'Bundled WinSW executable is missing.'}
$root=Join-Path ([IO.Path]::GetTempPath()) ('s-hospital-winsw-contract-'+[guid]::NewGuid().ToString('N'))
try{
    New-Item -ItemType Directory -Path $root|Out-Null
    $id='SHospitalContract'+[guid]::NewGuid().ToString('N')
    $executable=Join-Path $root ($id+'.exe')
    $configuration=Join-Path $root ($id+'.xml')
    Copy-Item -LiteralPath $source -Destination $executable
    $xml='<service><id>'+$id+'</id><name>S_Hospital contract probe</name><description>Configuration discovery probe.</description><executable>powershell.exe</executable><arguments>-NoProfile</arguments></service>'
    [IO.File]::WriteAllText($configuration,$xml,[Text.UTF8Encoding]::new($false))
    $output=@(& $executable status 2>&1)
    $exitCode=$LASTEXITCODE
    $text=$output-join"`n"
    if($text-match'Unable to locate WinSW-x64\.(xml|yml)' -or $text-match'Unable to locate '+[regex]::Escape($id)){
        throw 'WinSW did not discover the adjacent same-base-name XML configuration.'
    }
    if($exitCode-ne0-or$text.Trim()-ne'NonExistent'){throw 'WinSW status did not identify the unregistered synthetic service through the adjacent configuration.'}
    [pscustomobject]@{ready=$true;configuration_discovered=$true;status_exit_code=$exitCode;status_output=$text;winsw_sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()}|ConvertTo-Json -Compress
}
finally{
    if(Test-Path -LiteralPath $root){
        $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
        $full=[IO.Path]::GetFullPath($root)
        if(-not$full.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase)-or[IO.Path]::GetFileName($full)-notmatch'^s-hospital-winsw-contract-[0-9a-f]{32}$'){throw 'Refusing unsafe WinSW test cleanup path.'}
        Remove-Item -LiteralPath $full -Recurse -Force
    }
}
