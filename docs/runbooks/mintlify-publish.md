# Publish the docs on Mintlify

Every merge to `main` that touches `apps/docs` publishes `docs.todz.app`: check the docs before the merge, then check the site after it ([ADR 0059](../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md)).

## Setup

The owner did this on 2026-11-25 in Mintlify's dashboard and on GitHub; the loop never repeats it and makes no DNS record.

- Mintlify project `todz`, on the Hobby plan.
- Source: the GitHub repository `dhyegocalota/todz`, through Mintlify's GitHub app.
- Deploy branch `main`, content directory `apps/docs`.
- Custom domain `docs.todz.app`, connected in the dashboard with SSL, serving Mintlify's starter kit until the first merge that touches `apps/docs`.

## Steps

1. **Check the docs before the merge.** On the branch head, run `pnpm --filter @todz/docs broken-links` and `pnpm --filter @todz/docs validate` from the repository root.
   Expected: the first prints `success no broken links found`, the second exits 0.
   If it fails: the merge waits. Fix the link or the page the output names; a bad merge publishes at once.

2. **Wait for the build of the merge commit.** Open the project's deployments in Mintlify's dashboard after the merge.
   Expected: the build of the merge commit shows as deployed.
   If it fails: read the dashboard's build log. `docs.todz.app` keeps the last good build meanwhile, so the next step still sees the old titles.

3. **Ask the host.** Run `curl -sS -D - https://docs.todz.app/self-host`, `curl -sS https://docs.todz.app/` and `curl -sS -D - https://docs.todz.app/no-such-page`.
   Expected: the first answers `HTTP/2 200` and holds `Self-host todz`; the second holds `todz is a product of Logic Bit, made in Brazil`; the third answers 404 and holds `Page not found`.
   If it fails: the starter kit's text means the build has not landed. Ask again each minute for up to fifteen minutes, then read the build log of step 2.

4. **Walk it.** With Playwright, open the five pages and the 404 page of `https://docs.todz.app` at 1280 and 375 pixels wide, in light and dark.
   Expected: every page shows its title and the todz logo, and the console has no error.
   If it fails: a defect goes back to Build with a regression in the `docs` gate of `pnpm verify`.

## Rollback

Revert the merge on `main`. Mintlify publishes the revert, or keeps its last good build when the revert removes `apps/docs`. Taking the docs offline is the owner's step: disconnect the domain in the dashboard.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
