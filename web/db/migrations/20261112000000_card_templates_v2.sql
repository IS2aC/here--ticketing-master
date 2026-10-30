-- migrate:up
-- Modèles de cartes par type d'événement : le catalogue (géré par l'équipe Here!) décrit chaque modèle en JSON
-- (formats, thème, champs, calques) ; la carte de l'organisateur garde les champs remplis et ses réglages.
-- Les cinq familles d'origine restent des modèles « classiques » : definition NULL, rendu dans lib/card/render.tsx.

CREATE TYPE card_style AS ENUM ('luxe_gold', 'boho', 'minimal', 'wax_afro', 'floral');
CREATE TYPE card_format AS ENUM ('whatsapp_4_5', 'story_9_16', 'square_1_1', 'print_a5');
CREATE TYPE card_status AS ENUM ('draft', 'final');

ALTER TABLE card_templates
  ADD COLUMN event_types  event_type[] NOT NULL DEFAULT '{}',   -- vide : proposé pour tous les types
  ADD COLUMN style        card_style,
  ADD COLUMN definition   jsonb,                                -- NULL : modèle classique
  ADD COLUMN created_at   timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at   timestamptz NOT NULL DEFAULT now();

CREATE INDEX card_templates_event_types_idx ON card_templates USING gin (event_types);

ALTER TABLE event_cards
  ADD COLUMN field_values     jsonb NOT NULL DEFAULT '{}',           -- champs du modèle remplis par l'organisateur
  ADD COLUMN theme_overrides  jsonb NOT NULL DEFAULT '{}',           -- palette, polices, ornements masqués
  ADD COLUMN format           card_format NOT NULL DEFAULT 'whatsapp_4_5',
  ADD COLUMN status           card_status NOT NULL DEFAULT 'draft',
  ADD COLUMN created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at       timestamptz NOT NULL DEFAULT now();

-- Les cartes déjà envoyées aux invités sont définitives.
UPDATE event_cards c SET status = 'final'
WHERE EXISTS (
  SELECT 1 FROM messages m JOIN guests g ON g.id = m.guest_id
  WHERE g.event_id = c.event_id AND m.kind = 'invitation'
    AND m.status IN ('scheduled', 'sending', 'sent', 'delivered', 'read')
);

-- Images des cartes : fond et ornements d'un modèle, ou photo ajoutée par l'organisateur à sa carte.
-- Le JSON du modèle les désigne par leur clé (« fond », « ornement-haut », « photo »…).
CREATE TABLE card_assets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid REFERENCES card_templates (id) ON DELETE CASCADE,
  event_card_id  uuid REFERENCES event_cards (id) ON DELETE CASCADE,
  key            text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  content_type   text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml')),
  content        bytea NOT NULL,
  width          integer CHECK (width > 0),     -- NULL pour un SVG
  height         integer CHECK (height > 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(template_id, event_card_id) = 1),
  UNIQUE NULLS NOT DISTINCT (template_id, event_card_id, key)
);

CREATE INDEX card_assets_event_card_id_idx ON card_assets (event_card_id);

-- migrate:down
DROP TABLE card_assets;
ALTER TABLE event_cards
  DROP COLUMN updated_at, DROP COLUMN created_at, DROP COLUMN status, DROP COLUMN format,
  DROP COLUMN theme_overrides, DROP COLUMN field_values;
DROP INDEX card_templates_event_types_idx;
ALTER TABLE card_templates
  DROP COLUMN updated_at, DROP COLUMN created_at, DROP COLUMN definition, DROP COLUMN style,
  DROP COLUMN event_types;
DROP TYPE card_status;
DROP TYPE card_format;
DROP TYPE card_style;
