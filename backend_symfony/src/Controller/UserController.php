<?php

namespace App\Controller;

use App\Service\AuthHelper;
use App\Service\Db;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class UserController
{
    private Db $db;
    private AuthHelper $auth;

    public function __construct(Db $db, AuthHelper $auth)
    {
        $this->db = $db;
        $this->auth = $auth;
    }

    #[Route('/api/users/me', methods: ['GET'])]
    public function me(Request $request): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $idQuoted = $this->db->quote((string)($payload['id'] ?? ''));
        $row = $this->db->fetchOne(
            "SELECT utilisateur_id, prenom, nom, email, telephone, adresse FROM utilisateur WHERE utilisateur_id=$idQuoted"
        );
        if (!$row && !empty($payload['email'])) {
            $emailQuoted = $this->db->quote(strtolower(trim((string)$payload['email'])));
            $row = $this->db->fetchOne(
                "SELECT utilisateur_id, prenom, nom, email, telephone, adresse
                 FROM utilisateur WHERE lower(trim(email))=lower(trim($emailQuoted))"
            );
        }
        if (!$row) {
            return new JsonResponse(['error' => 'User not found'], 404);
        }
        return new JsonResponse($row);
    }

    #[Route('/api/users/me', methods: ['PATCH'])]
    public function update(Request $request): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $firstName = $body['firstName'] ?? null;
        $lastName = $body['lastName'] ?? null;
        $phone = $body['phone'] ?? null;
        $address = $body['address'] ?? null;

        $row = $this->db->fetchOne(
            "UPDATE utilisateur
             SET prenom=COALESCE($1, prenom),
                 nom=COALESCE($2, nom),
                 telephone=COALESCE($3, telephone),
                 adresse=COALESCE($4, adresse),
                 updated_at=NOW()
             WHERE utilisateur_id=$5
             RETURNING utilisateur_id, prenom, nom, email, telephone, adresse",
            [$firstName, $lastName, $phone, $address, $payload['id']]
        );

        return new JsonResponse($row ?: ['error' => 'Update failed'], $row ? 200 : 400);
    }
}
