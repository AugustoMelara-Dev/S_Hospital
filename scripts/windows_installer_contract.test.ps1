$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$installerScriptPath = Join-Path $projectRoot "installer\S_Hospital.iss"
$builderPath = Join-Path $PSScriptRoot "build_windows_installer.ps1"

function Assert-FileExists([string] $path, [string] $label) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Expected $label to exist at: $path"
    }
}

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

Assert-FileExists $installerScriptPath "Inno Setup script"
Assert-FileExists $builderPath "Windows installer builder"

$installer = Get-Content -LiteralPath $installerScriptPath -Raw
$builder = Get-Content -LiteralPath $builderPath -Raw

foreach ($requiredInstallerSetting in @(
    "AppName=S_Hospital",
    "DefaultDirName=C:\S_Hospital",
    "PrivilegesRequired=admin",
    "ArchitecturesAllowed=x64compatible",
    "Uninstallable=no",
    "WizardStyle=modern",
    "Compression=lzma2/max",
    "SolidCompression=yes",
    "SetupIconFile={#SourceRoot}\offline-release\frontend\public\icons\s-hospital-installer.ico",
    'Source: "{#SourceRoot}\offline-release\*"',
    'Filename: "{app}\setup.bat"',
    'WorkingDir: "{app}"',
    "FileExists(ExpandConstant('{localappdata}\Programs\DockerDesktop\Docker Desktop.exe'))",
    "waituntilterminated"
)) {
    Assert-Contains $installer $requiredInstallerSetting "Inno Setup script"
}

Assert-NotContains $installer "[UninstallDelete]" "Inno Setup script"
Assert-NotContains $installer "runhidden" "Inno Setup script"

foreach ($requiredBuilderBehavior in @(
    '[string] $ProjectRoot = ""',
    'if ([string]::IsNullOrWhiteSpace($ProjectRoot))',
    "assert_offline_release_clean.ps1",
    "ISCC.exe",
    "S_Hospital-Instalador.exe",
    "Get-FileHash",
    "ENTREGA-USB",
    "LEEME-INSTALACION.txt",
    "DockerDesktopInstallerPath"
)) {
    Assert-Contains $builder $requiredBuilderBehavior "Windows installer builder"
}

Write-Host "[ OK ] Windows graphical installer contract is safe and complete"
