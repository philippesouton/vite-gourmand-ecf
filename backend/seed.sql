PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- Idempotent (si tu relances le seed sur une DB existante)
DELETE FROM password_resets;
DELETE FROM menus;
DELETE FROM users;

-- USERS
-- Mots de passe (à donner dans ton manuel utilisateur) :
-- ADMIN:    Admin123!
-- EMPLOYEE: Employee123!
-- USER:     User123!
-- passwordHash = bcrypt (cost 10)

INSERT INTO users (firstName, lastName, phone, email, address, passwordHash, role) VALUES
('Philippe', 'Admin',    '0600000001', 'admin@vitegourmand.test',    '1 rue Admin, 75000 Paris',     '$2a$10$IxuwMxmw7xYiFsgpz3nm8.v9sJVClfS2P5aoRErFTk53wOXmTOBLm', 'ADMIN'),
('Emma',     'Employe',  '0600000002', 'employee@vitegourmand.test', '2 rue Employe, 75000 Paris',   '$2a$10$MYWb/QDP5LyDRI0T3U5n7uUjhRsHYEH3hp5gCz2jNWSatqXkpPn5y', 'EMPLOYEE'),
('Jean',     'User',     '0600000003', 'user@vitegourmand.test',     '3 rue User, 75000 Paris',      '$2a$10$PZhbQ1LHZ4y8b6sXtx7IjeZ0EHXnYnpwXKUUSedEE1IrPbbkQOnAu', 'USER');

-- MENUS
INSERT INTO menus (title, description, theme, diet, minPersons, priceMin, isActive) VALUES
('Brunch du Dimanche', 'Viennoiseries, fruits, boissons chaudes + salé léger.', 'BRUNCH', 'OMNIVORE', 6, 12, 1),
('Végétarien Chic', 'Assortiment végétarien gourmand et de saison.', 'SOIREE', 'VEGETARIEN', 8, 15, 1),
('Vegan Festival', 'Buffet 100% vegan : bowls, wraps, desserts.', 'EVENEMENT', 'VEGAN', 10, 18, 1),
('Sans Gluten', 'Recettes garanties sans gluten.', 'FAMILLE', 'SANS_GLUTEN', 6, 16, 1),
('BBQ Convivial', 'Grillades + accompagnements + sauces maison.', 'EXTERIEUR', 'OMNIVORE', 12, 20, 1),
('Menu Test Inactif', 'Menu désactivé pour tester les filtres/états.', 'TEST', 'OMNIVORE', 4, 9, 0);

COMMIT;
