-- migrate:up
-- Type « Autre » de l'assistant de création (maquette backoffice-creation).
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'autre';

-- migrate:down
-- PostgreSQL ne sait pas retirer une valeur d'un type enum : rien à annuler.
