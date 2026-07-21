$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$libraryPath = Join-Path $scriptRoot "lib\lan_asset_discovery.ps1"

if (-not (Test-Path -LiteralPath $libraryPath)) {
    throw "Missing LAN asset discovery library: $libraryPath"
}

. $libraryPath

function Assert-Equal([string] $Expected, [string] $Actual, [string] $Message) {
    if ($Expected -ne $Actual) {
        throw "$Message Expected=[$Expected] Actual=[$Actual]"
    }
}

$productionHtml = @'
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" crossorigin href="/assets/app-a1b2c3.css">
    <script type="module" crossorigin src="/assets/app-d4e5f6.js"></script>
  </head>
</html>
'@

$productionAssets = Get-HospitalLanAssetPaths -Html $productionHtml
Assert-Equal "/assets/app-d4e5f6.js" $productionAssets.JavaScript "Production JS asset was not discovered."
Assert-Equal "/assets/app-a1b2c3.css" $productionAssets.Css "Production CSS asset was not discovered."

$developmentHtml = '<script type="module" src="/src/main.tsx"></script>'
$developmentAssets = Get-HospitalLanAssetPaths -Html $developmentHtml
Assert-Equal "" $developmentAssets.JavaScript "Development entrypoints must not satisfy production LAN proof."
Assert-Equal "" $developmentAssets.Css "Missing production CSS must remain visible."

Write-Host "LAN asset discovery contract passed."
