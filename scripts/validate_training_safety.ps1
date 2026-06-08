param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Protect-TrainingText([string] $value) {
    $protected = $value
    $protected = $protected -replace [regex]::Escape($ProjectRoot), "%PROJECT_ROOT%"
    $protected = $protected -replace [regex]::Escape(($ProjectRoot -replace "\\", "/")), "%PROJECT_ROOT%"
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $protected = $protected -replace [regex]::Escape($env:USERPROFILE), "%USERPROFILE%"
        $protected = $protected -replace [regex]::Escape(($env:USERPROFILE -replace "\\", "/")), "%USERPROFILE%"
    }
    $protected = $protected -replace "(?i)(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+", '$1=[redacted]'
    $protected = $protected -replace "(?i)[A-Z]:\\[^\s`"']+", "[ruta-local]"

    return $protected
}

function Add-Failure([string] $message) {
    $safe = Protect-TrainingText $message
    $failures.Add($safe) | Out-Null
    Write-Host "[FAIL] $safe" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $(Protect-TrainingText $message)" -ForegroundColor Green
}

function Normalize-TrainingText([string] $value) {
    $normalized = $value.Normalize([System.Text.NormalizationForm]::FormD)
    $builder = New-Object System.Text.StringBuilder

    foreach ($character in $normalized.ToCharArray()) {
        $category = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($character)
        if ($category -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            [void] $builder.Append($character)
        }
    }

    return $builder.ToString().ToLowerInvariant()
}

function Read-RequiredText([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required training file: $relativePath"
        return ""
    }

    return Get-Content -LiteralPath $path -Raw -Encoding UTF8
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    $normalizedContent = Normalize-TrainingText $content
    if ($normalizedContent -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    $normalizedContent = Normalize-TrainingText $content
    if ($normalizedContent -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

$safeTraining = Read-RequiredText "docs\manuales\GUIA_CAPACITACION_SEGURA.md"
$trainingChecklist = Read-RequiredText "docs\manuales\CHECKLIST_CAPACITACION.md"
$areaUserManual = Read-RequiredText "docs\manuales\MANUAL_USUARIO_AREA.md"
$localValidationScript = Read-RequiredText "docs\LOCAL_VALIDATION_SCRIPT.md"
$operativeValidationFlow = Read-RequiredText "docs\OPERATIVE_VALIDATION_FLOW.md"
$lanClientProofTemplate = Read-RequiredText "qa\LAN_CLIENT_VALIDATION_PROOF.example.md"
$trainingAcceptanceTemplate = Read-RequiredText "qa\TRAINING_ACCEPTANCE_PROOF.example.md"
$quickAdminTraining = Read-RequiredText "docs\TRAINING_ADMIN.md"
$userManual = Read-RequiredText "docs\Manual_Usuario.html"
$helpView = Read-RequiredText "frontend\src\features\help\HelpView.tsx"
$helpViewTest = Read-RequiredText "frontend\src\features\help\HelpView.test.tsx"

$combinedDocs = "$safeTraining`n$trainingChecklist`n$areaUserManual`n$localValidationScript`n$operativeValidationFlow`n$lanClientProofTemplate`n$trainingAcceptanceTemplate`n$quickAdminTraining`n$userManual"
$combinedUi = "$helpView`n$helpViewTest"

Assert-Contains "Training docs forbid practicing in production" $combinedDocs 'no use la base de produccion para practicar|no en\s+la base real de produccion'
Assert-Contains "Training docs require isolated environment or disposable database" $combinedDocs '(entorno|instalacion).{0,60}(separad|aislad)|base descartable'
Assert-Contains "Training docs require cashier role practice" $combinedDocs '(?i)cajero'
Assert-Contains "Training docs require supervisor role practice" $combinedDocs '(?i)supervisor'
Assert-Contains "Training docs require administrator role practice" $combinedDocs '(?i)administrador'
Assert-Contains "Training docs require area-user role practice" $combinedDocs '(?i)usuario de area|area-user'
Assert-Contains "Training docs require area paid-service consultation practice" $combinedDocs '(?i)servicios pagados'
Assert-Contains "Training docs forbid area users from operating cashbox" $combinedDocs '(?i)usuario de area[\s\S]{0,500}no abre caja|no abre caja[\s\S]{0,500}usuario de area'
Assert-Contains "Training docs require support summary practice" $combinedDocs '(?i)ayuda\s*>\s*preparar resumen|resumen seguro'
Assert-NotContains "Training checklist avoids technical incident wording for staff" $trainingChecklist 'incidente tecnico|error tecnico'
Assert-NotContains "Training and validation docs avoid receipt preview wording" $combinedDocs 'vista previa de recibo|receipt preview opens|receipt preview controls|tamano de vista previa'
Assert-Contains "Training and validation docs use institutional receipt wording" $combinedDocs 'recibo institucional'
Assert-Contains "Quick administrator training uses protected backup status" $quickAdminTraining 'protegido'
Assert-Contains "Quick administrator training uses pending backup status" $quickAdminTraining 'pendiente'
Assert-Contains "Quick administrator training uses error backup status" $quickAdminTraining 'error'
Assert-Contains "User manual uses protected backup status" $userManual 'protegido'
Assert-Contains "User manual uses pending backup status" $userManual 'pendiente'
Assert-Contains "User manual uses error backup status" $userManual 'error'
Assert-NotContains "Quick administrator training avoids raw backup states and checksums" $quickAdminTraining '(^|[^a-z])(pending|success|failed|checksum|sha256)([^a-z]|$)'
Assert-NotContains "Quick administrator training avoids raw route checks" $quickAdminTraining '/up|/login|/verify-email'
Assert-NotContains "User manual avoids obsolete backup status labels" $userManual 'todo bien|requiere revision'

foreach ($scenario in @(
    'servidor no disponible',
    'red local',
    'impresora no responde',
    'caja qued',
    'respaldo fallido',
    'sesion vencida',
    'error de permisos',
    'navegador',
    'energia'
)) {
    Assert-Contains "Training docs include scenario: $scenario" $combinedDocs $scenario
}

Assert-Contains "Training docs forbid real production users" $combinedDocs 'usuarios reales de produccion|cuenta real de turno'
Assert-Contains "Training docs forbid real patient data" $combinedDocs 'datos reales de pacientes'
Assert-Contains "Training docs forbid migrate fresh in production" $combinedDocs 'migrate:fresh.{0,40}produccion'
Assert-Contains "Training docs forbid restoring over real database" $combinedDocs 'restaurar backups sobre la base real|nunca sobre la\s+base real'
Assert-Contains "Training docs forbid sharing secrets" $combinedDocs '\.env.{0,80}passwords.{0,80}tokens|passwords.{0,80}tokens'

Assert-Contains "Training acceptance template requires anonymous proof" $trainingAcceptanceTemplate 'keep it anonymous|no escriba nombres|do not write.{0,80}names'
Assert-Contains "Training acceptance template requires final conclusion" $trainingAcceptanceTemplate 'final conclusion'
Assert-Contains "Training acceptance template records evidence reference" $trainingAcceptanceTemplate 'evidence/capture reference'
Assert-Contains "Training acceptance template blocks production database practice" $trainingAcceptanceTemplate 'did not use the production database'
Assert-Contains "Training acceptance template blocks real patient data" $trainingAcceptanceTemplate 'did not use real patient data'
Assert-Contains "Training acceptance template covers cashier workflow" $trainingAcceptanceTemplate 'opening cashbox.{0,120}invoicing.{0,120}charging.{0,120}printing'
Assert-Contains "Training acceptance template covers supervisor incidents" $trainingAcceptanceTemplate 'printer failure.{0,120}lan failure.{0,120}permission issue'
Assert-Contains "Training acceptance template covers administrator restore safety" $trainingAcceptanceTemplate 'restore-only-on-disposable-database|disposable target'
Assert-Contains "Training acceptance template preserves physical blockers" $trainingAcceptanceTemplate 'second-client lan proof[\s\S]{0,240}physical printer proof[\s\S]{0,240}production preflight'

foreach ($item in @(
    @{ Pattern = '(?i)APP_KEY\s*[:=]\s*[^\s`]+'; Message = 'Training acceptance template must not contain APP_KEY-like assignments' },
    @{ Pattern = '(?i)DB_PASSWORD\s*[:=]\s*[^\s`]+'; Message = 'Training acceptance template must not contain DB_PASSWORD-like assignments' },
    @{ Pattern = '(?i)(TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^\s`]+'; Message = 'Training acceptance template must not contain secret-like assignments' },
    @{ Pattern = '(?i)[A-Z]:\\(?![\\])'; Message = 'Training acceptance template must not contain absolute Windows paths' }
)) {
    if ($trainingAcceptanceTemplate -match $item.Pattern) {
        Add-Failure $item.Message
    } else {
        Add-Pass $item.Message
    }
}

Assert-Contains "Help screen exposes safe training section" $combinedUi 'capacitacion segura'
Assert-Contains "Help screen exposes practice mode warning" $combinedUi 'modo practica'
Assert-Contains "Help screen warns not to use production database" $combinedUi 'no use la base de produccion'
Assert-Contains "Help screen mentions isolated practice database" $combinedUi 'base aislada|base descartable'
Assert-Contains "Help screen teaches protected backup status" $combinedUi 'protegido, pendiente o error'
Assert-NotContains "Help screen avoids obsolete backup status labels" $combinedUi 'todo bien|requiere revision'
Assert-Contains "HelpView test protects production database warning" $helpViewTest 'no use la base de produccion'

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "TRAINING_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "TRAINING_SAFETY: YES" -ForegroundColor Green
