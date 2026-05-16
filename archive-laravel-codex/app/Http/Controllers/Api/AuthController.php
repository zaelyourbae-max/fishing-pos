<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    private const CASHIER_ALLOWED_ROLES = ['owner', 'admin', 'cashier'];

    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::query()
            ->with('role:id,name,slug')
            ->where('email', $validated['email'])
            ->where('is_active', true)
            ->whereNull('deleted_at')
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Email atau password tidak valid.'],
            ]);
        }

        $roleSlug = $user->role?->slug;
        $tokenName = $validated['device_name'] ?? 'pos-api';
        $abilities = $this->abilitiesForRole($roleSlug);
        $token = $user->createToken($tokenName, $abilities)->plainTextToken;

        return response()->json([
            'message' => 'Login berhasil.',
            'token_type' => 'Bearer',
            'access_token' => $token,
            'abilities' => $abilities,
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logout berhasil.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('role:id,name,slug');

        return response()->json([
            'user' => $this->userPayload($user),
            'permissions' => [
                'can_access_cashier' => $this->canAccessCashier($user->role?->slug),
            ],
        ]);
    }

    public function checkRole(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'max:100'],
        ]);

        $user = $request->user()->load('role:id,name,slug');
        $roleSlug = $user->role?->slug;

        return response()->json([
            'role' => [
                'required' => $validated['role'],
                'current' => $roleSlug,
                'matched' => $roleSlug === $validated['role'],
            ],
            'permissions' => [
                'can_access_cashier' => $this->canAccessCashier($roleSlug),
            ],
        ]);
    }

    private function abilitiesForRole(?string $roleSlug): array
    {
        return match ($roleSlug) {
            'owner' => ['*'],
            'admin' => ['products:read', 'sales:create', 'sales:read', 'cashier:access'],
            'cashier' => ['products:read', 'sales:create', 'sales:read', 'cashier:access'],
            default => ['products:read'],
        };
    }

    private function canAccessCashier(?string $roleSlug): bool
    {
        return in_array($roleSlug, self::CASHIER_ALLOWED_ROLES, true);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'is_active' => (bool) $user->is_active,
            'role' => $user->role ? [
                'id' => $user->role->id,
                'name' => $user->role->name,
                'slug' => $user->role->slug,
            ] : null,
        ];
    }
}
