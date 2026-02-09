<?php

namespace App\Controller;

use App\Service\AuthHelper;
use App\Service\Db;
use App\Service\EmailLogger;
use App\Service\MongoService;
use App\Util\ApiUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class OrderController
{
    private Db $db;
    private AuthHelper $auth;
    private EmailLogger $emailLogger;
    private MongoService $mongo;

    public function __construct(Db $db, AuthHelper $auth, EmailLogger $emailLogger, MongoService $mongo)
    {
        $this->db = $db;
        $this->auth = $auth;
        $this->emailLogger = $emailLogger;
        $this->mongo = $mongo;
    }

    #[Route('/api/orders/quote', methods: ['POST'])]
    public function quote(Request $request): JsonResponse
    {
        $body = json_decode($request->getContent(), true) ?: [];
        $menuId = (int)($body['menuId'] ?? 0);
        $persons = (int)($body['persons'] ?? 0);
        $city = trim((string)($body['ville'] ?? ''));
        $distanceKm = (float)($body['distanceKm'] ?? 0);

        $menuIdQuoted = $this->db->quote((string)$menuId);
        $menu = $this->db->fetchOne(
            "SELECT menu_id AS id, nombre_personne_minimum AS \"minPersons\", prix_par_personne AS \"pricePerPerson\", stock_disponible AS stock
             FROM menu WHERE menu_id=$menuIdQuoted"
        );
        if (!$menu) {
            return new JsonResponse(['error' => 'Menu not found'], 404);
        }

        try {
            $pricing = ApiUtils::computePricing($menu, $persons, $city, $distanceKm);
            return new JsonResponse([
                'menuId' => $menuId,
                'persons' => $persons,
                'pricing' => $pricing
            ]);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    #[Route('/api/orders', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $menuId = (int)($body['menuId'] ?? 0);
        $persons = (int)($body['persons'] ?? 0);
        $date = $body['datePrestation'] ?? null;
        $heure = $body['heureLivraison'] ?? null;
        $adresse = $body['adresse'] ?? null;
        $ville = $body['ville'] ?? null;
        $cp = $body['codePostal'] ?? null;
        $distanceKm = (float)($body['distanceKm'] ?? 0);
        $materielPretRaw = $body['materielPret'] ?? false;
        $materielPret = filter_var($materielPretRaw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if ($materielPret === null) {
            $materielPret = false;
        }

        $menuIdQuoted = $this->db->quote((string)$menuId);
        $menu = $this->db->fetchOne(
            "SELECT menu_id AS id, titre, nombre_personne_minimum AS \"minPersons\", prix_par_personne AS \"pricePerPerson\", stock_disponible AS stock
             FROM menu WHERE menu_id=$menuIdQuoted"
        );
        if (!$menu) {
            return new JsonResponse(['error' => 'Menu not found'], 404);
        }

        if ($menu['stock'] !== null && (int)$menu['stock'] <= 0) {
            return new JsonResponse(['error' => 'Stock indisponible'], 400);
        }

        try {
            $pricing = ApiUtils::computePricing($menu, $persons, (string)$ville, $distanceKm);
        } catch (\Throwable $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }

        $numero = ApiUtils::generateOrderNumber();

        $userId = (int)($payload['id'] ?? 0);
        if ($userId <= 0) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $client = $this->db->fetchOne(
            'SELECT prenom, nom, email, telephone FROM utilisateur WHERE utilisateur_id=$1',
            [$userId]
        );
        if (!$client && !empty($payload['email'])) {
            $emailQuoted = $this->db->quote(strtolower(trim((string)$payload['email'])));
            $client = $this->db->fetchOne(
                "SELECT prenom, nom, email, telephone FROM utilisateur WHERE lower(trim(email))=lower(trim($emailQuoted))"
            );
        }
        if (!$client) {
            return new JsonResponse(['error' => 'User not found'], 404);
        }

        $row = $this->db->fetchOne(
            "INSERT INTO commande (
                numero_commande, utilisateur_id, menu_id, statut_courant,
                date_prestation, heure_livraison,
                client_prenom, client_nom, client_email, client_telephone,
                adresse_prestation, ville_prestation, code_postal_prestation,
                nombre_personnes,
                prix_par_personne_applique, prix_menu_brut, reduction_pourcent, reduction_eur, prix_menu_net,
                livraison_distance_km, prix_livraison, prix_total,
                materiel_pret
             )
             VALUES (
                ?, ?, ?, 'en_attente', ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?
             )
             RETURNING numero_commande",
            [
                $numero,
                $userId,
                $menuId,
                $date,
                $heure,
                $client['prenom'] ?: 'Client',
                $client['nom'] ?: 'Client',
                $client['email'] ?: ($payload['email'] ?? 'client'),
                $client['telephone'],
                $adresse,
                $ville,
                $cp,
                $persons,
                (float)$menu['pricePerPerson'],
                $pricing['brut'],
                $pricing['reductionPercent'],
                $pricing['reductionEur'],
                $pricing['net'],
                $pricing['km'],
                $pricing['delivery'],
                $pricing['total'],
                $materielPret ? 1 : 0
            ]
        );

        $this->db->execute(
            "INSERT INTO commande_statut_historique (numero_commande, statut) VALUES (?, ?)",
            [$numero, 'en_attente']
        );

        if ($menu['stock'] !== null) {
            $this->db->execute('UPDATE menu SET stock_disponible=stock_disponible-1 WHERE menu_id=$1', [$menuId]);
        }

        $this->emailLogger->log(
            $payload['email'] ?? 'client',
            'Confirmation commande',
            "Commande {$numero} confirmée.",
            'order_confirm',
            $numero
        );

        $this->mongo->insertOrder([
            'menuId' => $menuId,
            'numero' => $numero,
            'total' => $pricing['total'],
            'createdAt' => date('Y-m-d')
        ]);

        return new JsonResponse(['numero' => $numero], 201);
    }

    #[Route('/api/orders/me', methods: ['GET'])]
    public function myOrders(Request $request): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $userId = (int)($payload['id'] ?? 0);
        if ($userId <= 0) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $rows = $this->db->fetchAll(
            "SELECT c.numero_commande, c.statut_courant AS statut, c.date_prestation, c.heure_livraison,
                    c.prix_total, c.nombre_personnes AS personnes, m.titre AS menu
             FROM commande c
             JOIN menu m ON m.menu_id=c.menu_id
             WHERE c.utilisateur_id=?
             ORDER BY c.created_at DESC",
            [$userId]
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/orders/{numero}', methods: ['GET'])]
    public function orderDetail(Request $request, string $numero): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $userId = (int)($payload['id'] ?? 0);
        if ($userId <= 0) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $order = $this->db->fetchOne(
            "SELECT c.numero_commande, c.statut_courant AS statut, c.date_prestation, c.heure_livraison,
                    c.adresse_prestation AS adresse, c.ville_prestation AS ville,
                    c.code_postal_prestation AS code_postal, c.livraison_distance_km AS distance_km, c.materiel_pret,
                    c.nombre_personnes AS personnes, c.prix_total, c.prix_livraison, c.reduction_pourcent,
                    m.titre AS menu
             FROM commande c
             JOIN menu m ON m.menu_id=c.menu_id
             WHERE c.numero_commande=? AND c.utilisateur_id=?",
            [$numero, $userId]
        );
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }

        $history = $this->db->fetchAll(
            'SELECT statut, changed_at FROM commande_statut_historique WHERE numero_commande=$1 ORDER BY changed_at',
            [$numero]
        );

        return new JsonResponse(['order' => $order, 'history' => $history]);
    }

    #[Route('/api/orders/{numero}', methods: ['PATCH'])]
    public function updateOrder(Request $request, string $numero): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $persons = $body['persons'] ?? null;
        $date = $body['datePrestation'] ?? null;
        $heure = $body['heureLivraison'] ?? null;
        $adresse = $body['adresse'] ?? null;
        $ville = $body['ville'] ?? null;
        $cp = $body['codePostal'] ?? null;
        $distanceKm = $body['distanceKm'] ?? null;
        $materielPretRaw = $body['materielPret'] ?? null;
        $materielPret = null;
        if ($materielPretRaw !== null) {
            $materielPret = filter_var($materielPretRaw, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if ($materielPret === null) {
                $materielPret = false;
            }
        }

        $row = $this->db->fetchOne(
            "UPDATE commande
             SET nombre_personnes=COALESCE($1, nombre_personnes),
                 date_prestation=COALESCE($2, date_prestation),
                 heure_livraison=COALESCE($3, heure_livraison),
                 adresse_prestation=COALESCE($4, adresse_prestation),
                 ville_prestation=COALESCE($5, ville_prestation),
                 code_postal_prestation=COALESCE($6, code_postal_prestation),
                 livraison_distance_km=COALESCE($7, livraison_distance_km),
                 materiel_pret=COALESCE($8, materiel_pret),
                 updated_at=NOW()
             WHERE numero_commande=$9 AND utilisateur_id=$10 AND statut_courant='en_attente'
             RETURNING numero_commande",
            [$persons, $date, $heure, $adresse, $ville, $cp, $distanceKm, $materielPret, $numero, $payload['id']]
        );

        if (!$row) {
            return new JsonResponse(['error' => 'Order not editable'], 400);
        }

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/orders/{numero}/cancel', methods: ['POST'])]
    public function cancelOrder(Request $request, string $numero): JsonResponse
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $order = $this->db->fetchOne(
            "SELECT c.menu_id, c.statut_courant AS statut, c.numero_commande
             FROM commande c WHERE c.numero_commande=$1 AND c.utilisateur_id=$2",
            [$numero, $payload['id']]
        );
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }
        if ($order['statut'] !== 'en_attente') {
            return new JsonResponse(['error' => 'Order cannot be cancelled'], 400);
        }

        $this->db->execute(
            "UPDATE commande SET statut_courant='annulee', updated_at=NOW() WHERE numero_commande=$1",
            [$numero]
        );
        $this->db->execute(
            "INSERT INTO commande_statut_historique (numero_commande, statut) VALUES (?, ?)",
            [$numero, 'annulee']
        );

        $this->db->execute(
            'INSERT INTO commande_annulation (numero_commande, motif, mode_contact) VALUES ($1,$2,$3)',
            [$numero, 'Annulation client', 'client']
        );

        $this->db->execute('UPDATE menu SET stock_disponible=stock_disponible+1 WHERE menu_id=$1', [$order['menu_id']]);

        return new JsonResponse(['ok' => true]);
    }
}
