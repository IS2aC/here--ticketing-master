-- migrate:up
-- Sécurité de la connexion.

-- Tentatives de connexion (et de « mot de passe actuel ») : limite par compte et par adresse IP.
-- identifier : téléphone E.164 ou e-mail en minuscules, tel que saisi. Gardées 24 h.
CREATE TABLE login_attempts (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier  text NOT NULL,
  ip          inet,
  succeeded   boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_identifier_idx ON login_attempts (identifier, created_at);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, created_at);

-- Codes à usage unique envoyés par WhatsApp (mot de passe oublié ; plus tard : vérification à l'inscription).
CREATE TYPE otp_purpose AS ENUM ('password_reset');
CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose     otp_purpose NOT NULL,
  code_hash   text NOT NULL,        -- empreinte du code, jamais le code en clair
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_user_idx ON otp_codes (user_id, purpose, created_at);

-- migrate:down
DROP TABLE otp_codes;
DROP TYPE otp_purpose;
DROP TABLE login_attempts;
