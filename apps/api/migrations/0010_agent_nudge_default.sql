UPDATE owners SET agent_nudge = 1 WHERE agent_nudge_chosen_at IS NULL;
