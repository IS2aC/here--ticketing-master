-- migrate:up
-- Éditeur de cartes : images SVG (ornements vectoriels, recolorables), nettoyées avant l'envoi et revérifiées
-- par l'API (routers/card_design.py).
ALTER TABLE card_design_assets DROP CONSTRAINT card_design_assets_content_type_check;
ALTER TABLE card_design_assets ADD CONSTRAINT card_design_assets_content_type_check
  CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'));

-- migrate:down
DELETE FROM card_design_assets WHERE content_type = 'image/svg+xml';
ALTER TABLE card_design_assets DROP CONSTRAINT card_design_assets_content_type_check;
ALTER TABLE card_design_assets ADD CONSTRAINT card_design_assets_content_type_check
  CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'));
