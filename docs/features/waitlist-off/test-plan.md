# Waitlist off: test plan

## Unit

- [ ] `POST /join` with a form body answers 410, the body contains `/download` and the waitlist row count is unchanged.
- [ ] `POST /join` asking for JSON answers 410 the same way.
- [ ] The landing HTML holds no `<form`, no `class="cf-turnstile"` and no waitlist word.
- [ ] The landing policy holds no `challenges.cloudflare.com`, no `frame-src` and no `unsafe-inline`.
- [ ] The JSON-LD holds no waitlist word and no `PreOrder`.
- [ ] llms.txt and llms-full.txt hold no waitlist word.
- [ ] The WebMCP tools are the three read-only ones.
- [ ] The dispatch rejects `0 11 * * *` naming it and sends nothing.
- [ ] `wrangler.jsonc` triggers `*/15 * * * *` alone.

## E2E

- [ ] The landing has no form and `POST /join` answers 410, in both viewports.
- [ ] The download button sits in the viewport in the hero at 1280 and at 375.
- [ ] The landing logs no error and calls only its own origin.

## Coverage honesty

The deploy itself is not run: the cron removal is proven by the trigger pin and the dispatch test, not by Cron Events.
