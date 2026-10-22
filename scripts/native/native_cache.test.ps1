#Requires -Version 5.1
$ErrorActionPreference='Stop';Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'lib\native_cache.ps1')
$root=Join-Path $env:TEMP ('s-hospital-cache-'+[guid]::NewGuid().ToString('N'))
try{
 New-Item -ItemType Directory -Path (Join-Path $root 'cache\views') -Force|Out-Null
 foreach($name in @('config.php','events.php','packages.php','routes.php','services.php')){Set-Content -LiteralPath (Join-Path $root ('cache\'+$name)) -Value 'stale'}
 Set-Content -LiteralPath (Join-Path $root 'cache\views\compiled.php') -Value 'stale'
 Clear-NativePersistentLaravelCaches -DataRoot $root
 if(@(Get-ChildItem -LiteralPath (Join-Path $root cache) -Recurse -File).Count-ne0){throw 'Known persistent Laravel caches were not cleared.'}
 'PASS native persistent Laravel cache invalidation'
}finally{if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}}
