param(
    [string] $ProjectRoot = "",
    [string] $HandoffPath = "qa\FINAL_PRODUCTION_HANDOFF_RESULT.md"
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

function Write-Fail([string] $message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

function Protect-EvidenceText([string] $value) {
    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    $protected = $protected -replace "(?i)/(var|home|srv|opt|tmp|usr|mnt)/[^\s`"']+", "[ruta-local]"

    return $protected
}

trap {
    Write-Host (Protect-EvidenceText $_.Exception.Message) -ForegroundColor Red
    Write-Host "No se valido el indice de evidencia. Revise rutas dentro de qa/ y no agregue secretos al handoff." -ForegroundColor Yellow
    exit 1
}

$handoffCandidate = if ([System.IO.Path]::IsPathRooted($HandoffPath)) {
    $HandoffPath
} else {
    Join-Path $ProjectRoot $HandoffPath
}
$handoffFullPath = [System.IO.Path]::GetFullPath($handoffCandidate)
$rootPrefix = $ProjectRoot.TrimEnd("\") + "\"

if (-not $handoffFullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Fail "El handoff debe estar dentro de la carpeta instalada del sistema."
}

if (-not (Test-Path -LiteralPath $handoffFullPath -PathType Leaf)) {
    Write-Fail "No se encontro el handoff final: $(Protect-EvidenceText $handoffFullPath)"
}

$content = Get-Content -LiteralPath $handoffFullPath -Raw

$forbiddenPatterns = @(
    @{ Pattern = ('(?i)' + 'Billing' + '\s+' + 'OS'); Message = 'Branding heredado encontrado en el handoff.' },
    @{ Pattern = '(?i)APP_KEY\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener APP_KEY.' },
    @{ Pattern = '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener DB_PASSWORD.' },
    @{ Pattern = '(?i)(TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^\s`]+'; Message = 'El handoff parece contener secretos.' },
    @{ Pattern = '(?i)[A-Z]:\\(?![\\])'; Message = 'El handoff contiene una ruta absoluta de Windows.' },
    @{ Pattern = '(?i)/(var|home|srv|opt|tmp|usr|mnt)/'; Message = 'El handoff contiene una ruta absoluta local.' }
)

foreach ($item in $forbiddenPatterns) {
    if ($content -match $item.Pattern) {
        Write-Fail $item.Message
    }
}

if ($content -match '(?m)^\s*-\s*Decision:\s*`?PRODUCTION_READY`?\s*$') {
    $requiredPhysicalProofs = @(
        "qa\LAN_CLIENT_VALIDATION_PROOF.md",
        "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md",
        "qa\FINAL_RESTORE_PROOF.md",
        "qa\FINAL_CONCURRENCY_PROOF.md",
        "qa\TRAINING_ACCEPTANCE_PROOF.md"
    )

    foreach ($proof in $requiredPhysicalProofs) {
        $proofPath = Join-Path $ProjectRoot $proof
        if (-not (Test-Path -LiteralPath $proofPath -PathType Leaf)) {
            Write-Fail "El handoff declara PRODUCTION_READY pero falta $proof."
        }

        $proofContent = Get-Content -LiteralPath $proofPath -Raw
        if ($proofContent -match '(?i)\b(TODO|PENDING|PENDING_[A-Z_]+|REPLACE|TBD)\b|\[ \]') {
            Write-Fail "El handoff declara PRODUCTION_READY pero $proof aun tiene marcadores incompletos."
        }
    }
}

if ($content -notmatch '(?i)LAN_CLIENT_VALIDATION_PROOF\.md' -or
    $content -notmatch '(?i)INSTITUTIONAL_RECEIPT_PRINT_PROOF\.md' -or
    $content -notmatch '(?i)TRAINING_ACCEPTANCE_PROOF\.md' -or
    $content -notmatch '(?i)production_readiness_preflight\.ps1') {
    Write-Fail "El handoff debe listar la prueba LAN, la prueba de impresora, la capacitacion supervisada y el preflight final como bloqueantes."
}

$references = New-Object System.Collections.Generic.HashSet[string]
$referenceMatches = [regex]::Matches($content, '`(?<path>qa[\\/][^`]+)`')
foreach ($match in $referenceMatches) {
    $reference = $match.Groups["path"].Value.Trim()
    if ($reference -match '(^|[\\/])\.\.([\\/]|$)') {
        Write-Fail "Referencia con traversal no permitida: $reference"
    }
    if ([System.IO.Path]::IsPathRooted($reference)) {
        Write-Fail "Referencia absoluta no permitida: $(Protect-EvidenceText $reference)"
    }

    $null = $references.Add($reference)
}

if ($references.Count -eq 0) {
    Write-Fail "No se encontraron referencias qa/ en el handoff."
}

foreach ($reference in $references) {
    $candidate = Join-Path $ProjectRoot $reference
    $fullPath = [System.IO.Path]::GetFullPath($candidate)
    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Fail "Referencia fuera del sistema instalado: $(Protect-EvidenceText $reference)"
    }
    if (-not (Test-Path -LiteralPath $fullPath)) {
        Write-Fail "Referencia de evidencia faltante: $reference"
    }
}

Write-Host "[OK] OPS_EVIDENCE_INDEX: YES" -ForegroundColor Green
Write-Host "[OK] Referencias qa/ verificadas: $($references.Count)" -ForegroundColor Green
Write-Host "[OK] El handoff conserva bloqueantes fisicos antes de PRODUCTION_READY." -ForegroundColor Green
