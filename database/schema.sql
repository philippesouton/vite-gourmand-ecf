BEGIN;

-- Enums
DO $$ BEGIN
  CREATE TYPE commande_statut AS ENUM (
    'en_attente',
    'accepte',
    'en_preparation',
    'en_livraison',
    'livre',
    'attente_retour_materiel',
    'terminee',
    'annulee'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mode_contact AS ENUM ('gsm','email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE avis_statut AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS utilisateur (
  utilisateur_id BIGSERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES roles(role_id),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT,
  adresse TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu (
  menu_id BIGSERIAL PRIMARY KEY,
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  theme TEXT,
  regime TEXT,
  conditions TEXT,
  nombre_personne_minimum INT NOT NULL CHECK (nombre_personne_minimum > 0),
  prix_par_personne NUMERIC(10,2) NOT NULL CHECK (prix_par_personne >= 0),
  stock_disponible INT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE menu ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS regime TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS conditions TEXT;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS stock_disponible INT;

CREATE TABLE IF NOT EXISTS menu_image (
  menu_image_id BIGSERIAL PRIMARY KEY,
  menu_id BIGINT NOT NULL REFERENCES menu(menu_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT
);

CREATE TABLE IF NOT EXISTS plat (
  plat_id BIGSERIAL PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entree','plat','dessert')),
  description TEXT
);

CREATE TABLE IF NOT EXISTS allergene (
  allergene_id BIGSERIAL PRIMARY KEY,
  libelle TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS menu_plat (
  menu_id BIGINT NOT NULL REFERENCES menu(menu_id) ON DELETE CASCADE,
  plat_id BIGINT NOT NULL REFERENCES plat(plat_id) ON DELETE CASCADE,
  PRIMARY KEY (menu_id, plat_id)
);

CREATE TABLE IF NOT EXISTS plat_allergene (
  plat_id BIGINT NOT NULL REFERENCES plat(plat_id) ON DELETE CASCADE,
  allergene_id BIGINT NOT NULL REFERENCES allergene(allergene_id) ON DELETE CASCADE,
  PRIMARY KEY (plat_id, allergene_id)
);

CREATE TABLE IF NOT EXISTS horaire (
  horaire_id BIGSERIAL PRIMARY KEY,
  jour TEXT NOT NULL UNIQUE,
  heure_ouverture TIME,
  heure_fermeture TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_log (
  email_id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  related_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande (
  numero_commande TEXT PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(utilisateur_id),
  menu_id BIGINT NOT NULL REFERENCES menu(menu_id),

  -- snapshot client
  client_prenom TEXT NOT NULL,
  client_nom TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_telephone TEXT,

  -- prestation
  adresse_prestation TEXT NOT NULL,
  ville_prestation TEXT NOT NULL,
  code_postal_prestation TEXT,
  date_prestation DATE NOT NULL,
  heure_livraison TIME,

  -- quantités + pricing
  nombre_personnes INT NOT NULL CHECK (nombre_personnes > 0),
  prix_par_personne_applique NUMERIC(10,2) NOT NULL,
  prix_menu_brut NUMERIC(10,2) NOT NULL,
  reduction_pourcent NUMERIC(10,2) NOT NULL DEFAULT 0,
  reduction_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_menu_net NUMERIC(10,2) NOT NULL,

  livraison_distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_livraison NUMERIC(10,2) NOT NULL DEFAULT 0,
  prix_total NUMERIC(10,2) NOT NULL,

  -- matériel
  materiel_pret BOOLEAN NOT NULL DEFAULT FALSE,
  materiel_restitue BOOLEAN NOT NULL DEFAULT FALSE,
  materiel_deadline DATE,
  materiel_penalite_eur NUMERIC(10,2) NOT NULL DEFAULT 600,
  materiel_penalite_appliquee BOOLEAN NOT NULL DEFAULT FALSE,

  statut_courant commande_statut NOT NULL DEFAULT 'en_attente',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_statut_historique (
  id BIGSERIAL PRIMARY KEY,
  numero_commande TEXT NOT NULL REFERENCES commande(numero_commande) ON DELETE CASCADE,
  statut commande_statut NOT NULL,
  changed_by BIGINT REFERENCES utilisateur(utilisateur_id),
  commentaire TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commande_annulation (
  id BIGSERIAL PRIMARY KEY,
  numero_commande TEXT NOT NULL REFERENCES commande(numero_commande) ON DELETE CASCADE,
  cancelled_by BIGINT REFERENCES utilisateur(utilisateur_id),
  mode mode_contact NOT NULL,
  motif TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Avis (modération)
CREATE TABLE IF NOT EXISTS avis (
  avis_id BIGSERIAL PRIMARY KEY,
  numero_commande TEXT NOT NULL UNIQUE REFERENCES commande(numero_commande) ON DELETE CASCADE,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(utilisateur_id) ON DELETE CASCADE,
  note SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire TEXT,
  statut avis_statut NOT NULL DEFAULT 'pending',
  moderation_comment TEXT,
  moderated_by BIGINT REFERENCES utilisateur(utilisateur_id),
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avis_statut ON avis(statut);

-- Contact (trace)
CREATE TABLE IF NOT EXISTS contact_message (
  contact_id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  statut TEXT NOT NULL DEFAULT 'sent'
);

-- Password reset / invitation
CREATE TABLE IF NOT EXISTS password_reset (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateur(utilisateur_id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'reset',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
