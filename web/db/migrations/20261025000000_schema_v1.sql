-- migrate:up
-- Here! · Schéma de base de données (v1 : invitations)
-- PostgreSQL 15 ou plus (NULLS NOT DISTINCT, gen_random_uuid intégré).
-- Schéma visuel : docs/base-de-donnees.excalidraw
-- Plus tard (non inclus) : otp_codes, scan_links, checkins (voir TODO.md).


-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('organizer', 'support', 'admin');

CREATE TYPE event_type AS ENUM (
  'mariage', 'dot', 'bapteme', 'funerailles', 'anniversaire', 'brunch',
  'retrouvailles', 'reunion', 'seminaire', 'concert_prive', 'festival'
);

CREATE TYPE event_status AS ENUM ('draft', 'active', 'done', 'cancelled');

CREATE TYPE import_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TYPE rsvp_status AS ENUM ('pending', 'confirmed', 'declined');

CREATE TYPE contact_status AS ENUM ('none', 'reminded', 'call_scheduled', 'unreachable');

CREATE TYPE message_kind AS ENUM ('invitation', 'reminder');

CREATE TYPE message_status AS ENUM ('scheduled', 'sent', 'delivered', 'read', 'failed');

CREATE TYPE call_outcome AS ENUM ('confirmed', 'declined', 'no_answer', 'wrong_number');

-- Met à jour updated_at à chaque modification.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         text NOT NULL UNIQUE CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'), -- E.164 : +225…
  first_name    text NOT NULL,
  last_name     text NOT NULL,
  email         text,
  password_hash text NOT NULL,                                               -- bcrypt ou argon2
  role          user_role NOT NULL DEFAULT 'organizer',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE email IS NOT NULL;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  user_agent  text,
  ip          inet,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- ---------------------------------------------------------------------------
-- Événement
-- ---------------------------------------------------------------------------

CREATE TABLE events (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT, -- créateur
  title                      text NOT NULL,
  type                       event_type NOT NULL,
  description                text,
  starts_at                  timestamptz NOT NULL,
  duration_minutes           integer CHECK (duration_minutes > 0),
  location_name              text,
  location_address           text,
  latitude                   numeric(9, 6),
  longitude                  numeric(9, 6),
  expected_guests            integer CHECK (expected_guests >= 0),
  dress_code                 text,
  status                     event_status NOT NULL DEFAULT 'draft',
  whatsapp_reminders_enabled boolean NOT NULL DEFAULT false,
  call_reminders_enabled     boolean NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_user_id_idx ON events (user_id);

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE guest_categories (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name      text NOT NULL, -- VIP, Normal…
  UNIQUE (event_id, name),
  UNIQUE (id, event_id)    -- cible des clés composées : la catégorie appartient au même événement
);

CREATE TABLE guest_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_url        text NOT NULL,
  column_mapping  jsonb,   -- ex. {"Nom": "display_name", "Téléphone": "phone"}
  total_rows      integer NOT NULL DEFAULT 0,
  imported_rows   integer NOT NULL DEFAULT 0,
  error_rows      integer NOT NULL DEFAULT 0,
  status          import_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guest_imports_event_id_idx ON guest_imports (event_id);

-- ---------------------------------------------------------------------------
-- Cartes
-- ---------------------------------------------------------------------------

CREATE TABLE card_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,                         -- ceremonie, rendez_vous…
  name             text NOT NULL,
  default_palette  jsonb NOT NULL DEFAULT '{}',
  owner_user_id    uuid REFERENCES users (id) ON DELETE CASCADE, -- null = modèle Here! ; futur : modèle importé
  is_active        boolean NOT NULL DEFAULT true
);

CREATE TABLE event_cards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  category_id      uuid,                                          -- null = carte par défaut de l'événement
  template_id      uuid NOT NULL REFERENCES card_templates (id) ON DELETE RESTRICT,
  palette          jsonb NOT NULL DEFAULT '{}',
  invitation_text  text,
  photo_url        text,
  FOREIGN KEY (category_id, event_id) REFERENCES guest_categories (id, event_id) ON DELETE CASCADE,
  UNIQUE NULLS NOT DISTINCT (event_id, category_id)               -- une seule carte par défaut par événement
);

CREATE INDEX event_cards_template_id_idx ON event_cards (template_id);

-- ---------------------------------------------------------------------------
-- Invités
-- ---------------------------------------------------------------------------

CREATE TABLE guests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  category_id     uuid NOT NULL,
  import_id       uuid REFERENCES guest_imports (id) ON DELETE SET NULL, -- null = ajout manuel
  display_name    text NOT NULL,                                         -- « M. et Mme Konan »
  phone           text NOT NULL,                                         -- tel qu'importé, normalisé si possible
  phone_valid     boolean NOT NULL DEFAULT false,
  seats           integer NOT NULL DEFAULT 1 CHECK (seats > 0),
  rsvp_status     rsvp_status NOT NULL DEFAULT 'pending',
  responded_at    timestamptz,
  contact_status  contact_status NOT NULL DEFAULT 'none',
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (category_id, event_id) REFERENCES guest_categories (id, event_id) ON DELETE RESTRICT,
  UNIQUE (event_id, phone)
);

CREATE INDEX guests_category_id_idx ON guests (category_id);
CREATE INDEX guests_import_id_idx ON guests (import_id);
CREATE INDEX guests_event_status_idx ON guests (event_id, rsvp_status, contact_status); -- compteurs du tableau de bord

CREATE TABLE invitations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id       uuid NOT NULL UNIQUE REFERENCES guests (id) ON DELETE CASCADE, -- 1–1
  event_card_id  uuid NOT NULL REFERENCES event_cards (id) ON DELETE RESTRICT,
  token          text NOT NULL UNIQUE, -- lien de la page invité + contenu du QR code, aléatoire et long
  image_url      text,                 -- carte générée 1080 × 1350
  sent_at        timestamptz,
  opened_at      timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_event_card_id_idx ON invitations (event_card_id);

-- ---------------------------------------------------------------------------
-- Relances
-- ---------------------------------------------------------------------------

CREATE TABLE messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id             uuid NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  kind                 message_kind NOT NULL,
  provider_message_id  text UNIQUE, -- identifiant renvoyé par l'API WhatsApp
  status               message_status NOT NULL DEFAULT 'scheduled',
  scheduled_at         timestamptz NOT NULL DEFAULT now(),
  sent_at              timestamptz,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_guest_id_idx ON messages (guest_id);
CREATE INDEX messages_due_idx ON messages (scheduled_at) WHERE status = 'scheduled'; -- file d'envoi

CREATE TABLE calls (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      uuid NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  agent_id      uuid REFERENCES users (id) ON DELETE SET NULL, -- membre du support
  scheduled_at  timestamptz NOT NULL,
  called_at     timestamptz,
  outcome       call_outcome,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX calls_guest_id_idx ON calls (guest_id);
CREATE INDEX calls_agent_id_idx ON calls (agent_id);
CREATE INDEX calls_todo_idx ON calls (scheduled_at) WHERE called_at IS NULL; -- file d'appels

-- ---------------------------------------------------------------------------
-- Données de départ : les cinq modèles de cartes (uiux/visual-identity/DESIGN.md)
-- ---------------------------------------------------------------------------

INSERT INTO card_templates (code, name, default_palette) VALUES
  ('ceremonie',   'Cérémonie',   '{"background": "#F7F1E8", "accent": "#A8823C", "text": "#0B0B0B"}'),
  ('rendez_vous', 'Rendez-vous', '{"background": "#FFFFFF", "accent": "#E10600", "text": "#0B0B0B"}'),
  ('officiel',    'Officiel',    '{"background": "#FFFFFF", "accent": "#0B0B0B", "text": "#0B0B0B"}'),
  ('soiree',      'Soirée',      '{"background": "#0B0B0B", "accent": "#E10600", "text": "#FFFFFF"}'),
  ('hommage',     'Hommage',     '{"background": "#F3F1EC", "accent": "#5E5A53", "text": "#0B0B0B"}');

-- migrate:down

DROP TABLE IF EXISTS calls, messages, invitations, guests, event_cards, card_templates,
  guest_imports, guest_categories, events, sessions, users CASCADE;
DROP FUNCTION IF EXISTS set_updated_at();
DROP TYPE IF EXISTS call_outcome, message_status, message_kind, contact_status, rsvp_status,
  import_status, event_status, event_type, user_role;
