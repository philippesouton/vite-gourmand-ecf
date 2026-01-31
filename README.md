<<<<<<< Updated upstream
# vite-gourmand-ecf
=======
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
```bash
node -v
npm -v
sqlite3 -version
mongosh --eval 'db.runCommand({ ping: 1 })'
>>>>>>> Stashed changes
