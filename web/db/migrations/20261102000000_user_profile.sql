-- migrate:up
-- Vue « Mon profil » : informations du client, utiles au support et à la facturation (toutes facultatives).
ALTER TABLE users
  ADD COLUMN organization    text,   -- entreprise, association ou famille
  ADD COLUMN city            text,
  ADD COLUMN country         text,
  ADD COLUMN billing_address text,
  ADD COLUMN tax_id          text;   -- numéro d'identification fiscale (entreprise)

-- migrate:down
ALTER TABLE users
  DROP COLUMN tax_id,
  DROP COLUMN billing_address,
  DROP COLUMN country,
  DROP COLUMN city,
  DROP COLUMN organization;
