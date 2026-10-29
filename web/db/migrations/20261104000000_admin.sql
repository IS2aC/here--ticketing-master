-- migrate:up
-- Portail admin (équipe Here!).

-- Relances à la demande (« Relancer maintenant ») : option payante, activée compte par compte.
ALTER TABLE users ADD COLUMN on_demand_reminders boolean NOT NULL DEFAULT false;

-- Réglages modifiés depuis le portail admin : ils remplacent les variables d'environnement du même
-- nom (en minuscules), sans redéployer. Sans ligne : la valeur de l'environnement s'applique.
CREATE TABLE platform_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);

-- migrate:down
DROP TABLE platform_settings;
ALTER TABLE users DROP COLUMN on_demand_reminders;
