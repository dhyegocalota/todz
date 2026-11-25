# Plan: Landing digest

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/api/src/index.ts`'s default export, which has only `fetch`
**Assumptions (decided, owner can override):**
- ADR 0052's choices are the ones built, on top of `landing-admin` (its `adminEmailOf` and `admin-store.ts`).

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 (all of it) | `apps/api/src/site/waitlist-digest.ts`; `apps/api/src/site/admin-store.ts` (the facts query only); `apps/api/src/index.ts` (`scheduled`); `apps/api/src/emails/waitlist-digest-mail.ts`, `email-slot.ts`; `apps/api/scripts/emails/waitlist-digest-*.ts`, `generated-emails.ts`; `apps/api/src/emails/generated/`; `libs/types/src/constants.ts` (if `HOURS_PER_DAY` is missing); `apps/api/wrangler.jsonc` (`triggers`); `apps/api/test/waitlist-digest.test.ts`, `admin-store.test.ts` (the facts cases), `test/emails/` (the template); `tools/repository-shape/src/api-source.test.ts` (the cron pin); `tester-briefing.md` | `developer` in this worktree |
| Lead | `docs/runbooks/deploy-the-api.md` (step 8 names the cron trigger; a digest check), `docs/self-host.md` if it lists triggers, `apps/api/README.md`, the ADR index | the lead |

## Sequencing

One lane, then the lead's docs.

## Steps

### G1

- [ ] **Step 1:** Red: the facts query's cases (inside, before and after the window, both edges, the cap of fifty and `moreAddresses`, failed confirmations only in the window, the total). Then green.
- [ ] **Step 2:** Red: the mail template tests and `waitlistDigestMail` (subject for N and for none, the counts, each address escaped, "and N more" only past fifty, the button to `<origin>/admin`, no slot left). Then the template, its copy, the enum member, the slots and `pnpm emails:generate`.
- [ ] **Step 3:** Red: `waitlist-digest.test.ts` through `worker.scheduled` (or the handler) with `workerEnvWith`: each missing piece sends nothing and logs one line without an address; an unknown cron rejects; D1 and the sender throwing reject; an empty day sends the "no one new" mail; a normal day sends one mail to `ADMIN_EMAIL` with the facts. Then green with `scheduled` in `index.ts`.
- [ ] **Step 4:** Red: `api-source.test.ts` pins `triggers.crons` to `["0 11 * * *"]` and that `DIGEST_CRON` matches it. Then green in `wrangler.jsonc`.

### Lead

- [ ] **Step 5:** The runbook (step 8 lists the `0 11 * * *` schedule; a local scheduled check), the README, the ADR index, the briefing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | the window double-counts or misses an edge row | the edge tests | fix the bounds |
| 2 | an address injects markup into the mail | the escaping test | escape the slot |
| 3 | a missing piece mails anyway, or a log carries an address | the recording sender and a console spy | move the check up |
| deploy | the cron fires on a version without `scheduled` | the dashboard's failed invocations | deploy again or remove `triggers` |

**Steps with no backout:** none; the digest writes nothing.

## Z. Prove and ship

- [ ] **Tester run**
- [ ] **Reviewer**
- [ ] **Security reviewer**
- [ ] **/open-pr**
