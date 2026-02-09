<?php

namespace App\Controller;

use App\Service\Db;
use App\Service\EmailLogger;
use App\Service\JwtService;
use App\Util\ApiUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class AuthController
{
    private Db $db;
    private JwtService $jwt;
    private EmailLogger $emailLogger;

    public function __construct(Db $db, JwtService $jwt, EmailLogger $emailLogger)
    {
        $this->db = $db;
        $this->jwt = $jwt;
        $this->emailLogger = $emailLogger;
    }

    #[Route('/api/auth/register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $firstName = trim($body['firstName'] ?? '');
        $lastName = trim($body['lastName'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $address = trim($body['address'] ?? '');
        $password = $body['password'] ?? '';

        if (!$firstName || !$lastName || !$email || !$password) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }
        if (!ApiUtils::isStrongPassword($password)) {
            return new JsonResponse(['error' => 'Weak password'], 400);
        }

        $roleRow = $this->db->fetchOne("SELECT role_id FROM roles WHERE libelle='USER'");
        if (!$roleRow) {
            return new JsonResponse(['error' => 'Role USER missing'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);

        try {
            $row = $this->db->fetchOne(
                "INSERT INTO utilisateur (role_id, email, password_hash, prenom, nom, telephone, adresse)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 RETURNING utilisateur_id",
                [$roleRow['role_id'], $email, $hash, $firstName, $lastName, $phone ?: null, $address ?: null]
            );

            $this->emailLogger->log(
                $email,
                'Bienvenue chez Vite & Gourmand',
                "Bonjour {$firstName}, votre compte est bien créé.",
                'welcome',
                $row['utilisateur_id'] ?? null
            );

            return new JsonResponse(['id' => (string)($row['utilisateur_id'] ?? '')], 201);
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'duplicate')) {
                return new JsonResponse(['error' => 'Email already used'], 409);
            }
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    #[Route('/api/auth/login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $email = strtolower(trim($body['email'] ?? ''));
        $password = $body['password'] ?? '';

        if (!$email || !$password) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }

        $emailQuoted = $this->db->quote($email);
        $user = $this->db->fetchOne(
            "SELECT u.utilisateur_id, u.email, u.password_hash, u.is_active, r.libelle AS role
             FROM utilisateur u JOIN roles r ON r.role_id=u.role_id
             WHERE lower(trim(u.email))=lower(trim($emailQuoted))"
        );
        if (!$user) {
            return new JsonResponse(['error' => 'Invalid credentials'], 401);
        }
        if (!($user['is_active'] ?? true)) {
            return new JsonResponse(['error' => 'Account disabled'], 403);
        }

        if (!password_verify($password, $user['password_hash'] ?? '')) {
            return new JsonResponse(['error' => 'Invalid credentials'], 401);
        }

        $token = $this->jwt->createToken([
            'id' => (string)$user['utilisateur_id'],
            'email' => $user['email'],
            'role' => $user['role'],
        ]);

        return new JsonResponse(['token' => $token, 'role' => $user['role']]);
    }

    #[Route('/api/auth/forgot', methods: ['POST'])]
    public function forgot(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $email = strtolower(trim($body['email'] ?? ''));
        if (!$email) {
            return new JsonResponse(['error' => 'Missing email'], 400);
        }

        $user = $this->db->fetchOne(
            'SELECT utilisateur_id, prenom FROM utilisateur WHERE email=$1',
            [$email]
        );

        if ($user) {
            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', time() + 3600);
            $this->db->execute(
                "INSERT INTO password_reset (utilisateur_id, token, purpose, expires_at)
                 VALUES ($1,$2,'reset',$3)",
                [$user['utilisateur_id'], $token, $expires]
            );

            $this->emailLogger->log(
                $email,
                'Réinitialisation de mot de passe',
                "Bonjour {$user['prenom']}, lien: reset-password.html?token={$token}",
                'reset',
                $token
            );
        }

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/auth/reset', methods: ['POST'])]
    public function reset(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $token = trim($body['token'] ?? '');
        $password = $body['password'] ?? '';

        if (!$token || !$password) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }
        if (!ApiUtils::isStrongPassword($password)) {
            return new JsonResponse(['error' => 'Weak password'], 400);
        }

        $row = $this->db->fetchOne(
            "SELECT id, utilisateur_id FROM password_reset
             WHERE token=$1 AND purpose='reset' AND expires_at > NOW()",
            [$token]
        );
        if (!$row) {
            return new JsonResponse(['error' => 'Invalid or expired token'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $this->db->execute(
            'UPDATE utilisateur SET password_hash=$1, updated_at=NOW() WHERE utilisateur_id=$2',
            [$hash, $row['utilisateur_id']]
        );
        $this->db->execute('DELETE FROM password_reset WHERE id=$1', [$row['id']]);

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/auth/set-password', methods: ['POST'])]
    public function setPassword(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $token = trim($body['token'] ?? '');
        $password = $body['password'] ?? '';

        if (!$token || !$password) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }
        if (!ApiUtils::isStrongPassword($password)) {
            return new JsonResponse(['error' => 'Weak password'], 400);
        }

        $row = $this->db->fetchOne(
            'SELECT id, utilisateur_id FROM password_reset WHERE token=$1 AND expires_at > NOW()',
            [$token]
        );
        if (!$row) {
            return new JsonResponse(['error' => 'Invalid or expired token'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $this->db->execute(
            'UPDATE utilisateur SET password_hash=$1, updated_at=NOW() WHERE utilisateur_id=$2',
            [$hash, $row['utilisateur_id']]
        );
        $this->db->execute('DELETE FROM password_reset WHERE id=$1', [$row['id']]);

        return new JsonResponse(['ok' => true]);
    }
}
