

## Pré-requis
- Node.js (LTS)
- PostgreSQL
- (Optionnel) MongoDB

## Étapes générales
1. Créer la base PostgreSQL.
2. Renseigner les variables d’environnement.
3. Installer les dépendances backend.
4. Initialiser la base (`schema.sql` + `seed.sql`).
5. Lancer l’API.
6. Déployer le front statique.

## Exemple local
```bash
cd backend
npm install
psql $DATABASE_URL -f schema.sql
psql $DATABASE_URL -f seed.sql
npm run dev
```

Le front peut être servi via un serveur statique (ex: `npx http-server .`).
