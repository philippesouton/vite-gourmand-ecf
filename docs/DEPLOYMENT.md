

## Pré-requis
- PHP 8.2+ + Composer
- PostgreSQL
- (Optionnel) MongoDB

## Étapes générales
1. Créer la base PostgreSQL.
2. Renseigner les variables d’environnement.
3. Installer les dépendances backend (Symfony).
4. Initialiser la base (`schema.sql` + `seed.sql`).
5. Lancer l’API.
6. Déployer le front statique.

## Exemple local
```bash
cd backend_symfony
composer install

# Base de données
psql $DATABASE_URL -f /Users/imaschool/Desktop/vite-gourmand-ecf/database/schema.sql
psql $DATABASE_URL -f /Users/imaschool/Desktop/vite-gourmand-ecf/database/seed.sql

# Lancer l’API
php -S 127.0.0.1:3001 -t public
```

Le front peut être servi via un serveur statique (ex: `npx http-server .`).

## Déploiement (résumé)
- API : Heroku (PHP) avec `backend_symfony/` comme app.
- Front : Netlify (site statique).
- Base : Heroku Postgres (DATABASE_URL).
