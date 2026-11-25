UPDATE owners SET day_email = 1 WHERE day_email_chosen_at IS NULL AND EXISTS (SELECT 1 FROM owner_identities WHERE owner_identities.owner_id = owners.id AND owner_identities.provider = 'email');
