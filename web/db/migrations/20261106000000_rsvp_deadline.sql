-- migrate:up
-- Date limite de réponse choisie par l'organisateur. NULL : jusqu'au début de l'événement.
ALTER TABLE events ADD COLUMN rsvp_deadline timestamptz;

-- migrate:down
ALTER TABLE events DROP COLUMN rsvp_deadline;
