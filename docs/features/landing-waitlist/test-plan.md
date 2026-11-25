# Test plan: Landing waitlist

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `waitlist-store.test.ts`, `waitlist-limiter.test.ts`, `waitlist-join.test.ts` and the new `site-pages.test.ts` cases are each red at their own commit — expected: the failure text the briefing records
- [ ] Confirmed from `git log` that each red commit precedes its green one

## Unit

- [ ] `joinWaitlist` with ` Maria@Example.COM ` — expected: one row `maria@example.com`, the join claims the confirmation
- [ ] The same address again — expected: still one row, no claim
- [ ] A recorded failure — expected: `confirmation_failed_at` set, `confirmation_sent_at` kept
- [ ] Each limit over its count — expected: "try again", no row, no mail
- [ ] No `CF-Connecting-IP`, and each binding missing in turn — expected: "opens soon", no row, no mail
- [ ] A local site host (`SITE_ORIGIN` `http://localhost:8788`) — expected: the limits are skipped and the dummy token is accepted
- [ ] siteverify answers `success: false`, a wrong action, a wrong hostname — expected: "try again", no row, no mail
- [ ] siteverify times out or answers an own-fault code — expected: "opens soon", no row, no mail
- [ ] No site key, no secret — expected: the page has no widget and `/join` answers "opens soon"
- [ ] A JSON body, a multipart body, a 5 KB body, no `email`, `a@`, a 255-character address — expected: "try again", no row
- [ ] A valid join — expected: 200, "You're on the list." under the posting form only, one mail to the address with the template's subject, nothing echoed
- [ ] The mail sender throws — expected: still "You're on the list.", `confirmation_failed_at` set, no log line carries the address
- [ ] D1 throws on insert — expected: "try again", no mail
- [ ] The CSP without a site key — expected: as today, no external origin; with a key — expected: `https://challenges.cloudflare.com` in `script-src` and `frame-src` only
- [ ] `api-source.test.ts` — expected: `WAITLIST_LIMITER` 8604 (10/60), `WAITLIST_ADDRESS_LIMITER` 8605 (3/60), `WAITLIST_GLOBAL_LIMITER` 8606 (60/60)
- [ ] `emails:check` and `site:check` — expected: fresh

## E2E (Playwright specs)

- [ ] Join from the hero form with the dummy keys — expected: `/join#join`, "You're on the list." focused, the address not echoed
- [ ] Join again from the final form with the same address — expected: `/join#final`, the same notice; the console sender printed one mail in total
- [ ] Console and network — expected: no CSP violation; requests only to the page's origin and `challenges.cloudflare.com`

## Prove it for real — Playwright MCP or a scripted Chrome

- [ ] Walk both forms at 1280 and 375, light and dark — expected: the widget fits the capsule and the notices read well
- [ ] Read the local D1 after two joins of one address and one of another — expected: two rows
- [ ] Screenshots of the joined notice for the PR and the README row

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: nothing is stored or mailed without a solved challenge and room under every limit — attack: replay a token, skip the field, flood one address, flood from many keys; result:
- [ ] Claim 2: the answer never tells whether an address is known — attack: compare bodies, headers and timings for a new and a known address; result:
- [ ] Claim 3: the address never reaches a log — attack: read the Worker's console during every failure path; result:

## Coverage honesty

- The real widget and siteverify are proven only in production once the owner creates the widget, through the runbook's waitlist smoke check.
