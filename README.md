# Vite & Gourmand

Application web avec front statique (HTML/CSS/JS) et API Node.js/Express.

- Base relationnelle : SQLite
- NoSQL : MongoDB (journalisation des commandes simulées + statistiques admin)

## Fonctionnalités
- Authentification JWT + rôles : USER / EMPLOYEE / ADMIN
- Menus : création + activation/désactivation (ADMIN/EMPLOYEE)
- Catalogue public : liste + filtres + détail
- Simulation de commande (stockée en NoSQL si MongoDB est disponible)
- Statistiques admin (agrégation NoSQL)

## Prérequis
- Node.js + npm
- sqlite3 (CLI)
- MongoDB local + mongosh

Vérifier :
```bash
node -v
npm -v
sqlite3 -version
mongosh --eval 'db.runCommand({ ping: 1 })'
