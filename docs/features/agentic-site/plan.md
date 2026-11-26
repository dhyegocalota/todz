# Agentic site: plan

- [x] 1. Red tests: `apps/api/test/agentic-site.test.ts` and the updated discovery, JSON-LD and constants tests (2673b287).
- [x] 2. The copy: the live status, download, free plan and docs MCP in `discovery-copy.ts`, the Privacy docs page, robots with CCBot, llms.txt and llms-full.txt (`site-discovery.test.ts`, `llms.txt for a live product`).
- [x] 3. The markdown landing, its `Link` header and `Accept` negotiation (`agentic-site.test.ts`, `the markdown landing`).
- [x] 4. The API catalog and the server card on the API host (`agentic-site.test.ts`, `the API catalog`, `the server card on the API host`).
- [x] 5. The JSON-LD `sameAs` and `downloadUrl` (`site-json-ld.test.ts`).

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A cache serves markdown to a browser | the landing without `Vary: Accept` | a test pins the header; revert the commit |
| 2 | The Privacy link 404s until the docs page exists | a docs.todz.app/privacy 404 | add the docs page |
