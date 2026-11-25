# Publish the docs on Mintlify

Every merge to `main` that touches `apps/docs` publishes `docs.todz.app`: check the docs before the merge, then check the site after it ([ADR 0059](../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md)).

## Setup

The owner did this on 2026-11-25 in Mintlify's dashboard and on GitHub; the loop never repeats it and makes no DNS record.

- Mintlify project `todz`, on the Hobby plan.
- Source: the GitHub repository `dhyegocalota/todz`, through Mintlify's GitHub app.
- Deploy branch `main`, content directory `apps/docs`.
- Pull request previews: not observed on the Hobby plan (the deployment setting `preview: false`), so an unmerged branch is not published.
- Mintlify's GitHub app can write as well as read, by design: Mintlify asks for write access to the repository's contents for its web editor. Its repository scope is the owner's check, not the loop's: GitHub → Settings → Applications → Mintlify → "Only select repositories" with `dhyegocalota/todz` alone.
- Branch protection on `main` cannot be enforced on this private repository's plan: GitHub answers 403 for both its branch protection and its rulesets. So Mintlify's web editor could commit to `main`, and Mintlify publishes every commit there. The owner's options: turn off Mintlify's web editor; or move to GitHub Pro and add a ruleset on `main` requiring pull requests, with Mintlify's app not on its bypass list; or make it a public repository and add the same ruleset. Until one of them is in place, step 5 checks every deploy after the fact.
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

5. **Check who changed the docs.** After each docs deploy, run `git fetch origin`, then `git log --format='%h %an %cn' <previous>..origin/main -- apps/docs`, where `<previous>` is the commit of the last deploy in the run log.
   Expected: every line names `Dhyego Calota` as both author and committer; no commit under `apps/docs` came from anyone else, Mintlify's web editor included.
   If it fails: stop and tell the owner the hashes and names the command printed; a commit that skipped review is already live on `docs.todz.app`, so the owner decides whether to revert it.

## Rollback

Revert the merge on `main`. Mintlify publishes the revert, or keeps its last good build when the revert removes `apps/docs`. Taking the docs offline is the owner's step: disconnect the domain in the dashboard.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
| 2026-11-25 | 87e643f | 2 | The deployment of the merge commit of PR #42 shows as live at 12:44 UTC (todz-6f's check in the dashboard); pull request previews not observed, the deployment's `preview: false` |
| 2026-11-25 | 87e643f | 3 | At 12:47 UTC: `/`, `/quickstart`, `/connect-an-agent`, `/mcp-tools` and `/self-host` each `200`, `/no-such-page` `404` holding `Page not found`; titles `Introduction - todz` and `Self-host todz - todz`; no starter kit page left. Deviation: `/` never held `todz is a product of Logic Bit, made in Brazil`, since the footer carries `todz is a product of` and `Logic Bit` apart; step 3 now expects those two (`docs-cutover`) |
| 2026-11-25 | 26842db | 5 | `git log --format='%h %an %cn' 87e643f^..origin/main -- apps/docs` printed 11 commits (9ee29cd, 1a8e92b, 413bc96, 03beab9, d4a8334, 87890fc, 69cf39a, f144a46, fee64c3, 42fb951, 817fed2), every one with `Dhyego Calota` as author and committer; no commit from anyone else, Mintlify's web editor included |
