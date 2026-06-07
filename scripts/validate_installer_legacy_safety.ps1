param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$releaseSetup = Read-RequiredFile "scripts\release_setup.bat"
$lanInstaller = Read-RequiredFile "scripts\deploy_hospital_lan.ps1"
$legacyInstaller = Read-RequiredFile "scripts\install_hospital_os.ps1"
$releaseBuilder = Read-RequiredFile "scripts\make_offline_release.ps1"
$releaseGuard = Read-RequiredFile "scripts\assert_offline_release_clean.ps1"
$installGuide = Read-RequiredFile "docs\manuales\GUIA_INSTALACION_OPERATIVA.md"
$offlineInstallGuide = Read-RequiredFile "docs\OFFLINE_LAN_INSTALL.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"
$operativeNotes = Read-RequiredFile "docs\OPERATIVE_NOTES_2026_06_02.md"

Assert-Contains "setup.bat launcher delegates to supported LAN installer" $releaseSetup "deploy_hospital_lan\.ps1"
Assert-NotContains "setup.bat launcher does not invoke legacy installer" $releaseSetup "install_hospital_os\.ps1"
Assert-Contains "setup.bat launcher runs from its own folder" $releaseSetup 'cd /d "%~dp0"'
Assert-Contains "setup.bat launcher disables PowerShell profiles" $releaseSetup "powershell\s+-NoProfile\s+-ExecutionPolicy\s+Bypass"
Assert-Contains "setup.bat launcher gives administrator recovery instructions" $releaseSetup "Ejecutar como administrador"
Assert-Contains "setup.bat launcher uses institutional wording" $releaseSetup "Sistema de Caja Hospitalaria"
Assert-NotContains "setup.bat launcher does not use legacy branding" $releaseSetup ('Billing' + '\s+' + 'OS')
Assert-NotContains "setup.bat launcher does not describe the install as demo" $releaseSetup "(?i)\bdemo\b|demostracion"
Assert-Contains "offline release builder uses release_setup.bat as root setup.bat" $releaseBuilder "release_setup\.bat[\s\S]*setup\.bat"
Assert-Contains "offline release guard requires supported LAN installer" $releaseGuard "scripts\\deploy_hospital_lan\.ps1"
Assert-Contains "offline release guard checks supported LAN installer source hash" $releaseGuard 'Test-ReleaseFileMatchesSource "scripts\\deploy_hospital_lan\.ps1"'
Assert-Contains "offline release guard checks root setup launcher source hash" $releaseGuard "setup\.bat matches scripts\\release_setup\.bat"
Assert-Contains "offline release guard checks setup launcher working directory" $releaseGuard 'cd /d "%~dp0"'
Assert-Contains "offline release guard checks setup launcher NoProfile" $releaseGuard "setup\.bat launches PowerShell with -NoProfile"
Assert-Contains "offline release guard rejects legacy setup launcher" $releaseGuard "setup\.bat must not invoke the deprecated installer"

Assert-Contains "supported installer uses institutional name" $lanInstaller "Sistema de Caja Hospitalaria"
Assert-Contains "supported installer has diagnostics-only mode" $lanInstaller "DiagnosticsOnly"
Assert-Contains "supported installer has self-test mode" $lanInstaller "SelfTest"
Assert-Contains "supported installer refuses missing backup task installer" $lanInstaller "No se encontro el instalador de tareas de backup"
Assert-Contains "supported installer runs safe migrations" $lanInstaller "migrate --force"
Assert-NotContains "supported installer does not run migrate:fresh" $lanInstaller "migrate:fresh"
Assert-Contains "supported installer creates explicit role/catalog seeders only" $lanInstaller "RolesAndPermissionsSeeder[\s\S]*ServiceCatalogSeeder"
Assert-Contains "supported installer explains production data preparation in operator wording" $lanInstaller "Preparando base institucional, roles y catalogo"
Assert-NotContains "supported installer does not expose seeders as normal installer wording" $lanInstaller "Ejecutando migraciones y seeders"

Assert-Contains "legacy installer is marked deprecated at top of file" $legacyInstaller "DEPRECATED in v1\.0\.0"
Assert-Contains "legacy installer points operators to supported installer" $legacyInstaller "deploy_hospital_lan\.ps1"
Assert-Contains "legacy installer explains backwards compatibility only" $legacyInstaller "backwards compatibility"
Assert-Contains "legacy installer warns at runtime" $legacyInstaller "DEPRECATION NOTICE"
Assert-Contains "legacy installer says no new code paths should reference it" $legacyInstaller "no new[\s\S]*code paths reference it"

Assert-Contains "operator install guide uses setup.bat for normal install" $installGuide 'Ejecute `setup\.bat`'
Assert-Contains "operator install guide identifies supported LAN installer" $installGuide "deploy_hospital_lan\.ps1"
Assert-Contains "operator install guide limits legacy installer to compatibility" $installGuide "install_hospital_os\.ps1[\s\S]*compatibilidad"
Assert-Contains "operator install guide forbids clean destructive install" $installGuide "instalacion limpia"
Assert-Contains "operator install guide forbids demo seeders" $installGuide "sin correr seeders de demostracion"
Assert-Contains "offline install guide prefers supported installer" $offlineInstallGuide 'Preferir `scripts\\deploy_hospital_lan\.ps1`'
Assert-Contains "operative notes record legacy installer deprecation" $operativeNotes "install_hospital_os\.ps1"
Assert-Contains "release checklist mentions installer legacy guard" $releaseChecklist "validate_installer_legacy_safety\.ps1"

$unexpectedReferences = New-Object System.Collections.Generic.List[string]
$scanRoots = @("docs", "scripts")
foreach ($root in $scanRoots) {
    $rootPath = Join-Path $ProjectRoot $root
    if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
        continue
    }

    $files = Get-ChildItem -LiteralPath $rootPath -Recurse -File | Where-Object {
        $_.FullName -notmatch '\\docs\\KNOWN_LIMITATIONS\.md$' -and
        $_.FullName -notmatch '\\docs\\OPERATIVE_NOTES_2026_06_02\.md$' -and
        $_.FullName -notmatch '\\docs\\superpowers\\' -and
        $_.FullName -notmatch '\\scripts\\install_hospital_os\.ps1$' -and
        $_.FullName -notmatch '\\scripts\\validate_installer_legacy_safety\.ps1$'
    }

    foreach ($file in $files) {
        $content = Get-Content -LiteralPath $file.FullName -Raw
        if ($content -match "install_hospital_os\.ps1") {
            $safeDeprecationReference = $content -match "No use accesos directos antiguos" -and
                $content -match "compatibilidad" -and
                $content -match "deploy_hospital_lan\.ps1"
            $safeChecklistReference = $content -match "validate_installer_legacy_safety\.ps1" -and
                $content -match "compatibilidad deprecada" -and
                $content -match "deploy_hospital_lan\.ps1"

            if (-not ($safeDeprecationReference -or $safeChecklistReference)) {
                $rootPrefix = $ProjectRoot.TrimEnd("\") + "\"
                $relative = if ($file.FullName.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                    $file.FullName.Substring($rootPrefix.Length)
                } else {
                    $file.FullName
                }
                $unexpectedReferences.Add($relative) | Out-Null
            }
        }
    }
}

if ($unexpectedReferences.Count -eq 0) {
    Add-Pass "Active docs/scripts do not point operators to legacy installer"
} else {
    Add-Failure "Unexpected legacy installer references: $($unexpectedReferences -join ', ')"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "INSTALLER_LEGACY_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "INSTALLER_LEGACY_SAFETY: YES" -ForegroundColor Green
