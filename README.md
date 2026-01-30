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
- `sql/` : `schema.sql` + `seed.sql` (recommandé pour l’ECF)

> ⚠️ Important : `node_modules/`, `database.sqlite`, `.env` ne doivent pas être versionnés.

---

# Installation (local)

## Prérequis
- Node.js **LTS** (idéalement >= 18)
- npm (inclus avec Node)
- SQLite3 (CLI) : `sqlite3`

Vérification :
```bash
node -v
npm -v
sqlite3 -version
