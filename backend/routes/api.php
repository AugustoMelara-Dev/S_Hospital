<?php

use App\Actions\Reports\OpenApiExporter;
use App\Http\Controllers\AreaController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CashSessionController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CspReportController;
use App\Http\Controllers\EchoConfigController;
use App\Http\Controllers\FiscalSequenceController;
use App\Http\Controllers\FiscalSettingsController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\InstitutionalReceiptController;
use App\Http\Controllers\InstitutionalReceiptSettingsController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LogoController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SystemStatusController;
use App\Http\Controllers\UserController;
use App\Http\Middleware\LoginLockout;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'Sistema de Caja Hospitalaria',
    ]);
})->middleware('throttle:120,1');

Route::post('/system/csp-report', [CspReportController::class, 'store'])
    ->middleware('throttle:30,1');

Route::get('/system/health', [HealthController::class, 'show'])
    ->middleware('throttle:120,1');

Route::get('/system/echo-config', [EchoConfigController::class, 'show'])
    ->middleware('throttle:120,1');

Route::get('/system/openapi', function () {
    $document = app(OpenApiExporter::class)->document(app('router'));

    return response()->json($document);
})->middleware('auth:sanctum');

Route::get('/system/setup-status', [SystemStatusController::class, 'setupStatus'])
    ->middleware('web');

Route::get('/settings/logo', [LogoController::class, 'show'])
    ->middleware('web');
Route::get('/settings/logo/file', [LogoController::class, 'file'])
    ->middleware('web');

Route::get('/settings/branding', [FiscalSettingsController::class, 'publicBranding'])
    ->middleware('web');

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware(['web', LoginLockout::class, 'throttle:5,1']);
Route::get('/auth/session', [AuthController::class, 'session'])
    ->middleware(['web', 'throttle.user:30,1']);

Route::middleware(['web', 'auth:web', 'user.active', 'throttle.user:240,1'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword'])
        ->middleware('throttle.user:10,1');
    Route::post('/auth/logout', [AuthController::class, 'logout'])
        ->middleware('throttle.user:60,1');

    Route::middleware('password.changed')->group(function () {
        Route::get('/settings/fiscal', [FiscalSettingsController::class, 'show']);
        Route::put('/settings/fiscal', [FiscalSettingsController::class, 'update'])
            ->middleware('throttle.user:30,1');
        Route::post('/settings/logo', [LogoController::class, 'upload'])
            ->middleware('throttle.user:20,1');

        Route::get('/fiscal-sequences', [FiscalSequenceController::class, 'index']);
        Route::post('/fiscal-sequences', [FiscalSequenceController::class, 'store'])
            ->middleware('throttle.user:30,1');
        Route::patch('/fiscal-sequences/{fiscalSequence}', [FiscalSequenceController::class, 'update'])
            ->middleware('throttle.user:30,1');

        Route::get('/settings/institutional-receipts', [InstitutionalReceiptSettingsController::class, 'show']);
        Route::put('/settings/institutional-receipts/institution', [InstitutionalReceiptSettingsController::class, 'updateInstitution'])
            ->middleware('throttle.user:30,1');
        Route::get('/settings/institutional-receipts/series', [InstitutionalReceiptSettingsController::class, 'series']);
        Route::post('/settings/institutional-receipts/series', [InstitutionalReceiptSettingsController::class, 'storeSeries'])
            ->middleware('throttle.user:30,1');
        Route::patch('/settings/institutional-receipts/series/{series}', [InstitutionalReceiptSettingsController::class, 'updateSeries'])
            ->middleware('throttle.user:30,1');
        Route::get('/settings/institutional-receipts/print-profiles', [InstitutionalReceiptSettingsController::class, 'printProfiles']);
        Route::patch('/settings/institutional-receipts/print-profiles/{profile}', [InstitutionalReceiptSettingsController::class, 'updatePrintProfile'])
            ->middleware('throttle.user:30,1');
        Route::put('/settings/institutional-receipts/assignments', [InstitutionalReceiptSettingsController::class, 'upsertAssignment'])
            ->middleware('throttle.user:30,1');
        Route::post('/settings/institutional-receipts/test-preview', [InstitutionalReceiptSettingsController::class, 'testPreview'])
            ->middleware('throttle.user:30,1');
        Route::post('/settings/institutional-receipts/test-print', [InstitutionalReceiptSettingsController::class, 'testPrint'])
            ->middleware('throttle.user:30,1');
        Route::post('/institutional-receipts', [InstitutionalReceiptController::class, 'store'])
            ->middleware(['throttle.user:60,1', 'idempotency']);
        Route::get('/institutional-receipts/{receipt}/pdf', [InstitutionalReceiptController::class, 'pdf'])
            ->middleware('throttle.user:60,1');

        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store'])
            ->middleware('throttle.user:60,1');
        Route::patch('/categories/{category}', [CategoryController::class, 'update'])
            ->middleware('throttle.user:60,1');
        Route::get('/areas', [AreaController::class, 'index']);

        Route::get('/services', [ServiceController::class, 'index']);
        Route::post('/services', [ServiceController::class, 'store'])
            ->middleware('throttle.user:60,1');
        Route::patch('/services/{service}', [ServiceController::class, 'update'])
            ->middleware('throttle.user:60,1');

        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store'])
            ->middleware(['throttle.user:60,1', 'idempotency']);
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::post('/invoices/{invoice}/void', [InvoiceController::class, 'void'])
            ->middleware('throttle.user:30,1');
        Route::post('/invoices/{invoice}/reverse', [InvoiceController::class, 'reverse'])
            ->middleware('throttle.user:10,1');

        Route::get('/cash-sessions/current', [CashSessionController::class, 'current']);
        Route::post('/cash-sessions/open', [CashSessionController::class, 'open'])
            ->middleware(['throttle.user:30,1', 'idempotency']);
        Route::post('/cash-sessions/{cashSession}/close', [CashSessionController::class, 'close'])
            ->middleware(['throttle.user:30,1', 'idempotency']);
        Route::get('/cash-sessions', [CashSessionController::class, 'index']);

        Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store'])
            ->middleware(['throttle.user:60,1', 'idempotency']);
        Route::get('/invoices/{invoice}/payments', [PaymentController::class, 'index']);
        Route::post('/invoices/{invoice}/payments/{payment}/void', [PaymentController::class, 'void'])
            ->middleware('throttle.user:30,1');
        Route::get('/invoices/{invoice}/receipt', [ReceiptController::class, 'show']);
        Route::post('/invoices/{invoice}/reprint', [ReceiptController::class, 'reprint'])
            ->middleware('throttle.user:30,1');

        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/monthly', [ReportController::class, 'monthly']);
        Route::get('/reports/income', [ReportController::class, 'income']);
        Route::get('/reports/categories', [ReportController::class, 'categories']);
        Route::get('/reports/areas', [ReportController::class, 'areas']);
        Route::get('/reports/services', [ReportController::class, 'services']);
        Route::get('/reports/operations', [ReportController::class, 'operations']);
        Route::get('/reports/export', [ReportController::class, 'export'])
            ->middleware('throttle.user:30,1');
        Route::get('/reports/pdf', [ReportController::class, 'pdfExport']);
        Route::get('/reports/cash-sessions/{cashSession}', [ReportController::class, 'cashSession']);

        Route::get('/backups', [BackupController::class, 'index']);
        Route::post('/backups', [BackupController::class, 'store'])
            ->middleware('throttle.user:20,1');
        Route::get('/backups/{backupLog}/download', [BackupController::class, 'download']);

        Route::get('/system/status', [SystemStatusController::class, 'show']);

        Route::get('/admin/users', [UserController::class, 'index']);
        Route::post('/admin/users', [UserController::class, 'store'])
            ->middleware('throttle.user:30,1');
        Route::patch('/admin/users/{user}', [UserController::class, 'update'])
            ->middleware('throttle.user:30,1');
        Route::post('/admin/users/{user}/toggle-active', [UserController::class, 'toggleActive'])
            ->middleware('throttle.user:30,1');
        Route::post('/admin/users/{user}/reset-password', [UserController::class, 'resetPassword'])
            ->middleware('throttle.user:20,1');
    });
});
