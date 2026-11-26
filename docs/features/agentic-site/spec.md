# Agentic site

**Status:** Approved
**Tier:** 🟡
**Owner approval:** approved 2026-11-26 by the owner's request to the loop ("deixa o site bem agentic supported, llms.txt e tudo mais"), inheriting the product scope of [docs/product/README.md](../../product/README.md)
**ADRs:** none; [0059](../../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md) and [0060](../../adr/0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md) stay as history
**Not changing:** the landing's look, its policy, the MCP endpoint and the app

## Problem

todz is live, but the files agents read still describe a product in waiting, the MCP server card answers only on todz.app, the landing has no markdown form and no API catalog points at the MCP server, the docs and the docs MCP.

## Goals

- llms.txt and llms-full.txt describe a live product: the download at todz.app/download with the note that the app updates itself, open source under AGPL-3.0, "free on todz cloud, or self-host", the Install on Mac, self-host and Privacy docs and the docs MCP command; llms-full.txt keeps the full Claude Code, Codex and Cursor setups.
- `api.todz.app/.well-known/mcp/server-card.json` answers the same card as todz.app.
- `/index.md` is a markdown alternate of the landing generated from the landing copy; the landing sends `Link: </index.md>; rel="alternate"; type="text/markdown"` and answers markdown to `Accept: text/markdown`, varying on `Accept`.
- `/.well-known/api-catalog` (RFC 9727, `application/linkset+json`) points at the server card, the docs, llms.txt and the docs MCP.
- robots.txt allows ClaudeBot, Claude-User, Claude-SearchBot, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended and CCBot beside GPTBot and OAI-SearchBot.
- The JSON-LD application carries `sameAs` (the repository and the docs) and `downloadUrl`; no waitlist offer.
- WebMCP and the copy say nothing about a waitlist or an app not yet available.

## Non-goals

- A Privacy page on the docs site: the link is the one the owner named.
- Changing the landing's HTML, style or policy.

## Design

### Data flow

The markdown and the llms files are built once at module load from `LANDING_COPY` and `DISCOVERY_COPY` and served as discovery files. The API host routes the well-known card path to the card the site already serves. The landing route reads `Accept` and answers the prebuilt markdown without fetching the star count.

### Failure handling

`POST` on any new path answers an empty 404. `/index.md` and the catalog answer 404 on the API host.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Pricing line | Keep "pricing not announced", or say free | "free on todz cloud, or self-host" | 2026-11-26 |

## Test strategy summary

`apps/api/test/agentic-site.test.ts` pins each new route's status, type, headers and body facts, the unchanged policy and the absence of stale phrases; the existing discovery, JSON-LD and constants tests carry the new values.
