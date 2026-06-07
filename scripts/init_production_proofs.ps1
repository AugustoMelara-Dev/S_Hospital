param(
    [string] $ProjectRoot = "",
    [switch] $Force,
    [switch] $WhatIfOnly
)

$ErrorActionPreference = "Stop"

trap {
    Write-Host $_.Exception.Message
    Write-Host "No reemplace evidencia fisica real sin autorizacion del responsable tecnico."
    exit 1
}

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

function Protect-ProofText([string] $value) {
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $value
    }

    $protected = $value -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"
    return $protected
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
        Source = Join-Path $qaDir "FINAL_STARTUP_TASK_PROOF.example.md"
        Target = Join-Path $qaDir "FINAL_STARTUP_TASK_PROOF.md"
        Name = "final startup task proof"
    },
    @{
        Source = Join-Path $qaDir "FINAL_BACKUP_TASK_PROOF.example.md"
        Target = Join-Path $qaDir "FINAL_BACKUP_TASK_PROOF.md"
        Name = "final backup task proof"
    },
    @{
        Source = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.example.md"
        Target = Join-Path $qaDir "FINAL_CONCURRENCY_PROOF.md"
        Name = "final concurrency proof"
    },
    @{
        Source = Join-Path $qaDir "TRAINING_ACCEPTANCE_PROOF.example.md"
        Target = Join-Path $qaDir "TRAINING_ACCEPTANCE_PROOF.md"
        Name = "training acceptance proof"
    }
)

foreach ($proof in $proofs) {
    if (-not (Test-Path -LiteralPath $proof.Source -PathType Leaf)) {
        throw "No se encontro la plantilla requerida: $(Protect-ProofText $proof.Source)"
    }

    if ($WhatIfOnly) {
        $action = if (Test-Path -LiteralPath $proof.Target -PathType Leaf) {
            if ($Force) { "reemplazaria" } else { "conservaria existente" }
        } else {
            "crearia"
        }
        Write-Host "Modo WhatIf: $action $($proof.Name) en $(Protect-ProofText $proof.Target)"
        continue
    }

    if ((Test-Path -LiteralPath $proof.Target -PathType Leaf) -and -not $Force) {
        Write-Host "$($proof.Name) ya existe: $(Protect-ProofText $proof.Target)"
        Write-Host "Use -Force solo si el responsable tecnico autorizo reemplazar un borrador incompleto."
        continue
    }

    Copy-Item -LiteralPath $proof.Source -Destination $proof.Target -Force:$Force
    Write-Host "Creado $($proof.Name): $(Protect-ProofText $proof.Target)"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Fill qa\LAN_CLIENT_VALIDATION_PROOF.md from a real second LAN client."
Write-Host "2. Fill qa\INSTITUTIONAL_RECEIPT_PRINT_PROOF.md from the real cashier printer, including media carta/carta/A5."
Write-Host "3. Install/update stack autostart, observe startup/reboot recovery and fill qa\FINAL_STARTUP_TASK_PROOF.md."
Write-Host "4. Run restore validation into a disposable DB and fill qa\FINAL_RESTORE_PROOF.md."
Write-Host "5. Install/update backup tasks, create one manual UI backup, confirm Protegido in the admin UI and fill qa\FINAL_BACKUP_TASK_PROOF.md."
Write-Host "6. Run concurrency validation against a disposable target and fill qa\FINAL_CONCURRENCY_PROOF.md."
Write-Host "7. Fill qa\TRAINING_ACCEPTANCE_PROOF.md after supervised role training, without names or patient data."
Write-Host "8. Run scripts\production_readiness_preflight.ps1 without -AllowMissingPhysicalProof."
