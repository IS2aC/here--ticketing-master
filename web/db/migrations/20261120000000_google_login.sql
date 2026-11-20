-- migrate:up
-- Connexion avec Google. Un compte Google peut n'avoir ni téléphone (facultatif, demandé après la
-- première connexion) ni mot de passe. Un compte sans Google garde téléphone et mot de passe obligatoires.
ALTER TABLE users
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_sub text UNIQUE, -- identifiant stable du compte Google (claim « sub »)
  ADD CONSTRAINT users_login_method CHECK (
    google_sub IS NOT NULL OR (phone IS NOT NULL AND password_hash IS NOT NULL)
  );

-- migrate:down
-- Échoue s'il existe des comptes Google sans téléphone ou sans mot de passe : à traiter à la main.
ALTER TABLE users
  DROP CONSTRAINT users_login_method,
  DROP COLUMN google_sub,
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN phone SET NOT NULL;
