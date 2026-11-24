# 0044. The Wrangler configuration is production on api.todz.app, and development overrides it

- Status: Proposed; amends [0020](0020-sign-in-goes-through-a-provider-port-and-v1-ships-only-the-fake.md) §3, [0041](0041-outgoing-email-goes-through-a-port-with-a-console-sender-for-development.md) §2 and [0008](0008-runbooks-live-in-the-repository.md)
- Date: 2026-11-24
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) bought `todz.app`, authorized the deploy on 2026-11-24 ("já comprei todz.app no Cloudflare, configura tudo") and may overturn this
- Inspired by: PROMPT.md "Publishing on todz.app" (2026-11-24), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md), [ADR 0043](0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)

## Context

The Worker has only ever run under `wrangler dev` and Miniflare. `wrangler.jsonc` names a placeholder D1 id and no route, and by ADR 0020 and ADR 0041 it never names a sign-in provider or a sender, so a deploy fails closed. The owner now owns `todz.app` in Cloudflare and has authorized the loop to deploy the todz Worker there, create its D1 database and routes, and set up mail sending. ADR 0020 rejected a `env.production` block because Wrangler does not inherit bindings into named environments, so every binding would be declared twice. The macOS app reads its server from `TodzAPIBaseURL`, which is `http://localhost:8787` in every build.

## Decision

1. `wrangler.jsonc`'s top level is production. It names:
   - the D1 database `todz-directory`, with its real id;
   - the route `api.todz.app` as a custom domain;
   - the vars `SIGN_IN_PROVIDER=email`, `EMAIL_SENDER=cloudflare` and `PUBLIC_ORIGIN=https://api.todz.app`.

   It never names `fake` or `console`. A repository-shape test pins those values, which replaces ADR 0020 §3's and ADR 0041 §2's "never names it".
2. Development overrides the production vars:
   - the `dev` and `dev:email` scripts pass `--var` for the provider, the sender and a local origin;
   - the tests set their bindings in the Miniflare options, which win over `vars`;
   - local D1 state stays local, because `wrangler dev` never touches the remote database without `--remote`.
3. Every Cloudflare resource name starts with `todz`: the Worker `todz-api`, the database `todz-directory`, the Durable Object namespace that `todz-api` owns. Nothing else in the account is read or changed.
4. A per-client limit joins the per-address limit of ADR 0040. A Workers rate-limit binding, keyed by `CF-Connecting-IP`, guards `POST /owner/sign-in-links` and `POST /owner/sessions`. It needs no zone rule and no extra token permission.
5. The macOS app's `TodzAPIBaseURL` comes from a build setting. The Debug configuration keeps `http://localhost:8787`; Release names `https://api.todz.app`.
6. The deploy is a runbook, `docs/runbooks/deploy-the-api.md`. Under the owner's authorization of 2026-11-24, the build loop runs its remote steps itself, from `main`, after `pnpm verify all` is green and the features' tester and reviewers have passed, and records each run's outcome. A person runs the same steps thereafter. This amends ADR 0008's "agents never run them" for this runbook only.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Top level is production, development overrides with `--var` (chosen) | one declaration per binding; a plain `wrangler deploy` is production | `wrangler dev` without the scripts runs with production vars against local state | the scripts are the only documented way to run it, and local state never reaches production |
| A `env.production` block | the top level stays safe | every binding declared twice; drift between them | ADR 0020's reason still holds |
| A second config file for production | clear split | two files to keep in step; tests read one | duplication |
| A zone rate-limiting rule | no code | needs a WAF permission the token lacks; one rule on the plan | the binding needs neither |

## Consequences

- `wrangler deploy` from `apps/api` ships production. The runbook guards that it runs from `main` with a clean tree.
- `docs/runbooks/README.md` drops "agents never run them" for this runbook.
- The app's Release build talks to production, which the production smoke walk uses.

## Evidence

The token in the Keychain item `todz-cloudflare` verified as active on 2026-11-24 and sees the zone `todz.app` (id `06490974636c535e2cbfd7c5b09925a5`) in account `e2035d8e0b7173d520ccf643f6f4661c`.

## Revisit when

A staging environment is needed, or a second person deploys.
