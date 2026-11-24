# 0042. Emails are React Email templates, rendered at build time into a generated module

- Status: Proposed
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for React Email and may overturn this
- Inspired by: the owner's direction of 2026-11-24 ("React Email: TypeScript with `@react-email/components`, rendered to HTML in the Worker, or at build time if the bundle is too heavy"; "sexy and simple"), the owner's zapbip repository, which renders its emails at build time (its ADR 0058), [ADR 0041](0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md)

## Context

todz sends two emails: the sign-in link and a welcome. The owner wants them written with React Email. Rendering React in the Worker would put React, React DOM and the React Email renderer into every request's bundle and cold start, for two templates whose only per-recipient values are a link and an address. The owner's zapbip already renders its templates at build time into a generated TypeScript module and has proven the pattern.

## Decision

1. Templates are React Email components in `apps/api/scripts/emails/`, written with `createElement` from the `react-email` package (the repository has no JSX setup), sharing one layout: the todz lockup on `#0E1020`, a white card, one `#4C6BFF`→`#1B2A9E` button, a mint `#8CF7D0` accent, short copy.
2. `pnpm emails:generate` renders each template to `{subject, html, text}` and writes `apps/api/src/emails/generated/email-templates.ts`, formatted with Prettier and committed. Per-recipient values are slots (`{{link}}`, `{{email}}`) from an `EmailSlot` enum, filled at send time, HTML-escaped in the HTML part.
3. A unit test fails while the generated module differs from a fresh render, and another fails if any file under `apps/api/src` imports `react`, `react-dom`, `react-email`, `@react-email/*` or anything under `scripts/`, so React never reaches the Worker.
4. `pnpm emails:preview` writes each template's HTML, with sample slots, to `.pr-media/emails/` for screenshots in light and dark.
5. React, React DOM and the React Email packages are development dependencies of `@todz/api` only.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Render at build time into a generated module (chosen) | no React at runtime; proven in zapbip; the output is reviewable in the diff | a generate step to remember | the stale-file test catches a forgotten step |
| Render in the Worker per send | no generate step | React in the bundle and cold start of every request | the owner allowed build time when the bundle is heavy |
| Hand-written HTML strings | no dependency | the owner asked for React Email; table markup by hand | — |

## Consequences

- A template change is: edit the component, run `pnpm emails:generate`, commit both.
- `tsx` joins the development dependencies to run the generator.
- The components come from `react-email` (6.11.16) and the renderer from `@react-email/render` (2.3.1), not from `@react-email/components` 1.0.12, which npm marks deprecated.

## Evidence

On 2026-11-24 `npm view` showed `@react-email/components` 1.0.12 (published 2026-04-09) as `deprecated: Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.`, with `latest` still pointing at it. The same maintainers (zenorocha, bukinoshita, gabrielmfern) publish `react-email` 6.11.16 (2026-11-17, `latest`, not deprecated), whose tarball (`npm pack`, integrity `sha512-/d0gipOg2mB4IOqM46SfcQIZsJP2rumyxZWREOB8hKcyLAFDSlurCyvfWKVA85JaMUZECVFTN/U0UdqUAIBgXQ==`) exports Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section and Text, re-exports `@react-email/render`, declares no `preinstall`, `install` or `postinstall` script, and needs `react` and `react-dom` as peers. The switch changed the generated HTML in one way: the `<link rel="preload">` for the lockup is gone. `pnpm security:audit` and `pnpm audit --audit-level=high` (all dependencies) both print `No known vulnerabilities found` after the switch. `react-email` is a development dependency and also brings its preview server's packages (`socket.io`, `esbuild`, `tailwindcss`); none reaches the Worker, which the import guard test proves.

zapbip's `apps/api/scripts/emails/` and `test/unit/generated-emails.test.ts`, read on 2026-11-24, used `@react-email/components` 1.0.12, `@react-email/render` 2.0.6 and React 19.3.1 before this switch.

## Revisit when

`react-email` grows an install script or a deprecation notice, or an email needs per-recipient structure that slots cannot express (lists, conditional blocks), such as the landing's digest.
