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

function Read-Manual([string] $relativePath) {
    $path = Join-Path $ProjectRoot $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Add-Failure "No se encontro $relativePath."
        return ""
    }

    Add-Pass "Found $relativePath"
    return Get-Content -LiteralPath $path -Raw
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

function Test-NotContains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Failure $label
    } else {
        Add-Pass $label
    }
}

function Test-ManualChecklistAndWarnings([string] $role, [string] $content) {
    Test-Contains $content "(?im)^##\s+Checklist Diario" "$role has daily checklist section"
    Test-Contains $content "(?im)^##\s+Advertencias Antes De Acciones Delicadas" "$role has delicate-action warning section"
    Test-Contains $content "(?im)^\s*-\s+\[ \]\s+.+" "$role checklist has actionable checkboxes"
    Test-Contains $content "(?i)no\s+(repita|repetir)|antes de repetir|revise Historial" "$role warns before duplicate invoice/payment attempts"
}

$cashier = Read-Manual "docs\manuales\MANUAL_CAJERO.md"
$supervisor = Read-Manual "docs\manuales\MANUAL_SUPERVISOR.md"
$administrator = Read-Manual "docs\manuales\MANUAL_ADMINISTRADOR.md"
$operatorIndex = Read-Manual "docs\manuales\INDICE_OPERADOR.md"
$support = Read-Manual "docs\manuales\GUIA_SOPORTE_PRIMER_NIVEL.md"
$training = Read-Manual "docs\manuales\GUIA_CAPACITACION_SEGURA.md"
$commonIncidents = Read-Manual "docs\manuales\RUNBOOK_INCIDENTES_COMUNES.md"

if ($cashier -ne "") {
    Test-ManualChecklistAndWarnings "Cashier manual" $cashier
    foreach ($pattern in @("Abrir El Sistema", "Iniciar Sesion", "Abrir Caja", "Crear Factura", "Cobrar", "Imprimir Recibo", "Cerrar Caja", "Si Algo Falla")) {
        Test-Contains $cashier ([regex]::Escape($pattern)) "Cashier manual includes $pattern"
    }
    Test-Contains $cashier "(?i)no\s+se\s+debe\s+facturar\s+ni\s+cobrar\s+sin\s+caja\s+abierta" "Cashier manual blocks charging without open cashbox"
}

if ($supervisor -ne "") {
    Test-ManualChecklistAndWarnings "Supervisor manual" $supervisor
    foreach ($pattern in @("Servidor No Disponible", "Red Local Caida", "Impresora No Responde", "Caja Quedo Abierta", "Respaldo Fallido", "Sesion Vencida O Sin Permiso")) {
        Test-Contains $supervisor ([regex]::Escape($pattern)) "Supervisor manual includes incident: $pattern"
    }
    Test-Contains $supervisor "(?i)no\s+borre\s+facturas|No borre facturas" "Supervisor manual forbids deleting invoices"
}

if ($administrator -ne "") {
    Test-ManualChecklistAndWarnings "Administrator manual" $administrator
    foreach ($pattern in @("Usuarios Y Permisos", "Respaldos", "Cambios Criticos", "Capacitacion Segura")) {
        Test-Contains $administrator ([regex]::Escape($pattern)) "Administrator manual includes $pattern"
    }
    Test-Contains $administrator "(?i)No invente CAI|No invente cumplimiento fiscal" "Administrator manual forbids invented fiscal compliance"
    Test-Contains $administrator "(?i)migrate:fresh|seeders de prueba|borrado de volumenes" "Administrator manual forbids destructive production commands"
    Test-Contains $administrator "(?i)automatizacion\s+de\s+respaldos" "Administrator manual uses operator-friendly backup automation wording"
    Test-Contains $administrator "(?i)respaldos\s+con\s+error,\s+respaldos\s+pendientes" "Administrator manual uses operator-friendly backup status wording"
}

if ($operatorIndex -ne "") {
    Test-Contains $operatorIndex "(?i)Soporte Local de Primer Nivel" "Operator index uses local support wording"
    Test-Contains $operatorIndex "(?i)Avisar a soporte local" "Operator index routes LAN errors to local support"
}

$backupIncident = ""
if ($commonIncidents -match "(?is)##\s+5\.\s+Respaldo queda en Pendiente(?<section>.*?)(?:\r?\n---|\z)") {
    $backupIncident = $Matches.section
}

$blankScreenIncident = ""
if ($commonIncidents -match "(?is)##\s+1\.\s+Pantalla blanca(?<section>.*?)(?:\r?\n---|\z)") {
    $blankScreenIncident = $Matches.section
}

$finalChecklist = ""
if ($commonIncidents -match "(?is)##\s+Cuando todo falla: lista de verificacion de 60 segundos(?<section>.*)\z") {
    $finalChecklist = $Matches.section
}

$backupToolIncident = ""
if ($commonIncidents -match "(?is)##\s+9\.\s+Respaldo muestra Error por herramienta local(?<section>.*?)(?:\r?\n---|\z)") {
    $backupToolIncident = $Matches.section
}

if ($commonIncidents -ne "") {
    Test-Contains $commonIncidents "(?i)Respaldo queda en Pendiente" "Common incidents runbook uses operator backup incident title"
    Test-Contains $backupIncident "(?i)Protegido" "Common incidents runbook names protected backup state"
    Test-Contains $backupIncident "(?i)Pendiente" "Common incidents runbook names pending backup state"
    Test-Contains $backupIncident "(?i)Error" "Common incidents runbook names error backup state"
    Test-NotContains $backupIncident "(?i)\b(pending|success|failed|worker_recently_active|HOSPITAL_DUMP_BINARY|/usr/bin/mariadb-dump)\b" "Common incidents backup section avoids raw backup internals"
    Test-Contains $blankScreenIncident "(?i)direccion LAN oficial" "Common incidents blank screen section uses LAN wording"
    Test-Contains $blankScreenIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents blank screen section routes to safe support summary"
    Test-NotContains $blankScreenIncident "(?i)/up|/api|docker\s+ps|frontend/dist|nginx|F12|consola del navegador" "Common incidents blank screen section avoids raw runtime checks"
    Test-Contains $finalChecklist "(?i)direccion LAN oficial" "Common incidents final checklist uses LAN wording"
    Test-Contains $finalChecklist "(?i)no\s+repita|no\s+repetir" "Common incidents final checklist warns against repeating financial actions"
    Test-NotContains $finalChecklist "(?i)curl\s+http|/api|docker\s+ps|localhost:8000|smoke_test_post_install|database\.connected|JSON" "Common incidents final checklist avoids command/API checks"
    Test-Contains $commonIncidents "(?i)Respaldo muestra Error por herramienta local" "Common incidents runbook uses operator backup-tool incident title"
    Test-Contains $backupToolIncident "(?i)Ayuda\s*>\s*Preparar resumen para soporte|resumen seguro" "Common incidents backup-tool section routes to safe support summary"
    Test-Contains $backupToolIncident "(?i)Protegido|Protegida" "Common incidents backup-tool section names protected backup state"
    Test-Contains $backupToolIncident "(?i)Pendiente" "Common incidents backup-tool section names pending backup state"
    Test-Contains $backupToolIncident "(?i)Error" "Common incidents backup-tool section names error backup state"
    Test-NotContains $backupToolIncident "(?i)docker\s+exec|HOSPITAL_DUMP_BINARY|mariadb-dump|mysqldump|\.env|/usr/bin|contenedor backend|which\s+" "Common incidents backup-tool section avoids raw server internals"
}

$combined = "$cashier`n$supervisor`n$administrator`n$support`n$training`n$commonIncidents"
$operatorFacing = "$cashier`n$supervisor`n$administrator`n$operatorIndex"
foreach ($pattern in @("base real", "produccion", "base descartable", "no use la base real", "No restaure", "No borre")) {
    Test-Contains $combined ([regex]::Escape($pattern)) "Operator docs include safe training/support term: $pattern"
}

if ($operatorFacing -match "(?i)\bworker\b|cola\s+de\s+trabajos|trabajos\s+pendientes|soporte\s+tecnico|responsable\s+tecnico|comandos\s+tecnicos|documentos\s+tecnicos|duda\s+tecnica|curl\s+http|/api/|php\s+artisan") {
    Add-Failure "Normal operator manuals expose internal or technical support wording."
} else {
    Add-Pass "Normal operator manuals avoid internal backup/support wording"
}

if ($combined -match "(?i)DB_PASSWORD\s*=|APP_KEY\s*=|TOKEN\s*=|SECRET\s*=") {
    Add-Failure "Operator manuals expose secret-like assignments."
} else {
    Add-Pass "Operator manuals do not expose secret-like assignments"
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "OPERATOR_MANUALS_SAFETY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "OPERATOR_MANUALS_SAFETY: YES" -ForegroundColor Green
