# Cloud capacity: plan

- [x] 1. ADR 0099, spec, plan, test plan.
- [x] 2. Migration 0016 and the cap on the sign-in link request and on the sign-in, with the alike answer, the full mail and the count-guarded insert.
- [x] 3. The queue route, the `/cloud-queue` page, the admin page and admissions limited to the free spots, the daily digest stamped after the send.
- [x] 4. The budget guard (analytics token or D1 estimate), its cron, the 80% email and the 95% write refusal and read throttle.
- [x] 5. The mail meter, the per-address daily bound, `last_seen_day`, `wrangler.jsonc` (`CLOUD_ACCOUNTS_MAX`, `CLOUD_READ_LIMITER`), the README, `apps/docs`, the landing and discovery copy.

## Failure modes

| Step | What breaks | Signal | Back out |
|---|---|---|---|
| 2 | An active account is refused | `cloud_full` for a known active address | unset `CLOUD_ACCOUNTS_MAX` |
| 4 | Writes refused too early | the capacity 429 while under 95% | unset `CLOUD_ACCOUNTS_MAX` (the guard is off with it) |
| 4 | The analytics token has the wrong permission | the nightly run fails with `the Cloudflare analytics answered 403` | fix the token, or delete the secret to use the D1 estimate |
