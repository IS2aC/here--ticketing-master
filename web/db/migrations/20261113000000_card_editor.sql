-- migrate:up
-- Canvas des cartes d'invitation : la carte est dessinée dans l'éditeur (Doory, services here-doory-*).
-- Identifiant du design dans l'éditeur ; à la validation, son rendu devient le fond de la carte
-- (card_backgrounds) et la place du nom, de la table et du QR code sa mise en page (layout).
ALTER TABLE event_cards ADD COLUMN editor_design_id uuid;

-- migrate:down
ALTER TABLE event_cards DROP COLUMN editor_design_id;
