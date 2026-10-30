-- migrate:up
-- « Mon propre modèle » : fond importé par l'organisateur (recadré en 1080 × 1350, JPEG) et mise en page
-- (nom de l'invité, table / catégorie, position du QR code). Mise en page NULL : carte automatique.
ALTER TABLE event_cards ADD COLUMN layout jsonb;

CREATE TABLE card_backgrounds (
  event_card_id  uuid PRIMARY KEY REFERENCES event_cards (id) ON DELETE CASCADE,
  content        bytea NOT NULL,       -- JPEG 1080 × 1350
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE card_backgrounds;
ALTER TABLE event_cards DROP COLUMN layout;
