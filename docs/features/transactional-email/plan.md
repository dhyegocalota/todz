# Plan: Transactional email

**Spec:** spec.md
**Tier:** 🟡
**Seam:** the `EmailSender` port of ADR 0041, `sign-in-links.ts`, the owner creation in `owner-sign-in.ts`, `wrangler.jsonc`
**Assumptions (decided, owner can override):**
- ADRs 0042 and 0043, built while `Proposed` (the owner asked the loop to decide every call and review later, PROMPT.md 2026-11-24).
- The branch starts from `feat/magic-link-sign-in` and takes `main` by merge once that feature ships.
- spec.md → Plan review answers T1–T10 bind every step.
- Ported from the owner's zapbip (`/Users/dhyegocalota/Projects/zapbip/zapbip/apps/api/scripts/emails/`, read-only): copy and adapt, never edit it.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/scripts/emails/**` (new), `apps/api/src/emails/**` (new), `apps/api/src/email-sender.ts`, `apps/api/src/sign-in-links.ts`, `apps/api/src/sign-in-mail-copy.ts` (removed), `apps/api/src/owner-sign-in.ts`, `apps/api/src/env.ts`, `apps/api/src/index.ts`, `apps/api/public/**` (new), `apps/api/wrangler.jsonc`, `apps/api/package.json`, `apps/api/tsconfig*.json`, `apps/api/vitest.config.mts`, `apps/api/tsconfig.scripts.json` (new), `apps/api/test/**`, `apps/api/src/owner-request.ts`, `apps/api/src/owner-endpoint.ts`, `apps/api/README.md`, `package.json` (root scripts), `pnpm-lock.yaml`, `tools/repository-shape/src/api-source.test.ts`, `docs/features/transactional-email/tester-briefing.md` | `developer` |

## Sequencing

One group, in order.

## Steps

### G1

- [ ] **Step 1:** Red: `test/emails/email-slot.test.ts` (fills and escapes), `test/emails/generated-emails.test.ts` (the module on disk equals a fresh render; runs in Node, not Miniflare: a second vitest project if needed), `test/emails/runtime-email-imports.test.ts` (no `src` file imports `react`, `react-dom` or `@react-email`), `test/emails/email-templates.test.ts` (each template's subject, heading, the button's `href` holding `{{link}}`, the header image's `src` holding `{{origin}}/brand/todz-lockup.png`, the plain text holding the link and "If you didn't ask for this, ignore this email."). Commit failing alone.
- [ ] **Step 2:** Green: the dev dependencies (React Email 1.0.12 / render 2.0.6 / React 19.3.1 / tsx, as zapbip), `scripts/emails/` (layout, style, two templates with `createElement`, `render-email.ts`, `cli.ts` with `generate`, `check` and `preview` from a record), the generated module, `email-slot.ts`, the root scripts.
- [ ] **Step 3:** Red: `test/email-sender.test.ts`: `cloudflare` calls the binding with `from` `todz <noreply@todz.app>`, `replyTo` `hello@todz.app`, `to`, `subject`, `html`, `text`; rejects when the binding throws; `emailSenderOf` gives none for `cloudflare` without a binding and keeps the console rules. `test/sign-in-links.test.ts`: the link request sends HTML whose button `href` and text both carry the link, and the HTML has the origin's lockup URL. `test/owner-sign-in.test.ts`: a new owner by link gets exactly one welcome; a returning owner none; the fake provider none; a welcome sender that throws still answers 201. `test/brand-asset.test.ts`: `GET /brand/todz-lockup.png` answers the PNG byte-equal to `docs/brand/todz-lockup.png`. Commit failing alone.
- [ ] **Step 4:** Green: the `cloudflare` kind, `sign-in-mail.ts` and `welcome-mail.ts`, the welcome after owner creation, `wrangler.jsonc` `send_email` and `assets`, `public/brand/todz-lockup.png`, the `api-source.test.ts` guard still allowing only the console sender to name `console`.
- [ ] **Step 5:** `apps/api/README.md` (purpose only); tester briefing with `pnpm emails:preview` and how to open each mail.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | The generator's output is not deterministic | `generated-emails.test.ts` flakes | pin the render options and Prettier config as zapbip does |
| 2 | React reaches the Worker bundle | `runtime-email-imports.test.ts` fails, or `wrangler deploy --dry-run` grows by hundreds of kB | move the import to `scripts/` |
| 4 | `assets` changes routing so owner and MCP paths miss the Worker | `worker.test.ts` and the MCP tests fail | `run_worker_first` for the API paths, or serve the PNG from the Worker |
| 4 | Miniflare rejects the `send_email` binding shape | the vitest config fails to start | omit the binding in the test config and inject a fake binding in tests |

**Steps with no backout:** none.

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **Security reviewer:** verdict recorded.
- [ ] **/check-ui:** the two mails' screenshots recorded and uploaded.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
