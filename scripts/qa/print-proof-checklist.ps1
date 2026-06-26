param(
    [string] $OutputPath = ""
)

$checklist = @"
S_Hospital V1.1 - Physical Print Proof Checklist

Use synthetic data only.

Required formats:
[ ] Letter
[ ] Half-letter
[ ] A5
[ ] 80mm, only if compatible printer exists
[ ] 58mm, only if compatible printer exists

Scenarios:
[ ] One item
[ ] Several items
[ ] Long service description
[ ] Long patient name
[ ] Reprinted receipt
[ ] Voided receipt, if approved in test environment
[ ] Large total
[ ] Multipage document

Driver/browser:
[ ] Correct printer selected
[ ] Correct paper size selected
[ ] Scale 100 percent / actual size
[ ] Browser headers and footers disabled when available
[ ] Orientation correct

Visual review:
[ ] Margins acceptable
[ ] Header visible
[ ] Item table readable
[ ] Totals together
[ ] No clipped text
[ ] Grayscale readable
[ ] No unauthorized QR
[ ] No unauthorized barcode
[ ] No internal IDs or technical logs

Decision:
[ ] PASS
[ ] FAIL
[ ] PENDIENTE

Notes:
"@

if ($OutputPath -ne "") {
    $fullPath = [System.IO.Path]::GetFullPath($OutputPath)
    $allowedRoot = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "qa\field-acceptance"))
    if (-not $fullPath.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "OutputPath must be under qa\field-acceptance."
    }
    New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($fullPath)) | Out-Null
    Set-Content -LiteralPath $fullPath -Value $checklist -Encoding UTF8
    Write-Host "Checklist written to $fullPath"
} else {
    Write-Host $checklist
}
