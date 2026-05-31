param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$billingWord = 'bill' + 'ing'
$demoWord = 'de' + 'mo'
$forbidden = @(
    ('Hospital ' + $billingWord + ' OS'),
    ($billingWord + ' OS'),
    ($billingWord + '-os'),
    ($billingWord + 'os')
)

$scopedForbidden = @(
    ('Hospital ' + $demoWord),
    ('Admin ' + $demoWord),
    ('Administrador ' + $demoWord),
    ('Supervisor ' + $demoWord),
    ('Cajero ' + $demoWord),
    ('admin.' + $demoWord),
    ('supervisor.' + $demoWord),
    ('cajero.' + $demoWord),
    ('hospital-' + $billingWord + '.local'),
    (($demoWord).ToUpperInvariant() + '-CAI'),
    ('Development' + $demoWord.Substring(0, 1).ToUpperInvariant() + $demoWord.Substring(1) + 'Seeder')
)

function Invoke-ForbiddenSearch {
    param(
        [string] $Label,
        [string[]] $Patterns,
        [string[]] $Paths,
        [string[]] $AllowedLinePatterns = @()
    )

    $pattern = ($Patterns | ForEach-Object { [regex]::Escape($_) }) -join '|'
    $matches = rg -n -i $pattern @Paths `
        --glob '!.git/**' `
        --glob '!node_modules/**' `
        --glob '!vendor/**' `
        --glob '!storage/logs/**' `
        --glob '!bootstrap/cache/**' `
        --glob '!dist/**' `
        --glob '!build/**'

    if ($LASTEXITCODE -eq 0) {
        if ($AllowedLinePatterns.Count -gt 0) {
            $matches = $matches | Where-Object {
                $line = $_
                -not ($AllowedLinePatterns | Where-Object { $line -match $_ })
            }
        }

        if (-not $matches -or $matches.Count -eq 0) {
            return
        }

        Write-Host $Label
        $matches | ForEach-Object { Write-Host $_ }
        exit 1
    }

    if ($LASTEXITCODE -gt 1) {
        Write-Error 'No se pudo completar la revision de branding.'
        exit $LASTEXITCODE
    }
}

Push-Location $Root
try {
    Invoke-ForbiddenSearch `
        -Label 'Branding prohibido encontrado:' `
        -Patterns $forbidden `
        -Paths @('.') `
        -AllowedLinePatterns @(
            ('"' + $billingWord + 'Os"\s*:\s*false')
        )

    Invoke-ForbiddenSearch `
        -Label 'Datos de demostracion visibles encontrados en superficies de entrega:' `
        -Patterns $scopedForbidden `
        -Paths @(
            'backend/database',
            'backend/tests',
            'frontend/src',
            'frontend/e2e',
            'docs/KNOWN_LIMITATIONS.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/manuales',
            'qa'
        ) `
        -AllowedLinePatterns @(
            'qa\\visual-smoke\\field-qa-current-screenshots\.mjs:\d+:\s*\[''hospitalDemo'',\s*/Hospital Demo/i\]',
            'qa\\visual-smoke\\field-qa-current-screenshots\.mjs:\d+:\s*\[''demoCai'',\s*/DEMO-CAI/i\]'
        )

    Write-Host 'Revision de branding completada sin hallazgos.'
} finally {
    Pop-Location
}
