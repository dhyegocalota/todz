# Agentic site: plan

- [ ] 1. Red tests: `apps/api/test/agentic-site.test.ts` and the updated discovery, JSON-LD and constants tests.
- [ ] 2. The copy: the live status, download, free plan and docs MCP in `discovery-copy.ts`, the Privacy docs page, robots with CCBot, llms.txt and llms-full.txt.
- [ ] 3. The markdown landing, its `Link` header and `Accept` negotiation.
- [ ] 4. The API catalog and the server card on the API host.
- [ ] 5. The JSON-LD `sameAs` and `downloadUrl`.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | A cache serves markdown to a browser | the landing without `Vary: Accept` | a test pins the header; revert the commit |
| 2 | The Privacy link 404s until the docs page exists | a docs.todz.app/privacy 404 | add the docs page |
