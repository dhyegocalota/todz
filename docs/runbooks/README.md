# Runbooks

Step-by-step procedures a person follows by hand, kept in the repository beside the configuration they describe ([ADR 0008](../adr/0008-runbooks-live-in-the-repository.md)).

Every runbook step has an expected result and an `If it fails` line, and agents never run them, except `deploy-the-api`, which the build loop runs under the owner's authorization ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)).

## Runbooks

- [Render the brand assets](render-the-brand-assets.md): the app icon and the menu bar glyph, again from the SVGs in `docs/brand`.
- [Deploy the API](deploy-the-api.md): the database, the Worker, the custom domain and mail sending on `api.todz.app`, with a smoke check.
