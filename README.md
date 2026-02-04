# Vite & Gourmand

Application web avec **front statique** (HTML/CSS/JS) + **API Node.js/Express**.  
Stockage principal : **PostgreSQL**.  
Stockage optionnel : **MongoDB** (stats admin).

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
- **Node.js** (LTS recommandé) + **npm**
- **PostgreSQL** (psql)
- (Optionnel) **MongoDB** + **mongosh**

Vérifier :
```bash
node -v
npm -v
psql --version
# optionnel
mongosh --eval 'db.runCommand({ ping: 1 })'
```

---

## Configuration
Créer une base PostgreSQL puis renseigner `backend/.env` :
```
PORT=3001
DATABASE_URL=postgres://USER@localhost:5432/vite_gourmand_clean
JWT_SECRET=une_phrase_secrete
MONGO_URL=mongodb://localhost:27017
MONGO_DB=vite_gourmand
```

## Installation
```bash
cd backend
npm install
```

## Initialiser la base
```bash
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f seed.sql
```

## Lancer l’API
```bash
cd backend
npm run dev
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

## Documentation (ECF)
- `docs/DEPLOYMENT.md` : déploiement
- `docs/SECURITE.md` : sécurité
- `docs/MANUEL.html` : manuel utilisateur 
- `docs/CHARTE_GRAPHIQUE.html` : charte graphique 
- `docs/MAQUETTES.html` : maquettes (wireframes + mockups)
- `docs/GESTION_PROJET.md` : gestion de projet (lien Notion
- `docs/TECHNIQUE.md` : documentation technique (diagrammes inclus)
