<?php

namespace App\Controller;

use App\Service\AuthHelper;
use App\Service\Db;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class AvisController
{
    private Db $db;
    private AuthHelper $auth;

    public function __construct(Db $db, AuthHelper $auth)
    {
        $this->db = $db;
        $this->auth = $auth;
    }

    #[Route('/api/avis', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $numero = $body['numero_commande'] ?? $body['numero'] ?? '';
        $note = $body['note'] ?? null;
        $commentaire = $body['commentaire'] ?? null;

        if (!$numero || !$note) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }

        $n = (int)$note;
        if ($n < 1 || $n > 5) {
            return new JsonResponse(['error' => 'Invalid note'], 400);
        }

        $userId = (int)($payload['id'] ?? 0);
        if ($userId <= 0) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $order = $this->db->fetchOne(
            'SELECT numero_commande, statut_courant AS statut FROM commande WHERE numero_commande=? AND utilisateur_id=?',
            [$numero, $userId]
        );
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }
        if ($order['statut'] !== 'terminee') {
            return new JsonResponse(['error' => 'Order not finished'], 400);
        }

        $existing = $this->db->fetchOne('SELECT avis_id FROM avis WHERE numero_commande=?', [$numero]);
        if ($existing) {
            return new JsonResponse(['error' => 'Avis already exists'], 409);
        }

        $row = $this->db->fetchOne(
            'INSERT INTO avis (numero_commande, utilisateur_id, note, commentaire) VALUES (?,?,?,?) RETURNING avis_id',
            [$numero, $userId, $n, $commentaire ?: null]
        );

        return new JsonResponse(['avis_id' => $row['avis_id'] ?? null], 201);
    }
}
