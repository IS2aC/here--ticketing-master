-- migrate:up
-- Retire la colonne de l'ancien éditeur de cartes (identifiant d'un design externe), remplacé par l'éditeur
-- intégré (card_designs). IF EXISTS : les bases créées après son retrait ne l'ont jamais eue.
ALTER TABLE event_cards DROP COLUMN IF EXISTS editor_design_id;

-- migrate:down
ALTER TABLE event_cards ADD COLUMN IF NOT EXISTS editor_design_id uuid;
