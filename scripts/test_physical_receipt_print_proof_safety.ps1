param(
    [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path -LiteralPath $Root).Path
$scriptPath = Join-Path $Root 'scripts\register_physical_receipt_print_proof.ps1'
$preflightPath = Join-Path $Root 'scripts\production_readiness_preflight.ps1'

function Get-PowerShellHostCommand {
    if (Get-Command pwsh -ErrorAction SilentlyContinue) {
        return (Get-Command pwsh).Source
    }

    if (Get-Command powershell.exe -ErrorAction SilentlyContinue) {
        return (Get-Command powershell.exe).Source
    }

    if (Get-Command powershell -ErrorAction SilentlyContinue) {
        return (Get-Command powershell).Source
    }

    throw 'No PowerShell host found for physical print proof tests.'
}

function Assert-Contains([string] $Content, [string] $Needle, [string] $Message) {
    if (-not $Content.Contains($Needle)) {
        throw $Message
    }
}

function Assert-NotMatch([string] $Content, [string] $Pattern, [string] $Message) {
    if ($Content -match $Pattern) {
        throw $Message
    }
}

function Assert-CommandFails([string[]] $CommandArgs, [string] $ExpectedText) {
    $powerShellHost = Get-PowerShellHostCommand
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & $powerShellHost @CommandArgs 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $joined = $output -join "`n"

    if ($exitCode -eq 0) {
        throw "Expected command to fail, but it passed. Output: $joined"
    }

    if (-not $joined.Contains($ExpectedText)) {
        throw "Expected failing command output to contain '$ExpectedText'. Output: $joined"
    }
}

if (-not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw "Missing script: $scriptPath"
}

if (-not (Test-Path -LiteralPath $preflightPath -PathType Leaf)) {
    throw "Missing preflight: $preflightPath"
}

$scriptContent = Get-Content -LiteralPath $scriptPath -Raw
$preflightContent = Get-Content -LiteralPath $preflightPath -Raw

Assert-Contains $scriptContent 'Esta acta es solo para impresora fisica real' 'Generator must reject virtual printer evidence.'
Assert-Contains $scriptContent 'ValidateSet("media carta", "carta", "A5")' 'Generator must limit primary paper to institutional formats.'
Assert-Contains $scriptContent 'Photo path, printed-sample reference, or signed local note' 'Generator must leave traceable physical evidence.'
Assert-Contains $preflightContent 'Test-InstitutionalPrinterProofFile' 'Preflight must use the dedicated physical printer proof validator.'
Assert-Contains $preflightContent 'at least one checked physical institutional paper item' 'Preflight must require at least one real institutional paper proof.'
Assert-Contains $preflightContent 'photo, signed note, printed sample, or real printer' 'Preflight must require physical evidence language.'

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('s-hospital-print-proof-test-' + [Guid]::NewGuid().ToString('N'))
$proofPath = Join-Path $tempRoot 'qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md'

try {
    New-Item -ItemType Directory -Path (Join-Path $tempRoot 'qa\evidence\printer-final') -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $tempRoot 'qa\evidence\printer-final\foto-media-carta.jpg') -Value 'synthetic physical photo placeholder for safety test' -Encoding ASCII

    $powerShellHost = Get-PowerShellHostCommand
    & $powerShellHost -NoProfile -ExecutionPolicy Bypass -File $scriptPath `
        -ProjectRoot $tempRoot `
        -EvidencePath qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md `
        -PrimaryPaperSize 'media carta' `
        -ResponsiblePerson 'Automated safety test' `
        -PrinterBrandModel 'HP LaserJet Safety Test' `
        -PrinterDriver 'HP Universal Printing PCL 6' `
        -ConnectionType 'LAN' `
        -BrowserVersion 'Microsoft Edge test' `
        -InvoiceUsed 'REC-A-SAFETY-0001' `
        -EvidenceReference 'qa/evidence/printer-final/foto-media-carta.jpg' `
        -ReprintEvidence 'Reimpresion desde historial con motivo auditado y misma informacion historica' `
        -MarginsEvidence 'Escala 100 por ciento, margenes minimos, contenido centrado y legible en papel' `
        -HeadersFootersEvidence 'Encabezados y pies del navegador desactivados en la impresion fisica' `
        -HistoricalSnapshotEvidence 'Servicios, paciente, monto y numero coinciden con la factura historica' `
        -Notes 'Synthetic safety test proof' | Out-Host

    if ($LASTEXITCODE -ne 0) {
        throw "Expected physical proof generator to pass. Exit code: $LASTEXITCODE"
    }

    if (-not (Test-Path -LiteralPath $proofPath -PathType Leaf)) {
        throw "Expected proof file was not created: $proofPath"
    }

    $proof = Get-Content -LiteralPath $proofPath -Raw
    Assert-Contains $proof '- Media carta result: VALIDADO FISICO en papel media carta' 'Generated proof must validate the selected paper physically.'
    Assert-Contains $proof '- Carta result: NO USADO COMO PAPEL FINAL' 'Generated proof must document non-selected carta format.'
    Assert-Contains $proof '- A5 result: NO USADO COMO PAPEL FINAL' 'Generated proof must document non-selected A5 format.'
    Assert-Contains $proof '- [x] media carta receipt prints on physical paper at 100 percent scale.' 'Generated proof must include a checked physical media carta item.'
    Assert-Contains $proof '- [x] Margins are minimal and no browser headers/footers appear.' 'Generated proof must include headers/footers evidence for preflight.'
    Assert-Contains $proof 'foto/acta/muestra impresa' 'Generated proof must include physical evidence language.'
    Assert-NotMatch $proof '\[ \]' 'Generated proof must not contain unchecked required items.'
    Assert-NotMatch $proof '(?i)\b(TODO|PENDING|PENDIENTE|REPLACE|TBD)\b' 'Generated proof must not contain placeholders.'

    $commonFailureArgs = @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass',
        '-File', $scriptPath,
        '-ProjectRoot', $tempRoot,
        '-EvidencePath', 'qa\SHOULD_NOT_PASS.md',
        '-PrimaryPaperSize', 'media carta',
        '-ResponsiblePerson', 'Automated safety test',
        '-ConnectionType', 'LAN',
        '-BrowserVersion', 'Microsoft Edge test',
        '-InvoiceUsed', 'REC-A-SAFETY-0001',
        '-ReprintEvidence', 'Reimpresion auditada',
        '-MarginsEvidence', 'Margenes fisicos correctos',
        '-HeadersFootersEvidence', 'Headers y footers desactivados',
        '-HistoricalSnapshotEvidence', 'Snapshot historico coincide'
    )

    Assert-CommandFails `
        -CommandArgs ($commonFailureArgs + @(
            '-PrinterBrandModel', 'Microsoft Print to PDF',
            '-PrinterDriver', 'Microsoft PDF',
            '-EvidenceReference', 'qa/evidence/printer-final/foto-media-carta.jpg'
        )) `
        -ExpectedText 'impresora fisica real'

    Assert-CommandFails `
        -CommandArgs ($commonFailureArgs + @(
            '-PrinterBrandModel', 'HP LaserJet Safety Test',
            '-PrinterDriver', 'HP Universal Printing PCL 6',
            '-EvidenceReference', 'C:\temp\foto-media-carta.jpg'
        )) `
        -ExpectedText 'no una ruta absoluta local'
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host '[OK] Physical receipt print proof safety validation passed.'
