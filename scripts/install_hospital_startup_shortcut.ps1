param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [string]$Url
)

$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path $ProjectRoot).Path
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'Sistema de Caja Hospitalaria.url'

$content = @"
[InternetShortcut]
URL=$Url
WorkingDirectory=$resolvedRoot
"@

Set-Content -LiteralPath $shortcutPath -Value $content -Encoding ASCII
Write-Host "Acceso directo creado: $shortcutPath"
