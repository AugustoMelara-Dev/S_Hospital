param(
    [string] $ProjectRoot = "",
    [string] $ProofPath = "",
    [switch] $AllowPendingFinalField
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

if ($ProofPath -eq "") {
    $ProofPath = Join-Path $ProjectRoot "qa\LAN_CLIENT_VALIDATION_PROOF.md"
} elseif (-not [System.IO.Path]::IsPathRooted($ProofPath)) {
    $ProofPath = Join-Path $ProjectRoot $ProofPath
}

$resolvedProofPath = Resolve-Path -LiteralPath $ProofPath -ErrorAction SilentlyContinue
if ($resolvedProofPath) {
    $ProofPath = $resolvedProofPath.Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-LanClientProofText([string] $value) {
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
    $protected = $protected -replace '(?i)[A-Z]:\\[^\s]+', "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-LanClientProofText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-LanClientProofText $message)" -ForegroundColor Green
}

function Test-ProofValueIsIncomplete([AllowNull()][string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $true
    }

    return $value -match '(?i)^\s*(TODO|TBD|N/A|REPLACE|PENDING|PENDING_LAN_CLIENT_VALIDATION|PENDING_FINAL_FIELD|example|template|\[.*\])\s*$'
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
        Add-Failure "Complete '${fieldLabel}:' in qa\LAN_CLIENT_VALIDATION_PROOF.md."
    } else {
        Add-Pass "Completed field: $fieldLabel"
    }
}

function Test-ProofHasCheckedItem([string] $content, [string] $checkLabel) {
    $escaped = [regex]::Escape($checkLabel)
    if ($content -match "(?im)^\s*-\s*\[[xX]\]\s*.*$escaped.*$") {
        Add-Pass "Checked evidence item: $checkLabel"
    } else {
        Add-Failure "Complete a checked evidence item for '$checkLabel' in qa\LAN_CLIENT_VALIDATION_PROOF.md."
    }
}

function Test-ProofReferencedEvidence([string] $content) {
    $value = Get-ProofFieldValue $content "Evidence/capture reference"
    if (Test-ProofValueIsIncomplete $value) {
        Add-Failure "Complete 'Evidence/capture reference:' in qa\LAN_CLIENT_VALIDATION_PROOF.md."
        return
    }

    if ([System.IO.Path]::IsPathRooted($value)) {
        Add-Failure "LAN client evidence must use a relative qa/ path or non-local physical/support reference, not an absolute local path."
        return
    }

    $looksLikeRepoPath = $value -match '^(qa|docs|scripts|frontend|backend)[\\/]'
    if ($looksLikeRepoPath) {
        if ($value -notmatch '^qa[\\/]' -or $value -match '(^|[\\/])\.\.([\\/]|$)') {
            Add-Failure "LAN client evidence must reference files under qa/ without traversal, or use a non-local physical/support reference."
            return
        }

        $candidate = Join-Path $ProjectRoot $value
        if (-not (Test-Path -LiteralPath $candidate)) {
            Add-Failure "LAN client evidence references missing local evidence '$value'."
            return
        }
    }

    Add-Pass "Evidence/capture reference is safe"
}

if ([string]::IsNullOrWhiteSpace($ProofPath) -or -not (Test-Path -LiteralPath $ProofPath -PathType Leaf)) {
    Add-Failure "Missing qa\LAN_CLIENT_VALIDATION_PROOF.md. Run scripts\validate_lan_client.ps1 from a real second LAN client, then complete the proof."
} else {
    Add-Pass "Found qa\LAN_CLIENT_VALIDATION_PROOF.md"
    $content = Get-Content -LiteralPath $ProofPath -Raw -Encoding UTF8

    if ($content -match '(?i)PENDING_LAN_CLIENT_VALIDATION|PENDING_FINAL_FIELD') {
        if ($AllowPendingFinalField) {
            foreach ($pendingRequirement in @(
                @{ Pattern = '(?i)segunda computadora|second computer|PC cliente'; Label = 'second client computer' },
                @{ Pattern = '(?i)IP fija|IP_DEL_SERVIDOR|server IP|LAN final'; Label = 'final LAN IP/name' },
                @{ Pattern = '(?i)login.*(419|sesion|session)|419.*login'; Label = 'login without 419/session expiry' },
                @{ Pattern = '(?i)caja.*factura.*pago|cashbox.*invoice.*payment'; Label = 'cashbox/invoice/payment workflow' },
                @{ Pattern = '(?i)recibo|receipt'; Label = 'receipt preview' },
                @{ Pattern = '(?i)historial|reprint|reimpresion'; Label = 'history/reprint' },
                @{ Pattern = '(?i)reportes|reports'; Label = 'reports' },
                @{ Pattern = '(?i)backup|respaldo'; Label = 'backup from UI' },
                @{ Pattern = '(?is)Pendiente.*Protegido|Protegido.*Pendiente'; Label = 'Pendiente a Protegido' },
                @{ Pattern = '(?i)PRODUCTION_CANDIDATE'; Label = 'PRODUCTION_CANDIDATE' }
            )) {
                if ($content -match $pendingRequirement.Pattern) {
                    Add-Pass "Pending LAN client proof keeps blocker: $($pendingRequirement.Label)"
                } else {
                    Add-Failure "Pending LAN client proof must keep blocker text: $($pendingRequirement.Label)"
                }
            }
        } else {
            Add-Failure "qa\LAN_CLIENT_VALIDATION_PROOF.md is still PENDING_LAN_CLIENT_VALIDATION."
        }
    }

    if ($content.Trim().Length -lt 300) {
        Add-Failure "qa\LAN_CLIENT_VALIDATION_PROOF.md is too short to contain second-client LAN evidence."
    }

    if (-not ($AllowPendingFinalField -and $content -match '(?i)PENDING_LAN_CLIENT_VALIDATION|PENDING_FINAL_FIELD')) {
        foreach ($field in @(
            "Date/time",
            "Responsible person",
            "Client computer name",
            "Server IP or LAN name",
            "Server LAN URL",
            "Client browser/version",
            "User/role used",
            "Evidence/capture reference",
            "Final conclusion"
        )) {
            Test-ProofHasCompletedField $content $field
        }

        foreach ($check in @(
            "/up",
            "/login",
            "/verify-email",
            "/assets/*.js",
            "Login completes without 419",
            "Cashbox opens",
            "Invoice is created with patient name",
            "Payment is registered",
            "Receipt preview opens",
            "Invoice history and reprint work",
            "Reports load",
            'Respaldo solicitado desde la UI cambia de Pendiente a Protegido'
        )) {
            Test-ProofHasCheckedItem $content $check
        }

        Test-ProofReferencedEvidence $content
    }

    if (-not ($AllowPendingFinalField -and $content -match '(?i)PENDING_LAN_CLIENT_VALIDATION|PENDING_FINAL_FIELD')) {
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
                Add-Failure "$($placeholder.Message) in qa\LAN_CLIENT_VALIDATION_PROOF.md."
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
            Add-Failure "qa\LAN_CLIENT_VALIDATION_PROOF.md must not expose secrets or local machine paths."
            break
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "LAN_CLIENT_PROOF: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "LAN_CLIENT_PROOF: YES" -ForegroundColor Green
