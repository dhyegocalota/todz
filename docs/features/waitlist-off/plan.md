# Waitlist off: plan

- [ ] 1. Red tests: `apps/api/test/waitlist-off.test.ts` and the trigger pin in `tools/repository-shape/src/api-source.test.ts`.
- [ ] 2. The landing page without the form, the widget and the page script; the copy without its join strings.
- [ ] 3. `POST /join` answers 410 through `apps/api/src/site/waitlist-closed.ts`; the join handler, its limiter and its stamp go.
- [ ] 4. The `join_waitlist` tool leaves the WebMCP script and copy.
- [ ] 5. The digest leaves the dispatch and `wrangler.jsonc`.
- [ ] 6. llms.txt, llms-full.txt and the JSON-LD stop mentioning the waitlist.
- [ ] 7. The READMEs, the self-host guide, the deploy runbook's schedule line and the smoke walk's step 12.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 3 | An old tab keeps posting | 410 with the download text | none needed |
| 5 | The deploy keeps the old cron | a Cron Events failure naming `0 11 * * *` | deploy again from the same commit |
