-- migrate:up
-- Réponse de l'invité depuis sa page (/i/<jeton>) : nombre de personnes qui viennent et mot pour l'hôte.
ALTER TABLE guests
  ADD COLUMN attending_seats integer CHECK (attending_seats >= 0),
  ADD COLUMN rsvp_message    text;

-- migrate:down
ALTER TABLE guests
  DROP COLUMN rsvp_message,
  DROP COLUMN attending_seats;
