param(
    [string] $ProjectRoot = "",
    [string] $ProofPath = "",
    [switch] $AllowPendingHardwareValidation
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

if ($ProofPath -eq "") {
    $ProofPath = Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
} elseif (-not [System.IO.Path]::IsPathRooted($ProofPath)) {
    $ProofPath = Join-Path $ProjectRoot $ProofPath
}

$resolvedProofPath = Resolve-Path -LiteralPath $ProofPath -ErrorAction SilentlyContinue
if ($resolvedProofPath) {
    $ProofPath = $resolvedProofPath.Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-PrintProofText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-PrintProofText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-PrintProofText $message)" -ForegroundColor Green
}

function Test-ProofValueIsIncomplete([AllowNull()][string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $true
    }

    return $value -match '(?i)^\s*(TODO|TBD|N/A|REPLACE|PENDING|PENDING_HARDWARE_VALIDATION|example|template|\[.*\])\s*$'
}

function Get-ProofFieldValue([string] $content, [string] $fieldLabel) {
    $escaped = [regex]::Escape($fieldLabel)
    $pattern = "(?im)^\s*-\s*$escaped\s*:[ \t]*(?<value>[^\r\n]*)$"
    $match = [regex]::Match($content, $pattern)

    if (-not $match.Success) {
        return $null
    }

    return $match.Groups["value"].Value.Trim()
}

function Test-ProofHasCompletedField([string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    if (Test-ProofValueIsIncomplete $value) {
        Add-Failure "Complete '${fieldLabel}:' in qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md."
    } else {
        Add-Pass "Completed field: $fieldLabel"
    }
}

function Test-ProofHasCheckedItem([string] $content, [string] $checkLabel) {
    $escaped = [regex]::Escape($checkLabel)
    if ($content -match "(?im)^\s*-\s*\[[xX]\]\s*.*$escaped.*$") {
        Add-Pass "Checked evidence item: $checkLabel"
    } else {
        Add-Failure "Complete a checked evidence item for '$checkLabel' in qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md."
    }
}

function Test-ProofReferencedEvidence([string] $content, [string] $fieldLabel) {
    $value = Get-ProofFieldValue $content $fieldLabel
    if (Test-ProofValueIsIncomplete $value) {
        Add-Failure "Complete '${fieldLabel}:' in qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md."
        return
    }

    if ([System.IO.Path]::IsPathRooted($value)) {
        Add-Failure "Institutional receipt print evidence must use a relative qa/ path or non-local physical/support reference, not an absolute local path."
        return
    }

    $looksLikeRepoPath = $value -match '^(qa|docs|scripts|frontend|backend)[\\/]'
    if ($looksLikeRepoPath) {
        if ($value -notmatch '^qa[\\/]' -or $value -match '(^|[\\/])\.\.([\\/]|$)') {
            Add-Failure "Institutional receipt print evidence must reference files under qa/ without traversal, or use a non-local physical/support reference."
            return
        }

        $candidate = Join-Path $ProjectRoot $value
        if (-not (Test-Path -LiteralPath $candidate)) {
            Add-Failure "Institutional receipt print evidence references missing local evidence '$value'."
            return
        }
    }

    Add-Pass "${fieldLabel}: reference is safe"
}

if ([string]::IsNullOrWhiteSpace($ProofPath) -or -not (Test-Path -LiteralPath $ProofPath -PathType Leaf)) {
    Add-Failure "Missing qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md. Run scripts\init_production_proofs.ps1, then fill it after physical printer validation."
} else {
    Add-Pass "Found qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
    $content = Get-Content -LiteralPath $ProofPath -Raw -Encoding UTF8

    if ($content -match '(?i)PENDING_HARDWARE_VALIDATION') {
        if ($AllowPendingHardwareValidation) {
            foreach ($pendingRequirement in @(
                @{ Pattern = '(?i)media carta'; Label = 'media carta' },
                @{ Pattern = '(?i)carta'; Label = 'carta' },
                @{ Pattern = '(?i)A5'; Label = 'A5' },
                @{ Pattern = '(?i)reimpresion|reprint'; Label = 'reprint/reimpresion' },
                @{ Pattern = '(?i)escala\s*100|100%|100 percent'; Label = '100 percent scale' },
                @{ Pattern = '(?i)margenes|minimos|headers/footers|encabezados'; Label = 'margins and headers/footers' },
                @{ Pattern = '(?i)evidencia.*(foto|muestra|referencia)|photo|signed'; Label = 'physical evidence reference' },
                @{ Pattern = '(?i)PRODUCTION_CANDIDATE'; Label = 'PRODUCTION_CANDIDATE' }
            )) {
                if ($content -match $pendingRequirement.Pattern) {
                    Add-Pass "Pending print proof keeps blocker: $($pendingRequirement.Label)"
                } else {
                    Add-Failure "Pending print proof must keep blocker text: $($pendingRequirement.Label)"
                }
            }
        } else {
            Add-Failure "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md is still PENDING_HARDWARE_VALIDATION."
        }
    }

    if ($content.Trim().Length -lt 300) {
        Add-Failure "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md is too short to contain physical printer evidence."
    }

    if (-not ($AllowPendingHardwareValidation -and $content -match '(?i)PENDING_HARDWARE_VALIDATION')) {
        foreach ($field in @(
            "Date/time",
            "Responsible person",
            "Printer brand/model",
            "Printer driver",
            "Connection type",
            "Browser/version",
            "Cashier computer",
            "Invoice used",
            "Media carta result",
            "Media carta evidence/reference",
            "Media carta observations",
            "Carta result",
            "Carta evidence/reference",
            "Carta observations",
            "A5 result",
            "A5 evidence/reference",
            "A5 observations",
            "Reprint result",
            "Margins result",
            "Browser headers/footers result",
            "Problems found",
            "Evidence/photo reference",
            "Final conclusion",
            "Photo path, printed-sample reference, or signed local note"
        )) {
            Test-ProofHasCompletedField $content $field
        }

        foreach ($check in @(
            "Media carta receipt prints at 100 percent scale",
            "Carta receipt prints at 100 percent scale",
            "A5 receipt prints at 100 percent scale",
            "Institutional receipt includes hospital name",
            "white background",
            "no QR, barcode, internal codes or technical fields",
            "Reprint from invoice history prints with historical snapshots",
            "Margins are minimal and no browser headers/footers appear"
        )) {
            Test-ProofHasCheckedItem $content $check
        }

        Test-ProofReferencedEvidence $content "Evidence/photo reference"
        Test-ProofReferencedEvidence $content "Photo path, printed-sample reference, or signed local note"
    }

    if (-not ($AllowPendingHardwareValidation -and $content -match '(?i)PENDING_HARDWARE_VALIDATION')) {
        foreach ($placeholder in @(
            @{ Pattern = '(?i)\bTODO\b'; Message = "Remove TODO placeholders" },
            @{ Pattern = '(?i)\bREPLACE\b'; Message = "Replace placeholder text" },
            @{ Pattern = '(?i)\bN/A\b'; Message = "Replace N/A with a real result or concrete value such as none found" },
            @{ Pattern = '(?i)\bTBD\b'; Message = "Replace TBD placeholders" },
            @{ Pattern = '(?i)example'; Message = "Remove example/template instructions" },
            @{ Pattern = '(?i)template'; Message = "Remove template instructions" },
            @{ Pattern = '\[ \]'; Message = "Check every required evidence item after testing it" },
            @{ Pattern = '(?i)\bPENDING_[A-Z_]+\b'; Message = "Replace PENDING_* placeholders" }
        )) {
            if ($content -match $placeholder.Pattern) {
                Add-Failure "$($placeholder.Message) in qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md."
            }
        }
    }

    foreach ($secretPattern in @(
        '(?i)APP_KEY\s*[:=]\s*[^\s`]+',
        '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+',
        '(?i)(TOKEN|SECRET|MAIL_PASSWORD|HOSPITAL_LICENSE_SALT)\s*[:=]\s*[^\s`]+',
        '(?i)[A-Z]:\\(?![\\])'
    )) {
        if ($content -match $secretPattern) {
            Add-Failure "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md must not expose secrets or local machine paths."
            break
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "INSTITUTIONAL_RECEIPT_PRINT_PROOF: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "INSTITUTIONAL_RECEIPT_PRINT_PROOF: YES" -ForegroundColor Green
