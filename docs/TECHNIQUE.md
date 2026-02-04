# Documentation technique — Vite & Gourmand (ECF)

## 1. Réflexions initiales (choix technologiques)
- **Front** : HTML/CSS/JS (Bootstrap) pour simplicité et rapidité.
- **Back** : Node.js + Express pour API REST claire.
- **BD relationnelle** : PostgreSQL (transactions, intégrité).
- **BD NoSQL** : MongoDB (stats commandes par menu).
- **Auth** : JWT + bcrypt.

## 2. Configuration de l’environnement
Pré-requis :
- Node.js (LTS), npm
- PostgreSQL
- (Optionnel) MongoDB

Variables d’environnement (`backend/.env`) :
```
PORT=3001
DATABASE_URL=postgres://USER@localhost:5432/vite_gourmand_clean
JWT_SECRET=une_phrase_secrete
MONGO_URL=mongodb://localhost:27017
MONGO_DB=vite_gourmand
```

## 3. Modèle conceptuel de données (MCD)

```mermaid
erDiagram
  UTILISATEUR ||--o{ COMMANDE : passe
  UTILISATEUR ||--o{ AVIS : ecrit
  ROLE ||--o{ UTILISATEUR : attribue
  MENU ||--o{ COMMANDE : concerne
  MENU ||--o{ MENU_IMAGE : contient
  MENU ||--o{ MENU_PLAT : associe
  PLAT ||--o{ MENU_PLAT : associe
  PLAT ||--o{ PLAT_ALLERGENE : associe
  ALLERGENE ||--o{ PLAT_ALLERGENE : associe

  UTILISATEUR {
    BIGINT utilisateur_id PK
    TEXT email
    TEXT password_hash
    TEXT prenom
    TEXT nom
  }
  MENU {
    BIGINT menu_id PK
    TEXT titre
    TEXT description
    TEXT theme
    TEXT regime
  }
  COMMANDE {
    TEXT numero_commande PK
    DATE date_prestation
    NUMERIC prix_total
    commande_statut statut_courant
  }
```

## 4. Diagramme d’utilisation (Use Case)

```mermaid
flowchart TD
  U[Utilisateur] -->|Consulter menus| M[Menus]
  U -->|Commander| C[Commande]
  U -->|Donner un avis| A[Avis]

  E[Employé] -->|Gérer commandes| GC[Workflow commandes]
  E -->|Gérer menus| GM[Menus]
  E -->|Modérer avis| MA[Modération avis]

  AD[Admin] -->|Créer employé| CE[Employés]
  AD -->|Stats| ST[Statistiques]
  AD -->|Tout employé| E
```

## 5. Diagramme de séquence (commande)

```mermaid
sequenceDiagram
  participant U as Utilisateur
  participant F as Front
  participant API as API Express
  participant DB as PostgreSQL

  U->>F: Remplit formulaire commande
  F->>API: POST /api/orders
  API->>DB: INSERT commande + historique
  DB-->>API: OK
  API-->>F: Confirmation
  F-->>U: Message "Commande enregistrée"
```

## 6. Déploiement
Voir `docs/DEPLOYMENT.md` pour le détail.

## 7. Sécurité
Voir `docs/SECURITE.md`.
