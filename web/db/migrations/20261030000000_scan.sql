-- migrate:up
-- Scan à l'entrée : liens de scan partagés aux agents d'accueil, et entrées enregistrées.

CREATE TABLE scan_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  label       text NOT NULL,                -- « Entrée de la réception », « Porte A »
  token       text NOT NULL UNIQUE,         -- dans l'adresse /scan/<jeton> ; long et aléatoire
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,         -- peu après la fin de l'événement
  revoked_at  timestamptz
);

CREATE INDEX scan_links_event_id_idx ON scan_links (event_id);

CREATE TABLE checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id  uuid NOT NULL UNIQUE REFERENCES invitations (id) ON DELETE CASCADE, -- une seule entrée par invitation
  scan_link_id   uuid REFERENCES scan_links (id) ON DELETE SET NULL,
  seats          integer NOT NULL DEFAULT 1 CHECK (seats > 0),
  scanned_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checkins_scan_link_id_idx ON checkins (scan_link_id);

-- migrate:down
DROP TABLE checkins;
DROP TABLE scan_links;
