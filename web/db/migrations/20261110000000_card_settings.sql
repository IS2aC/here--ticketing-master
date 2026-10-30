-- migrate:up
-- Carte de l'événement personnalisée par l'organisateur : intitulé (sinon le nom de l'événement).
-- La palette choisie est gardée dans event_cards.palette ({"preset": "<identifiant>"}).
ALTER TABLE event_cards ADD COLUMN title text;

-- migrate:down
ALTER TABLE event_cards DROP COLUMN title;
