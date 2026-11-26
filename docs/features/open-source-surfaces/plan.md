# Open source surfaces: plan

- [ ] 1. Red tests and stubs: `repository-stars.test.ts`, `open-source-landing.test.ts`, the JSON-LD fields, `open-source-surfaces.test.ts`, `RepositoryAddressTests.swift`, `star-pill.spec.ts`.
- [ ] 2. `REPOSITORY` in `libs/types`, `repositoryStarsOf` and `formatStars` with their constants.
- [ ] 3. The pill, the count-up script, the open source line and the footer links on the landing; the JSON-LD and llms.txt lines.
- [ ] 4. `RepositoryAddress`, `OpenSourceCopy` and the two views in the popover footer, the todz menu and Settings.
- [ ] 5. The README badge, the feature docs and the index row.
- [ ] 6. Screenshots in light and dark at desktop and phone width under `media/`.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 2 | GitHub rate limits the site | the pill shows no number for five minutes | none needed |
| 3 | The count-up script changes the policy | a policy violation in the console | the policy test goes red first |
