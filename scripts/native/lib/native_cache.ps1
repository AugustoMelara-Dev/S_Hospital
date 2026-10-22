#Requires -Version 5.1

Set-StrictMode -Version Latest

function Clear-NativePersistentLaravelCaches {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string] $DataRoot)

    $root = [IO.Path]::GetFullPath($DataRoot).TrimEnd('\')
    $cacheRoot = Join-Path $root 'cache'
    if (-not (Test-Path -LiteralPath $cacheRoot -PathType Container)) { return }
    foreach ($directory in @($root, $cacheRoot, (Join-Path $cacheRoot 'views'))) {
        if (Test-Path -LiteralPath $directory) {
            $item = Get-Item -LiteralPath $directory -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Persistent cache path must not be a reparse point: $directory" }
        }
    }
    foreach ($name in @('config.php','events.php','packages.php','routes.php','services.php')) {
        $path = Join-Path $cacheRoot $name
        if (Test-Path -LiteralPath $path) {
            $item = Get-Item -LiteralPath $path -Force
            if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Unexpected persistent cache entry: $path" }
            Remove-Item -LiteralPath $path -Force
        }
    }
    $views = Join-Path $cacheRoot 'views'
    if (Test-Path -LiteralPath $views -PathType Container) {
        $entries = @(Get-ChildItem -LiteralPath $views -Recurse -Force)
        if (@($entries | Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 }).Count -gt 0) { throw 'Compiled view cache contains a reparse point.' }
        Get-ChildItem -LiteralPath $views -Force | Remove-Item -Recurse -Force
    }
}
