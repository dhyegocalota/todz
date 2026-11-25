# A signed-in route with no quota lets one tenant fill the directory every tenant shares

- Date: 2026-11-25
- Inspired by: the `security-sweep` review of `main` at `e10641e` (finding 1, IMPORTANT, and twelve MINOR), [ADR 0073](../adr/0073-signed-in-writes-have-quotas-and-signed-in-routes-a-rate-limit-per-owner-and-per-key.md)
- Revisited: 2026-11-25 — still true (written the same day)

## Signal

Every public route has its limiters and Turnstile, so the sweep found nothing to flood without a session; but one Turnstile solve and one mail buy a session, and from there `POST /owner/workspaces`, `/projects` and `/keys` insert rows without end into the one D1 database that holds every tenant's sessions, keys and links. The symptom, the day it is used, is D1 refusing writes for everyone, not for the tenant who caused it.

## Cause

The public routes were guarded by their own feature (ADR 0045, ADR 0050) and the signed-in routes were built earlier, when signing in needed no mail; nothing revisited them when sign-in became open to any address. A signed-in caller was treated as trusted because it is authenticated, though anyone can become one.

## Do

Give every insert into a shared table its cap in the same statement (`INSERT … SELECT … WHERE (SELECT count(*) …) < ?`), never a count followed by an insert; give every signed-in route a limiter keyed by the credential, not the client address. When a public route opens sign-up to anyone, sweep the signed-in routes in the same change.

The sweep's result, every finding with the commit that fixed it:

| # | Finding | Fix |
|---|---------|-----|
| 1 | No quota or rate limit on signed-in routes | Count-guarded inserts for workspaces, projects and live keys; `OWNER_LIMITER` and `MCP_LIMITER` |
| 2 | Owner bodies read at any size | `parsedBody` requires `isBoundedRequest` |
| 3 | Static assets without a policy | `_headers` gives `/*` `default-src 'none'; frame-ancestors 'none'` |
| 4 | `?`, `#`, `%` in an address domain | The domain is dot-separated labels of `[a-z0-9-]` |
| 5 | A crash skips the security headers | `fetch` answers an empty 500 through `withSecurityHeaders` |
| 6 | No daily cap on the waitlist | `joinWaitlistWithinLimit`, over the cap opens soon |
| 7–9 | The app's session vault binds and reads too much | The app lane, `lane/security-sweep-app` |
| 10 | A change socket outlives its session | Sockets tagged with the session digest, closed at sign-out |
| 11 | Dev-only highs under `mint` | `pnpm.overrides` for `sharp` and `js-yaml` under the mint tree |
| 12 | HSTS without `includeSubDomains` | Added after every subdomain was seen redirecting to `https` |
| 13 | The key on a shell command line | Accepted (ADR 0034) |

## Anchor

`apps/api/src/directory-workspaces.ts`, `apps/api/src/directory.ts` (`insertProjectKey`), `apps/api/src/signed-in-limiter.ts`, `apps/api/test/owner-quotas.test.ts`, `apps/api/test/owner-rate-limit.test.ts`, `docs/features/security-sweep/`.
