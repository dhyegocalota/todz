ALTER TABLE owners ADD COLUMN agent_nudge INTEGER NOT NULL DEFAULT 0 CHECK (agent_nudge IN (0, 1));
