# Docs cutover

**Status:** In review
**Tier:** 🟡 (a public route changes from a page to a redirect to an outside host, and the landing's generated guide and its generator go)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, PROMPT.md "Self-host, docs and credits" item 2 ("Afterwards it redirects (301) to the docs, and the landing, README and app link the docs"), taken as [ADR 0059](../../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md) § 8 foresaw: once `https://docs.todz.app/self-host` answers 200 with the guide. It did on 2026-11-25: Mintlify's deploy of 87e643f went live at 12:44 UTC, and the five pages answer 200 with todz's titles (`Introduction - todz`, `Self-host todz - todz`), no starter kit left (relayed by todz-6f, re-asked by the loop at 12:47 UTC).
**ADRs:** [0059](../../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md) § 8, [0048](../../adr/0048-the-self-host-guide-is-one-markdown-file-that-the-landing-serves.md) § 3, [0049](../../adr/0049-todz-app-is-served-by-the-same-worker-dispatched-by-host-in-three-features.md)
**Not changing:** the guide's text (`apps/docs/self-host.mdx`, its one source), the docs site, the landing's labels and layout, the admin, the waitlist, the API host, the macOS app

## Problem

`docs.todz.app` now serves the guide, yet `todz.app/self-host` still renders its own copy, generated from the same file, and the landing, the README and the runbooks point at that copy. Two published copies drift on every deploy gap: on 2026-11-25 the live landing still says `Connect an agent` where the docs say `Connect an Agent`.

## Goals

- `GET` and `HEAD` `https://todz.app/self-host` answer `301` with `Location: https://docs.todz.app/self-host`, `Cache-Control: max-age=3600` and no body, so a browser asks again after an hour instead of keeping the redirect for good. The query string is dropped: the `Location` is one constant, so no part of the request reaches the header, and the docs page takes no parameter.
- `https://www.todz.app/self-host`, any method and any query, answers the same `301` straight to the docs, not to `todz.app/self-host` first. Every other `www` path keeps its `301` to the site host with the path and the query.
- `/self-host/`, `POST /self-host` and `DELETE /self-host` on the site host stay `404`, and the API host keeps `404` for `/self-host`.
- The landing's header link and footer link, both labelled "Self-host guide", point at `https://docs.todz.app/self-host`, the guide itself rather than the docs home, because the label names the guide. Labels and copy stay as they are.
- The README's self-host link points at `https://docs.todz.app/self-host`.
- The landing's generated guide goes, with everything that only it reads: `self-host-page.ts`, `generated/self-host-html.ts`, `scripts/site/` (the generator, the Markdown renderer and the front matter helper), the `site:generate` and `site:check` scripts, the guide's styles, `LANDING_COPY.selfHost`, and their tests. The gate map stops sending `apps/docs/self-host.mdx` to the `@todz/api` unit suite, which no longer reads it.
- `docs/runbooks/deploy-the-api.md` step 13 expects the `301` for both `/self-host` probes.
- `docs/runbooks/mintlify-publish.md` records what the owner's setup really is: pull request previews not observed on the Hobby plan (`preview: false`); Mintlify's GitHub app not read-only by design, since its web editor asks for contents write, so its repository scope is the owner's check on GitHub; branch protection on `main` cannot be enforced on this private repository's plan (GitHub answers 403), so the Setup names the owner's options and a new step 5 lists, after each docs deploy, the commits under `apps/docs` since the previous one, expecting the owner alone (security review, IMPORTANT); and its run log gets the post-merge check of 87e643f. Step 3's expected credit becomes what the docs footer holds (`todz is a product of` and `Logic Bit`), since the full sentence was never on `docs.todz.app`.
- `docs/features/docs-mintlify/test-plan.md`'s after-merge rows carry this evidence.

## Non-goals

- **The macOS app.** It shows no help, guide or docs link today (no such string in `apps/macos/Copy/*.swift`), so nothing changes there; adding a Help link is UI and is left for a feature of its own.
- Relabelling the landing's links ("Docs" instead of "Self-host guide"): owner-facing copy, not asked.
- Redirecting other paths (`/docs`, `/self-host/`) or keeping the query string.
- Any change on `docs.todz.app` or in Mintlify's dashboard.

## Design

### Data flow

```
GET|HEAD https://todz.app/self-host[?anything]
   ── hostKindOf → Site ── serveSite: ROUTE_OF_REQUEST["GET /self-host"] = redirectToDocs
   ──▶ 301, Location: https://docs.todz.app/self-host, no body

ANY https://www.todz.app/self-host[?anything]
   ── hostKindOf → WwwRedirect ── redirectToSite: the path is /self-host → redirectToDocs
   ──▶ 301, Location: https://docs.todz.app/self-host

ANY https://www.todz.app/<other>[?query]  ──▶ 301, Location: https://todz.app/<other>[?query]   (unchanged)

landing header and footer  ── href ──▶ https://docs.todz.app/self-host
README                     ── link ──▶ https://docs.todz.app/self-host
apps/docs/self-host.mdx    ── Mintlify ──▶ docs.todz.app/self-host   (the one published copy)
```

### Interfaces

- `apps/api/src/site/self-host-redirect.ts`: `SELF_HOST_PATH = '/self-host'`, `DOCS_SELF_HOST_URL = 'https://docs.todz.app/self-host'`, `redirectToDocs(): Response` (`301`, `Location` the constant, null body).
- `site-endpoint.ts`: `GET` and `HEAD` of `SELF_HOST_PATH` route to `redirectToDocs`.
- `index.ts`: `redirectToSite` returns `redirectToDocs()` when the path is `SELF_HOST_PATH`.
- `site-shell.ts`: the header and footer links use `DOCS_SELF_HOST_URL`.

### Failure handling

| Case | Effect |
|---|---|
| `docs.todz.app` is down or Mintlify serves a bad build | the 301 still answers; the reader lands on Mintlify's error or the last good build. The runbook `mintlify-publish` covers the docs host |
| a browser cached the 301 and the docs move again | the cached redirect holds until the browser drops it; a future move adds a redirect on `docs.todz.app`, not here |
| the deployed Worker predates this feature | `/self-host` keeps answering 200 with the old copy; step 13 of the deploy runbook names it |
| a request carries a query or a fragment | the `Location` is the constant; the browser keeps a fragment by itself |

### Rollback

Revert the pull request and deploy: the landing renders its copy again from `apps/docs/self-host.mdx` and the links return. Browsers that cached the 301 keep going to the docs, which serve the same guide. No data is involved.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Keep or drop the query string on the redirect? | keep; drop | the loop's call: drop, so the `Location` is one constant and no request input reaches a header; ADR 0059 does not say | 2026-11-25 |
| Where do the landing's links point? | the guide; the docs home | the loop's call: the guide, because both links say "Self-host guide" | 2026-11-25 |
| `www.todz.app/self-host`: one hop or two? | straight to the docs; to `todz.app/self-host` first | the loop's call: straight to the docs, one hop | 2026-11-25 |
| The macOS app's docs link | add a Help link; none | the loop's call: none, no help link exists and adding one is UI | 2026-11-25 |

## Test strategy summary

Unit (`@todz/api`, Workers pool): through `worker.fetch`, `GET` and `HEAD` `todz.app/self-host` and `www.todz.app/self-host?ref=x` answer `301` to the docs with no query; the other `www` paths keep path and query; `/self-host/`, `POST` and `DELETE` stay `404`; the landing's header and footer links carry the docs URL. End-to-end (landing): the footer and header links' `href` is the docs URL, and a request to `/self-host` without following redirects answers `301` with that `Location`. Shape (`tools/repository-shape`): the README links the docs guide; step 13 of the deploy runbook expects the `301` and the docs `Location` for both probes; the Mintlify runbook's setup states `preview: false`, the owner's repository check, and no read-only claim. `scripts/verify.test.sh`: `apps/docs/self-host.mdx` no longer selects the `@todz/api` unit suite.
