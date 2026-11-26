# Test plan: Owner route order

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/app-version-gate.test.ts::GET /owner with no credential and no version header answers 401, not 426` — input: `GET /owner`, no headers; expected: 401
- [ ] Confirmed it fails for the right reason: the red run printed `expected 426 to be 401` for six tests (43f7aff0)

## Unit

- [ ] `app-version-gate.test.ts` — input: `GET /owner`, `PATCH /owner`, `GET` and `POST /owner/workspaces`, `DELETE /owner/sessions/current`, no credential, no version; expected: 401 each
- [ ] Edge: unknown credential, version `0.1.0`, `GET /owner/workspaces`; expected: 401
- [ ] Edge: known credential, version `0.1.0`, `GET /owner`; expected: 426 with the todz body, owner limiter keys `[]`
- [ ] Edge: known credential, no version, the change socket; expected: 426 with the todz body
- [ ] Edge: no version, `GET /owner/sign-in-method` and the pre-ADR 0058 sign-in link body; expected: 426, sign-in limiters untouched
- [ ] `download-paths.test.ts` — input: thirteen odd paths by GET, HEAD and POST on the site host; expected: status below 500 each
- [ ] Edge: `/download/9.9.9/Todz-9.9.9.dmg`; expected: 404, empty body

## Prove it for real

- [ ] `curl -s -o /dev/null -w '%{http_code}' https://api.todz.app/owner` after the deploy; expected: 401 (a person runs it; the agent never deploys)

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: no session route answers 426 before the credential is checked — attack: every `SESSION_HANDLERS` route without a token; result: pending
- [ ] Claim 2: the public routes still refuse an old app before any limiter — attack: the existing limiter-budget test; result: pending
- [ ] Claim 3: no 5xx on odd download paths — attack: paths beyond the pin list; result: pending

## Coverage honesty

- The reported landing 500 could not be reproduced; the pin proves the Worker never answers 5xx on the listed inputs, not that the edge never does.
