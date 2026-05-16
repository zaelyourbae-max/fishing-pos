<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCashierPermission
{
    private const ALLOWED_ROLES = ['owner', 'admin', 'cashier'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $roleSlug = $user?->role?->slug;

        if (! $user || ! in_array($roleSlug, self::ALLOWED_ROLES, true)) {
            return response()->json([
                'message' => 'Akses kasir ditolak.',
            ], 403);
        }

        if ($user->currentAccessToken() && ! $user->tokenCan('cashier:access')) {
            return response()->json([
                'message' => 'Token tidak memiliki permission kasir.',
            ], 403);
        }

        return $next($request);
    }
}
