-- migrate:up
-- La relance standard (7 jours avant l'événement) est offerte : active par défaut sur chaque événement.
ALTER TABLE events ALTER COLUMN whatsapp_reminders_enabled SET DEFAULT true;
UPDATE events SET whatsapp_reminders_enabled = true WHERE status = 'draft';

-- migrate:down
ALTER TABLE events ALTER COLUMN whatsapp_reminders_enabled SET DEFAULT false;
