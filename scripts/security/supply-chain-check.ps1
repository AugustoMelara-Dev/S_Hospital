param(
    [string] $ProjectRoot = "",
    [switch] $IncludeCaches,
    [switch] $SkipTemp,
    [switch] $StrictPins
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
. (Join-Path $scriptRoot "SupplyChainPolicy.ps1")

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

$findings = New-Object System.Collections.Generic.List[object]
$warnings = New-Object System.Collections.Generic.List[object]

function Add-Finding([string] $Kind, [string] $Path, [string] $Message) {
    $findings.Add([pscustomobject]@{
        Kind = $Kind
        Path = $Path
        Message = $Message
    }) | Out-Null
}

function Add-Warning([string] $Kind, [string] $Path, [string] $Message) {
    $warnings.Add([pscustomobject]@{
        Kind = $Kind
        Path = $Path
        Message = $Message
    }) | Out-Null
}

function Read-JsonFile([string] $Path) {
    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    } catch {
        Add-Finding "json" $Path "Invalid JSON: $($_.Exception.Message)"
        return $null
    }
}

function Get-ObjectPropertyValue($Object, [string] $Name) {
    if ($null -eq $Object) {
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Test-DependencyMap($Map, [string] $ManifestPath, [string] $Section) {
    if ($null -eq $Map) {
        return
    }

    foreach ($property in $Map.PSObject.Properties) {
        $name = $property.Name
        $declared = [string] $property.Value
        $reason = Test-DeniedNpmVersion -Name $name -Version $declared
        if ($null -ne $reason) {
            Add-Finding "npm-manifest" $ManifestPath "$Section declares denied dependency '$name' version '$declared'. $reason"
        }

        if ($StrictPins -and $declared -match "^\s*(\^|~|\*|latest)") {
            Add-Warning "npm-manifest" $ManifestPath "$Section uses floating version '$name@$declared'. Prefer exact pins for production dependencies."
        }
    }
}

function Test-NpmManifest([string] $Path) {
    $manifest = Read-JsonFile $Path
    if ($null -eq $manifest) {
        return
    }

    Test-DependencyMap (Get-ObjectPropertyValue $manifest "dependencies") $Path "dependencies"
    Test-DependencyMap (Get-ObjectPropertyValue $manifest "devDependencies") $Path "devDependencies"
    Test-DependencyMap (Get-ObjectPropertyValue $manifest "optionalDependencies") $Path "optionalDependencies"

    $scripts = Get-ObjectPropertyValue $manifest "scripts"
    if ($null -ne $scripts) {
        foreach ($property in $scripts.PSObject.Properties) {
            if ($property.Name -match "^(preinstall|install|postinstall|prepare)$" -and [string] $property.Value -match $script:SuspiciousInstallScriptPattern) {
                Add-Finding "npm-script" $Path "Suspicious lifecycle script '$($property.Name)': $($property.Value)"
            }
        }
    }
}

function Get-NpmPackageNameFromLockPath([string] $LockPath) {
    if ($LockPath -notmatch "^node_modules/") {
        return $null
    }

    $withoutPrefix = $LockPath.Substring("node_modules/".Length)
    $parts = $withoutPrefix -split "/"
    if ($parts.Length -eq 0) {
        return $null
    }

    if ($parts[0].StartsWith("@") -and $parts.Length -ge 2) {
        return "$($parts[0])/$($parts[1])"
    }

    return $parts[0]
}

function Test-NpmLock([string] $Path) {
    $content = Get-Content -LiteralPath $Path -Raw

    foreach ($packageName in $script:DeniedNpmPackages.Keys) {
        $escaped = [regex]::Escape($packageName)
        if ($content -match '"node_modules/' + $escaped + '"') {
            $reason = $script:DeniedNpmPackages[$packageName].Reason
            Add-Finding "npm-lock" $Path "Denied package '$packageName' found in lockfile. $reason"
        }
    }

    foreach ($packageName in $script:DeniedNpmVersions.Keys) {
        $escapedName = [regex]::Escape($packageName)
        foreach ($version in $script:DeniedNpmVersions[$packageName].Versions) {
            $escapedVersion = [regex]::Escape($version)
            $packageBlockPattern = '"node_modules/' + $escapedName + '"\s*:\s*\{(?s:.*?)"version"\s*:\s*"' + $escapedVersion + '"'
            $dependencyPattern = '"' + $escapedName + '"\s*:\s*\{(?s:.*?)"version"\s*:\s*"' + $escapedVersion + '"'
            if ($content -match $packageBlockPattern -or $content -match $dependencyPattern) {
                $reason = $script:DeniedNpmVersions[$packageName].Reason
                Add-Finding "npm-lock" $Path "Denied package '$packageName@$version' found in lockfile. $reason"
            }
        }
    }

    $scriptPattern = '"(preinstall|install|postinstall|prepare)"\s*:\s*"([^"]*(' + $script:SuspiciousInstallScriptPattern + ')[^"]*)"'
    foreach ($match in [regex]::Matches($content, $scriptPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Add-Finding "npm-lock-script" $Path "Suspicious lifecycle script in lockfile: $($match.Groups[1].Value)=$($match.Groups[2].Value)"
    }
}

function Test-ComposerLock([string] $Path) {
    $content = Get-Content -LiteralPath $Path -Raw

    foreach ($packageName in $script:DeniedComposerPackages.Keys) {
        $escaped = [regex]::Escape($packageName)
        if ($content -match '"name"\s*:\s*"' + $escaped + '"') {
            Add-Finding "composer-lock" $Path "Denied Composer package '$packageName' found. $($script:DeniedComposerPackages[$packageName])"
        }
    }

    $packagePattern = '"name"\s*:\s*"(?<name>[^"]+)"(?s:.*?)(?=,\s*\{\s*"name"|\]\s*,\s*"packages-dev"|\]\s*\})'
    foreach ($match in [regex]::Matches($content, $packagePattern)) {
        $name = $match.Groups["name"].Value
        $block = $match.Value
        $filesMatch = [regex]::Match($block, '"files"\s*:\s*\[(?<files>[^\]]+)\]')
        if ($filesMatch.Success) {
            foreach ($fileMatch in [regex]::Matches($filesMatch.Groups["files"].Value, '"(?<file>[^"]+)"')) {
                $filePath = $fileMatch.Groups["file"].Value
                if ($filePath -eq "src/helpers.php" -and -not (Test-ComposerAutoloadFileAllowed -PackageName $name -FilePath $filePath)) {
                    Add-Warning "composer-autoload" $Path "Package '$name' autoloads file '$filePath'. Review before release."
                }
            }
        }
    }
}

function Test-TextIndicators([string[]] $Roots) {
    foreach ($root in $Roots) {
        if (-not (Test-Path -LiteralPath $root)) {
            continue
        }

        $files = Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Length -le 1048576 -and
                $_.FullName -notmatch "\\.git\\" -and
                $_.FullName -notmatch "\\frontend\\dist\\" -and
                $_.FullName -notmatch "\\backend\\storage\\logs\\" -and
                (
                    $_.Name -in @("package.json", "package-lock.json", "composer.json", "composer.lock", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock") -or
                    ($_.FullName -match "\\backend\\public\\" -and $_.Extension -in @(".php", ".js", ".json", ".vbs", ".ps1", ".cmd", ".bat"))
                )
            }

        foreach ($file in $files) {
            try {
                $matches = Select-String -LiteralPath $file.FullName -Pattern $script:DeniedTextIndicators -SimpleMatch -ErrorAction SilentlyContinue
                foreach ($match in $matches) {
                    Add-Finding "indicator" $file.FullName "Found denied indicator '$($match.Pattern)'."
                }
            } catch {
                Add-Warning "indicator-scan" $file.FullName "Skipped unreadable file: $($_.Exception.Message)"
            }
        }
    }
}

function Test-SuspiciousFiles([string[]] $Roots) {
    $patterns = @(
        "^\.laravel_locale$",
        "^DebugChromium\.exe$",
        "^[0-9a-f]{8}\.vbs$",
        "^[0-9a-f]{12}\.php$"
    )

    foreach ($root in $Roots) {
        if (-not (Test-Path -LiteralPath $root)) {
            continue
        }

        Get-ChildItem -LiteralPath $root -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
            foreach ($pattern in $patterns) {
                if ($_.Name -match $pattern) {
                    Add-Finding "file" $_.FullName "Suspicious filename matches '$pattern'."
                }
            }
        }
    }
}

Write-Host "Supply-chain guard: $ProjectRoot"

$npmManifests = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -Force -File -Filter "package.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\vendor\\" -and $_.FullName -notmatch "\\frontend\\dist\\" }
foreach ($manifest in $npmManifests) {
    Test-NpmManifest $manifest.FullName
}

$npmLocks = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -Force -File -Filter "package-lock.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\vendor\\" }
foreach ($lock in $npmLocks) {
    Test-NpmLock $lock.FullName
}

$composerLocks = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -Force -File -Filter "composer.lock" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch "\\vendor\\" }
foreach ($lock in $composerLocks) {
    Test-ComposerLock $lock.FullName
}

$scanRoots = @(
    (Join-Path $ProjectRoot "frontend\node_modules"),
    (Join-Path $ProjectRoot "backend\vendor"),
    (Join-Path $ProjectRoot "backend\public")
)
Test-TextIndicators $scanRoots
Test-SuspiciousFiles $scanRoots

if (-not $SkipTemp) {
    $tempRoots = @()
    if ($env:TEMP) {
        $tempRoots += $env:TEMP
    }
    if (Test-Path -LiteralPath "C:\tmp") {
        $tempRoots += "C:\tmp"
    }
    Test-SuspiciousFiles $tempRoots
}

if ($IncludeCaches) {
    $cacheRoots = @(
        (Join-Path $env:USERPROFILE "AppData\Local\npm-cache\_npx"),
        (Join-Path $env:USERPROFILE "AppData\Roaming\npm\node_modules")
    )
    Test-TextIndicators $cacheRoots
    Test-SuspiciousFiles $cacheRoots
}

foreach ($warning in $warnings) {
    Write-Host "[WARN] $($warning.Kind): $($warning.Path) - $($warning.Message)" -ForegroundColor Yellow
}

foreach ($finding in $findings) {
    Write-Host "[FAIL] $($finding.Kind): $($finding.Path) - $($finding.Message)" -ForegroundColor Red
}

if ($findings.Count -gt 0) {
    Write-Host "Supply-chain guard failed with $($findings.Count) finding(s) and $($warnings.Count) warning(s)." -ForegroundColor Red
    exit 1
}

Write-Host "Supply-chain guard passed with $($warnings.Count) warning(s)." -ForegroundColor Green
