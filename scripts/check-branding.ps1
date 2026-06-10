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
    'ticket de rollo'
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
    [CmdletBinding()]
    param(
        [string] $Label,
        [string[]] $Patterns,
        [string[]] $Paths,
        [string[]] $AllowedLinePatterns = @()
    )

    $pattern = ($Patterns | ForEach-Object { [regex]::Escape($_) }) -join '|'

    $localMatches = @()
    $useRg = $false
    if (Get-Command rg -ErrorAction SilentlyContinue) {
        try {
            $rgTestOutput = rg -n -i 'zzzzzz_no_match_zzzzzz' . --glob '!**/.git/**' --glob '!**/storage/**' 2>&1
            if ($LASTEXITCODE -le 1) {
                $useRg = $true
            }
        } catch {
            $useRg = $false
        }
    }
    if ($useRg -and ($pattern -notmatch '[|]')) {
        $rgArgs = @('-n', '-i', $pattern) + $Paths + @(
            '--glob', '!**/.git/**',
            '--glob', '!**/node_modules/**',
            '--glob', '!**/vendor/**',
            '--glob', '!**/storage/logs/**',
            '--glob', '!**/storage/app/private/backups/**',
            '--glob', '!**/storage/framework/**',
            '--glob', '!**/bootstrap/cache/**',
            '--glob', '!**/dist/**',
            '--glob', '!**/build/**',
            '--glob', '!**/offline-images/**',
            '--glob', '!**/offline-release/**',
            '--glob', '!**/install-logs/**',
            '--glob', '!**/.agent/skills/**',
            '--glob', '!**/.agents/skills/**',
            '--glob', '!**/backend/vendor/**',
            '--glob', '!**/backend/storage/**',
            '--glob', '!**/backend/build/**',
            '--glob', '!**/backend/tests/**',
            '--glob', '!**/frontend/dist/**',
            '--glob', '!**/frontend/node_modules/**'
        )
        $raw = rg @rgArgs 2>$null
        if ($LASTEXITCODE -le 1 -and $raw) {
            foreach ($line in @($raw)) {
                if ($line) { $localMatches += [string]$line }
            }
        }
    } else {
        # Fallback Select-String. En PowerShell 5.1 usar += con array es seguro.
        $resolved = @()
        foreach ($p in $Paths) {
            if (Test-Path $p) {
                $resolved += (Resolve-Path $p).Path
            } else {
                $resolved += $p
            }
        }
        foreach ($base in $resolved) {
            $files = @()
            if (Test-Path $base -PathType Leaf) {
                $files = @($base)
            } else {
                $files = Get-ChildItem -Path $base -Recurse -File -ErrorAction SilentlyContinue
            }
            foreach ($f in $files) {
                # Excluir paths por substring (no regex)
                $rel = $f.FullName -replace '/', '\'
                $excluded = $false
                foreach ($bad in @('\.git\', '\node_modules\', '\vendor\', '\storage\logs', '\storage\app\private\backups', '\storage\framework\', '\bootstrap\cache\', '\dist\', '\build\', '\offline-images\', '\offline-release\', '\install-logs\', '\.agent\skills\', '\.agents\skills\', '\backend\vendor\', '\backend\storage\', '\backend\build\', '\backend\tests\', '\frontend\dist\', '\frontend\node_modules\', '\qa\qa-secretscan.txt', '\qa\qa-branding.txt', '\qa\run_secretscan.ps1')) {
                    if ($rel -like "*$bad*") { $excluded = $true; break }
                }
                if ($excluded) { continue }

                $hits = Select-String -Path $f -Pattern $pattern -CaseSensitive:$false -SimpleMatch:$false -ErrorAction SilentlyContinue
                foreach ($h in $hits) {
                    $localMatches += [string]("{0}:{1}:{2}" -f $h.Path, $h.LineNumber, $h.Line)
                }
            }
        }
    }

    if ($localMatches.Count -gt 0) {
        if ($AllowedLinePatterns.Count -gt 0) {
            $filtered = @()
            foreach ($m in $localMatches) {
                $skip = $false
                foreach ($allow in $AllowedLinePatterns) {
                    if ([string]$m -match $allow) { $skip = $true; break }
                }
                if (-not $skip) { $filtered += [string]$m }
            }
            $localMatches = $filtered
        }

        if ($localMatches.Count -eq 0) {
            return
        }

        Write-Host $Label
        foreach ($m in $localMatches) { Write-Host ([string]$m) }
        exit 1
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
