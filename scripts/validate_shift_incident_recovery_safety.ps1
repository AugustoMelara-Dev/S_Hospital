param(
    [string] $ProjectRoot = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectRoot -eq "") {
    $scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot "..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

$failures = New-Object System.Collections.Generic.List[string]

function Add-Failure([string] $message) {
    $failures.Add($message) | Out-Null
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Add-Pass([string] $message) {
    Write-Host "[ OK ] $message" -ForegroundColor Green
}

function Read-RequiredFile([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "Missing required file: $relativePath"
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Assert-Contains([string] $label, [string] $content, [string] $pattern) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Assert-NotContains([string] $label, [string] $content, [string] $pattern) {
    if ($content -notmatch $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$helpView = Read-RequiredFile "frontend\src\features\help\HelpView.tsx"
$helpTest = Read-RequiredFile "frontend\src\features\help\HelpView.test.tsx"
$clientIssueLog = Read-RequiredFile "frontend\src\lib\support\clientIssueLog.ts"
$cashierManual = Read-RequiredFile "docs\manuales\MANUAL_CAJERO.md"
$supervisorManual = Read-RequiredFile "docs\manuales\MANUAL_SUPERVISOR.md"
$adminManual = Read-RequiredFile "docs\manuales\MANUAL_ADMINISTRADOR.md"
$supportGuide = Read-RequiredFile "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$trainingGuide = Read-RequiredFile "docs\manuales\GUIA_CAPACITACION_SEGURA.md"
$releaseChecklist = Read-RequiredFile "docs\RELEASE_CHECKLIST.md"

$operatorDocs = "$cashierManual`n$supervisorManual`n$adminManual`n$supportGuide`n$trainingGuide"
$helpAndTests = "$helpView`n$helpTest"

foreach ($incidentPattern in @(
    "Servidor no disponible",
    "Impresora no responde",
    "Falla la red|Red Local Caida|red local caida",
    "Se fue la luz|reinici",
    "Caja qued",
    "Respaldo fallido",
    "Base de datos necesita restaurarse",
    "Sesion Vencida|Sesi",
    "Sin permiso",
    "Se cerro el navegador|Navegador cerrado"
)) {
    Assert-Contains "Help and tests cover incident: $incidentPattern" $helpAndTests $incidentPattern
}

Assert-Contains "Help tells staff to review cashbox and history after power/browser incidents" $helpView "(?i)revise\s+Caja\s+e\s+Historial[\s\S]*(facturas|pagos|cobro)"
Assert-Contains "Help prevents duplicate printing/payment after printer failure" $helpView "(?i)No repita la factura ni el cobro"
Assert-Contains "Help directs database restore to isolated validation first" $helpView "(?i)base aislada[\s\S]*Nunca restaure producci|validar primero en una base aislada"
Assert-Contains "Help tells staff not to use another account for permissions" $helpView "(?i)No use la cuenta de otra persona"
Assert-Contains "Help keeps safe support evidence workflow" $helpView "Evidencia local para soporte[\s\S]*Preparar resumen"
Assert-Contains "Help support summary warns not to repeat invoices or payments" $clientIssueLog "(?i)no repetir facturas ni cobros[\s\S]*caja e historial"

Assert-Contains "Cashier manual tells staff to prepare safe help summary on errors" $cashierManual "(?i)Ayuda[\s\S]*Preparar resumen"
Assert-Contains "Cashier manual forbids retrying uncertain invoices or payments" $cashierManual "(?i)No repita una factura o cobro"
Assert-Contains "Cashier manual requires history review before repeating work" $cashierManual "(?i)Reviso Historial antes de repetir"

Assert-Contains "Supervisor manual has real-failure section" $supervisorManual "Fallos Reales Y Que Hacer"
Assert-Contains "Supervisor manual covers browser close without duplicate work" $supervisorManual "(?i)navegador se cierra[\s\S]*revise Historial[\s\S]*repetir una factura o cobro"
Assert-Contains "Supervisor manual covers open cashbox recovery" $supervisorManual "Caja Quedo Abierta[\s\S]*No abra otra caja[\s\S]*Cierre con conteo real"
Assert-Contains "Supervisor manual covers backup failure without self-restore" $supervisorManual "Respaldo Fallido[\s\S]*No restaure por cuenta propia"

Assert-Contains "Support guide gathers operational incident facts" $supportGuide "Datos Que Debe Anotar[\s\S]*caja abierta[\s\S]*factura o pago en proceso"
Assert-Contains "Support guide uses safe repair diagnostics" $supportGuide "repair_hospital_system\.ps1[\s\S]*LOCAL_REPAIR_DIAGNOSTIC\.md"
Assert-Contains "Support guide uses safe support packet without secrets" $supportGuide 'collect_support_packet\.ps1[\s\S]*No copia[\s\S]*\.env'
Assert-Contains "Support guide forbids destructive first-level actions" $supportGuide "Acciones Prohibidas[\s\S]*Borrar la base de datos[\s\S]*Repetir facturas o pagos"
Assert-Contains "Support guide requires closure checks before declaring incident resolved" $supportGuide "Cierre Del Incidente[\s\S]*Revise caja[\s\S]*Revise Historial"

Assert-Contains "Training guide drills real incidents before production" $trainingGuide "Fallos Que Deben Practicarse[\s\S]*Servidor no disponible[\s\S]*Reinicio de la computadora"
Assert-Contains "Training guide forbids production practice and destructive restore" $trainingGuide "(?i)No use la base de produccion[\s\S]*Restaurar backups sobre la base real"
Assert-Contains "Administrator manual keeps restore as authorized isolated procedure" $adminManual "(?i)Restauracion[\s\S]*base descartable|base aislada"
Assert-Contains "Release checklist mentions shift incident recovery guard" $releaseChecklist "validate_shift_incident_recovery_safety\.ps1"

Assert-NotContains "Incident recovery docs do not expose secret assignments" $operatorDocs "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*="
Assert-NotContains "Help incident guidance does not expose secret assignments" $helpView "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*="

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "SHIFT_INCIDENT_RECOVERY_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SHIFT_INCIDENT_RECOVERY_SAFETY: YES" -ForegroundColor Green
