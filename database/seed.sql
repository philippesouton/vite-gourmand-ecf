BEGIN;

INSERT INTO roles (libelle) VALUES ('ADMIN'),('EMPLOYE'),('USER')
ON CONFLICT (libelle) DO NOTHING;

-- Comptes de démonstration
INSERT INTO utilisateur (role_id, email, password_hash, prenom, nom, telephone, adresse)
VALUES
((SELECT role_id FROM roles WHERE libelle='ADMIN'), 'admin@vite-gourmand.test', '$2b$10$DdzqEh2HIcVyK9gw7byLGex/jgrVpJM.jd2gTrQVdQRrZDf4modVS', 'Admin', 'ECF', '0600000000', 'Bordeaux'),
((SELECT role_id FROM roles WHERE libelle='EMPLOYE'), 'employe@vite-gourmand.test', '$2b$10$DdzqEh2HIcVyK9gw7byLGex/jgrVpJM.jd2gTrQVdQRrZDf4modVS', 'Julie', 'Employe', '0600000001', 'Bordeaux')
ON CONFLICT (email) DO NOTHING;

INSERT INTO menu (titre, description, theme, regime, conditions, nombre_personne_minimum, prix_par_personne, stock_disponible, is_active)
VALUES
('Brunch du Dimanche','Viennoiseries, fruits, boissons chaudes + salé léger.','Classique','Classique','Commander 48h à l’avance.',6,12.00,20,TRUE),
('Végétarien Chic','Assortiment végétarien gourmand et de saison.','Évènement','Végétarien','Prévoir un espace frais pour le stockage.',8,15.00,15,TRUE),
('Vegan Festival','Buffet 100% vegan : bowls, wraps, desserts.','Évènement','Vegan','Préparation la veille. Livraison avant 12h.',10,18.00,12,TRUE),
('Sans Gluten','Recettes garanties sans gluten.','Classique','Sans gluten','Contamination croisée non garantie à 100%.',6,16.00,10,TRUE),
('BBQ Convivial','Grillades + accompagnements + sauces maison.','Été','Classique','Nécessite un espace extérieur.',12,20.00,8,TRUE);

INSERT INTO plat (nom, type, description) VALUES
('Salade de saison','entree','Salade fraîche, vinaigrette maison'),
('Velouté de légumes','entree','Légumes de saison mixés'),
('Lasagnes végétariennes','plat','Tomate, légumes, fromage'),
('Brochettes BBQ','plat','Bœuf et poulet marinés'),
('Bowl vegan','plat','Quinoa, légumes rôtis, tofu'),
('Tarte aux fruits','dessert','Pâte sablée et fruits frais'),
('Mousse chocolat','dessert','Chocolat noir, crème légère');

INSERT INTO allergene (libelle) VALUES
('Gluten'),('Lactose'),('Fruits à coque')
ON CONFLICT (libelle) DO NOTHING;

-- Associations menu ↔ plats
INSERT INTO menu_plat (menu_id, plat_id) VALUES
((SELECT menu_id FROM menu WHERE titre='Brunch du Dimanche'), (SELECT plat_id FROM plat WHERE nom='Salade de saison')),
((SELECT menu_id FROM menu WHERE titre='Brunch du Dimanche'), (SELECT plat_id FROM plat WHERE nom='Tarte aux fruits')),
((SELECT menu_id FROM menu WHERE titre='Végétarien Chic'), (SELECT plat_id FROM plat WHERE nom='Lasagnes végétariennes')),
((SELECT menu_id FROM menu WHERE titre='Végétarien Chic'), (SELECT plat_id FROM plat WHERE nom='Mousse chocolat')),
((SELECT menu_id FROM menu WHERE titre='Vegan Festival'), (SELECT plat_id FROM plat WHERE nom='Bowl vegan')),
((SELECT menu_id FROM menu WHERE titre='Sans Gluten'), (SELECT plat_id FROM plat WHERE nom='Velouté de légumes')),
((SELECT menu_id FROM menu WHERE titre='BBQ Convivial'), (SELECT plat_id FROM plat WHERE nom='Brochettes BBQ'))
ON CONFLICT DO NOTHING;

-- Allergènes
INSERT INTO plat_allergene (plat_id, allergene_id) VALUES
((SELECT plat_id FROM plat WHERE nom='Lasagnes végétariennes'), (SELECT allergene_id FROM allergene WHERE libelle='Gluten')),
((SELECT plat_id FROM plat WHERE nom='Lasagnes végétariennes'), (SELECT allergene_id FROM allergene WHERE libelle='Lactose')),
((SELECT plat_id FROM plat WHERE nom='Tarte aux fruits'), (SELECT allergene_id FROM allergene WHERE libelle='Gluten')),
((SELECT plat_id FROM plat WHERE nom='Mousse chocolat'), (SELECT allergene_id FROM allergene WHERE libelle='Lactose'))
ON CONFLICT DO NOTHING;

-- Galerie (URLs statiques)
INSERT INTO menu_image (menu_id, url, alt)
SELECT m.menu_id, 'assets/gallery/brunch.webp', 'Brunch'
FROM menu m
WHERE m.titre='Brunch du Dimanche'
  AND NOT EXISTS (SELECT 1 FROM menu_image mi WHERE mi.menu_id=m.menu_id AND mi.url='assets/gallery/brunch.webp');

INSERT INTO menu_image (menu_id, url, alt)
SELECT m.menu_id, 'assets/gallery/menuvege.webp', 'Menu végétarien'
FROM menu m
WHERE m.titre='Végétarien Chic'
  AND NOT EXISTS (SELECT 1 FROM menu_image mi WHERE mi.menu_id=m.menu_id AND mi.url='assets/gallery/menuvege.webp');

INSERT INTO menu_image (menu_id, url, alt)
SELECT m.menu_id, 'assets/gallery/barbecue.webp', 'BBQ'
FROM menu m
WHERE m.titre='BBQ Convivial'
  AND NOT EXISTS (SELECT 1 FROM menu_image mi WHERE mi.menu_id=m.menu_id AND mi.url='assets/gallery/barbecue.webp');

INSERT INTO menu_image (menu_id, url, alt)
SELECT m.menu_id, 'assets/gallery/dessert.webp', 'Vegan festival'
FROM menu m
WHERE m.titre='Vegan Festival'
  AND NOT EXISTS (SELECT 1 FROM menu_image mi WHERE mi.menu_id=m.menu_id AND mi.url='assets/gallery/dessert.webp');

INSERT INTO menu_image (menu_id, url, alt)
SELECT m.menu_id, 'assets/gallery/sansgluten.webp', 'Sans gluten'
FROM menu m
WHERE m.titre='Sans Gluten'
  AND NOT EXISTS (SELECT 1 FROM menu_image mi WHERE mi.menu_id=m.menu_id AND mi.url='assets/gallery/sansgluten.webp');

-- Horaires
INSERT INTO horaire (jour, heure_ouverture, heure_fermeture) VALUES
('Lundi','08:00','20:00'),
('Mardi','08:00','20:00'),
('Mercredi','08:00','20:00'),
('Jeudi','08:00','20:00'),
('Vendredi','08:00','20:00'),
('Samedi','08:00','20:00'),
('Dimanche','08:00','20:00')
ON CONFLICT (jour) DO NOTHING;

COMMIT;
