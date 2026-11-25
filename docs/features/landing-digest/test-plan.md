# Test plan: Landing digest

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Each of the facts, template, mail, run and cron-pin tests is red at its own commit — expected: the failure text the briefing records; `git log` puts each red before its green

## Unit

- [ ] Rows joined 1 ms after `since`, at `until`, at `since` and 1 ms after `until` — expected: the first two counted, the last two not
- [ ] 51 rows in the window — expected: `joined` 51, fifty addresses newest first, `moreAddresses` 1
- [ ] A failed confirmation inside and one outside the window — expected: `failedConfirmations` 1; `total` counts every row
- [ ] The run with `ADMIN_EMAIL` unset, `ADMIN_EMAIL` `not-an-address`, `SITE_ORIGIN` unset, no sender — expected: no mail, one log line naming the missing piece, no `@` in any log line, the handler resolves
- [ ] An unknown cron `*/5 * * * *` — expected: the handler rejects, no mail
- [ ] D1 throws; the sender throws — expected: the handler rejects
- [ ] An empty window — expected: one mail, subject "Your todz waitlist: no one new", the total in the body
- [ ] Three joins, one with `<` and `&` in a quoted local part if the address rule allows it, else a plain one — expected: one mail to `ADMIN_EMAIL`, subject "Your todz waitlist: 3 new", the addresses newest first and HTML-escaped, a button to `<SITE_ORIGIN>/admin`
- [ ] `emails:check` — expected: the generated module is current
- [ ] `api-source.test.ts` — expected: `triggers.crons` is `["0 11 * * *"]` and equals `DIGEST_CRON`

## Prove it for real

- [ ] `wrangler dev --test-scheduled` with the dev site variables and a few joins, then `curl "http://localhost:<port>/__scheduled?cron=0+11+*+*+*"` — expected: the console sender logs one mail to the dev `ADMIN_EMAIL` with the joins; a second cron string logs a rejection
- [ ] The rendered html of the mail in light and dark (the preview script) — expected: the shared layout, the counts, the addresses, the button; screenshots for the PR

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Reviewer and security reviewer: no address in a log, the recipient only `ADMIN_EMAIL`, nothing sent without it, escaping in the html

## Coverage honesty

- The first real digest is the production smoke walk's: it arrives at 11:00 UTC after the deploy, once `ADMIN_EMAIL` exists in production.
