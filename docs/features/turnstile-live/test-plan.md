# Test plan: Turnstile live

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `tools/repository-shape/src/api-source.test.ts` the production vars test — input: `vars` without the key; expected: red with the received vars lacking `TURNSTILE_SITE_KEY` — evidence: red at a6824c6, `AssertionError: expected { SIGN_IN_PROVIDER: 'email', …(3) } to deeply equal { SIGN_IN_PROVIDER: 'email', …(4) }`
- [x] Confirmed it fails for the right reason — expected: the diff shows only `- "TURNSTILE_SITE_KEY": "0x4AAAAAAGSI2K7Qe9Vad2nL"` missing, not a parse error — evidence: the diff at a6824c6 shows only that line missing; green at f6f29f2

## Unit

- [x] `pnpm --filter @todz/repository-shape exec vitest run` — expected: all files green with the key in `vars` — evidence: 18 files, 240 tests passed at cc5a66e
- [x] `gitleaks detect --no-git --source apps/api/wrangler.jsonc --config .gitleaks.toml` — expected: `no leaks found` — evidence: `no leaks found` at cc5a66e
- [x] `pnpm verify` — expected: every gate the diff touches green — evidence: `verify: 8 gates green at cc5a66e (product)`

## Prove it for real (production, after the secret is put and the runbook runs from step 1 on `main`)

- [ ] `wrangler secret list` through the wrapper — expected: names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY`, no value printed
- [ ] The put from the Keychain — input: `security find-generic-password -s todz-turnstile -w` piped into the wrapper's `secret put`; expected: the secret `TURNSTILE_SECRET_KEY` uploaded for `todz-api`, and the secret's value in no output or file
- [ ] Step 13: `https://api.todz.app/sign-in` and `/sign-in/challenge` — expected: `HTTP/2 200` each with `content-type: text/html; charset=utf-8`; `/mcp` `HTTP/2 401`
- [ ] Step 13: `https://todz.app/admin` — expected: `HTTP/2 200`, `cache-control: no-store`, `x-robots-tag: noindex`
- [ ] Step 14: the junk link post — expected: `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`
- [ ] Step 14: the waitlist junk post — expected: the counts of the probe address `0` before and after, the post printing `429`
- [ ] Step 14: the admin probe — expected: unspent admin link counts equal before and after, the post printing `429`
- [ ] Step 15: fourteen wrong-session posts — expected: first ten `HTTP/2 401`, at least one of the last four `HTTP/2 429` followed by `retry-after: 60`
- [ ] The new run-log rows carry no token, secret value, link or personal address — expected: 0 matches for `bearer`, `cfut_`, `token=` and addresses

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Coverage honesty

- A real sign-in link, a solved Managed challenge in a browser and a real confirmation mail are the owner's production smoke walk, never run here.
- The first digest still arrives at the next 11:00 UTC; a later run records it.
