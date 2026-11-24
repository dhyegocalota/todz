# Test plan: Transactional email

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Red commits of steps 1 and 3: each run in a throwaway worktree fails on the named assertion; failure text recorded
- [ ] Confirmed they fail for the right reason, not a missing import

## Unit

- [ ] `filledHtmlOf` with `a<b>"c"&'d'` gives `a&lt;b&gt;&quot;c&quot;&amp;&#39;d&#39;`; `filledTextOf` keeps it literal
- [ ] The generated module equals a fresh render; mutation: edit one word in `sign-in-template.ts` without generating → red, restored
- [ ] No file under `apps/api/src` imports `react`, `react-dom` or `@react-email`; mutation: add one import → red, restored
- [ ] Sign-in mail: subject "Your todz sign-in link"; HTML button `href` is the link; the header `img` `src` is `<origin>/brand/todz-lockup.png`; text carries the link and the ignore line
- [ ] Welcome mail: subject and heading; text and HTML carry the address
- [ ] `cloudflare` sender: the binding receives `from` `todz <noreply@todz.app>`, `replyTo` `hello@todz.app`, `to`, `subject`, `html`, `text`; a throwing binding rejects
- [ ] `EMAIL_SENDER=cloudflare` without the `EMAIL` binding: 503 on a link request, no row
- [ ] A new owner by link: one welcome; a returning owner: none; the fake provider: none; a welcome that throws: 201 anyway
- [ ] `GET /brand/todz-lockup.png`: 200 `image/png`, bytes equal to `docs/brand/todz-lockup.png`; `/owner/*` and `/mcp` still reach the Worker
- [ ] `pnpm verify all`: green, gates recorded

## Prove it for real

- [ ] `pnpm emails:preview` writes both mails to `.pr-media/emails/`
- [ ] Each mail in Playwright MCP at 1280 and 375 wide, light and dark (`browser_emulate_media`): the lockup header on dark, the white card, the gradient button readable, the mint accent, no horizontal scroll at 375; screenshots `01-sign-in-mail.png`, `02-welcome-mail.png` (light, for the README) and dark ones for the PR
- [ ] `pnpm --filter @todz/api dev:email`, ask for a link from the app or with `curl`: the console line carries the text; with `EMAIL_SENDER=cloudflare` under `wrangler dev`, the simulated binding writes the mail to a local file whose HTML is the template

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: no React reaches the Worker — attack: <how>; result: <refuted | held>
- [ ] Claim 2: a slot value cannot inject HTML — attack: <how>; result: <refuted | held>
- [ ] Claim 3: a welcome failure never fails a sign-in — attack: <how>; result: <refuted | held>

## Coverage honesty

- Real delivery to an inbox waits for `deploy-ready`'s sending-domain onboarding and the production smoke walk.
- Rendering in real mail clients (Gmail, Apple Mail, Outlook dark mode) is not tested; the preview in Chromium stands in.
