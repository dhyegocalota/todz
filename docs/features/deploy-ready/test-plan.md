# Test plan: Deploy ready

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Step 1's red commit fails on the named assertions in a throwaway worktree; failure text recorded

## Unit

- [ ] `wrangler.jsonc` names `SIGN_IN_PROVIDER` `email`, `EMAIL_SENDER` `cloudflare`, `PUBLIC_ORIGIN` `https://api.todz.app`, the route `api.todz.app` as a custom domain, the database `todz-directory` with a real id; never `fake` or `console`; every resource name starts with `todz`
- [ ] `dev` and `dev:email` pass `--var` for the provider, the sender and a `localhost` origin; `dev` still applies migrations locally first
- [ ] The limiter: the eleventh `POST /owner/sign-in-links` from one client address in a minute answers 429 `too_many_requests`; the same for `POST /owner/sessions`; another address is unaffected; no binding → no check
- [ ] `project.yml`: Debug `http://localhost:8787`, Release `https://api.todz.app`; the built Release app's Info.plist says `https://api.todz.app`
- [ ] Every existing suite stays green: the API (both projects), the shape suite, TodzKit, the macOS build
- [ ] `wrangler deploy --dry-run` builds and lists the bindings: D1 `DIRECTORY`, the Durable Object, `EMAIL`, the limiter, the assets
- [ ] `pnpm verify all`: green, gates recorded

## Prove it for real

- [ ] `pnpm --filter @todz/api dev` answers `{"method":"identity"}` and `dev:email` answers `{"method":"link"}` on `localhost:8787`, proving the overrides
- [ ] The runbook reads top to bottom with every step's expected result and `If it fails` line, and names the permission each remote step needs
- [ ] After merge (lead): the runbook's run log records each remote step's actual result from `main`

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: development can never reach production data — attack: <how>; result: <refuted | held>
- [ ] Claim 2: a deployed Worker can never select the fake provider or the console sender — attack: <how>; result: <refuted | held>
- [ ] Claim 3: the limiter keys on the real client address — attack: <how>; result: <refuted | held>

## Coverage honesty

- The live deploy, the custom domain and the Email Sending onboarding are proven by the runbook's run, not by tests.
- The Workers rate-limit binding is eventually consistent per location; the test proves the wiring, not Cloudflare's counting.
