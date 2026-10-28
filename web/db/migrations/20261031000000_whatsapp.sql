-- migrate:up
-- Envoi WhatsApp (WasenderAPI) : invitations et relances.
-- Un message = une invitation ou une relance pour un invité : l'image de la carte (ou un texte) suivie,
-- sauf pour un hommage, d'un sondage « Oui / Non ». Les webhooks du prestataire identifient les messages
-- par leur identifiant WhatsApp (key.id), différent de l'identifiant renvoyé à l'envoi (msgId).

ALTER TYPE message_status ADD VALUE IF NOT EXISTS 'sending' BEFORE 'sent'; -- pris par le worker
ALTER TYPE message_status ADD VALUE IF NOT EXISTS 'canceled';             -- devenu inutile (l'invité a répondu)

ALTER TABLE messages
  ADD COLUMN body                     text,         -- texte envoyé (légende de la carte ou relance)
  ADD COLUMN whatsapp_id              text UNIQUE,  -- key.id du message principal, pour les statuts
  ADD COLUMN poll_provider_message_id text UNIQUE,  -- msgId du sondage
  ADD COLUMN poll_whatsapp_id         text UNIQUE,  -- key.id du sondage, pour les votes
  ADD COLUMN attempts                 integer NOT NULL DEFAULT 0,
  ADD COLUMN delivered_at             timestamptz,
  ADD COLUMN read_at                  timestamptz;

-- Messages écrits par les invités sur WhatsApp (« On sera 3 »), traités par la conseillère.
CREATE TABLE inbound_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id     uuid REFERENCES guests (id) ON DELETE CASCADE, -- null : numéro inconnu
  phone        text NOT NULL,
  body         text NOT NULL,
  whatsapp_id  text UNIQUE,
  received_at  timestamptz NOT NULL DEFAULT now(),
  handled_at   timestamptz
);

CREATE INDEX inbound_messages_guest_id_idx ON inbound_messages (guest_id);

-- migrate:down
-- Les valeurs ajoutées à message_status ne peuvent pas être retirées (PostgreSQL) : elles restent inutilisées.
DROP TABLE inbound_messages;
ALTER TABLE messages
  DROP COLUMN read_at,
  DROP COLUMN delivered_at,
  DROP COLUMN attempts,
  DROP COLUMN poll_whatsapp_id,
  DROP COLUMN poll_provider_message_id,
  DROP COLUMN whatsapp_id,
  DROP COLUMN body;
