<?php

namespace App\Controller;

use App\Service\Db;
use App\Service\EmailLogger;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class MiscController
{
    private Db $db;
    private EmailLogger $emailLogger;

    public function __construct(Db $db, EmailLogger $emailLogger)
    {
        $this->db = $db;
        $this->emailLogger = $emailLogger;
    }

    #[Route('/api/health', methods: ['GET'])]
    public function health(): JsonResponse
    {
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/horaires', methods: ['GET'])]
    public function horaires(): JsonResponse
    {
        $rows = $this->db->fetchAll('SELECT jour, heure_ouverture, heure_fermeture FROM horaire ORDER BY horaire_id');
        return new JsonResponse($rows);
    }

    #[Route('/api/contact', methods: ['POST'])]
    public function contact(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $email = trim($body['email'] ?? '');
        $title = trim($body['title'] ?? '');
        $message = trim($body['message'] ?? '');

        if (!$email || !$title || !$message) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }

        $row = $this->db->fetchOne(
            'INSERT INTO contact_message (email, titre, message) VALUES ($1,$2,$3) RETURNING contact_id',
            [$email, $title, $message]
        );

        $this->emailLogger->log($email, 'Contact reçu', $message, 'contact', $row['contact_id'] ?? null);

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/avis/public', methods: ['GET'])]
    public function avisPublic(): JsonResponse
    {
        $rows = $this->db->fetchAll(
            "SELECT a.avis_id, a.note, a.commentaire, a.created_at, u.prenom, u.nom
             FROM avis a
             JOIN utilisateur u ON u.utilisateur_id=a.utilisateur_id
             WHERE a.statut='approved'
             ORDER BY a.created_at DESC"
        );
        return new JsonResponse($rows);
    }
}
