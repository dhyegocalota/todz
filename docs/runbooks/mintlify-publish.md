# Publish the docs on Mintlify

Every merge to `main` that touches `apps/docs` publishes `docs.todz.app`: check the docs before the merge, then check the site after it ([ADR 0059](../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md)).

## Setup

The owner did this on 2026-11-25 in Mintlify's dashboard and on GitHub; the loop never repeats it and makes no DNS record.

- Mintlify project `todz`, on the Hobby plan.
- Source: the GitHub repository `dhyegocalota/todz`, through Mintlify's GitHub app.
- Deploy branch `main`, content directory `apps/docs`.
- Pull request previews: not observed on the Hobby plan (the deployment setting `preview: false`), so an unmerged branch is not published.
- Mintlify's GitHub app can write as well as read, by design: Mintlify asks for write access to the repository's contents for its web editor. Its repository scope is the owner's check, not the loop's: GitHub → Settings → Applications → Mintlify → "Only select repositories" with `dhyegocalota/todz` alone. Branch protection on `main` already requires a pull request.
- Custom domain `docs.todz.app`, connected in the dashboard with SSL, serving Mintlify's starter kit until the first merge that touches `apps/docs`.

## Steps

1. **Check the docs before the merge.** On the branch head, run `pnpm --filter @todz/docs broken-links` and `pnpm --filter @todz/docs validate` from the repository root.
   Expected: the first prints `success no broken links found`, the second exits 0.
   If it fails: the merge waits. Fix the link or the page the output names; a bad merge publishes at once.

2. **Wait for the build of the merge commit.** Open the project's deployments in Mintlify's dashboard after the merge.
   Expected: the build of the merge commit shows as deployed.
   If it fails: read the dashboard's build log. `docs.todz.app` keeps the last good build meanwhile, so the next step still sees the old titles.

3. **Ask the host.** Run `curl -sS -D - https://docs.todz.app/self-host`, `curl -sS https://docs.todz.app/` and `curl -sS -D - https://docs.todz.app/no-such-page`.
   Expected: the first answers `HTTP/2 200` and holds `Self-host todz`; the second holds the footer's credit, `todz is a product of` and `Logic Bit`; the third answers 404 and holds `Page not found`.
   If it fails: the starter kit's text means the build has not landed. Ask again each minute for up to fifteen minutes, then read the build log of step 2.

4. **Walk it.** With Playwright, open the five pages and the 404 page of `https://docs.todz.app` at 1280 and 375 pixels wide, in light and dark.
   Expected: every page shows its title and the todz logo, and the console has no error.
   If it fails: a defect goes back to Build with a regression in the `docs` gate of `pnpm verify`.

## Rollback

Revert the merge on `main`. Mintlify publishes the revert, or keeps its last good build when the revert removes `apps/docs`. Taking the docs offline is the owner's step: disconnect the domain in the dashboard.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
| 2026-11-25 | 87e643f | 2 | The deployment of the merge commit of PR #42 shows as live at 12:44 UTC (todz-6f's check in the dashboard); pull request previews not observed, the deployment's `preview: false` |
| 2026-11-25 | 87e643f | 3 | At 12:47 UTC: `/`, `/quickstart`, `/connect-an-agent`, `/mcp-tools` and `/self-host` each `200`, `/no-such-page` `404` holding `Page not found`; titles `Introduction - todz` and `Self-host todz - todz`; no starter kit page left. Deviation: `/` never held `todz is a product of Logic Bit, made in Brazil`, since the footer carries `todz is a product of` and `Logic Bit` apart; step 3 now expects those two (`docs-cutover`) |
