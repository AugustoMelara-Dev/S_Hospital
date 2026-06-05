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

$legacyReceiptPaperForbidden = @(
    'ticket termico',
    'ticket de rollo',
    'recibo termico',
    'recibos termicos',
    'recibo térmico',
    'recibos térmicos',
    'impresora termica',
    'impresora térmica'
)

$visibleReceiptPaperForbidden = @(
    'ticket termico',
    'ticket de rollo',
    'recibo termico',
    'recibos termicos',
    'recibo térmico',
    'recibos térmicos',
    'impresora termica',
    'impresora térmica'
)

$deliveryReleaseForbidden = @(
    ($demoWord + '_READY'),
    ($demoWord + ' vendible'),
    ($demoWord + ' credentials'),
    ($demoWord + ' users'),
    ('seeders ' + $demoWord),
    ('usuarios ' + $demoWord),
    'producto vendible',
    'vendible',
    'ticket termico',
    'ticket de rollo'
)

$technicalProductBrandForbidden = @(
    'HOSPITAL OS'
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

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje heredado de ticket encontrado en superficies de entrega:' `
        -Patterns $legacyReceiptPaperForbidden `
        -Paths @(
            'frontend/src/features',
            'frontend/src/components',
            'frontend/src/layout',
            'frontend/src/lib/institutionalReceiptPaper.ts',
            'prompts',
            'docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md',
            'docs/LOCAL_VALIDATION_SCRIPT.md',
            'docs/OFFLINE_LAN_INSTALL.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/manuales',
            'qa/ACCEPTANCE_CRITERIA.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md',
            'qa/RELEASE_READINESS.md'
        ) `
        -AllowedLinePatterns @(
            'frontend/src/features\\invoices\\NewInvoiceView\.test\.tsx:\d+:\s*expect\(styles\)\.not\.toContain'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje heredado de recibo encontrado en superficies visibles instalables:' `
        -Patterns $visibleReceiptPaperForbidden `
        -Paths @(
            'frontend/index.html',
            'frontend/public/manifest.webmanifest'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje de entrega no institucional encontrado:' `
        -Patterns $deliveryReleaseForbidden `
        -Paths @(
            'docs/KNOWN_LIMITATIONS.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/manuales',
            'prompts',
            'qa/RELEASE_READINESS.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Marca tecnica visible encontrada en superficies de producto:' `
        -Patterns $technicalProductBrandForbidden `
        -Paths @(
            'backend/app',
            'frontend/src',
            'docs/KNOWN_LIMITATIONS.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/manuales',
            'prompts',
            'qa/RELEASE_READINESS.md'
        )

    Write-Host 'Revision de branding completada sin hallazgos.'
} finally {
    Pop-Location
}
