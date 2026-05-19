<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BackupController;
use App\Http\Controllers\CashSessionController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\FiscalSequenceController;
use App\Http\Controllers\FiscalSettingsController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LogoController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\SystemStatusController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => config('app.name'),
    ]);
});

Route::get('/system/setup-status', [SystemStatusController::class, 'setupStatus'])
    ->middleware('web');

Route::get('/settings/logo', [LogoController::class, 'show'])
    ->middleware('web');

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware(['web', 'throttle:5,1']);
Route::get('/auth/session', [AuthController::class, 'session'])
    ->middleware('web');

Route::middleware(['web', 'auth:web', 'user.active', 'throttle:60,1'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::middleware('password.changed')->group(function () {
        Route::get('/settings/fiscal', [FiscalSettingsController::class, 'show']);
        Route::put('/settings/fiscal', [FiscalSettingsController::class, 'update']);
        Route::post('/settings/logo', [LogoController::class, 'upload']);

        Route::get('/fiscal-sequences', [FiscalSequenceController::class, 'index']);
        Route::post('/fiscal-sequences', [FiscalSequenceController::class, 'store']);
        Route::patch('/fiscal-sequences/{fiscalSequence}', [FiscalSequenceController::class, 'update']);

        Route::get('/categories', [CategoryController::class, 'index']);
        Route::post('/categories', [CategoryController::class, 'store']);
        Route::patch('/categories/{category}', [CategoryController::class, 'update']);

        Route::get('/services', [ServiceController::class, 'index']);
        Route::post('/services', [ServiceController::class, 'store']);
        Route::patch('/services/{service}', [ServiceController::class, 'update']);

        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
        Route::post('/invoices/{invoice}/void', [InvoiceController::class, 'void']);

        Route::get('/cash-sessions/current', [CashSessionController::class, 'current']);
        Route::post('/cash-sessions/open', [CashSessionController::class, 'open']);
        Route::post('/cash-sessions/{cashSession}/close', [CashSessionController::class, 'close']);
        Route::get('/cash-sessions', [CashSessionController::class, 'index']);

        Route::post('/invoices/{invoice}/payments', [PaymentController::class, 'store']);
        Route::get('/invoices/{invoice}/payments', [PaymentController::class, 'index']);
        Route::get('/invoices/{invoice}/receipt', [ReceiptController::class, 'show']);
        Route::post('/invoices/{invoice}/reprint', [ReceiptController::class, 'reprint']);

        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/daily', [ReportController::class, 'daily']);
        Route::get('/reports/income', [ReportController::class, 'income']);
        Route::get('/reports/categories', [ReportController::class, 'categories']);
        Route::get('/reports/services', [ReportController::class, 'services']);
        Route::get('/reports/operations', [ReportController::class, 'operations']);
        Route::get('/reports/export', [ReportController::class, 'export'])
            ->middleware('throttle:30,1');
        Route::get('/reports/cash-sessions/{cashSession}', [ReportController::class, 'cashSession']);

        Route::get('/backups', [BackupController::class, 'index']);
        Route::post('/backups', [BackupController::class, 'store']);
        Route::get('/backups/{backupLog}/download', [BackupController::class, 'download']);

        Route::get('/system/status', [SystemStatusController::class, 'show']);

        Route::get('/admin/users', [UserController::class, 'index']);
        Route::post('/admin/users', [UserController::class, 'store']);
        Route::patch('/admin/users/{user}', [UserController::class, 'update']);
        Route::post('/admin/users/{user}/toggle-active', [UserController::class, 'toggleActive']);
        Route::post('/admin/users/{user}/reset-password', [UserController::class, 'resetPassword']);
    });
});
