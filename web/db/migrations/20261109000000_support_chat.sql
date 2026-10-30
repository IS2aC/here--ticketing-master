-- migrate:up
-- « Une question ? » : discussion de l'organisateur avec l'assistant (agent branchable) et l'équipe Here!.
CREATE TYPE support_status AS ENUM (
  'assistant',  -- l'assistant a répondu, rien à faire pour l'équipe
  'waiting',    -- transmise à l'équipe : réponse attendue
  'answered',   -- l'équipe a répondu
  'closed'      -- terminée (nouvelle question = nouvelle discussion)
);
CREATE TYPE support_author AS ENUM ('organizer', 'assistant', 'staff');

CREATE TABLE support_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status      support_status NOT NULL DEFAULT 'assistant',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_conversations_user_idx ON support_conversations (user_id, created_at);
CREATE INDEX support_conversations_waiting_idx ON support_conversations (updated_at) WHERE status = 'waiting';

CREATE TABLE support_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES support_conversations (id) ON DELETE CASCADE,
  author           support_author NOT NULL,
  staff_id         uuid REFERENCES users (id) ON DELETE SET NULL, -- membre de l'équipe qui a répondu
  body             text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_conversation_idx ON support_messages (conversation_id, created_at);

-- migrate:down
DROP TABLE support_messages;
DROP TABLE support_conversations;
DROP TYPE support_author;
DROP TYPE support_status;
