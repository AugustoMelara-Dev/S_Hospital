param(
    [string] $ProjectRoot = "",
    [switch] $Force
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$qaDir = Join-Path $ProjectRoot "qa"
$proofs = @(
    @{
        Source = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.example.md"
        Target = Join-Path $qaDir "LAN_CLIENT_VALIDATION_PROOF.md"
        Name = "LAN client validation proof"
    },
    @{
        Source = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.example.md"
        Target = Join-Path $qaDir "INSTITUTIONAL_RECEIPT_PRINT_PROOF.md"
        Name = "institutional receipt print proof"
    },
    @{
        Source = Join-Path $qaDir "FINAL_RESTORE_PROOF.example.md"
        Target = Join-Path $qaDir "FINAL_RESTORE_PROOF.md"
        Name = "final restore proof"
    },
    @{
        Source = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.example.md"
        Target = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.md"
        Name = "final concurrency proof"
    }
)

foreach ($proof in $proofs) {
    if (-not (Test-Path -LiteralPath $proof.Source -PathType Leaf)) {
        throw "Missing template: $($proof.Source)"
    }

    if ((Test-Path -LiteralPath $proof.Target -PathType Leaf) -and -not $Force) {
        Write-Host "$($proof.Name) already exists: $($proof.Target)"
        Write-Host "Use -Force only if you intentionally want to replace the unfinished proof file."
        continue
    }

    Copy-Item -LiteralPath $proof.Source -Destination $proof.Target -Force:$Force
    Write-Host "Created $($proof.Name): $($proof.Target)"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Fill qa\LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client."
Write-Host "2. Fill qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md from the real cashier printer."
Write-Host "3. Run restore validation into a disposable DB and fill qa\FINAL_RESTORE_PROOF.md."
Write-Host "4. Run concurrency validation against a disposable target and fill qa\FINAL_CONCURRENCY_PROOF.md."
Write-Host "5. Run scripts\production_readiness_preflight.ps1 without -AllowMissingPhysicalProof."
