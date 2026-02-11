# Vite & Gourmand

Application web avec **front statique** (HTML/CSS/JS) + **API Symfony (PHP)**.  
Stockage principal : **PostgreSQL**.  
Stockage optionnel : **MongoDB** (stats admin, fallback Postgres si Mongo absent).

## Démarrage rapide
```bash
git clone https://github.com/philippesouton/vite-gourmand-ecf.git
cd vite-gourmand-ecf

# API Symfony
cd backend_symfony
composer install

# Config (à adapter)
cp .env .env.local
# éditer .env.local (DATABASE_URL, JWT_SECRET, MONGO_*)

# Base
psql $DATABASE_URL -f /Users/imaschool/Desktop/vite-gourmand-ecf/database/schema.sql
psql $DATABASE_URL -f /Users/imaschool/Desktop/vite-gourmand-ecf/database/seed.sql

# Lancer l’API
php -S 127.0.0.1:3001 -t public
```

## Liens publics de démonstration
- Site web : https://fabulous-kleicha-6c3d4f.netlify.app/
- API : https://vite-gourmand-api-eu-a88d7f2d4f7f.herokuapp.com
- Code source : https://github.com/philippesouton/vite-gourmand-ecf
- Gestion de projet (Notion) : https://www.notion.so/Vite-Gourmand-2fd8218cbd068046b7c4d4799e98233c?source=copy_link

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

### Versions testées
- PHP : **8.5.2**
- Composer : **2.9.5**
- PostgreSQL : **15+**
- MongoDB : **7.x** (optionnel)
- Node.js : **22.x** (optionnel, uniquement pour lancer un serveur statique)

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

### Explication des variables d’environnement
- `DATABASE_URL` : chaîne de connexion PostgreSQL (user, host, port, db)
- `JWT_SECRET` : clé secrète pour signer les tokens (obligatoire)
- `MONGO_URL` : URL MongoDB (optionnel, utilisé pour les stats)
- `MONGO_DB` : nom de la base MongoDB (optionnel)

### Créer la base PostgreSQL (exemples)
Option 1 (rapide) :
```bash
createdb vite_gourmand_clean
```

Option 2 (SQL) :
```bash
psql postgres -c "CREATE DATABASE vite_gourmand_clean;"
```

## Installation
```bash
cd backend_symfony
composer install
```

## Initialiser la base
```bash
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/seed.sql
```

## Lancer l’API
```bash
cd backend_symfony
php -S 127.0.0.1:3001 -t public
# ou: symfony server:start
```

## Lancer le front
Ouvrir `index.html` dans un navigateur ou utiliser un serveur statique (ex: `npx http-server .`).

## Structure du projet (repères rapides)
- `backend_symfony/` : API Symfony (PHP)
- `database/` : scripts SQL `schema.sql` + `seed.sql`
- `js/` : scripts front (API_BASE à mettre à jour pour la prod)
- `assets/` : images + galerie
- `docs/` : livrables ECF (manuel, charte, technique, etc.)

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
Les images sont placées dans `assets/gallery/` (sous‑dossiers autorisés).
Dans `admin-menus.html`, utiliser la galerie pour associer une ou plusieurs images au menu.

## Configuration API front (prod)
Le front utilise `API_BASE` dans les fichiers de `js/` (ex: `js/appscript.js`, `js/auth.js`, `js/order.js`, `js/user-orders.js`, `js/admin-*.js`).  
En production, remplacer `http://127.0.0.1:3001/api` par l’URL Heroku (ex: `https://<app>.herokuapp.com/api`).

## Documentation
- `docs/DEPLOYMENT.pdf` : déploiement
- `docs/SECURITE.pdf` : sécurité
- `docs/Manuel utilisateur .pdf` : manuel utilisateur
- `docs/Charte Graphique .pdf` : charte graphique
- `docs/vite_gourmand_wireframes_mockups.pdf` : maquettes desktop
- `docs/vite_gourmand_mobile_wireframes_mockups_ios_android.pdf` : maquettes mobile
- `docs/gestion de projet.pdf` : gestion de projet
- `docs/TECHNIQUE.pdf` : documentation technique (diagrammes inclus)

## Backend utilisé
La version utilisée pour l’ECF est **`backend_symfony/`**.
