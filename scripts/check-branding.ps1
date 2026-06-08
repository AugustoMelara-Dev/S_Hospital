param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$billingWord = 'bill' + 'ing'
$demoWord = 'de' + 'mo'
$mojibakeLead = [string][char]0x00C3
$mojibakeMarker = @(
    $mojibakeLead,
    [string][char]0x00C2,
    [string][char]0x00E2,
    [string][char]0xFFFD
)
$mojibakeAcuteE = $mojibakeLead + [string][char]0x00A9
$mojibakeAcuteO = $mojibakeLead + [string][char]0x00B3
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
    'VALIDACION-CAI',
    ('Development' + $demoWord.Substring(0, 1).ToUpperInvariant() + $demoWord.Substring(1) + 'Seeder')
)

$legacyReceiptPaperForbidden = @(
    'ticket termico',
    'ticket de rollo',
    'recibo termico',
    'recibos termicos',
    'recibo térmico',
    'recibos térmicos',
    'impresion termica',
    'impresión térmica',
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
    'impresion termica',
    'impresión térmica',
    'impresora termica',
    'impresora térmica'
)

$deliveryReleaseForbidden = @(
    ($demoWord + '_READY'),
    ($demoWord + ' vendible'),
    ($demoWord + ' premium'),
    ($demoWord + ' tecnica'),
    ($demoWord + ' t' + $mojibakeAcuteE + 'cnica'),
    ($demoWord + ' credentials'),
    ($demoWord + ' users'),
    ('credenciales ' + $demoWord),
    ('seeders ' + $demoWord),
    ('datos ' + $demoWord),
    ('usuarios ' + $demoWord),
    ('parece ' + $demoWord),
    ('para ' + $demoWord),
    ('guion de ' + $demoWord),
    ('gui' + $mojibakeAcuteO + 'n de ' + $demoWord),
    'producto vendible',
    'producto demostrable',
    'vendible',
    'ticket termico',
    'ticket de rollo'
)

$currentDeliveryReceiptPaperForbidden = @(
    'thermal printer',
    'roll printer',
    'roll-paper printer',
    'impresion termica',
    'impresión térmica',
    'impresora termica',
    'impresora térmica',
    'impresora de rollo',
    '80mm',
    '58mm'
)

$technicalProductBrandForbidden = @(
    'HOSPITAL OS'
)

$commercialProductSurfaceForbidden = @(
    'Premium'
)

$receiptPreviewAutomationForbidden = @(
    'Vista previa del recibo',
    'vista previa del recibo',
    'receipt preview',
    'receipt previews',
    'receipt-preview'
)

$serviceIdentifierAutomationForbidden = @(
    'scanner support',
    'scanner/busqueda',
    'scanner/búsqueda'
)

$controlledEvidenceForbidden = @(
    'rc-e2e-mocked-report.json',
    'mode: mocked-e2e',
    '"mode": "mocked-e2e"',
    'mocked browser evidence',
    'mocked E2E screenshots',
    'evidencia mockeada',
    'API mockeada'
)

$forbiddenPathNamePatterns = @(
    ('Bill' + 'ing_OS'),
    ('Hospital_Bill' + 'ing_OS'),
    ('Bill' + 'ing OS'),
    'THERMAL_PRINTER_PROOF',
    'receipt-preview-80mm',
    'receipt-preview-58mm',
    'thermal-printer',
    'thermal_printer',
    'impresora-termica',
    'impresora_termica',
    'recibo-termico',
    'recibo_termico'
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

function Invoke-ForbiddenPathSearch {
    param(
        [string] $Label,
        [string[]] $Patterns
    )

    $pattern = ($Patterns | ForEach-Object { [regex]::Escape($_) }) -join '|'
    $matches = & git ls-files | Where-Object { $_ -match $pattern }
    if ($matches -and $matches.Count -gt 0) {
        Write-Host $Label
        $matches | ForEach-Object { Write-Host $_ }
        exit 1
    }
}

Push-Location $Root
try {
    Invoke-ForbiddenPathSearch `
        -Label 'Nombres de archivo heredados encontrados:' `
        -Patterns $forbiddenPathNamePatterns

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
            'devex/windows-server-install.md',
            'frontend/src',
            'frontend/e2e',
            'docs/KNOWN_LIMITATIONS.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/manuales',
            'PROMPT_URGENTE_PARA_CODEX.md',
            'worklogs',
            'workflows',
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
            'SYSTEM_REQUIREMENTS.md',
            'prompts',
            'codex-skills',
            'subagents',
            'UI',
            'references/hospital_billing_domain.md',
            'references/offline_lan_deployment.md',
            'references/institutional_receipt_printing.md',
            'docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md',
            'docs/LOCAL_VALIDATION_SCRIPT.md',
            'docs/OFFLINE_LAN_INSTALL.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/manuales',
            'PROMPT_URGENTE_PARA_CODEX.md',
            'worklogs',
            'workflows',
            'qa/ACCEPTANCE_CRITERIA.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md',
            'qa/UX_UI_AUDIT_LIVE_2026-05-21.md',
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
            'docs/00_EXECUTIVE_RESET.md',
            'docs/01_FINAL_PRODUCT_REQUIREMENTS.md',
            'docs/02_UI_ARCHITECTURE.md',
            'docs/07_FINAL_PHASES_ROADMAP.md',
            'docs/09_FINAL_EXECUTION_PACK_INDEX.md',
            'docs/12_CORRECTED_FINAL_PRODUCT_PLAN.md',
            'docs/API_CONTRACTS.md',
            'docs/PERMISSIONS_MATRIX.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/superpowers/plans',
            'docs/manuales',
            'codex-skills',
            'devex/windows-server-install.md',
            'PROMPT_URGENTE_PARA_CODEX.md',
            'prompts',
            'worklogs',
            'workflows',
            'frontend/src/lib/api/types.ts',
            'qa/AREAS_DE_MEJORA_CONSIDERADAS_2026-05-19.md',
            'qa/FIELD_DEPLOYMENT_VALIDATION.md',
            'qa/PRODUCTION_READINESS_AUDIT_2026-05-18.md',
            'qa/PRODUCTION_READINESS_GAP_REPORT.md',
            'qa/UX_UI_AUDIT_LIVE_2026-05-21.md',
            'qa/RELEASE_READINESS.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje de impresora de rollo encontrado en documentacion actual:' `
        -Patterns $currentDeliveryReceiptPaperForbidden `
        -Paths @(
            'docs/08_CRITICAL_ACCEPTANCE_CRITERIA.md',
            'docs/00_README.md',
            'SYSTEM_REQUIREMENTS.md',
            'docs/12_CORRECTED_FINAL_PRODUCT_PLAN.md',
            'docs/AUDIT_2026_06_02.md',
            'docs/INSTITUTIONAL_RECEIPT_PRINT_VALIDATION.md',
            'docs/LOCAL_VALIDATION_SCRIPT.md',
            'docs/OPERATIVE_NOTES_2026_06_02.md',
            'docs/OPERATIVE_VALIDATION_FLOW.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
            'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md',
            'docs/TROUBLESHOOTING.md',
            'docs/ARCHITECTURE_CURRENT.md',
            'docs/superpowers/plans',
            'CHANGELOG.md',
            'package_manifest.json',
            'devex/windows-server-install.md',
            'PROMPT_URGENTE_PARA_CODEX.md',
            'codex-skills',
            'subagents',
            'UI',
            'worklogs',
            'workflows',
            'references/hospital_billing_domain.md',
            'references/offline_lan_deployment.md',
            'references/institutional_receipt_printing.md',
            'frontend/e2e/production-readiness.spec.ts',
            'qa/AREAS_DE_MEJORA_CONSIDERADAS_2026-05-19.md',
            'qa/FIELD_DEPLOYMENT_VALIDATION.md',
            'qa/final-product-ux-acceptance.md',
            'qa/FINAL_FIELD_BLOCKERS_SAFETY_2026_06_04.md',
            'qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md',
            'qa/PRODUCTION_READINESS_AUDIT_2026-05-18.md',
            'qa/PRODUCTION_READINESS_GAP_REPORT.md',
            'qa/PROJECT_POLISH_FINAL_REPORT.md',
            'qa/PRODUCTION_PRIORITY_HIGH_EXECUTION_2026-05-19.md',
            'qa/ROLE_MODULE_AUDIT_2026-05-19.md',
            'qa/UX_2_CASH_RECEIPT_AUDIT_2026-05-18.md',
            'qa/UX_OPERATIVA_AUDIT_2026-05-18.md',
            'qa/ACCESSIBILITY_UX_AUDIT.md'
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
            'scripts/deploy_hospital_lan.ps1',
            'backend/tests/PowerShell',
            'prompts',
            'qa/RELEASE_READINESS.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje comercial encontrado en superficies de producto:' `
        -Patterns $commercialProductSurfaceForbidden `
        -Paths @(
            'frontend/src',
            'backend/app',
            'docs/superpowers/plans'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje obsoleto de recibo encontrado en automatizacion/evidencia activa:' `
        -Patterns $receiptPreviewAutomationForbidden `
        -Paths @(
            'frontend/e2e',
            'qa/visual-smoke',
            'qa/browser-smoke-2026-06-07',
            'qa/browser-smoke-2026-06-08',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_07.md',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_08.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje obsoleto de identificador de servicio encontrado en evidencia activa:' `
        -Patterns $serviceIdentifierAutomationForbidden `
        -Paths @(
            'qa/visual-smoke',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_07.md',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_08.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Lenguaje obsoleto de evidencia controlada encontrado en evidencia activa:' `
        -Patterns $controlledEvidenceForbidden `
        -Paths @(
            'qa/browser-smoke-2026-06-08',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_08.md',
            'qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md',
            'qa/FINAL_PRODUCTION_HANDOFF_RESULT.md'
        )

    Invoke-ForbiddenSearch `
        -Label 'Texto corrupto por codificacion encontrado en superficies activas:' `
        -Patterns $mojibakeMarker `
        -Paths @(
            'backend/app',
            'backend/routes',
            'backend/tests',
            'frontend/src',
            'frontend/e2e',
            'docs/KNOWN_LIMITATIONS.md',
            'docs/RELEASE_CHECKLIST.md',
            'docs/TRAINING_ADMIN.md',
            'docs/TRAINING_CAJERO.md',
            'docs/manuales',
            'qa/browser-smoke-2026-06-08',
            'qa/BROWSER_SMOKE_EVIDENCE_2026_06_08.md',
            'qa/OPERATIONS_OBJECTIVE_AUDIT_2026_06_03.md',
            'qa/FINAL_PRODUCTION_HANDOFF_RESULT.md',
            'scripts'
        )

    Write-Host 'Revision de branding completada sin hallazgos.'
} finally {
    Pop-Location
}
