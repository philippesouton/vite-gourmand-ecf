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

class AdminController
{
    private Db $db;
    private AuthHelper $auth;
    private EmailLogger $emailLogger;
    private MongoService $mongo;

    private array $orderStatuses = [
        'en_attente','accepte','en_preparation','en_livraison','livre','attente_retour_materiel','terminee','annulee'
    ];

    private array $avisStatuses = ['pending', 'approved', 'rejected'];

    private array $statusTransitions = [
        'en_attente' => ['accepte','annulee'],
        'accepte' => ['en_preparation','annulee'],
        'en_preparation' => ['en_livraison','annulee'],
        'en_livraison' => ['livre'],
        'livre' => ['attente_retour_materiel','terminee'],
        'attente_retour_materiel' => ['terminee'],
        'terminee' => [],
        'annulee' => []
    ];

    public function __construct(Db $db, AuthHelper $auth, EmailLogger $emailLogger, MongoService $mongo)
    {
        $this->db = $db;
        $this->auth = $auth;
        $this->emailLogger = $emailLogger;
        $this->mongo = $mongo;
    }

    private function requireRole(Request $request, array $roles): ?array
    {
        $payload = $this->auth->getPayload($request);
        if (!$payload) {
            return null;
        }
        if (!$this->auth->requireRole($payload, $roles)) {
            return ['error' => 'Forbidden', 'status' => 403];
        }
        return $payload;
    }

    // ----- Employees -----
    #[Route('/api/admin/employees', methods: ['GET'])]
    public function employees(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $rows = $this->db->fetchAll(
            "SELECT u.utilisateur_id, u.email, u.prenom, u.nom, u.telephone, u.is_active
             FROM utilisateur u
             JOIN roles r ON r.role_id=u.role_id
             WHERE r.libelle='EMPLOYE'
             ORDER BY u.created_at DESC"
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/admin/employees', methods: ['POST'])]
    public function createEmployee(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $email = strtolower(trim($body['email'] ?? ''));
        $firstName = trim($body['firstName'] ?? '');
        $lastName = trim($body['lastName'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';

        if (!$email || !$firstName || !$lastName || !$password) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }
        if (!ApiUtils::isStrongPassword($password)) {
            return new JsonResponse(['error' => 'Weak password'], 400);
        }

        $role = $this->db->fetchOne("SELECT role_id FROM roles WHERE libelle='EMPLOYE'");
        if (!$role) {
            return new JsonResponse(['error' => 'Role EMPLOYE missing'], 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);

        try {
            $row = $this->db->fetchOne(
                "INSERT INTO utilisateur (role_id, email, password_hash, prenom, nom, telephone)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 RETURNING utilisateur_id",
                [$role['role_id'], $email, $hash, $firstName, $lastName, $phone ?: null]
            );

            $this->emailLogger->log(
                $email,
                'Création de compte employé',
                "Un compte employé a été créé. Merci de contacter l'administrateur pour le mot de passe.",
                'employee_created',
                $row['utilisateur_id'] ?? null
            );

            return new JsonResponse(['ok' => true], 201);
        } catch (\Throwable $e) {
            if (str_contains($e->getMessage(), 'duplicate')) {
                return new JsonResponse(['error' => 'Email already used'], 409);
            }
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    #[Route('/api/admin/employees/{id}/disable', methods: ['PATCH'])]
    public function disableEmployee(Request $request, string $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $isActive = array_key_exists('isActive', $body) ? (bool)$body['isActive'] : false;

        $row = $this->db->fetchOne(
            "UPDATE utilisateur u
             SET is_active=$1, updated_at=NOW()
             FROM roles r
             WHERE u.role_id=r.role_id AND r.libelle='EMPLOYE' AND u.utilisateur_id=$2
             RETURNING u.utilisateur_id, u.email, u.is_active",
            [$isActive, $id]
        );

        if (!$row) {
            return new JsonResponse(['error' => 'Employee not found'], 404);
        }

        return new JsonResponse($row);
    }

    // ----- Avis -----
    #[Route('/api/admin/avis', methods: ['GET'])]
    public function listAvis(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $statut = $request->query->get('statut') ?: 'pending';
        if (!in_array($statut, $this->avisStatuses, true)) {
            return new JsonResponse(['error' => 'Invalid avis statut'], 400);
        }

        $rows = $this->db->fetchAll(
            "SELECT a.avis_id, a.note, a.commentaire, a.statut, a.created_at,
                    c.numero_commande, u.email, u.prenom, u.nom
             FROM avis a
             JOIN commande c ON c.numero_commande=a.numero_commande
             JOIN utilisateur u ON u.utilisateur_id=a.utilisateur_id
             WHERE a.statut::text = ?
             ORDER BY a.created_at DESC",
            [$statut]
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/admin/avis/{id}', methods: ['PATCH'])]
    public function updateAvis(Request $request, string $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $statut = $body['statut'] ?? '';
        $commentaire = trim($body['commentaire'] ?? '') ?: null;
        if (!in_array($statut, $this->avisStatuses, true)) {
            return new JsonResponse(['error' => 'Invalid avis statut'], 400);
        }

        $row = $this->db->fetchOne(
            "UPDATE avis
             SET statut=?, moderation_comment=?, moderated_by=?, moderated_at=NOW()
             WHERE avis_id=?
             RETURNING avis_id, statut",
            [$statut, $commentaire, $payload['id'], $id]
        );

        if (!$row) {
            return new JsonResponse(['error' => 'Avis not found'], 404);
        }

        return new JsonResponse($row);
    }

    // ----- Orders -----
    #[Route('/api/admin/orders', methods: ['GET'])]
    public function listOrders(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $statut = $request->query->get('statut');
        $q = $request->query->get('q');

        $statutParam = $statut ?: null;
        $qParam = $q ?: null;

        $rows = $this->db->fetchAll(
            "SELECT c.numero_commande, c.statut_courant AS statut, c.date_prestation, c.heure_livraison, c.prix_total,
                    u.email, u.prenom, u.nom
             FROM commande c
             JOIN utilisateur u ON u.utilisateur_id=c.utilisateur_id
             WHERE (?::text IS NULL OR c.statut_courant::text = ?)
               AND (?::text IS NULL OR c.numero_commande ILIKE '%' || ? || '%' OR u.email ILIKE '%' || ? || '%')
             ORDER BY c.created_at DESC",
            [$statutParam, $statutParam, $qParam, $qParam, $qParam]
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/admin/orders/{numero}/status', methods: ['PATCH'])]
    public function updateOrderStatus(Request $request, string $numero): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $next = $body['statut'] ?? '';
        if (!in_array($next, $this->orderStatuses, true)) {
            return new JsonResponse(['error' => 'Invalid statut'], 400);
        }

        $order = $this->db->fetchOne(
            'SELECT numero_commande, statut_courant AS statut, utilisateur_id FROM commande WHERE numero_commande=?',
            [$numero]
        );
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }

        $current = $order['statut'];
        $allowed = $this->statusTransitions[$current] ?? [];
        if (!in_array($next, $allowed, true)) {
            return new JsonResponse(['error' => "Transition interdite: {$current} -> {$next}"], 400);
        }

        $this->db->execute('UPDATE commande SET statut_courant=?, updated_at=NOW() WHERE numero_commande=?', [$next, $numero]);
        $this->db->execute(
            'INSERT INTO commande_statut_historique (numero_commande, statut, changed_by) VALUES (?, ?, ?)',
            [$numero, $next, $payload['id']]
        );

        if ($next === 'attente_retour_materiel') {
            $this->emailLogger->log('client', 'Retour matériel', 'Merci de restituer le matériel sous 10 jours.', 'material_return', $numero);
        }
        if ($next === 'terminee') {
            $this->emailLogger->log('client', 'Commande terminée', 'Votre commande est terminée. Vous pouvez laisser un avis.', 'order_done', $numero);
        }

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/orders/{numero}/cancel', methods: ['POST'])]
    public function adminCancelOrder(Request $request, string $numero): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $mode = $body['mode_contact'] ?? $body['mode'] ?? 'email';
        $motif = $body['motif'] ?? 'Annulation';

        $order = $this->db->fetchOne(
            'SELECT menu_id, statut_courant AS statut FROM commande WHERE numero_commande=?',
            [$numero]
        );
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }

        $this->db->execute(
            "UPDATE commande SET statut_courant='annulee', updated_at=NOW() WHERE numero_commande=?",
            [$numero]
        );
        $this->db->execute(
            'INSERT INTO commande_statut_historique (numero_commande, statut, changed_by) VALUES (?, ?, ?)',
            [$numero, 'annulee', $payload['id']]
        );
        $this->db->execute(
            'INSERT INTO commande_annulation (numero_commande, cancelled_by, mode, motif) VALUES (?, ?, ?, ?)',
            [$numero, $payload['id'], $mode, $motif]
        );

        $this->db->execute(
            'UPDATE menu SET stock_disponible=stock_disponible+1 WHERE menu_id=?',
            [$order['menu_id']]
        );

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/orders/{numero}/material-returned', methods: ['PATCH'])]
    public function materialReturned(Request $request, string $numero): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $order = $this->db->fetchOne('SELECT statut_courant AS statut FROM commande WHERE numero_commande=?', [$numero]);
        if (!$order) {
            return new JsonResponse(['error' => 'Order not found'], 404);
        }
        if ($order['statut'] !== 'attente_retour_materiel') {
            return new JsonResponse(['error' => 'Invalid status'], 400);
        }

        $this->db->execute(
            'UPDATE commande SET statut_courant=?, updated_at=NOW() WHERE numero_commande=?',
            ['terminee', $numero]
        );
        $this->db->execute(
            'INSERT INTO commande_statut_historique (numero_commande, statut, changed_by) VALUES (?, ?, ?)',
            [$numero, 'terminee', $payload['id']]
        );

        return new JsonResponse(['ok' => true]);
    }

    // ----- Menus admin -----
    #[Route('/api/admin/menus', methods: ['GET'])]
    public function adminMenus(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $rows = $this->db->fetchAll(
            "SELECT menu_id AS id, titre AS title, description, theme, regime,
                    nombre_personne_minimum AS \"minPersons\", prix_par_personne AS \"pricePerPerson\",
                    stock_disponible AS stock, is_active AS \"isActive\"
             FROM menu ORDER BY menu_id DESC"
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/admin/menus', methods: ['POST'])]
    public function createMenu(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $title = trim($body['title'] ?? '');
        $description = trim($body['description'] ?? '');
        $theme = trim($body['theme'] ?? '');
        $regime = trim($body['regime'] ?? '');
        $minPersons = (int)($body['minPersons'] ?? 0);
        $pricePerPerson = (float)($body['pricePerPerson'] ?? 0);
        $conditions = trim($body['conditions'] ?? '');
        $stock = $body['stock'] ?? null;
        $isActive = (bool)($body['isActive'] ?? true);
        $images = $body['images'] ?? [];

        if (!$title || !$description) {
            return new JsonResponse(['error' => 'Missing fields'], 400);
        }

        $row = $this->db->fetchOne(
            "INSERT INTO menu (titre, description, theme, regime, conditions, nombre_personne_minimum, prix_par_personne, stock_disponible, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING menu_id",
            [$title, $description, $theme ?: null, $regime ?: null, $conditions ?: null, $minPersons, $pricePerPerson, $stock, $isActive]
        );

        if ($row && is_array($images)) {
            foreach ($images as $img) {
                if (!is_array($img)) continue;
                $url = $img['url'] ?? null;
                $alt = $img['alt'] ?? null;
                if ($url) {
                    $this->db->execute('INSERT INTO menu_image (menu_id, url, alt) VALUES ($1,$2,$3)', [$row['menu_id'], $url, $alt]);
                }
            }
        }

        return new JsonResponse(['id' => $row['menu_id'] ?? null], 201);
    }

    #[Route('/api/admin/menus/{id}', methods: ['PATCH'])]
    public function updateMenu(Request $request, int $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $isActive = array_key_exists('isActive', $body) ? (bool)$body['isActive'] : null;

        $row = $this->db->fetchOne(
            'UPDATE menu SET is_active=COALESCE($1, is_active), updated_at=NOW() WHERE menu_id=$2 RETURNING menu_id',
            [$isActive, $id]
        );
        if (!$row) {
            return new JsonResponse(['error' => 'Menu not found'], 404);
        }
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/menus/{id}', methods: ['DELETE'])]
    public function deleteMenu(Request $request, int $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $row = $this->db->fetchOne('UPDATE menu SET is_active=false WHERE menu_id=$1 RETURNING menu_id', [$id]);
        if (!$row) {
            return new JsonResponse(['error' => 'Menu not found'], 404);
        }
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/menus/{id}/images', methods: ['POST'])]
    public function addMenuImage(Request $request, int $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $url = trim($body['url'] ?? '');
        $alt = trim($body['alt'] ?? '');
        if (!$url) {
            return new JsonResponse(['error' => 'Missing url'], 400);
        }

        $this->db->execute('INSERT INTO menu_image (menu_id, url, alt) VALUES ($1,$2,$3)', [$id, $url, $alt ?: null]);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/plats', methods: ['GET'])]
    public function listPlats(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $rows = $this->db->fetchAll(
            "SELECT p.plat_id, p.nom, p.type, p.description,
                    COALESCE(string_agg(a.libelle, ', '), '') AS allergenes
             FROM plat p
             LEFT JOIN plat_allergene pa ON pa.plat_id=p.plat_id
             LEFT JOIN allergene a ON a.allergene_id=pa.allergene_id
             GROUP BY p.plat_id
             ORDER BY p.plat_id DESC"
        );
        return new JsonResponse($rows);
    }

    #[Route('/api/admin/plats', methods: ['POST'])]
    public function createPlat(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $nom = trim($body['name'] ?? $body['nom'] ?? '');
        $type = trim($body['type'] ?? 'plat');
        $desc = trim($body['description'] ?? '');
        $allergenes = $body['allergenes'] ?? [];

        if (!$nom) {
            return new JsonResponse(['error' => 'Missing name'], 400);
        }

        $row = $this->db->fetchOne(
            'INSERT INTO plat (nom, type, description) VALUES ($1,$2,$3) RETURNING plat_id',
            [$nom, $type, $desc ?: null]
        );

        if ($row && is_array($allergenes)) {
            foreach ($allergenes as $lib) {
                $lib = trim($lib);
                if (!$lib) continue;
                $a = $this->db->fetchOne('INSERT INTO allergene (libelle) VALUES ($1) ON CONFLICT (libelle) DO UPDATE SET libelle=EXCLUDED.libelle RETURNING allergene_id', [$lib]);
                $this->db->execute('INSERT INTO plat_allergene (plat_id, allergene_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [$row['plat_id'], $a['allergene_id']]);
            }
        }

        return new JsonResponse(['id' => $row['plat_id'] ?? null], 201);
    }

    #[Route('/api/admin/plats/{id}', methods: ['DELETE'])]
    public function deletePlat(Request $request, int $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $this->db->execute('DELETE FROM plat WHERE plat_id=$1', [$id]);
        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/menus/{id}/plats', methods: ['PUT'])]
    public function updateMenuPlats(Request $request, int $id): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        $platIds = $body['platIds'] ?? [];

        $this->db->execute('DELETE FROM menu_plat WHERE menu_id=$1', [$id]);
        foreach ($platIds as $pid) {
            if (!is_numeric($pid)) continue;
            $this->db->execute('INSERT INTO menu_plat (menu_id, plat_id) VALUES ($1,$2)', [$id, (int)$pid]);
        }

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/horaires', methods: ['PATCH'])]
    public function updateHoraires(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $body = json_decode($request->getContent(), true) ?: [];
        if (!is_array($body)) {
            return new JsonResponse(['error' => 'Invalid payload'], 400);
        }

        foreach ($body as $row) {
            $jour = $row['jour'] ?? null;
            $open = $row['heure_ouverture'] ?? null;
            $close = $row['heure_fermeture'] ?? null;
            if (!$jour) continue;

            $exists = $this->db->fetchOne('SELECT horaire_id FROM horaire WHERE jour=$1', [$jour]);
            if ($exists) {
                $this->db->execute('UPDATE horaire SET heure_ouverture=$1, heure_fermeture=$2 WHERE jour=$3', [$open, $close, $jour]);
            } else {
                $this->db->execute('INSERT INTO horaire (jour, heure_ouverture, heure_fermeture) VALUES ($1,$2,$3)', [$jour, $open, $close]);
            }
        }

        return new JsonResponse(['ok' => true]);
    }

    #[Route('/api/admin/gallery-images', methods: ['GET'])]
    public function galleryImages(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN','EMPLOYE']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $galleryDir = dirname(__DIR__, 3) . '/assets/gallery';
        $files = [];

        if (is_dir($galleryDir)) {
            $rii = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($galleryDir));
            foreach ($rii as $file) {
                if ($file->isDir()) continue;
                if (!preg_match('/\.(webp|png|jpg|jpeg)$/i', $file->getFilename())) continue;
                $rel = str_replace($galleryDir . '/', '', $file->getPathname());
                $rel = str_replace('\\', '/', $rel);
                $files[] = $rel;
            }
        }

        sort($files);
        $out = array_map(function ($rel) {
            $name = preg_replace('/\.[^.]+$/', '', basename($rel));
            $alt = str_replace(['_', '-'], ' ', $name);
            return [
                'url' => 'assets/gallery/' . $rel,
                'alt' => $alt
            ];
        }, $files);

        return new JsonResponse($out);
    }

    #[Route('/api/admin/stats/menus', methods: ['GET'])]
    public function statsMenus(Request $request): JsonResponse
    {
        $payload = $this->requireRole($request, ['ADMIN']);
        if (!$payload || isset($payload['error'])) {
            return new JsonResponse(['error' => $payload['error'] ?? 'Unauthorized'], $payload['status'] ?? 401);
        }

        $menuId = $request->query->get('menuId');
        $from = $request->query->get('from');
        $to = $request->query->get('to');

        $mongoRows = $this->mongo->statsMenus($menuId, $from, $to);
        if ($mongoRows !== null) {
            return new JsonResponse(['source' => 'mongo', 'rows' => $mongoRows]);
        }

        $rows = $this->db->fetchAll(
            "SELECT menu_id AS \"menuId\", COUNT(*) AS count, SUM(prix_total) AS total
             FROM commande
             WHERE ($1::int IS NULL OR menu_id=$1)
               AND ($2::date IS NULL OR created_at >= $2)
               AND ($3::date IS NULL OR created_at <= $3)
             GROUP BY menu_id",
            [
                is_numeric($menuId) ? (int)$menuId : null,
                $from ?: null,
                $to ?: null
            ]
        );

        return new JsonResponse(['source' => 'postgres', 'rows' => $rows]);
    }
}
