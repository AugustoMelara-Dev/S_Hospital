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
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Add-Pass "Found $relativePath"
        return Get-Content -LiteralPath $path -Raw
    }

    Add-Failure "Missing required file: $relativePath"
    return ""
}

function Test-Contains([string] $content, [string] $pattern, [string] $label) {
    if ($content -match $pattern) {
        Add-Pass $label
    } else {
        Add-Failure $label
    }
}

$newInvoicePath = "frontend\src\features\invoices\NewInvoiceView.tsx"
$layoutPath = "frontend\src\features\invoices\components\NewInvoiceViewLayout.tsx"
$reducerPath = "frontend\src\features\invoices\state\reducer.ts"
$stateTypesPath = "frontend\src\features\invoices\state\types.ts"
$testPath = "frontend\src\features\invoices\NewInvoiceView.test.tsx"
$a11yTestPath = "frontend\src\features\invoices\NewInvoiceView.a11y.test.tsx"

$newInvoice = Read-RequiredFile $newInvoicePath
$layout = Read-RequiredFile $layoutPath
$reducer = Read-RequiredFile $reducerPath
$stateTypes = Read-RequiredFile $stateTypesPath
$viewTest = Read-RequiredFile $testPath
$a11yTest = Read-RequiredFile $a11yTestPath

$newInvoiceFullPath = Join-Path $ProjectRoot $newInvoicePath
if (Test-Path -LiteralPath $newInvoiceFullPath -PathType Leaf) {
    $lineCount = (Get-Content -LiteralPath $newInvoiceFullPath | Measure-Object -Line).Lines
    if ($lineCount -le 200) {
        Add-Pass "NewInvoiceView stays under 200 lines ($lineCount)"
    } else {
        Add-Failure "NewInvoiceView has $lineCount lines; keep it at or below 200 by preserving hooks/state/layout extraction."
    }
}

if ($newInvoice -ne "") {
    foreach ($requiredText in @(
        'useInvoiceLifecycle',
        'usePaymentLifecycle',
        'usePosCartActions',
        'usePosDataLoader',
        'usePosKeyboardShortcuts',
        'newInvoiceReducer',
        'NewInvoiceViewLayout'
    )) {
        Test-Contains $newInvoice ([regex]::Escape($requiredText)) "NewInvoiceView keeps extracted dependency: $requiredText"
    }
}

if ($layout -ne "") {
    foreach ($requiredText in @(
        'PatientStep',
        'ServiceSearch',
        'InvoiceCart',
        'InvoiceConfirmation',
        'PaymentModal',
        'InvoiceSuccess',
        'ReceiptPreview'
    )) {
        Test-Contains $layout ([regex]::Escape($requiredText)) "NewInvoice layout composes expected UI block: $requiredText"
    }
}

if ($reducer -ne "" -and $stateTypes -ne "") {
    Test-Contains $reducer 'RESET_FORM' "Reducer owns reset behavior outside the view"
    Test-Contains $reducer 'ADD_TO_CART' "Reducer owns cart add behavior outside the view"
    Test-Contains $reducer 'UPDATE_DIALYSIS' "Reducer owns dialysis flag behavior outside the view"
    Test-Contains $stateTypes 'NewInvoiceState' "State contract lives outside the view"
    Test-Contains $stateTypes 'NewInvoiceAction' "Action contract lives outside the view"
}

$combinedTests = "$viewTest`n$a11yTest"
if ($combinedTests.Trim() -ne "") {
    foreach ($requiredText in @(
        'NewInvoiceView',
        'accessibility',
        'emitir',
        'cobrar',
        'dialysis'
    )) {
        Test-Contains $combinedTests ([regex]::Escape($requiredText)) "New invoice tests preserve coverage marker: $requiredText"
    }
}

if ($failures.Count -gt 0) {
    Write-Host ""
    Write-Host "NEW_INVOICE_MAINTAINABILITY: NO ($($failures.Count) blocking issue(s))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "NEW_INVOICE_MAINTAINABILITY: YES" -ForegroundColor Green
