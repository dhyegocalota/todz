# 0043. Mail leaves through Cloudflare Email Service, from noreply@todz.app

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) chose Cloudflare Email Service and subscribed to Workers Paid on 2026-11-24, and may overturn this
- Inspired by: the owner's queue of 2026-11-24 (`transactional-email`: "sent from the Worker through Cloudflare Email Service's `send_email` binding"; "the sender address is the loop's call"), [ADR 0041](0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md), Cloudflare's Email Service documentation read on 2026-11-24

## Context

ADR 0041 put outgoing mail behind an `EmailSender` port with only a console sender. Cloudflare Email Service sends from a Worker through a `send_email` binding to any recipient on Workers Paid, which the owner has. The `todz.app` zone already routes `hello@` and `support@` to the owner, and its DMARC is `p=none`.

## Decision

1. A second sender kind, `cloudflare`, calls the `EMAIL` binding's `send({from, to, subject, html, text, replyTo})`. It is chosen by `EMAIL_SENDER=cloudflare`; with that kind and no binding, the Worker has no sender and fails closed (503), as ADR 0041 does.
2. Mail comes from `todz <noreply@todz.app>` with a reply-to of `hello@todz.app`, so a reply reaches the owner through Email Routing. The binding allows only that sender (`allowed_sender_addresses`).
3. The sender rejects when the binding throws. The sign-in link's request then answers 503 and leaves no row (ADR 0040). The welcome is sent after the first sign-in creates the owner, and its failure never fails the sign-in.
4. The `email` messages carry both parts: the generated HTML ([ADR 0042](0042-emails-are-react-email-templates-rendered-at-build-time-into-a-generated-module.md)) and the plain text.
5. The email header's lockup is served by the Worker at `/brand/todz-lockup.png` from its static assets, a byte copy of `docs/brand/todz-lockup.png`, because mail clients block inline `data:` images.
6. Onboarding `todz.app` as a sending domain (its `cf-bounce` MX, SPF and DKIM records) is a runbook step of `deploy-ready`, through the Email Sending API with the owner's token.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Cloudflare Email Service binding (chosen) | no API key to keep; same account and zone; the owner's choice | beta; quotas grow with history | — |
| Resend, as zapbip does | mature, good deliverability | a second vendor and a secret | the owner chose Cloudflare |
| The Email Sending REST API with a token | works outside a Worker | a secret in the Worker | the binding needs none |
| `hello@todz.app` as the sender | replies land directly | the owner's inbox address on every automated mail | `noreply@` plus a reply-to does both |

## Consequences

- `wrangler.jsonc` gains the `send_email` binding and an `assets` directory; `deploy-ready` names `EMAIL_SENDER=cloudflare` for production.
- A local `wrangler dev` simulates the binding and writes the mail to local files; tests fake the port.

## Evidence

`@cloudflare/workers-types` 5.20261123.1 declares `SendEmail.send(builder: EmailMessageBuilder): Promise<EmailSendResult>` with `from`, `to`, `subject`, `html`, `text` and `replyTo`. Wrangler 4.167.0's schema accepts `send_email[].allowed_sender_addresses`.

## Revisit when

Deliverability falls short, the daily quota binds, or the product needs marketing mail with unsubscribe handling.
