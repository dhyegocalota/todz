# Runbooks

Step-by-step procedures a person follows by hand, kept in the repository beside the configuration they describe ([ADR 0008](../adr/0008-runbooks-live-in-the-repository.md)).

Every runbook step has an expected result and an `If it fails` line, and agents never run them, except `deploy-the-api`, the loop's steps of `mintlify-publish`, the loop's steps of `performance` and the loop's steps of `production-smoke-walk`. The build loop runs the first under the owner's authorization ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)); the second only reads the docs and the host ([ADR 0059](../adr/0059-the-docs-are-a-mintlify-site-on-docs-todz-app-built-from-apps-docs-and-the-self-host-guide-moves-into-it.md)); the third runs the local steps and the bounded production load under the owner's authorization ([ADR 0061](../adr/0061-performance-has-written-budgets-a-fetch-based-load-harness-behind-pnpm-perf-and-work-count-budgets-in-verify.md)); the fourth runs its probes and the MCP client's steps, and leaves the app's steps to the owner's session.

## Runbooks

- [Render the brand assets](render-the-brand-assets.md): the app icon and the menu bar glyph, again from the SVGs in `docs/brand`.
- [Deploy the API](deploy-the-api.md): the database, the Worker, the custom domain and mail sending on `api.todz.app`, with a smoke check.
- [Publish the docs on Mintlify](mintlify-publish.md): the owner's Mintlify setup as done, the checks before a merge that touches `apps/docs` and the check of `docs.todz.app` after it.
- [Production smoke walk](production-smoke-walk.md): the sign-in mail, the app, an MCP client, the menu bar and widget, the limits, the waitlist, the headers and the budgets, walked against `todz.app` once the last deploy lands, with the dated run log.
- [Measure performance](performance.md): the load, stress and bounded production runs, the app probe walks and the landing check against the budgets of ADR 0061, with the dated results table.
