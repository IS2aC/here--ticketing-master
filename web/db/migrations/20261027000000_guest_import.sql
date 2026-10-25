-- migrate:up
-- Import de la liste d'invités : nom / prénoms / numéro (facultatif) / catégorie (facultatif) / position (table).

ALTER TABLE guests
  ADD COLUMN last_name   text,
  ADD COLUMN first_names text,
  ADD COLUMN seat        text,                -- « position » du fichier : table ou place
  ALTER COLUMN phone DROP NOT NULL;           -- numéro facultatif (plusieurs invités sans numéro possibles)

-- Lignes lues dans le fichier, gardées le temps que l'organisateur vérifie l'aperçu et confirme.
-- Le fichier lui-même n'est pas conservé.
ALTER TABLE guest_imports
  ADD COLUMN rows jsonb NOT NULL DEFAULT '[]',
  ALTER COLUMN file_url DROP NOT NULL;

-- migrate:down
ALTER TABLE guest_imports
  ALTER COLUMN file_url SET NOT NULL,
  DROP COLUMN rows;

DELETE FROM guests WHERE phone IS NULL;
ALTER TABLE guests
  ALTER COLUMN phone SET NOT NULL,
  DROP COLUMN seat,
  DROP COLUMN first_names,
  DROP COLUMN last_name;
