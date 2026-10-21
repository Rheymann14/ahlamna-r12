<?php

use App\Http\Controllers\Api\Play\AttemptController;
use App\Http\Controllers\Api\Play\AuthController;
use App\Http\Controllers\Api\Play\WorldController;
use Illuminate\Support\Facades\Route;

// Player game API (used by the /play app). Admin screens use Inertia web routes instead.
Route::prefix('play')->group(function () {
    Route::get('meta', [AuthController::class, 'meta']);

    Route::middleware('throttle:10,1')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login', [AuthController::class, 'login']);
    });

    Route::middleware(['auth:sanctum', 'player', 'throttle:120,1'])->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('world', [WorldController::class, 'show']);
        Route::post('quests/{quest}/attempts', [AttemptController::class, 'start']);
        Route::post('attempts/{attempt}/answers', [AttemptController::class, 'answer']);
        Route::post('attempts/{attempt}/complete', [AttemptController::class, 'complete']);
    });
});
