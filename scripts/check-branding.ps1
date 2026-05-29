param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$billingWord = 'bill' + 'ing'
$forbidden = @(
    ('Hospital ' + $billingWord + ' OS'),
    ($billingWord + ' OS'),
    ($billingWord + '-os'),
    ($billingWord + 'os')
)

$pattern = ($forbidden | ForEach-Object { [regex]::Escape($_) }) -join '|'

Push-Location $Root
try {
    $matches = rg -n -i $pattern . `
        --glob '!.git/**' `
        --glob '!node_modules/**' `
        --glob '!vendor/**' `
        --glob '!storage/logs/**' `
        --glob '!bootstrap/cache/**' `
        --glob '!dist/**' `
        --glob '!build/**'

    if ($LASTEXITCODE -eq 0) {
        Write-Host 'Branding prohibido encontrado:'
        $matches | ForEach-Object { Write-Host $_ }
        exit 1
    }

    if ($LASTEXITCODE -gt 1) {
        Write-Error 'No se pudo completar la revision de branding.'
        exit $LASTEXITCODE
    }

    Write-Host 'Revision de branding completada sin hallazgos.'
} finally {
    Pop-Location
}
