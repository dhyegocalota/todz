# Cloud capacity: plan

- [ ] 1. ADR 0099, spec, plan, test plan.
- [ ] 2. Red tests, then migration 0016 and the cap on the sign-in link request and on the sign-in.
- [ ] 3. The queue route, the admin page and admissions, the daily digest.
- [ ] 4. The budget guard, its cron, the 80% email and the 95% write refusal.
- [ ] 5. `wrangler.jsonc` (cron, `CLOUD_ACCOUNTS_MAX`), the README, `apps/docs` section.

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 2 | An active account is refused | `cloud_full` for a known active address | unset `CLOUD_ACCOUNTS_MAX` |
| 4 | Writes refused too early | `cloud_at_capacity` while under 95% | unset `CLOUD_ACCOUNTS_MAX` (the guard is off with it) |
