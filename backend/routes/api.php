<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\FiscalSequenceController;
use App\Http\Controllers\FiscalSettingsController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\ServiceController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => config('app.name'),
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('web');

Route::middleware(['auth:sanctum', 'user.active'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout'])
        ->middleware('web');

    Route::middleware('password.changed')->group(function () {
        Route::get('/settings/fiscal', [FiscalSettingsController::class, 'show']);
        Route::put('/settings/fiscal', [FiscalSettingsController::class, 'update']);

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
    });
});
