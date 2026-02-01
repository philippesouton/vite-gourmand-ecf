# Vite & Gourmand

Application web avec **front statique** (HTML/CSS/JS) + **API Node.js/Express**.  
Stockage principal : **SQLite**.  
Stockage optionnel : **MongoDB** (journalisation des commandes simulées + stats admin).

## Fonctionnalités
- Authentification **JWT** + rôles : `USER` / `EMPLOYEE` / `ADMIN`
- Menus :
  - catalogue public (liste + filtres + détail)
  - création + activation/désactivation (ADMIN/EMPLOYEE)
- Simulation de commande (stockée en MongoDB si disponible)
- Statistiques admin (agrégations MongoDB si disponible)

---

## Prérequis
- **Node.js** (LTS recommandé) + **npm**
- **SQLite3 CLI** (`sqlite3`)
- (Optionnel) **MongoDB** + **mongosh**

Vérifier :
```bash
node -v
npm -v
sqlite3 -version
# optionnel
mongosh --eval 'db.runCommand({ ping: 1 })'
