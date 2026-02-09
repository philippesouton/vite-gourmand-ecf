<?php

namespace App\Service;

use Symfony\Component\HttpFoundation\Request;

class AuthHelper
{
    private JwtService $jwt;

    public function __construct(JwtService $jwt)
    {
        $this->jwt = $jwt;
    }

    public function getPayload(Request $request): ?array
    {
        $auth = $request->headers->get('Authorization');
        if (!$auth || !str_starts_with($auth, 'Bearer ')) {
            return null;
        }
        $token = trim(substr($auth, 7));
        return $this->jwt->decodeToken($token);
    }

    public function requireRole(array $payload, array $roles): bool
    {
        $role = $payload['role'] ?? null;
        return $role && in_array($role, $roles, true);
    }
}
