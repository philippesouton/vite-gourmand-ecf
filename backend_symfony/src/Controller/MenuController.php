<?php

namespace App\Controller;

use App\Service\Db;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class MenuController
{
    private Db $db;

    public function __construct(Db $db)
    {
        $this->db = $db;
    }

    #[Route('/api/menus', methods: ['GET'])]
    public function list(Request $request): JsonResponse
    {
        $theme = $request->query->get('theme');
        $regime = $request->query->get('regime');
        $minPersons = $request->query->get('minPersons');
        $priceMin = $request->query->get('priceMin');
        $priceMax = $request->query->get('priceMax');

        $rows = $this->db->fetchAll(
            "SELECT menu_id AS id, titre AS title, description, theme, regime, conditions,
                    nombre_personne_minimum AS \"minPersons\",
                    prix_par_personne AS \"pricePerPerson\",
                    stock_disponible AS stock,
                    (prix_par_personne * nombre_personne_minimum) AS \"priceMin\",
                    COALESCE(
                      (SELECT json_agg(json_build_object('url', mi.url, 'alt', mi.alt) ORDER BY mi.menu_image_id)
                       FROM menu_image mi
                       WHERE mi.menu_id=menu.menu_id),
                      '[]'::json
                    ) AS images
             FROM menu
             WHERE is_active=true
               AND ($1::text IS NULL OR theme=$1)
               AND ($2::text IS NULL OR regime=$2)
               AND ($3::int IS NULL OR nombre_personne_minimum >= $3)
               AND ($4::numeric IS NULL OR (prix_par_personne * nombre_personne_minimum) >= $4)
               AND ($5::numeric IS NULL OR (prix_par_personne * nombre_personne_minimum) <= $5)
             ORDER BY menu_id DESC",
            [
                $theme ?: null,
                $regime ?: null,
                is_numeric($minPersons) ? (int)$minPersons : null,
                is_numeric($priceMin) ? (float)$priceMin : null,
                is_numeric($priceMax) ? (float)$priceMax : null,
            ]
        );

        return new JsonResponse($rows);
    }

    #[Route('/api/menus/{id}', methods: ['GET'])]
    public function detail(int $id): JsonResponse
    {
        $idQuoted = $this->db->quote((string)$id);
        $menu = $this->db->fetchOne(
            "SELECT menu_id AS id, titre AS title, description, theme, regime, conditions,
                    nombre_personne_minimum AS \"minPersons\",
                    prix_par_personne AS \"pricePerPerson\",
                    stock_disponible AS stock,
                    (prix_par_personne * nombre_personne_minimum) AS \"priceMin\"
             FROM menu WHERE menu_id=$idQuoted"
        );

        if (!$menu) {
            return new JsonResponse(['error' => 'Menu not found'], 404);
        }

        $images = $this->db->fetchAll(
            "SELECT menu_image_id AS id, url, alt FROM menu_image WHERE menu_id=$idQuoted ORDER BY menu_image_id"
        );

        $rows = $this->db->fetchAll(
            "SELECT p.plat_id, p.nom, p.type, p.description, a.allergene_id, a.libelle
             FROM plat p
             JOIN menu_plat mp ON mp.plat_id=p.plat_id
             LEFT JOIN plat_allergene pa ON pa.plat_id=p.plat_id
             LEFT JOIN allergene a ON a.allergene_id=pa.allergene_id
             WHERE mp.menu_id=$idQuoted
             ORDER BY p.type, p.nom"
        );

        $plats = [];
        foreach ($rows as $row) {
            $pid = $row['plat_id'];
            if (!isset($plats[$pid])) {
                $plats[$pid] = [
                    'plat_id' => $row['plat_id'],
                    'nom' => $row['nom'],
                    'type' => $row['type'],
                    'description' => $row['description'],
                    'allergenes' => []
                ];
            }
            if (!empty($row['allergene_id'])) {
                $plats[$pid]['allergenes'][] = [
                    'allergene_id' => $row['allergene_id'],
                    'libelle' => $row['libelle']
                ];
            }
        }

        return new JsonResponse([
            'menu' => $menu,
            'images' => $images,
            'plats' => array_values($plats)
        ]);
    }
}
