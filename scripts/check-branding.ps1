param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$billingWord = 'bill' + 'ing'
$sourceForbidden = @(
    ('Hospital ' + $billingWord + ' OS'),
    ($billingWord + ' OS'),
    ($billingWord + '-os'),
    ($billingWord + 'os'),
    'S_Hospital OS',
    'Caja hospitalaria',
    'Hospital Demo'
)

$docForbidden = @(
    ('Hospital ' + $billingWord + ' OS'),
    ($billingWord + ' OS'),
    ($billingWord + '-os'),
    ($billingWord + 'os'),
    'S_Hospital OS'
)

$sourcePattern = ($sourceForbidden | ForEach-Object { [regex]::Escape($_) }) -join '|'
$docPattern = ($docForbidden | ForEach-Object { [regex]::Escape($_) }) -join '|'

Push-Location $Root
try {
    $sourceMatches = rg -n -i $sourcePattern frontend/src `
        --glob '!**/*.test.*' `
        --glob '!**/test/**'

    $sourceExit = $LASTEXITCODE

    $docMatches = rg -n -i $docPattern docs/manuales README.md SYSTEM_REQUIREMENTS.md CHANGELOG.md `
        --glob '!docs/superpowers/plans/**' `
        --glob '!**/*.docx'

    $docExit = $LASTEXITCODE

    if ($sourceExit -eq 0 -or $docExit -eq 0) {
        Write-Host 'Branding prohibido encontrado en superficie visible:'
        $sourceMatches | ForEach-Object { Write-Host $_ }
        $docMatches | ForEach-Object { Write-Host $_ }
        exit 1
    }

    if ($sourceExit -gt 1 -or $docExit -gt 1) {
        Write-Error 'No se pudo completar la revision de branding.'
        exit 2
    }

    Write-Host 'Revision de branding completada sin hallazgos.'
} finally {
    Pop-Location
}
