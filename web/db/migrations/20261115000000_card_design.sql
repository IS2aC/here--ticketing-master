-- migrate:up
-- Éditeur de cartes (Creative Engine) : document de l'éditeur (JSON, schéma du moteur) et ses images.
-- Le décor exporté par l'éditeur devient le fond de « Mon propre modèle » (card_backgrounds) : Satori y ajoute
-- le nom de l'invité, la table et le QR code. Le document sert seulement à reprendre l'édition.
-- Numérotée après 20261113 : cette version est déjà enregistrée en production par l'ancien éditeur, et dbmate
-- sauterait une migration de même numéro. IF NOT EXISTS : sans effet sur une base qui a déjà ces tables.
CREATE TABLE IF NOT EXISTS card_designs (
  event_card_id  uuid PRIMARY KEY REFERENCES event_cards (id) ON DELETE CASCADE,
  document_id    uuid NOT NULL,          -- identifiant du document dans le moteur
  document       jsonb NOT NULL,
  revision       integer NOT NULL CHECK (revision > 0),  -- concurrence optimiste (autre onglet, autre appareil)
  saved_at       timestamptz NOT NULL DEFAULT now()
);

-- Images du document, par empreinte de leur contenu (« sha256-<hex> »), la clé que le moteur enregistre.
CREATE TABLE IF NOT EXISTS card_design_assets (
  event_card_id  uuid NOT NULL REFERENCES event_cards (id) ON DELETE CASCADE,
  key            text NOT NULL CHECK (key ~ '^sha256-[0-9a-f]{64}$'),
  content_type   text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  content        bytea NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_card_id, key)
);

-- migrate:down
DROP TABLE IF EXISTS card_design_assets;
DROP TABLE IF EXISTS card_designs;
