<?php

namespace App\Http\Middleware;

use App\Models\Player;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin users and players both authenticate through Sanctum; game routes must only accept players.
 */
class EnsurePlayer
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() instanceof Player) {
            return response()->json(['message' => 'Player login required.'], 401);
        }

        return $next($request);
    }
}
