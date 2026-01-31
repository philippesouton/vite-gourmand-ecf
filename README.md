HEAD
Updated upstream
# vite-gourmand-ecf

# Vite & Gourmand

Application web avec front statique (HTML/CSS/JS) et API Node.js/Express, base SQLite, et stockage NoSQL MongoDB pour journaliser des événements de commande simulée + statistiques.

## Fonctionnalités
- Authentification JWT + rôles : USER / EMPLOYEE / ADMIN
- Menus : création + activation/désactivation (ADMIN/EMPLOYEE)
- Catalogue public : liste + filtres + détail
- Simulation de commande (stockée en NoSQL)
- Statistiques admin (agrégation NoSQL)

## Prérequis
- Node.js (LTS recommandé)
- npm
- SQLite3 (`sqlite3`)
- MongoDB (local)

Vérifier :

# Vite & Gourmand — Application web (ECF)

Application web avec authentification JWT (rôles USER / EMPLOYEE / ADMIN), gestion de menus (CRUD + activation/désactivation), affichage + filtres + détails, simulation de commande, et sécurisation front/back.

## Stack
- Front : HTML / CSS / JavaScript (vanilla)
- Back : Node.js + Express
- DB : SQLite

## Structure du dépôt (exemple)
- `backend/` : API Node/Express + fichiers SQL
- `js/`, `*.html`, `style.css` : front (pages + scripts)
- `docs/` : documentation / PDF (manuel utilisateur, charte, maquettes…)
- `sql/` : `schema.sql` + `seed.sql` 


# Installation (local)

## Prérequis
- Node.js **LTS** (idéalement >= 18)
- npm (inclus avec Node)
- SQLite3 (CLI) : `sqlite3`

Vérification :
origin/main
```bash
node -v
npm -v
sqlite3 -version
HEAD
mongosh --eval 'db.runCommand({ ping: 1 })'
 Stashed changes

 origin/main
