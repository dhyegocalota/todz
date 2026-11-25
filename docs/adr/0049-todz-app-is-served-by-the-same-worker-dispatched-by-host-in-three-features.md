# 0049. todz.app is served by the same Worker, dispatched by host, and built in three features

- Status: Accepted (the build loop's call, the owner may overturn it); amends [0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) (a second public host) and [0048](0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md) §3 (how the guide is rendered)
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for "uma landing page hiper mega simples com fila de espera, painel admin, digest etc igual zapbip … pra ser um prod ready mesmo" and may overturn it
- Inspired by: zapbip's host dispatch (its ADR 0041, read-only), the run-13 research in `todz-loop/notes/landing-research.md`, [ADR 0045](0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)

## Context

The owner wants a landing on `https://todz.app`: short, polished, with a waitlist, an admin panel he signs in to, and a daily digest. It should port zapbip's pieces. The todz Worker already runs on `api.todz.app` and dispatches by path. zapbip's landing, backoffice and digest are Hono JSX with a password-and-TOTP admin. todz has no Hono and no cookie session, and its magic link is bound to the Mac that asked for it (ADR 0040).

## Decision

1. **One Worker, two hosts.**
   - `todz-api` also takes the custom domains `todz.app` and `www.todz.app`.
   - The Worker picks a handler by host from a record keyed by a `HostKind`:
     - `api.todz.app` serves today's routes;
     - `todz.app` serves the site;
     - `www.todz.app` answers 301 to the apex;
     - any other host answers 404.
   - The site never mounts `/owner`, `/mcp` or `/sign-in`, and the API host never serves the site.
   - `SITE_ORIGIN` (`https://todz.app`) joins `PUBLIC_ORIGIN`.
   - ~~Development maps the site to `127.0.0.1` and the API to `localhost` on the same port, so both run under one `wrangler dev`.~~ Amended 2026-11-24 (run 14): a spike showed that `wrangler dev` hands the Worker the upstream host whatever the client sent, so one instance cannot serve two hosts. Development tells them apart by port: the API on `localhost:8787`, the site on `localhost:8788` through its own `dev:site` instance.
   - The kind compares the request's `URL.host` with each origin's; when the API and site hosts are equal, the API wins.
2. **Pages are template strings.** The site follows `sign-in-page.ts`: HTML, CSS and script as constants, with a hashed CSP and copy in `*-copy.ts` modules. No Hono and no JSX in the Worker, because one page and one form do not justify a first runtime framework. zapbip's CSS and markup are ported by hand into that shape.
3. **Three features, in order.** Each goes through the harness and ships on its own:
   1. `landing`:
      - the host dispatch and the custom domains;
      - the page (hero, three benefit rows, the "how it works" strip, a final call to action, a footer);
      - real screenshots;
      - `/self-host`, rendered at build time from `docs/self-host.md` into a generated module, as the emails are (ADR 0042).

      Its waitlist form is present but answers "opening soon" until `landing-waitlist` ships.
   2. `landing-waitlist`:
      - a D1 table;
      - the join route, with Turnstile (action `waitlist`, host `todz.app`) and three limits (per client, per address digest, global) on their own namespaces, failing closed as in ADR 0045.

      No referral codes and no welcome mail in v1.
   3. `landing-admin`:
      - the admin signs in as the owner: the magic link opens a browser session, an HttpOnly, Secure, SameSite=Strict cookie on `todz.app/admin`, and only for the address in `ADMIN_EMAIL`, failing closed when it is unset. A spike proves how the link binds to a browser first;
      - the waitlist list and `export.csv`;
      - a daily digest to `hello@todz.app` from a `0 11 * * *` cron, sent even when nobody joined.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Same Worker, dispatched by host (chosen) | one deploy, one D1, the shared guard and mail code | the Worker grows | zapbip proved it |
| A second Worker for the site | isolation | a second deploy, D1 and secrets, or service bindings | twice the surface for one page |
| Cloudflare Pages | static hosting | another product; the waitlist and admin still need a Worker | not one deploy |
| Hono JSX, ported as is | the least porting | a first runtime framework in the Worker | template strings already serve two pages |
| One feature for everything | one PR | 30 files, an unproven admin session and the DNS move in one review | too big to review well |
| zapbip's password and TOTP admin | proven | a new credential beside the magic link | "the admin authenticates as the owner" |

## Consequences

- `api-source.test.ts` changes deliberately: the custom domains, `SITE_ORIGIN`, the assets list, and later the new namespaces and the cron.
- The deploy runbook gains the two custom domains and a DNS check on `todz.app` and `www`, plus later the waitlist's Turnstile check. The owner's `todz` widget is created for `todz.app`, which covers both hosts.
- The production smoke walk adds a signup, which needs `landing-waitlist` and the owner's widget.

## Revisit when

The site needs more than a few pages, or the owner wants the admin to do more than read the waitlist.
