-- migrate:up
-- Thème et code couleur de l'événement (création et modification), repris par la génération de la carte.
-- Le dress code a désormais une valeur par défaut : « Dress code Libre ».
ALTER TABLE events
  ADD COLUMN theme  text,
  ADD COLUMN colors text[] NOT NULL DEFAULT '{}' CHECK (cardinality(colors) <= 3);

UPDATE events SET dress_code = 'Dress code Libre' WHERE dress_code IS NULL OR btrim(dress_code) = '';
ALTER TABLE events
  ALTER COLUMN dress_code SET DEFAULT 'Dress code Libre',
  ALTER COLUMN dress_code SET NOT NULL;

-- migrate:down
ALTER TABLE events ALTER COLUMN dress_code DROP NOT NULL, ALTER COLUMN dress_code DROP DEFAULT;
UPDATE events SET dress_code = NULL WHERE dress_code = 'Dress code Libre';
ALTER TABLE events DROP COLUMN colors, DROP COLUMN theme;
