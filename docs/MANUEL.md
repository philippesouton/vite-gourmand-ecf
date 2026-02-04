# Manuel utilisateur — Vite & Gourmand (ECF)

## 1. Présentation
Vite & Gourmand est une application web permettant de consulter les menus, commander un menu et gérer les commandes selon les rôles (Utilisateur, Employé, Administrateur).

## 2. Accès à l’application
- Front : ouvrir `index.html` via un serveur statique (ex. `npx http-server .`)
- API : `http://127.0.0.1:3001`

## 3. Comptes de démonstration
Ces comptes sont fournis dans le `seed.sql` :
- Admin : `admin@vite-gourmand.test` / `Admin123!`
- Employé : `employe@vite-gourmand.test` / `Admin123!`

Pour un compte Utilisateur, utilisez `register.html` et créez un compte.

## 4. Parcours Visiteur
### 4.1 Accueil
- Page : `index.html`
- Consulter la présentation de l’entreprise, les avis validés et la liste des menus.

### 4.2 Filtrer les menus
Filtres disponibles :
- Thème
- Régime
- Minimum de personnes
- Prix minimum / maximum

### 4.3 Détail d’un menu
Cliquer “Voir le détail” pour afficher :
- Galerie
- Plats et allergènes
- Conditions
- Minimum personnes et prix

### 4.4 Contact
Page : `contact.html`
Formulaire avec titre, description, email.

## 5. Parcours Utilisateur
### 5.1 Création de compte
Page : `register.html`
Champs obligatoires : nom, prénom, GSM, adresse, email, mot de passe fort.

### 5.2 Connexion
Page : `login.html`
Saisir email + mot de passe.

### 5.3 Commander un menu
Depuis la fiche menu, cliquer “Commander”.
Page : `order.html`
- Infos client pré-remplies
- Calcul automatique du prix (réduction + livraison)
- Validation et enregistrement

### 5.4 Mes commandes
Page : `user-orders.html`
- Liste des commandes
- Détail + historique
- Modification / annulation si statut `en_attente`

### 5.5 Avis
Quand la commande est “terminée”, l’utilisateur peut laisser un avis (note + commentaire).

## 6. Parcours Employé
### 6.1 Connexion
Utiliser le compte employé.

### 6.2 Gestion des commandes
Page : `admin-orders.html`
- Filtre par statut ou client
- Mise à jour des statuts
- Annulation avec mode de contact + motif
- Retour matériel

### 6.3 Gestion des menus
Page : `admin-menus.html`
- Créer/activer/désactiver un menu
- Ajouter une galerie
- Créer des plats + allergènes
- Associer plats à un menu
- Mettre à jour les horaires

### 6.4 Modération des avis
Page : `admin-dashboard.html`
Valider ou refuser les avis utilisateurs.

## 7. Parcours Administrateur
L’Administrateur peut tout faire comme un Employé + :
### 7.1 Création d’un compte employé
Page : `admin-dashboard.html`
- Saisir email, nom, prénom, téléphone, mot de passe
- Le mot de passe est communiqué à l’employé hors application

### 7.2 Désactivation d’un employé
Page : `admin-dashboard.html`
Bouton “Désactiver / Activer”.

### 7.3 Statistiques (NoSQL)
Page : `admin-dashboard.html`
- Graphique commandes par menu
- Filtre par menu et période
- Source MongoDB si disponible (sinon fallback Postgres)

## 8. Réinitialisation mot de passe
1. Page : `forgot-password.html`
2. Récupérer le lien de reset depuis les logs (stub email)
3. Page : `reset-password.html?token=...`

## 9. Notes techniques (dev)
- Les emails sont **simulés** (enregistrés dans `email_log` et affichés en console).
- MongoDB est optionnel : si non disponible, les stats utilisent Postgres.
