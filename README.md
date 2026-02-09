# Vite & Gourmand

Application web avec **front statique** (HTML/CSS/JS) + **API Symfony (PHP)**.  
Stockage principal : **PostgreSQL**.  
Stockage optionnel : **MongoDB** (stats admin, fallback Postgres si Mongo absent).

## Fonctionnalités
- Authentification **JWT** + rôles : `USER` / `EMPLOYE` / `ADMIN`
- Menus complets :
  - catalogue public (liste + filtres + détail)
  - CRUD + plats + galerie + allergènes (ADMIN/EMPLOYE)
- Commandes + devis + suivi + annulation/modif
- Avis clients + modération
- Statistiques admin (MongoDB si disponible, fallback Postgres)
- Contact + emails **stub** (enregistrés en base + console)

---

## Prérequis
- **PHP 8.2+** + **Composer**
- **PostgreSQL** (psql)
- (Optionnel) **MongoDB** + **mongosh**
- (Optionnel) extension PHP MongoDB : `pecl install mongodb`

Vérifier :
```bash
php -v
composer --version
psql --version
# optionnel
mongosh --eval 'db.runCommand({ ping: 1 })'
```

---

## Configuration
Créer une base PostgreSQL puis renseigner `backend_symfony/.env.local` :
```
DATABASE_URL=postgres://USER@localhost:5432/vite_gourmand_clean
JWT_SECRET=une_phrase_secrete
MONGO_URL=mongodb://localhost:27017
MONGO_DB=vite_gourmand_clean
```

## Installation
```bash
cd backend_symfony
composer install
```

## Initialiser la base
```bash
psql $DATABASE_URL -f backend/schema.sql
psql $DATABASE_URL -f backend/seed.sql
```

## Lancer l’API
```bash
cd backend_symfony
php -S 127.0.0.1:3001 -t public
# ou: symfony server:start
```

## Lancer le front
Ouvrir `index.html` dans un navigateur ou utiliser un serveur statique (ex: `npx http-server .`).

## Comptes de démo (seed)
- Admin : `admin@vite-gourmand.test` / `Admin123!`
- Employé : `employe@vite-gourmand.test` / `Admin123!`

---

## Pages principales
- `index.html` : accueil, menus, avis
- `login.html` / `register.html` : connexion / création de compte
- `forgot-password.html` / `reset-password.html` : reset mot de passe (email stub)
- `order.html` : commander un menu
- `user-orders.html` : espace utilisateur
- `contact.html` : formulaire de contact
- `admin-dashboard.html` : stats, modération, employés
- `admin-orders.html` : gestion des commandes
- `admin-menus.html` : gestion menus/plats/horaires + galerie
- `admin-profile.html` : profil admin/employé

## Galerie d’images (menus)
Les images doivent être placées dans `assets/gallery/` (sous‑dossiers autorisés).
Dans `admin-menus.html`, cocher les images souhaitées pour un menu.

## Documentation 
- `docs/DEPLOYMENT.md` : déploiement
- `docs/SECURITE.md` : sécurité
- `docs/MANUEL.html` : manuel utilisateur 
- `docs/CHARTE_GRAPHIQUE.html` : charte graphique 
- `docs/MAQUETTES.html` : maquettes (wireframes + mockups)
- `docs/GESTION_PROJET.md` : gestion de projet
- `docs/TECHNIQUE.md` : documentation technique (diagrammes inclus)

## Backend legacy (Node/Express)
Le dossier `backend/` contient l’ancien backend Express conservé en archive technique.  
La version utilisée pour l’ECF est **`backend_symfony/`**.
