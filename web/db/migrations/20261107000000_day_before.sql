-- migrate:up
-- Rappel la veille : la carte (avec le QR code d'entrée) renvoyée aux invités confirmés. Option payante.
ALTER TYPE message_kind ADD VALUE IF NOT EXISTS 'day_before';
-- Option activée compte par compte par l'équipe Here! (portail admin).
ALTER TABLE users ADD COLUMN day_before_reminders boolean NOT NULL DEFAULT false;
-- Avec l'option, l'organisateur peut le couper pour un événement.
ALTER TABLE events ADD COLUMN day_before_enabled boolean NOT NULL DEFAULT true;

-- migrate:down
ALTER TABLE events DROP COLUMN day_before_enabled;
ALTER TABLE users DROP COLUMN day_before_reminders;
-- La valeur 'day_before' du type message_kind reste (PostgreSQL ne retire pas une valeur d'enum).
