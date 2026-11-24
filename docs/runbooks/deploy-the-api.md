# Deploy the API

Deploy the todz Worker to `api.todz.app` from `main`: the database, its migrations, the Worker with its Durable Objects, the custom domain, mail sending for `todz.app`, HTTPS only and a smoke check of the live routes ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0043](../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)). The build loop runs it under the owner's authorization of 2026-11-24, and a person runs the same steps after that; each run adds rows to the run log at the end.

Every command runs from the repository root, one command per call, and starts with `scripts/todz-cloudflare.sh`: it reads the token from the Keychain item `todz-cloudflare` and gives it only to that one command, so no step exports a variable, echoes the token or puts it on a command line. A Wrangler call is `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler ...`, a Cloudflare API call is `scripts/todz-cloudflare.sh api <METHOD> <path> [json-body-file]` and prints the JSON. No step passes `--var`, and every database command names `--remote`. The values: account `e2035d8e0b7173d520ccf643f6f4661c`, zone `todz.app` `06490974636c535e2cbfd7c5b09925a5`, database `todz-directory` `dc22b1c3-1869-44a0-b805-91bf92017f19`, Worker `todz-api`.

Prerequisites: the account is on Workers Paid (the owner confirmed it active on 2026-11-24), and the token has these permissions by the dashboard's names: Workers Scripts Edit, D1 Edit, Workers Routes Edit and DNS Edit and Zone Settings Edit on the zone, Zone Read, and Email Sending Edit. The dashboard names are not checked against Cloudflare's documentation.

Where a step says `<commit>`, use the short hash step 1 prints; `<owner-address>` is the address the owner gives at run time. Files the run writes live in `~/.todz-deploy/`, outside the repository, in folders only the owner can open.

1. **Start from a clean `main`.** Check the tree, the branch and that nothing differs from `origin/main`, then run the gate:

   ```bash
   git status --porcelain
   git rev-parse --abbrev-ref HEAD
   git fetch origin
   git rev-list --count origin/main..HEAD
   git rev-list --count HEAD..origin/main
   git rev-parse --short HEAD
   pnpm verify all
   ```

   Expected: the first prints nothing, the second `main`, the fourth and the fifth `0`, the sixth the short hash to use as `<commit>`, and the gate passes on this commit.
   If it fails: a dirty tree, another branch or a commit ahead or behind `origin/main` means this is not the build that was reviewed; stop, and never deploy from it. A red gate goes back to Build.

2. **Check who the token is.** Wrangler reports the identity, and the API says whether the token is active:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler whoami
   scripts/todz-cloudflare.sh api GET /user/tokens/verify
   ```

   Expected: `whoami` says the login is an API Token and lists one account, `e2035d8e0b7173d520ccf643f6f4661c`, and nothing else; the verify call answers `"status":"active"`. Neither prints the token.
   If it fails: an error from the wrapper means the Keychain item is missing, empty or locked; unlock it or ask the owner. A status other than `active` means the token expired or was revoked; the owner issues a new one with the permissions above. If verify answers 404 for an account-owned token, verify it at `/accounts/e2035d8e0b7173d520ccf643f6f4661c/tokens/verify` instead. A second account in the list means the token is wider than it should be; stop and tell the owner. An authentication error on `whoami` itself names the missing token permission Zone Read.

3. **Check that `api.todz.app` is free and snapshot the zone.** List the records named `api.todz.app`, then every record of the zone:

   ```bash
   scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?name=api.todz.app"
   scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?per_page=100" | jq -r '.result[] | .type + " " + .name + " " + .content'
   ```

   Expected: the first answers `"success":true` with `"result":[]`. The second prints one line per record; write the apex `MX` and `TXT` lines (name `todz.app`) in the run log, because step 10 compares them.
   If it fails: `"success":false` with an authentication error names the missing permission, Zone Read or DNS Edit (read). One or more records named `api.todz.app` mean something else already answers there; stop and tell the owner, because the custom domain would refuse to attach over it.

4. **Check that the database exists, by id.** Read it by the id in `apps/api/wrangler.jsonc`:

   ```bash
   scripts/todz-cloudflare.sh api GET /accounts/e2035d8e0b7173d520ccf643f6f4661c/d1/database/dc22b1c3-1869-44a0-b805-91bf92017f19
   ```

   Expected: `"success":true`, `"name":"todz-directory"` and `"uuid":"dc22b1c3-1869-44a0-b805-91bf92017f19"`. Nothing is created.
   If it fails: a not-found answer means the database was never created or was deleted; create it once with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 create todz-directory` (token permission D1 Edit), copy the new id into `wrangler.jsonc` and its shape test in a pull request, and start over from step 1. An authentication error names D1 Edit. A different `name` means the configuration is stale; stop.

5. **Take a Time Travel bookmark.** Ask D1 for the current one:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 time-travel info todz-directory
   ```

   Expected: a bookmark and the current time. Write the bookmark in the run log; it is not a secret.
   If it fails: an authentication error names D1 Edit. Without a bookmark do not run step 7.

6. **Export the database before any migration.** Make a folder only the owner can open, then export into it:

   ```bash
   mkdir -p -m 700 ~/.todz-deploy
   mkdir -p -m 700 ~/.todz-deploy/backups
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 export todz-directory --remote --output ~/.todz-deploy/backups/before-<commit>.sql
   ```

   Expected: the file `before-<commit>.sql` exists in the folder; on the first deploy the database is empty and it holds the schema only, or nothing. Step 12 deletes it once the smoke check passes, because after the first sign-in it holds owners' email addresses.
   If it fails: an authentication error names D1 Edit. An empty database that the export refuses is the one failure to accept, and only on a first deploy that step 4 showed to be empty; say so in the run log.

7. **Apply the migrations.** List what is unapplied, apply it, and list again:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   ```

   Expected: the first list names `0001_directory.sql` to `0004_sign_in_links.sql` on a first deploy and nothing after; the apply prints each migration as applied; the second list says there is nothing to apply. Migrations only move forward and must keep working with the Worker that is live.
   If it fails: a failed migration changes nothing from that file on; read the error, fix the migration in a pull request and start over. An authentication error names D1 Edit. To undo a bad migration restore the bookmark of step 5 with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 time-travel restore todz-directory --bookmark <bookmark>` and tell the owner, because it discards the writes made since.

8. **Deploy the Worker.** Deploy alone: no variable override and no environment:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deploy
   ```

   Expected: the bindings list `env.DIRECTORY (todz-directory)`, `env.PROJECT_STORE (ProjectStore)`, `env.EMAIL`, `env.SIGN_IN_LIMITER (10 requests/60s)` and the three variables `SIGN_IN_PROVIDER ("email")`, `EMAIL_SENDER ("cloudflare")` and `PUBLIC_ORIGIN ("https://api.todz.app")`; the output names `api.todz.app (custom domain)` and a Current Version ID, which goes in the run log. Wrangler creates the DNS record and the certificate for the custom domain.
   If it fails: an authentication error names Workers Scripts Edit; an error about the custom domain names Workers Routes Edit and DNS Edit on the zone. An error that names a plan, or refuses a Durable Object, the rate limit binding or the email binding, means Workers Paid lapsed (it was active on 2026-11-24); tell the owner. A deploy that fails changes nothing in production; the first deploy's backout and a later deploy's rollback are at the end of this runbook.

9. **Confirm the Worker and its custom domain.** Read the account's domain entry for `api.todz.app`, then the deployments:

   ```bash
   scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=api.todz.app"
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list
   ```

   Expected: exactly one domain entry, with `"hostname":"api.todz.app"` and `"service":"todz-api"`; the newest deployment names the Version ID of step 8 at 100 percent.
   If it fails: no entry, or an entry for another service, means the custom domain is not attached to this Worker; run step 8 again once, and if it repeats, roll back as at the end. A permission error names Workers Scripts Read. Another version at 100 percent means the deploy did not finish.

10. **Onboard `todz.app` for Email Sending.** Enable sending for the zone, read the state and the records, and list the zone again to compare it with the snapshot of step 3:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending enable todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending list todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending dns get todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?per_page=100" | jq -r '.result[] | .type + " " + .name + " " + .content'
    ```

    Expected: the first prints `Email Sending enabled for todz.app (enabled: ...)`, and an already onboarded domain says so, which is fine. The list is a table with the columns `name`, `enabled` and `tag`, and `todz.app` shows `enabled` `yes`. `dns get` prints each record with its type, Name, Content, Priority and TTL, and the zone listing now holds them. The apex `MX` and `TXT` lines of step 3 are unchanged. Never add an apex SPF record by hand and never edit one: the sending records belong to the names `dns get` prints, and a merge of the apex SPF is the owner's call. The zone already publishes DMARC with `p=none`; leave it. Raising the policy is a later step, after the first deliveries are seen.
    If it fails: an authentication error names Email Sending Edit and Zone Read. If `enabled` is `no` or the records are missing, run steps 11 and 12 and repeat this list for up to fifteen minutes, because the records verify in the background; link requests answer 503 until then, which is the safe state. If Cloudflare did not add the records to the zone, create each one that `dns get` prints at the name it prints, with DNS Edit, and nothing at the apex. A changed or missing apex record means stop and tell the owner. The Email Sending API is in open beta, and its documentation was not available to check this step beyond Wrangler 4.167.0's own commands.

11. **Turn on Always Use HTTPS for the zone.** Set the zone setting, then ask for the plain address:

    ```bash
    scripts/todz-cloudflare.sh api PATCH /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https scripts/deploy-bodies/always-use-https-on.json
    curl -sI http://api.todz.app/owner/sign-in-method
    ```

    Expected: the first answers `"success":true` with `"value":"on"`; the second prints `HTTP/1.1 301` and a `location` header of `https://api.todz.app/owner/sign-in-method`.
    If it fails: an authentication error names Zone Settings Edit on the zone. A connection error right after step 8 means DNS is still settling; run the second command again every minute for up to fifteen minutes. A 200 over plain HTTP means the setting did not apply; read it back with `api GET /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https` and tell the owner.

12. **Smoke check the live routes.** Ask the live Worker, then its account's `workers.dev` address:

    ```bash
    curl -sS https://api.todz.app/owner/sign-in-method
    curl -sS -D - -o /dev/null https://api.todz.app/sign-in
    curl -sS -D - -o /dev/null https://api.todz.app/mcp
    scripts/todz-cloudflare.sh api GET /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/subdomain
    curl -sS -D - -o /dev/null https://todz-api.<subdomain>.workers.dev/owner/sign-in-method
    ```

    Expected: `{"method":"link"}`, then `HTTP/2 200` with `content-type: text/html; charset=utf-8`, then `HTTP/2 401`, then the account's `workers.dev` subdomain, then for the last no answer from the Worker: a connection error, 404 or a Cloudflare error page, never `{"method":"link"}`. The first proves the production variables are the ones in `wrangler.jsonc`; any other body means a `--var` or a dashboard variable overrides them, so stop and read the Worker's settings. When all five pass, delete the export of step 6:

    ```bash
    rm ~/.todz-deploy/backups/before-<commit>.sql
    ```

    If it fails: a TLS error right after step 8 means the certificate is still being issued; run it again every minute for up to fifteen minutes. `{"method":"identity"}` or a 503 `sign_in_unavailable` on the method route means the fake provider was refused or the variables are wrong; never leave it, and roll back as at the end. A 522 or 1014 means the custom domain is not attached; go back to step 9 (token permission Workers Routes Edit). A reply from the `workers.dev` host means `workers_dev` is on in the dashboard or in a stale deploy; turn it off in the Worker's settings, deploy again and tell the owner. A missing account subdomain means there is no address to check; write that in the run log. A permission error names Workers Scripts Read.

13. **Send one real sign-in link.** Ask for a link to the address the owner gives at run time. Print a fresh challenge, then write the request body with the file-writing tool to a file outside the repository: a JSON object with `email` set to `<owner-address>` and `link_challenge` set to the 64 hexadecimal characters printed:

    ```bash
    openssl rand -hex 32
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @<body-file> https://api.todz.app/owner/sign-in-links
    ```

    Expected: `HTTP/2 202` and the body `{}`, and within a minute a mail from `todz <noreply@todz.app>` whose button opens `https://api.todz.app/sign-in#token=...`. Never open or paste that link into a log; the production smoke walk with the app does that. The owner confirms the mail arrived; delete `<body-file>` afterwards.
    If it fails: a 503 with `{"error":"sign_in_unavailable"}` means the sender is not ready; go back to step 10. A 202 with no mail within fifteen minutes means the binding accepted it and the delivery failed; read the sending activity in the dashboard (Email Sending Read) and tell the owner. A 429 means this address used its quota; wait a minute and ask again.

14. **Check the per-client limit.** Post wrong session tokens from this machine, fourteen in one command, and keep only the status and `retry-after` lines:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions | grep -iE "^HTTP|^retry-after"
    ```

    Expected: the first answers are `HTTP/2 401` (the wrong token) and at least one of the last four is `HTTP/2 429` followed by `retry-after: 60`, because the binding counts per Cloudflare location and may let a request or two more than ten through. After the next step, one more request to `https://api.todz.app/owner/sessions` with the same body answers `HTTP/2 401` again.
    If it fails: no 429 means run the command once more; none in the second run either means the binding is not enforcing, or Cloudflare did not send `CF-Connecting-IP` or the request counted as local; tell the owner before the app ships. A 429 on the first request means another client on this address used the quota; wait a minute and run it again.

15. **Record the run.** Add one row per step above to the run log, with the date, the commit, the step and the actual result, in a pull request on `docs/`.
    Expected: no token, link, secret or challenge appears in the log; the Version ID, the database id and the Time Travel bookmark do.
    If it fails: a secret that reached the log is rotated first (see the end of this runbook), then removed from the commit with a new one, never by rewriting history.

## Rollback

- First deploy, and only while no owner exists: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) FROM owners"`. If it prints anything but `0`, stop and tell the owner: deleting the Worker deletes its Durable Object storage, which holds every project.
- With the count at `0`, detach the custom domain chosen by hostname and service, never by a remembered id: run `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=api.todz.app&service=todz-api"`. Exactly one entry must come back, else stop. Delete it with `scripts/todz-cloudflare.sh api DELETE /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains/<domain-id>`, using that entry's `id` (the endpoint is not verified; the dashboard's Worker settings detach it too). Then run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler delete todz-api`.
- Later deploys: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler rollback` to go back to the previous version, or the same with a version id for a named one, and note the reason with `-m`. The migrations stay applied: they only move forward and must keep working with the previous Worker, so write each one that way.
- A bad migration: restore the bookmark of step 5, which needs the owner's word because it discards writes made since.
- Durable Object classes are never deleted: a `migrations` entry in `wrangler.jsonc` never removes `ProjectStore`.

## Rotate the token

The owner rotates the Keychain token after a run that went wrong, when it may have leaked, and on a schedule of their choosing: create a new token in the dashboard with the permissions at the top, store it with `security add-generic-password -U -s todz-cloudflare -a todz -w` (it asks for the value; never type it on a command line), delete the old one in the dashboard, then run step 2 again.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
