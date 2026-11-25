# Test plan: Landing

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Run by the tester on `feat/landing` at 4d8b588, in a throwaway worktree. `LOGS` below is `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/e625c263-20cc-4bdf-bc50-d9d128298c0f/scratchpad/tester/` and `SHOTS` is the sibling `tester-shots/`. Where a line of this plan differs from the spec's "Plan review answers" (R1 to R17), the answers win: development ports, the method and path table (R10), HSTS without `includeSubDomains` (R11), no `robots.txt` (R5), assets on every host (R4).

The Playwright MCP servers (`playwright`, `playwright-second`, `playwright-third`) were down: each failed with `Browser "chrome-for-testing" is not installed` (chromium-1247 missing). The walk was scripted with the repository's own `@playwright/test` Chromium (revision 1228) in throwaway scripts under `LOGS` (`walk.mjs`, `walk2.mjs`), never committed. Say so in any summary.

## The failing test first

- [x] `host-kind.test.ts` is red at its own commit — expected: fails on "hostKindOf is not implemented" — evidence: e2cc8ce, 18 failed (18), every one `hostKindOf is not implemented`, `LOGS/red-host-kind.log`
- [x] `site-dispatch.test.ts` is red at its own commit — expected: `todz.app/` answers 404 before the dispatch — evidence: 5b5835a, 11 failed and 10 passed (21): `expected 404 to be 200`, `404 to be 303`, `404 to be 301`, `401 to be 404` (`/mcp`), `503 to be 404` (`/owner/sign-in-method`); matches the briefing, `LOGS/red-dispatch.log`
- [x] `site-pages.test.ts` is red at its own commit — expected: fails on "serveLandingPage is not implemented" — evidence: 5dae707, 16 failed and 2 passed (18) (the 2 are pins): 10x `serveLandingPage is not implemented`, 6x `serveSelfHostPage is not implemented`, `LOGS/red-pages.log`
- [x] Confirmed from `git log` that each red commit precedes its green one — evidence: log order e2cc8ce < 51cb1c7, 5b5835a < 5a21a36, 5dae707 < b69ba1e, also red-only checks of eff9dd8 (14 failed: `markdownHtml is not implemented`, `ENOENT .../generated/self-host-html.ts`, `LOGS/red-markdown.log`), 388cabe (2 failed, 1 passed: `expected 0 to be greater than 0`, `ENOENT landing-shots.ts`), aa666e6 (2 failed of 14: `['SITE_ORIGIN']` and `['api.todz.app']` to equal `[]`), b1bbc67 (`class: expected 'class: product', got 'class: docs'` and the gates line), d2541f7 (11 FAIL lines: packages `-`, no `e2e` gate); every worktree return to 4d8b588 confirmed; `LOGS/red-*.log`

## Unit

All of the section below: `pnpm --filter @todz/api test:unit` 48 files, 1079 passed (1079); `pnpm --filter @todz/repository-shape test:unit` 18 files, 229 passed (229); `bash scripts/verify.test.sh` "verify: all checks passed"; `pnpm typecheck` clean. Logs: `LOGS/unit-api.log`, `unit-shape.log`, `verify-test.log`, `typecheck.log`.

- [x] `hostKindOf` with `https://api.todz.app/x` — expected: `Api` — evidence: `test/host-kind.test.ts` green in `LOGS/unit-api.log`; also live: instance with `--local-upstream api.todz.app` answers `/mcp` 401, `/sign-in` 200, `/` 404 (`LOGS/hostcheck.out`)
- [x] `https://todz.app/` — expected: `Site` — evidence: unit green; live instance with `--local-upstream todz.app` answers `/` 200 (`LOGS/hostcheck.out`)
- [x] `https://www.todz.app/` — expected: `WwwRedirect` — evidence: unit green; live instance with `--local-upstream www.todz.app` answers 301 (`LOGS/hostcheck.out`)
- [x] `http://localhost:8787/` with the development origins — expected: `Api`; `http://localhost:8788/` — expected: `Site` — evidence: unit green; live by port with `PUBLIC_ORIGIN` `http://localhost:8800` (`/owner` 401, `/mcp` 401, `/sign-in` 200, `/` 404) and `SITE_ORIGIN` `http://localhost:8795` (`/` 200)
- [x] `https://todz-api.example.workers.dev/`, `https://203.0.113.7/` and `https://evil.todz.app/` — expected: `null`, then 404 — evidence: unit green; live instance with `--local-upstream evil.todz.app`: `/` 404 and `/owner/sign-in-method` 404
- [x] `SITE_ORIGIN` absent, and `SITE_ORIGIN` `not a url` — expected: the site host is unknown (404) and the API host still serves `/owner/sign-in-method` — evidence: unit green (`host-kind.test.ts`, `site-dispatch.test.ts`); not run live
- [x] `GET todz.app/owner/sign-in-method`, `/mcp`, `/sign-in`, `/sign-in/challenge` — expected: 404 each — evidence: unit green; live on the apex instance: `/owner` 404, `/mcp` 404, `/sign-in` 404, `/sign-in/challenge` 404, `/owner/sign-in-method` 404 (`LOGS/curls.out`, `hostcheck.out`)
- [x] `GET api.todz.app/` and `api.todz.app/self-host` — expected: 404 — evidence: unit green; live on the api-upstream instance: `/` 404, `/self-host` 404, `POST /join` 404
- [x] `GET www.todz.app/self-host?ref=x` — expected: 301 with `Location: https://todz.app/self-host?ref=x` — evidence: unit green; live (www upstream, `SITE_ORIGIN` `https://todz.app`): 301, `Location: http://todz.app/self-host?ref=x`; the scheme is the request's (`http` locally), the path and query are kept; the `https` form is the unit's
- [x] `POST todz.app/join` with `email=a@b.co` — expected: 200 HTML containing the "opens soon" copy, no D1 write, no mail — evidence: unit green; live POST 200 with notices "The waitlist opens soon." in both forms; the address is not in the DOM (`LOGS/walk2.out`); no D1 or mail code on the path (not inspected in the database)
- [x] `GET todz.app/` headers — expected: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a CSP with `default-src 'none'`, `img-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and no `unsafe-inline` — evidence: live headers: `Strict-Transport-Security: max-age=31536000`, `Content-Security-Policy: default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-cache`; no `unsafe-inline`
- [x] Each inline `<style>` and `<script>` hash equals the one in the CSP — evidence: `site-pages.test.ts` CSP test green; zero console errors (no CSP violation) in all 8 browser configurations (`LOGS/walk.json`)
- [x] Every visible text node of the landing comes from `LANDING_COPY` (no stray literal) — evidence: `site-pages.test.ts` "every word it shows or reads aloud comes from the copy module" green
- [x] No `http(s)://` origin other than the page's own appears in `src`, `href` of assets or CSS `url()`; external links (GitHub) are plain anchors — evidence: `LOGS/claim3.sh` output: the only absolute URL in `/` is the terminal text `https://api.todz.app/mcp`; `/self-host` only `https://api.example.com…` in code text; every `src`, `href`, `action` is relative; no GitHub link exists on the page (copy keys unused by decision, briefing G2)
- [x] `site:check` passes; after editing `docs/self-host.md` without regenerating — expected: it fails — evidence: clean run exit 0; after appending a line to `docs/self-host.md` exit 1 (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`, `LOGS/site-mut.log`); `git checkout docs/self-host.md` restored it, `git status` clean, `site:check` exit 0 again
- [x] The self-host page contains every `##` heading of `docs/self-host.md` and its code blocks — evidence: `site-pages.test.ts` green; live headings: "What you need" to "Updating" (11 headings, `LOGS/walk2.out`)
- [x] `site-assets.test.ts`: every file in `public/landing/` equals a file in `docs/screenshots/` byte for byte — evidence: in the shape run 18 files 229 passed
- [x] `api-source.test.ts`: the routes name `api.todz.app`, `todz.app` and `www.todz.app` as custom domains; `SITE_ORIGIN` is `https://todz.app` — evidence: shape run green (`api-source.test.ts` "serves api.todz.app, todz.app and www.todz.app as custom domains and no other host")

## E2E (Playwright specs)

`pnpm --filter @todz/api test:e2e` exit 0: 34 runs, 32 passed and 2 skipped (`desktop` 16 passed, 1 skipped: the 375 narrow-screen spec; `mobile` 16 passed, 1 skipped: the 1280 fold spec), 9.1 s, `LOGS/e2e.log`. The two `test.fail` focus specs of the earlier briefing are gone: the notice focus passes on both forms.

- [x] `e2e/landing.spec.ts` desktop 1280 light — steps: open `/`; expected: the logo, the promise and the hero shot are visible above the fold, and the form is in the first screen — evidence: `first fold` green on `desktop`; `SHOTS/landing-1280-light.png` shows logo, headline, form and the top of the window shot in 1280x800
- [x] The same at mobile 375 — expected: no horizontal scroll; the form is reachable without zoom; the hero shot fits — evidence: `narrow screen` green on `mobile`; `scrollWidth` 375 at 375 in all four schemes and motions; `SHOTS/landing-375-light.png`
- [x] Dark (`colorScheme: 'dark'`) — expected: the dark tokens apply; the text contrast stays readable — evidence: `dark scheme` green on both projects; `SHOTS/landing-1280-dark.png`, `landing-375-dark.png`; the dark window shot loads at 1280
- [x] Reduced motion (`reducedMotion: 'reduce'`) — expected: no element animates (computed `animation-name` none or duration 0) — evidence: spec green; my count of elements with a running animation: 0 with reduce, 8 without, at both widths and schemes (`LOGS/walk.json`)
- [x] Submit an address — expected: "The waitlist opens soon." on the page, the URL is `/join`, and nothing else is requested — evidence: live: URL `/join#join`, notice shown, requests `POST /join` then assets only; `SHOTS/opens-soon-1280-light.png`
- [x] `/self-host` — expected: the guide's title and steps; the footer link from `/` reaches it — evidence: spec green; `SHOTS/self-host-1280-light.png`
- [x] Console and network — expected: zero console errors, zero requests to another origin — evidence: specs green on 3 pages x 2 projects; my walk: errors `[]` and external requests `[]` in all 8 configurations (`LOGS/walk.json`)

## Prove it for real — Playwright MCP or a scripted Chrome

- [x] Walk `/` from first paint to the footer at 1280 and 375, light and dark, and take screenshots of each into the scratchpad — evidence: scripted Chromium (MCP down); 8 configs (2 widths x 2 schemes x 2 motions), each scrolled in 300 px steps; every image `naturalWidth` > 0 (5 images, 5 shown at 1280, 4 at 375 because the window is hidden), no horizontal scroll, no clipped visible text (the only `scrollWidth` > `clientWidth` hits are the visually hidden label and the visually hidden "Why todz" heading); looked at `SHOTS/full-1280-light-reduce.png`, `full-1280-dark-reduce.png`, `full-375-light-reduce.png`, `landing-375-dark.png`: images load, layout holds, the terminal wraps at 375, footer present
- [x] Keyboard only: tab through the form, the links and the footer — expected: a visible focus ring on each — evidence: tab order: skip link, logo, guide link, email, join, final email, final join, logo, guide link (footer), then the page; each link and button has a 3px solid outline, each input draws a 3px solid outline on `.join-capsule` (`LOGS/walk2.out`)
- [x] `www` redirect and an unknown host, against `wrangler dev` with `Host` headers — expected: 301 and 404 — evidence: `Host` headers are ignored under wrangler dev (R1: confirmed, `-H 'Host: www.todz.app'` still answered the instance's own host), so each host ran as its own instance through `--local-upstream <host>` with `PUBLIC_ORIGIN` `https://api.todz.app` and `SITE_ORIGIN` `https://todz.app`: `www.todz.app` 301 for `/self-host?ref=x`, `/?a=b&c=d`, `POST /join`, `/owner`; `evil.todz.app` 404; this contradicts R1's "one instance per host cannot be had": dispatch on host is provable live this way (`LOGS/hostcheck.out`, `LOGS/hosts.sh`)
- [x] Screenshots of the landing at 1280 light and dark for the PR, and one for the README hero row — evidence: `SHOTS/landing-1280-light.png`, `landing-1280-dark.png`, `landing-375-light.png`, `landing-375-dark.png`, `landing-full-1280-light.png`, `opens-soon-1280-light.png`, `self-host-1280-light.png`, `readme-landing-light.png` (1280 px wide, 197611 bytes, within the 1600 px and 1 MB limits of `product-screenshots.test.ts`)

## Edge cases found during execution

All against the instance on port 8795 unless said otherwise. Inputs and outcomes in `LOGS/curls.out`.

- [x] `POST /join` with `email=<script>alert(1)</script>` — expected: 200 and the script never echoed — evidence: 200, `grep -c "alert(1)"` 0
- [x] `POST /join` with `Content-Type: application/json` and `{"email":"a@b.co"}` — expected: 200, body ignored — evidence: 200 HTML with HSTS and nosniff
- [x] `POST /join` with `multipart/form-data; boundary=x` and body `garbage` — expected: 200 — evidence: 200
- [x] `POST /join` with a 20 MB body (`--data-binary`) — expected: 200 and no body read, no crash — evidence: `100 Continue` then `200 OK`; the instance kept answering
- [x] `HEAD /` and `HEAD /self-host` — expected: 200, headers of the GET, empty body — evidence: 200, same headers, 0 body bytes
- [x] `GET` and `HEAD /self-host/` — expected: 404 (R10) — evidence: 404 each
- [x] `GET //` — expected: 404 — evidence: 404
- [x] `GET /%2F` and `/%2Fself-host` — expected: 404 — evidence: 404 each
- [x] `GET /%2e%2e/` and `/landing/../` and `/landing/../self-host` (`--path-as-is`) — expected: not an owner or MCP route — evidence: 200 landing, 200 landing, 200 guide: the Worker URL parser normalises the dots before dispatch; no private route reached
- [x] `GET /?utm=x&a=b` and `HEAD` of it — expected: 200 landing — evidence: 200 each
- [x] `GET /join` — expected: 303 to `/` — evidence: `303`, `Location: /`; `curl -L` ends on the landing 200
- [x] `PUT /join`, `DELETE /`, `OPTIONS /`, `POST /` — expected: 404 — evidence: 404 each
- [x] `GET /robots.txt`, `/index.html`, `/self-host.md`, `/SELF-HOST` — expected: 404 (R5) — evidence: 404 each
- [x] `GET` and `HEAD /brand/todz-lockup.png` — expected: 200 `image/png` with nosniff — evidence: 200, `Content-Type: image/png`, `x-content-type-options: nosniff`
- [x] `HEAD /landing/menu-bar/01-today-popover.png` on the site, www, api, unknown and apex instances — expected: 200 with nosniff on every host (R4) — evidence: 200 `image/png` nosniff on all five
- [x] `GET /landing/nope.png` — expected: 404 — evidence: 404, empty body
- [x] Join from the hero form, then Back — expected: back to `/` — evidence: `/join#join` then `/`; reload of `/join#final` stays on `/join#final` (a reload re-posts, as the browser does)
- [x] Join from the final form at 1280 and the hero form at 375 — expected: URL `/join#final` and `/join#join`, notice focused, no overflow — evidence: focus on `final-notice` and `join-notice`; `scrollWidth` 375 at 375; both notices read "The waitlist opens soon." under both forms on either answer (as the briefing states)
- [x] `api.todz.app` instance `/owner/sign-in-method` with the `fake` provider and an https `PUBLIC_ORIGIN` — expected: as before — evidence: 503 `sign_in_unavailable` (the pre-existing refusal of a fake provider on a public origin); noted, not a defect
- [ ] Pin gap, no defect: no unit test sends `%2F`, `//owner` or a dot segment to the site host; the live 404s above hold. Request from the developer: add them to `site-dispatch.test.ts`
- [ ] Observation, minor, for the lead: the terminal's `--transport` and `--header` and the guide's `--filter` render as a long dash pair in the monospace font (looks like a ligature of the system font); the DOM text is two hyphens. Confirm the intended font stack before the PR screenshots

## Adversarial review

- [x] Claim 1: the site host can never reach an owner or MCP route — attack: paths with `%2F`, a `//owner` double slash, a trailing dot `todz.app.`, an uppercase host; result: HELD. On the apex instance `/owner`, `/mcp`, `/sign-in`, `/sign-in/challenge`, `/owner/sign-in-method`, `/%2Fowner/sign-in-method`, `//owner/sign-in-method` all 404; `todz.app.`, `TODZ.APP` and `api.todz.app:8443` cannot be sent live (wrangler dev fixes the host) and are covered by `host-kind.test.ts` rows (`todz.app.` null, `TODZ.APP` Site, `api.todz.app:8443` null)
- [x] Claim 2: the API host never changed behaviour — attack: run the whole existing suite and probe `/owner`, `/mcp`, `/sign-in` on `api.todz.app` and `localhost`; result: HELD as far as the suite shows: api 1079/1079; live on a local API instance (`PUBLIC_ORIGIN` `http://localhost:8800`): `/owner` 401, `/owner/sign-in-method` 200, `/mcp` 401, `POST /mcp` 401, `/sign-in` 200, `/sign-in/challenge` 200, `/` 404, `/join` 404; on the `api.todz.app` instance: `/mcp` 401 `WWW-Authenticate: Bearer`, `/sign-in` 200. I did not diff against `main` side by side; the seven test files that moved origin were not re-audited line by line
- [x] Claim 3: the page loads nothing from another origin — attack: read the HTML, the CSS and the network log; result: HELD. No `style=` attribute, one inline script and one inline style, all `src`, `srcset`, `href`, `action` relative; the network log of 8 configurations plus the join flows shows only own-origin requests and no console error

## Coverage honesty

- The real `todz.app` custom domain is proven only at deploy, through the runbook.
- Turnstile, storage and limits for the waitlist are `landing-waitlist`'s.
- Under `wrangler dev` a `Host` header does not reach the Worker; host dispatch was also run live, one instance per host (`--local-upstream`), as R1 allows. `--local-upstream` drops `https`, so the www redirect pointed at `http://todz.app` there: `https` is covered only by `site-dispatch.test.ts` and the runbook's checks after the deploy.
- The Playwright MCP walk was scripted (MCP browsers not installed); no video was recorded, no side-by-side with a pre-change screenshot (the landing is new).
- Unticked: two notes above that are requests, not test results.
