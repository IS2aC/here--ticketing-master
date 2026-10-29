-- migrate:up
-- Dates de relance choisies par l'organisateur, pour son événement.
-- NULL : calendrier proposé (WHATSAPP_REMINDER_DAYS_BEFORE, 7 jours avant), qui suit la date de l'événement.
ALTER TABLE events ADD COLUMN reminder_dates date[];

-- migrate:down
ALTER TABLE events DROP COLUMN reminder_dates;
