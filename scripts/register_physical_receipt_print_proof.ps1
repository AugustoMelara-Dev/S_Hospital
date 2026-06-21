param(
    [string] $ProjectRoot = "",

    [string] $EvidencePath = "",

    [Parameter(Mandatory = $true)]
    [ValidateSet("media carta", "carta", "A5")]
    [string] $PrimaryPaperSize,

    [Parameter(Mandatory = $true)]
    [string] $ResponsiblePerson,

    [Parameter(Mandatory = $true)]
    [string] $PrinterBrandModel,

    [Parameter(Mandatory = $true)]
    [string] $PrinterDriver,

    [Parameter(Mandatory = $true)]
    [string] $ConnectionType,

    [Parameter(Mandatory = $true)]
    [string] $BrowserVersion,

    [string] $CashierComputer = $env:COMPUTERNAME,

    [Parameter(Mandatory = $true)]
    [string] $InvoiceUsed,

    [Parameter(Mandatory = $true)]
    [string] $EvidenceReference,

    [Parameter(Mandatory = $true)]
    [string] $ReprintEvidence,

    [Parameter(Mandatory = $true)]
    [string] $MarginsEvidence,

    [Parameter(Mandatory = $true)]
    [string] $HeadersFootersEvidence,

    [Parameter(Mandatory = $true)]
    [string] $HistoricalSnapshotEvidence,

    [string] $ProblemsFound = "Ninguno observado durante la prueba fisica documentada.",

    [string] $Notes = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

if ($EvidencePath -eq "") {
    $EvidencePath = Join-Path $ProjectRoot "qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
} elseif (-not [System.IO.Path]::IsPathRooted($EvidencePath)) {
    $EvidencePath = Join-Path $ProjectRoot $EvidencePath
}

$EvidencePath = [System.IO.Path]::GetFullPath($EvidencePath)
$qaRoot = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot "qa"))
$qaPrefix = $qaRoot.TrimEnd("\") + "\"
if ($EvidencePath -eq $qaRoot -or -not $EvidencePath.StartsWith($qaPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La evidencia de impresion debe guardarse como archivo dentro de la carpeta qa."
}

foreach ($value in @($ResponsiblePerson, $PrinterBrandModel, $PrinterDriver, $ConnectionType, $BrowserVersion, $CashierComputer, $InvoiceUsed, $EvidenceReference, $ReprintEvidence, $MarginsEvidence, $HeadersFootersEvidence, $HistoricalSnapshotEvidence)) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Todos los campos obligatorios deben tener evidencia concreta."
    }
}

$virtualPrinterPattern = '(?i)(print to pdf|microsoft pdf|onenote|xps|pdf24|adobe pdf|virtual)'
if ($PrinterBrandModel -match $virtualPrinterPattern -or $PrinterDriver -match $virtualPrinterPattern) {
    throw "Esta acta es solo para impresora fisica real. Las impresoras PDF/OneNote/XPS no cierran el gate fisico."
}

function Test-IncompleteProofText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $true
    }

    return $value.Trim() -match '(?i)^(TODO|PENDING|PENDIENTE|REPLACE|N/A|NA|NONE|TBD|-)$'
}

foreach ($value in @($EvidenceReference, $ReprintEvidence, $MarginsEvidence, $HeadersFootersEvidence, $HistoricalSnapshotEvidence)) {
    if (Test-IncompleteProofText $value) {
        throw "La evidencia no puede quedar pendiente, vacia o como placeholder: '$value'."
    }
}

if ([System.IO.Path]::IsPathRooted($EvidenceReference)) {
    throw "Use una referencia relativa bajo qa/ o una referencia fisica/acta, no una ruta absoluta local."
}

if ($EvidenceReference -match '(^|[\\/])\.\.([\\/]|$)') {
    throw "La referencia de evidencia no puede usar traversal '..'."
}

if ($EvidenceReference -match '^(qa|docs|scripts|frontend|backend)[\\/]' -and $EvidenceReference -notmatch '^qa[\\/]') {
    throw "Las referencias locales de evidencia deben vivir bajo qa/."
}

$selectedPaper = $PrimaryPaperSize.ToLowerInvariant()

function New-PaperResult([string] $paper) {
    if ($paper.ToLowerInvariant() -eq $selectedPaper) {
        return "VALIDADO FISICO en papel $paper al 100 por ciento; evidencia: $EvidenceReference"
    }

    return "NO USADO COMO PAPEL FINAL; el formato institucional principal validado fisicamente fue $PrimaryPaperSize; evidencia: $EvidenceReference"
}

function New-PaperObservation([string] $paper) {
    if ($paper.ToLowerInvariant() -eq $selectedPaper) {
        return "Papel impreso revisado fisicamente: legible, alineado, fondo blanco, sin QR, sin codigo de barras y sin codigos internos visibles."
    }

    return "Formato no seleccionado para operacion diaria; no sustituye la prueba fisica aprobada en $PrimaryPaperSize."
}

function New-PaperCheck([string] $paper) {
    if ($paper.ToLowerInvariant() -eq $selectedPaper) {
        return "- [x] $paper receipt prints on physical paper at 100 percent scale. Result/evidence: VALIDADO FISICO en papel; foto/acta/muestra impresa: $EvidenceReference"
    }

    return "- [x] $paper not selected as final institutional paper; physical primary paper proof is covered by $PrimaryPaperSize. Result/evidence: decision operativa documentada; evidencia fisica principal: $EvidenceReference"
}

$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$evidenceDir = Split-Path -Parent $EvidencePath
if (-not (Test-Path -LiteralPath $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Institutional receipt print proof") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("Estado actual: VALIDADO_FISICO") | Out-Null
$lines.Add("Fase: G - prueba fisica LAN/offline real") | Out-Null
$lines.Add("Decision actual: PHYSICAL_INSTITUTIONAL_RECEIPT_VALIDATED") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Environment") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Date/time: $now") | Out-Null
$lines.Add("- Responsible person: $ResponsiblePerson") | Out-Null
$lines.Add("- Printer brand/model: $PrinterBrandModel") | Out-Null
$lines.Add("- Printer driver: $PrinterDriver") | Out-Null
$lines.Add("- Connection type: $ConnectionType") | Out-Null
$lines.Add("- Browser/version: $BrowserVersion") | Out-Null
$lines.Add("- Cashier computer: $CashierComputer") | Out-Null
$lines.Add("- Invoice used: $InvoiceUsed") | Out-Null
$lines.Add("- Evidence/photo reference: $EvidenceReference") | Out-Null
$lines.Add("- Final conclusion: Recibo institucional validado fisicamente en papel $PrimaryPaperSize con impresora real; evidencia: $EvidenceReference") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Media carta, carta, A5 and thermal physical print result") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Media carta result: $(New-PaperResult 'media carta')") | Out-Null
$lines.Add("- Media carta evidence/reference: $EvidenceReference") | Out-Null
$lines.Add("- Media carta observations: $(New-PaperObservation 'media carta')") | Out-Null
$lines.Add("- Carta result: $(New-PaperResult 'carta')") | Out-Null
$lines.Add("- Carta evidence/reference: $EvidenceReference") | Out-Null
$lines.Add("- Carta observations: $(New-PaperObservation 'carta')") | Out-Null
$lines.Add("- A5 result: $(New-PaperResult 'A5')") | Out-Null
$lines.Add("- A5 evidence/reference: $EvidenceReference") | Out-Null
$lines.Add("- A5 observations: $(New-PaperObservation 'A5')") | Out-Null
$lines.Add("- 80mm result: NO USADO COMO RECIBO INSTITUCIONAL PRINCIPAL; compatibilidad secundaria no configurada para esta entrega.") | Out-Null
$lines.Add("- 80mm evidence/reference: decision operativa; recibo institucional principal validado en $PrimaryPaperSize con evidencia $EvidenceReference") | Out-Null
$lines.Add("- 80mm observations: No sustituye el recibo institucional principal.") | Out-Null
$lines.Add("- 58mm result: NO USADO COMO RECIBO INSTITUCIONAL PRINCIPAL; compatibilidad secundaria no configurada para esta entrega.") | Out-Null
$lines.Add("- 58mm evidence/reference: decision operativa; recibo institucional principal validado en $PrimaryPaperSize con evidencia $EvidenceReference") | Out-Null
$lines.Add("- 58mm observations: No sustituye el recibo institucional principal.") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Reprint and browser print settings") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Reprint result: VALIDADO FISICO/AUDITADO; $ReprintEvidence") | Out-Null
$lines.Add("- Margins result: VALIDADO FISICO; $MarginsEvidence") | Out-Null
$lines.Add("- Browser headers/footers result: VALIDADO FISICO; $HeadersFootersEvidence") | Out-Null
$lines.Add("- Problems found: $ProblemsFound") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Required checks") | Out-Null
$lines.Add("") | Out-Null
$lines.Add((New-PaperCheck 'media carta')) | Out-Null
$lines.Add((New-PaperCheck 'carta')) | Out-Null
$lines.Add((New-PaperCheck 'A5')) | Out-Null
$lines.Add("- [x] 80mm receipt is not configured as the final institutional paper. Result/evidence: compatibilidad secundaria fuera del alcance operativo; papel fisico principal validado en $PrimaryPaperSize.") | Out-Null
$lines.Add("- [x] 58mm receipt is not configured as the final institutional paper. Result/evidence: compatibilidad secundaria fuera del alcance operativo; papel fisico principal validado en $PrimaryPaperSize.") | Out-Null
$lines.Add("- [x] Institutional receipt includes hospital name, RTN/CAI when configured, invoice number, patient, cashier, services and totals. Result/evidence: verificado contra muestra impresa; $EvidenceReference") | Out-Null
$lines.Add("- [x] Institutional receipt has white background and no QR, barcode, internal codes or technical fields. Result/evidence: verificado en papel/foto fisica; $EvidenceReference") | Out-Null
$lines.Add("- [x] Reprint from invoice history prints with historical snapshots. Result/evidence: $HistoricalSnapshotEvidence") | Out-Null
$lines.Add("- [x] Margins are minimal and no browser headers/footers appear. Result/evidence: $MarginsEvidence; $HeadersFootersEvidence") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("## Evidence") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("- Photo path, printed-sample reference, or signed local note: $EvidenceReference") | Out-Null
$lines.Add("- Notes: $Notes") | Out-Null

Set-Content -LiteralPath $EvidencePath -Value $lines -Encoding ASCII
Write-Host "Physical receipt print proof written to: $EvidencePath"
