# Transactional email

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-24 by the owner's queue (`transactional-email`: "magic-link and welcome templates, sent from the Worker through Cloudflare Email Service's `send_email` binding … behind a port, with a local fake"; the email direction "sexy and simple": the lockup header on dark `#0E1020`, one `#4C6BFF`→`#1B2A9E` button, a mint `#8CF7D0` accent, short copy, friendly in light and dark; React Email; a preview script; screenshots in the PR and the README). The build pattern and the sender are [ADR 0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md) and [ADR 0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md), the loop's calls
**ADRs:** [0042](../../adr/0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md), [0043](../../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md), [0041](../../adr/0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md), [0040](../../adr/0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md)
**Not changing:** the sign-in flow and its rules (ADR 0040), the console sender, the production deploy and the sending-domain onboarding (`deploy-ready`)

## Problem

The sign-in link is plain text through a console sender; a deployed Worker cannot send mail at all, and the mail does not look like todz.

## Goals

- The sign-in link and a welcome mail, each with an HTML part in the todz look and a plain-text part, from React Email templates rendered at build time.
- A `cloudflare` sender behind the existing port that sends through the `EMAIL` binding from `todz <noreply@todz.app>`, reply-to `hello@todz.app`.
- The welcome is sent once, when the first sign-in by link creates the owner; its failure never fails the sign-in.
- A preview script, and screenshots of both mails in light and dark in the PR and the README.

## Non-goals

- Onboarding `todz.app` for sending, the production deploy (`deploy-ready`), the landing's waitlist and digest mails (`landing`), localisation.

## Design

### Data flow

```
scripts/emails/*-template.ts ──(pnpm emails:generate: React Email render)──▶ src/emails/generated/email-templates.ts
                                                                                │ {subject, html, text} with {{link}} / {{email}}
sign-in-links.ts ── signInMail({link}) ──▶ EmailSender.send({to, subject, html, text})
owner-sign-in.ts ── a new owner by link ──▶ welcomeMail({email}) ──▶ EmailSender.send (failure ignored, outcome recorded nowhere)
EmailSender kinds: console (dev, ADR 0041) | cloudflare (EMAIL binding, ADR 0043)
GET /brand/todz-lockup.png ── Worker static assets (byte copy of docs/brand/todz-lockup.png)
```

### Interfaces

- `EmailMessage` gains `html`; the console sender keeps logging the text only.
- `EmailSenderKind.Cloudflare = 'cloudflare'`; `emailSenderOf` takes the env's `EMAIL` binding; `cloudflare` without the binding is no sender.
- `src/emails/email-slot.ts`: `EmailSlot { Link = '{{link}}', Email = '{{email}}' }`; `filledHtmlOf` escapes `& < > " '`; `filledTextOf` does not.
- `src/emails/sign-in-mail.ts` and `welcome-mail.ts` build `EmailMessage`s from the generated templates; `sign-in-mail-copy.ts` moves into the template.
- `scripts/emails/`: `cli.ts` (`generate` | `check` | `preview`, dispatched from a record), `render-email.ts`, `email-layout.ts`, `email-style.ts`, `sign-in-template.ts`, `welcome-template.ts`. Root scripts `emails:generate`, `emails:check`, `emails:preview`.
- `wrangler.jsonc`: `"send_email": [{ "name": "EMAIL", "allowed_sender_addresses": ["noreply@todz.app"] }]`, `"assets": { "directory": "./public" }` with `public/brand/todz-lockup.png`. `EMAIL_SENDER` stays unnamed in `wrangler.jsonc` until `deploy-ready`.
- The image URL in the header is `{{origin}}/brand/todz-lockup.png`, filled from `PUBLIC_ORIGIN`.

### Failure handling

| Case | Outcome |
|------|---------|
| `EMAIL.send` throws while sending a sign-in link | the link request answers 503 `sign_in_unavailable` and leaves no row (as today) |
| `EMAIL.send` throws while sending a welcome | the sign-in still answers 201 |
| `EMAIL_SENDER=cloudflare` with no binding | no sender: 503 on link requests |
| A slot value with `<` or `"` | escaped in HTML, literal in text |
| The generated module is stale | `generated-emails.test.ts` fails in the gate |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Render where | build time / in the Worker | Loop's call (ADR 0042): build time, zapbip's pattern | 2026-11-24 |
| Sender address | `noreply@` with reply-to `hello@` / `hello@` | Loop's call (ADR 0043): `noreply@todz.app`, reply-to `hello@todz.app` | 2026-11-24 |
| The header image | Worker static asset / inline data URI / CID attachment | Loop's call (ADR 0043): a static asset on the Worker | 2026-11-24 |
| Welcome trigger | first sign-in by link creates the owner / every sign-in | Loop's call: only when the owner is created | 2026-11-24 |

## Test strategy summary

Red first, unit (Node for the generator, Miniflare for the Worker): the generated module equals a fresh render; no `src` file imports React; each template's subject, heading, button href slot, lockup URL slot and plain text; slot escaping; the `cloudflare` sender calls the binding with `from`, `replyTo`, `to`, `subject`, `html`, `text` and rejects when it throws; `emailSenderOf` returns none for `cloudflare` without a binding; the link request sends HTML and text; a new owner by link gets exactly one welcome, a returning owner none, and a throwing welcome still signs in; `/brand/todz-lockup.png` is served and byte-equal to `docs/brand`. A walk: `pnpm emails:preview`, then each mail opened in Playwright at desktop and narrow widths, light and dark; screenshots for the PR and the README.
