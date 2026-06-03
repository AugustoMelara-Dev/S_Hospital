Set-StrictMode -Version Latest

$script:DeniedNpmPackages = @{
    "plain-crypto-js" = @{
        Versions = @("*")
        Reason = "Known npm supply-chain IOC used by compromised axios packages."
    }
    "systemd-network-helper" = @{
        Versions = @("*")
        Reason = "Known package.json/Packagist supply-chain IOC."
    }
    "echarts-for-react" = @{
        Versions = @("*")
        Reason = "Known package.json/Packagist supply-chain IOC."
    }
}

$script:DeniedNpmVersions = @{
    "axios" = @{
        Versions = @("1.14.1", "0.30.4")
        Reason = "Known compromised axios versions from the 2026 npm supply-chain incident."
    }
}

$script:DeniedComposerPackages = @{
    "laravel-lang/lang" = "Known compromised Laravel-Lang package family from the 2026 Composer supply-chain incident."
    "laravel-lang/actions" = "Known compromised Laravel-Lang package family from the 2026 Composer supply-chain incident."
    "laravel-lang/attributes" = "Known compromised Laravel-Lang package family from the 2026 Composer supply-chain incident."
    "laravel-lang/http-statuses" = "Known compromised Laravel-Lang package family from the 2026 Composer supply-chain incident."
    "silverstripe-cms-theme" = "Known package.json/Packagist supply-chain IOC."
    "crosierlib-base" = "Known package.json/Packagist supply-chain IOC."
    "devdojo/wave" = "Known package.json/Packagist supply-chain IOC."
    "devdojo/genesis" = "Known package.json/Packagist supply-chain IOC."
    "katanaui/katana" = "Known package.json/Packagist supply-chain IOC."
    "elitedevsquad/sidecar-laravel" = "Known package.json/Packagist supply-chain IOC."
    "r2luna/brain" = "Known package.json/Packagist supply-chain IOC."
    "baskarcm/tzi-chat-ui" = "Known package.json/Packagist supply-chain IOC."
}

$script:AllowedComposerAutoloadFiles = @(
    "laravel/prompts:src/helpers.php",
    "spatie/laravel-permission:src/helpers.php"
)

$script:DeniedTextIndicators = @(
    "flipboxstudio.info",
    "LARAVEL_LANG_HELPERS",
    ".laravel_locale",
    "DebugChromium.exe",
    "plain-crypto-js",
    "systemd-network-helper",
    "parikhpreyash4",
    "bun run index.js",
    "/tmp/.sshd",
    "gvfsd-network",
    "169.254.169.254/latest/meta-data"
)

$script:SuspiciousInstallScriptPattern = "(curl|wget|Invoke-WebRequest|iwr|irm|powershell|pwsh|bash|sh\s+-c|bitsadmin|certutil|Start-Process|\.vbs|DebugChromium|flipboxstudio|169\.254\.169\.254|/tmp/\.sshd|bun\s+run\s+index\.js)"

function Test-DeniedNpmVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Name,
        [string] $Version
    )

    if ($script:DeniedNpmPackages.ContainsKey($Name)) {
        $rules = $script:DeniedNpmPackages[$Name]
        if ($rules.Versions -contains "*" -or $rules.Versions -contains $Version) {
            return $rules.Reason
        }
    }

    if ($script:DeniedNpmVersions.ContainsKey($Name)) {
        $rules = $script:DeniedNpmVersions[$Name]
        if ($rules.Versions -contains $Version) {
            return $rules.Reason
        }
    }

    return $null
}

function Test-ComposerAutoloadFileAllowed {
    param(
        [Parameter(Mandatory = $true)]
        [string] $PackageName,
        [Parameter(Mandatory = $true)]
        [string] $FilePath
    )

    $key = "$($PackageName):$($FilePath)"
    return $script:AllowedComposerAutoloadFiles -contains $key
}
