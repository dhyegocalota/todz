# Deploy the API

Deploy the todz Worker to `api.todz.app` from `main`: the database, its migrations, the Worker with its Durable Objects, the custom domain, mail sending for `todz.app` and a smoke check of the live routes ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0043](../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)). The build loop runs it under the owner's authorization of 2026-11-24, and a person runs the same steps after that; each run adds a row to the run log at the end.

Every remote command names the todz account and the `todz` resources only, passes `--remote` where Wrangler defaults to local, and never passes `--var`. Run it from the repository root in one shell; `cd` into `apps/api` where a step says so. The values it uses: account `e2035d8e0b7173d520ccf643f6f4661c`, zone `todz.app` `06490974636c535e2cbfd7c5b09925a5`, database `todz-directory` `dc22b1c3-1869-44a0-b805-91bf92017f19`, Worker `todz-api`.

The token lives in the Keychain item `todz-cloudflare`. Its permissions, by the dashboard's names: Workers Scripts Edit, D1 Edit, Workers Routes Edit and DNS Edit on the zone, Zone Read, and Email Sending Edit. Wrangler asks for the scopes `workers:write`, `d1:write`, `workers_routes:write`, `dns_records:edit`, `zone:read` and `email_sending:write` for the same work; the dashboard names are not checked against Cloudflare's documentation.

1. **Start from a clean `main`.** Run `git status --porcelain`, `git rev-parse --abbrev-ref HEAD`, `git fetch origin` and `git rev-list --count HEAD..origin/main`, then `pnpm verify all`.
   Expected: the first prints nothing, the second prints `main`, the fourth prints `0`, and the gate passes on this commit.
   If it fails: a dirty tree, another branch or a commit behind `origin/main` means this is not the build that was reviewed; stop, and never deploy from it. A red gate goes back to Build.

2. **Load the token without echoing it.** Set the account and read the token from the Keychain into the shell, then verify it:

   ```bash
   export CLOUDFLARE_ACCOUNT_ID=e2035d8e0b7173d520ccf643f6f4661c
   export CLOUDFLARE_API_TOKEN="$(security find-generic-password -s todz-cloudflare -w)"
   curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/user/tokens/verify | jq -r '.result.status'
   ```

   Expected: `active`, and nothing else printed; the token never appears in a command line, a log or this run log.
   If it fails: an empty read means the Keychain item is missing or locked; unlock it or ask the owner for the token. A status other than `active` means the token expired or was revoked; the owner issues a new one with the permissions above. If the endpoint answers 404 for an account-owned token, verify it at `/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify` instead.

3. **Confirm the zone and that `api` is free.** List the zone's DNS records named `api.todz.app`:

   ```bash
   curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?name=api.todz.app" | jq -c '{success, records: .result | length}'
   ```

   Expected: `{"success":true,"records":0}`.
   If it fails: `success` false with an authentication error names the missing permission, Zone Read or DNS Edit (read). One or more records means something else already answers on `api.todz.app`; stop and tell the owner, because the custom domain would refuse to attach over it.

4. **Check the database.** From `apps/api`, run `pnpm exec wrangler d1 info todz-directory --json`.
   Expected: the `uuid` is `dc22b1c3-1869-44a0-b805-91bf92017f19`, the same id as `database_id` in `apps/api/wrangler.jsonc`.
   If it fails: a missing database means it was never created or was deleted; create it once with `pnpm exec wrangler d1 create todz-directory` (token permission D1 Edit), copy the new id into `wrangler.jsonc` and its shape test in a pull request, and start over from step 1. A different id means the configuration is stale; stop.

5. **Take a Time Travel bookmark.** From `apps/api`, run `pnpm exec wrangler d1 time-travel info todz-directory`.
   Expected: a bookmark and the current time; write the bookmark in the run log.
   If it fails: an authentication error names D1 Edit. Without a bookmark do not run step 7.

6. **Export the database.** From `apps/api`, write the data to a file outside the repository:

   ```bash
   pnpm exec wrangler d1 export todz-directory --remote --output "$TMPDIR/todz-directory-$(git rev-parse --short HEAD).sql"
   ```

   Expected: the `.sql` file exists; on the first deploy the database is empty and it holds the schema only, or nothing.
   If it fails: an authentication error names D1 Edit. An empty database that the export refuses is the one failure to accept, and only on a first deploy that step 4 showed to be empty; say so in the run log.

7. **Apply the migrations.** From `apps/api`, list what is unapplied, then apply it, always with `--remote`:

   ```bash
   pnpm exec wrangler d1 migrations list todz-directory --remote
   pnpm exec wrangler d1 migrations apply todz-directory --remote
   ```

   Expected: the list names `0001_directory.sql` to `0004_sign_in_links.sql` on a first deploy and nothing after; the apply prints each migration as applied, and a second `list` says there is nothing to apply. Migrations only move forward and must keep working with the Worker that is live.
   If it fails: a failed migration changes nothing from that file on; read the error, fix the migration in a pull request and start over. An authentication error names D1 Edit. To undo a bad migration restore the bookmark of step 5 with `pnpm exec wrangler d1 time-travel restore todz-directory --bookmark <bookmark>` and tell the owner.

8. **Deploy the Worker.** From `apps/api`, run `pnpm exec wrangler deploy` alone: no variable override and no environment.
   Expected: the bindings list `env.DIRECTORY (todz-directory)`, `env.PROJECT_STORE (ProjectStore)`, `env.EMAIL`, `env.SIGN_IN_LIMITER (10 requests/60s)` and the three variables `SIGN_IN_PROVIDER ("email")`, `EMAIL_SENDER ("cloudflare")` and `PUBLIC_ORIGIN ("https://api.todz.app")`; the output names `api.todz.app (custom domain)` and a Current Version ID, which goes in the run log. Wrangler creates the DNS record and the certificate for the custom domain.
   If it fails: an authentication error names Workers Scripts Edit; an error about the custom domain names Workers Routes Edit and DNS Edit on the zone. A deploy that fails changes nothing in production; the first deploy's backout and a later deploy's rollback are at the end of this runbook.

9. **Confirm the Worker is the one deployed.** From `apps/api`, run `pnpm exec wrangler deployments list`.
   Expected: the newest deployment names the Version ID of step 8 at 100 percent.
   If it fails: another version at 100 percent means the deploy did not finish; run step 8 again once, and if it repeats, roll back as at the end.

10. **Onboard `todz.app` for Email Sending.** Ask Cloudflare to enable sending for the zone's domain, so mail from `noreply@todz.app` has the `cf-bounce` MX, the SPF and the DKIM records:

    ```bash
    curl -sS -X POST -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" --data '{"name":"todz.app"}' "https://api.cloudflare.com/client/v4/zones/06490974636c535e2cbfd7c5b09925a5/email/sending/subdomains" | jq -c '{success, name: .result.name, enabled: .result.enabled}'
    ```

    Expected: `{"success":true,"name":"todz.app","enabled":true}` or the same with `enabled` false while the records are pending. A domain that is already onboarded answers a duplicate error, which is fine.
    If it fails: an authentication error names Email Sending Edit and Zone Read. Verified against Wrangler 4.167.0, whose `wrangler email sending enable todz.app` sends exactly this call (path `/zones/<zone>/email/sending/subdomains`, body `{"name": "<domain>"}`); that command is the same step when `curl` is not available. Not verified against Cloudflare's documentation: Context7 had no Cloudflare library in the session that wrote this step; the Email Sending API is in open beta.

11. **Wait for the sending records to verify.** Read the records and the state, and run it again every minute for up to fifteen minutes:

    ```bash
    pnpm exec wrangler email sending dns get todz.app
    pnpm exec wrangler email sending list todz.app
    ```

    Expected: the records are the `cf-bounce` MX, an SPF TXT and a DKIM TXT in the `todz.app` zone, and the list shows `todz.app` enabled and verified.
    If it fails: records that never appear in the zone mean Cloudflare did not add them itself; list the zone's DNS records and create the missing ones from the `dns get` output, which needs DNS Edit. Whether Cloudflare adds them itself, and which field says verified, are not verified; record what the list actually prints. Link requests answer 503 until this completes, and that is the safe state.

12. **Smoke check the live routes.** Run the four requests:

    ```bash
    curl -sS https://api.todz.app/owner/sign-in-method
    curl -sS -o /dev/null -w "%{http_code}\n" https://api.todz.app/mcp
    curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://api.todz.app/sign-in
    curl -sS -o /dev/null -w "%{http_code}\n" https://api.todz.app/brand/todz-lockup.png
    ```

    Expected: `{"method":"link"}`, then `401`, then `200 text/html` and `200`. The first proves the production variables are the ones in `wrangler.jsonc`; any other body means a `--var` or a dashboard variable overrides them, so stop and read the Worker's settings.
    If it fails: a TLS error right after step 8 means the certificate is still being issued; run it again every minute for up to fifteen minutes. `{"method":"identity"}` means the fake provider is live, which must never stay; roll back as at the end. A 522 or 1014 means the custom domain is not attached; list `/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains` and compare with step 8 (token permission Workers Routes Edit).

13. **Confirm the Worker has no other address.** Read the account's `workers.dev` subdomain and ask the Worker there:

    ```bash
    curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" | jq -r '.result.subdomain'
    curl -sS -o /dev/null -w "%{http_code}\n" "https://todz-api.<subdomain>.workers.dev/owner/sign-in-method"
    ```

    Expected: a name for the first, and for the second no answer from the Worker: a connection error, 404 or a Cloudflare error page, never `{"method":"link"}`. The preview URLs are off for the same reason (`preview_urls` is false in `wrangler.jsonc`).
    If it fails: a `{"method":"link"}` there means `workers_dev` is on in the dashboard or in a stale deploy; turn it off in the Worker's settings, deploy again and tell the owner. A missing account subdomain means there is no address to check; write that in the run log. A permission error names Workers Scripts Read.

14. **Check the per-client limit.** Post eleven wrong session tokens from this machine:

    ```bash
    for attempt in $(seq 1 11); do curl -sS -o /dev/null -w "%{http_code} " -X POST -H "Content-Type: application/json" --data '{"identity_token":"wrong","time_zone":"UTC"}' https://api.todz.app/owner/sessions; done; echo
    ```

    Expected: the first answers are `401` (the wrong token) and at least one of the last few is `429`, because the binding counts per Cloudflare location and may let a request or two more through; a request a minute later answers `401` again. A 429 carries `Retry-After: 60` and the body `{"error":"too_many_requests"}`.
    If it fails: no 429 after the eleventh means the binding is not enforcing, or Cloudflare did not send `CF-Connecting-IP`; read the Worker's logs for the key and tell the owner before the app ships. A 429 on the first request means another client on this address used the quota; wait a minute and run it again.

15. **Send one real sign-in link.** Ask for a link to an address the owner controls (`hello@todz.app` is routed to the owner's inbox), with a fresh challenge:

    ```bash
    curl -sS -w "\n%{http_code}\n" -X POST -H "Content-Type: application/json" --data "{\"email\":\"hello@todz.app\",\"link_challenge\":\"$(openssl rand -hex 32)\"}" https://api.todz.app/owner/sign-in-links
    ```

    Expected: `{}` and `202`, and within a minute a mail from `todz <noreply@todz.app>` whose button opens `https://api.todz.app/sign-in#token=…`. Never open or paste that link into a log; the production smoke walk with the app does that. The owner confirms the mail arrived.
    If it fails: `503` with `{"error":"sign_in_unavailable"}` means the sender is not ready; go back to step 11. A 202 with no mail within fifteen minutes means the binding accepted it and the delivery failed; read the sending activity in the dashboard (Email Sending Read) and tell the owner.

16. **Record the run.** Add one row per step above to the run log, with the date, the commit, the step and the actual result, in a pull request on `docs/`.
    Expected: no token, link, secret or full bookmark appears in the log; the Version ID and the database id do.
    If it fails: a secret that reached the log is rotated first (the owner replaces the Keychain token), then removed from the commit with a new one, never by rewriting history.

## Rollback

- First deploy: nothing else depends on the Worker and the database is empty, so the backout loses nothing. Detach the custom domain, then delete the Worker. List the account's Worker domains with `curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains?hostname=api.todz.app"`, delete the one entry with `DELETE` on `/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains/<id>`, and run `pnpm exec wrangler delete todz-api` from `apps/api` (the endpoint is not verified; the dashboard's Worker settings detach it too). Deleting the Worker deletes its Durable Object storage, which is only safe while no project exists.
- Later deploys: run `pnpm exec wrangler rollback` from `apps/api` to go back to the previous version, or `pnpm exec wrangler rollback <version-id>` for a named one, and note the reason with `-m`. The migrations stay applied: they only move forward and must keep working with the previous Worker, so write each one that way.
- A bad migration: restore the bookmark of step 5, which needs the owner's word because it discards writes made since.
- Durable Object classes are never deleted: a `migrations` entry in `wrangler.jsonc` never removes `ProjectStore`.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
