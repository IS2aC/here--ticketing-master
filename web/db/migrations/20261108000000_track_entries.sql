-- migrate:up
-- « Gérer les entrées et sorties » (choisi par l'organisateur, désactivé par défaut).
-- Désactivé : le scan vérifie seulement que l'invité fait partie de l'événement (pas de « Déjà entré »).
-- Activé : chaque entrée est enregistrée, un QR code déjà scanné affiche « Déjà entré ».
ALTER TABLE events ADD COLUMN track_entries boolean NOT NULL DEFAULT false;

-- migrate:down
ALTER TABLE events DROP COLUMN track_entries;
