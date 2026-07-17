$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$setup = Get-Content -LiteralPath (Join-Path $projectRoot "setup.bat") -Raw
$installer = Get-Content -LiteralPath (Join-Path $PSScriptRoot "deploy_hospital_lan.ps1") -Raw
$releaseBuilder = Get-Content -LiteralPath (Join-Path $PSScriptRoot "make_offline_release.ps1") -Raw
$imageLoader = Get-Content -LiteralPath (Join-Path $PSScriptRoot "load_offline_images.ps1") -Raw
$productionCompose = Get-Content -LiteralPath (Join-Path $projectRoot "docker-compose.prod.yml") -Raw

function Assert-Contains([string] $content, [string] $needle, [string] $label) {
    if (-not $content.Contains($needle)) {
        throw "Expected $label to contain: $needle"
    }
}

function Assert-NotContains([string] $content, [string] $needle, [string] $label) {
    if ($content.Contains($needle)) {
        throw "Expected $label not to contain: $needle"
    }
}

Assert-Contains $setup "scripts\deploy_hospital_lan.ps1" "setup.bat"
Assert-NotContains $setup "docker compose exec backend" "setup.bat"

foreach ($requiredSecret in @(
    'PUSHER_APP_ID',
    'PUSHER_APP_KEY',
    'PUSHER_APP_SECRET',
    'HOSPITAL_BACKUP_ENCRYPTION_KEY'
)) {
    Assert-Contains $installer $requiredSecret "LAN installer"
}
Assert-Contains $installer '-AsSecureString' "LAN installer"
Assert-Contains $installer 'HOSPITAL_INITIAL_ADMIN_PASSWORD' "LAN installer"
Assert-NotContains $installer '--password="$adminPassword"' "LAN installer"

foreach ($image in @(
    's_hospital-backend:latest',
    's_hospital-queue-worker:latest',
    's_hospital-scheduler:latest',
    'nginx:1.25.4-alpine',
    'mariadb:11.4.3',
    'quay.io/soketi/soketi:1.6-16-alpine'
)) {
    Assert-Contains $releaseBuilder $image "offline release builder"
    Assert-Contains $imageLoader $image "offline image loader"
}
foreach ($pinnedImage in @(
    'nginx:1.25.4-alpine@sha256:31bad00311cb5eeb8a6648beadcf67277a175da89989f14727420a80e2e76742',
    'mariadb:11.4.3@sha256:e3432369d4d432ec2a3d777ff84ffca11ec8c2188cf1b6a0551a393ae5d833bb',
    'quay.io/soketi/soketi:1.6-16-alpine@sha256:5e45fe1adbf2d4ef8022d0126a3c7e4371b7b08f35784b76a2dc353954ee885c'
)) {
    Assert-Contains $productionCompose $pinnedImage "production compose"
    Assert-Contains $releaseBuilder $pinnedImage "offline release builder"
}
Assert-Contains $releaseBuilder '".env.example"' "offline release builder"
Assert-Contains $releaseBuilder '"README.md"' "offline release builder"

Write-Host "[ OK ] offline release contract is complete and secure"
