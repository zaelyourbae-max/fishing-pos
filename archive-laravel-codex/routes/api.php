<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\SaleTransactionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Middleware\EnsureCashierPermission;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/check-role', [AuthController::class, 'checkRole']);

    Route::get('/products', [ProductController::class, 'index']);

    Route::post('/sales', [SaleTransactionController::class, 'store'])
        ->middleware(EnsureCashierPermission::class);
    Route::get('/sales/{sale}', [SaleTransactionController::class, 'show'])
        ->whereNumber('sale');
});
