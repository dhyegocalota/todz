SELECT
  (SELECT count(*) FROM owners) AS owners,
  (SELECT count(*) FROM owners WHERE EXISTS (SELECT 1 FROM owner_identities WHERE owner_identities.owner_id = owners.id AND owner_identities.provider = 'email') AND EXISTS (SELECT 1 FROM workspaces WHERE workspaces.owner_id = owners.id)) AS candidates,
  (SELECT count(*) FROM owners WHERE agent_nudge = 1) AS agent_nudge_on,
  (SELECT count(*) FROM owners WHERE day_email_chosen_at IS NULL AND EXISTS (SELECT 1 FROM owner_identities WHERE owner_identities.owner_id = owners.id AND owner_identities.provider = 'email')) AS untouched_email_owners;
