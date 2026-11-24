# 0041. Outgoing email goes through a port, with a console sender for development

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), the owner's queue of 2026-11-24 (`transactional-email`: React Email templates sent through Cloudflare Email Service, "behind a port, with a local fake")

## Context

The sign-in link must be mailed. The real sender, Cloudflare Email Service with React Email templates, is its own feature, `transactional-email`, which follows. Development and tests need the link without a mail server, and a deployed Worker must never fall back to a sender that only logs.

## Decision

1. The Worker sends mail through an `EmailSender` port: `send({to, subject, text})` resolves when the message is handed over, or rejects.
2. The kind is chosen by the `EMAIL_SENDER` variable, like the sign-in provider (ADR 0020): `console` logs the recipient's address and the message's text, link included, and is set only by the `dev` script and the test configuration. `wrangler.jsonc` never names it. With no kind, `POST /owner/sign-in-links` answers 503 `sign_in_unavailable`.
3. Tests read what the console sender wrote by spying on the console, so no test-only sender ships in the Worker.
4. `transactional-email` adds the Cloudflare kind behind the same port and the HTML templates; the sign-in link's text stays the plain-text part.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A port with a console sender selected only in development (chosen) | the link works locally today; a deploy without a sender fails closed | the real sender is not here yet | it is the next feature |
| Build the Cloudflare sender in this feature | one feature fewer | mixes sign-in with templates and domain onboarding | the owner queued them apart |
| A development route that lists the last links | the app's walk could read it | a route that hands out sign-in tokens must never deploy | the console is enough and cannot be reached remotely |

## Consequences

- The development console shows sign-in links, which carry tokens; the console of a deployed Worker never does, because no deployed configuration names `console`.

## Evidence

The `fake` provider has followed the same pattern since `owner-api` (ADR 0020), and its test proves a Worker without the variable answers 503.

## Revisit when

`transactional-email` ships the Cloudflare sender.
