# Test plan: Landing

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `host-kind.test.ts` is red at its own commit — expected: fails on "hostKindOf is not implemented"
- [ ] `site-dispatch.test.ts` is red at its own commit — expected: `todz.app/` answers 404 before the dispatch
- [ ] `site-pages.test.ts` is red at its own commit — expected: fails on "serveLandingPage is not implemented"
- [ ] Confirmed from `git log` that each red commit precedes its green one

## Unit

- [ ] `hostKindOf` with `https://api.todz.app/x` — expected: `Api`
- [ ] `https://todz.app/` — expected: `Site`
- [ ] `https://www.todz.app/` — expected: `WwwRedirect`
- [ ] `http://localhost:8787/` with the development origins — expected: `Api`; `http://127.0.0.1:8787/` — expected: `Site`
- [ ] `https://todz-api.example.workers.dev/`, `https://203.0.113.7/` and `https://evil.todz.app/` — expected: `null`, then 404
- [ ] `SITE_ORIGIN` absent, and `SITE_ORIGIN` `not a url` — expected: the site host is unknown (404) and the API host still serves `/owner/sign-in-method`
- [ ] `GET todz.app/owner/sign-in-method`, `/mcp`, `/sign-in`, `/sign-in/challenge` — expected: 404 each
- [ ] `GET api.todz.app/` and `api.todz.app/self-host` — expected: 404
- [ ] `GET www.todz.app/self-host?ref=x` — expected: 301 with `Location: https://todz.app/self-host?ref=x`
- [ ] `POST todz.app/join` with `email=a@b.co` — expected: 200 HTML containing the "opens soon" copy, no D1 write, no mail
- [ ] `GET todz.app/` headers — expected: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a CSP with `default-src 'none'`, `img-src 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and no `unsafe-inline`
- [ ] Each inline `<style>` and `<script>` hash equals the one in the CSP
- [ ] Every visible text node of the landing comes from `LANDING_COPY` (no stray literal)
- [ ] No `http(s)://` origin other than the page's own appears in `src`, `href` of assets or CSS `url()`; external links (GitHub) are plain anchors
- [ ] `site:check` passes; after editing `docs/self-host.md` without regenerating — expected: it fails
- [ ] The self-host page contains every `##` heading of `docs/self-host.md` and its code blocks
- [ ] `site-assets.test.ts`: every file in `public/landing/` equals a file in `docs/screenshots/` byte for byte
- [ ] `api-source.test.ts`: the routes name `api.todz.app`, `todz.app` and `www.todz.app` as custom domains; `SITE_ORIGIN` is `https://todz.app`

## E2E (Playwright specs)

- [ ] `e2e/landing.spec.ts` desktop 1280 light — steps: open `/`; expected: the logo, the promise and the hero shot are visible above the fold, and the form is in the first screen
- [ ] The same at mobile 375 — expected: no horizontal scroll; the form is reachable without zoom; the hero shot fits
- [ ] Dark (`colorScheme: 'dark'`) — expected: the dark tokens apply; the text contrast stays readable
- [ ] Reduced motion (`reducedMotion: 'reduce'`) — expected: no element animates (computed `animation-name` none or duration 0)
- [ ] Submit an address — expected: "The waitlist opens soon." on the page, the URL is `/join`, and nothing else is requested
- [ ] `/self-host` — expected: the guide's title and steps; the footer link from `/` reaches it
- [ ] Console and network — expected: zero console errors, zero requests to another origin

## Prove it for real — Playwright MCP or a scripted Chrome

- [ ] Walk `/` from first paint to the footer at 1280 and 375, light and dark, and take screenshots of each into the scratchpad
- [ ] Keyboard only: tab through the form, the links and the footer — expected: a visible focus ring on each
- [ ] `www` redirect and an unknown host, against `wrangler dev` with `Host` headers — expected: 301 and 404
- [ ] Screenshots of the landing at 1280 light and dark for the PR, and one for the README hero row

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: the site host can never reach an owner or MCP route — attack: paths with `%2F`, a `//owner` double slash, a trailing dot `todz.app.`, an uppercase host; result:
- [ ] Claim 2: the API host never changed behaviour — attack: run the whole existing suite and probe `/owner`, `/mcp`, `/sign-in` on `api.todz.app` and `localhost`; result:
- [ ] Claim 3: the page loads nothing from another origin — attack: read the HTML, the CSS and the network log; result:

## Coverage honesty

- The real `todz.app` custom domain is proven only at deploy, through the runbook.
- Turnstile, storage and limits for the waitlist are `landing-waitlist`'s.
