# Deploy the API

Deploy the todz Worker to `api.todz.app` from `main`: the database, its migrations, the Worker with its Durable Objects, the custom domain, mail sending for `todz.app`, HTTPS only and a smoke check of the live routes ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0043](../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)). The build loop runs it under the owner's authorization of 2026-11-24, and a person runs the same steps after that; each run adds rows to the run log at the end.

Every command runs from the repository root, one command per call, and every command that needs the token starts with `scripts/todz-cloudflare.sh`: it reads the token from the Keychain item `todz-cloudflare` and gives it only to that one command, so no step exports a variable, echoes the token or puts it on a command line. A Wrangler call is `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler ...`, a Cloudflare API call is `scripts/todz-cloudflare.sh api <METHOD> <path> [json-body-file]` and prints the JSON. No step passes `--var`, and every database command names `--remote`. The values: account `e2035d8e0b7173d520ccf643f6f4661c`, zone `todz.app` `06490974636c535e2cbfd7c5b09925a5`, database `todz-directory` `dc22b1c3-1869-44a0-b805-91bf92017f19`, Worker `todz-api`.

Prerequisites: the `sign-in-guard` feature has shipped. It adds Turnstile, failing closed, and the per-client, per-address and global limits on every public sign-in endpoint. The owner said on 2026-11-24 that sign-in never goes to production without it, so check `docs/features/README.md` for its `Shipped` row and stop if it is missing. The account is on Workers Paid (the owner confirmed it active on 2026-11-24), and the token has these permissions by the dashboard's names: Workers Scripts Edit, D1 Edit, Workers Routes Edit and DNS Edit and Zone Settings Edit on the zone, Zone Read scoped to the `todz.app` zone, and Email Sending Edit. The dashboard names are not checked against Cloudflare's documentation.

Where a step says `<commit>`, use the short hash step 1 prints; `<version-id>` is the Current Version ID step 8 prints; `<owner-address>` is the address the owner gives at run time. Files the run writes live in `~/.todz-deploy/`, outside the repository, in folders only the owner can open.

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
   scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?per_page=100" | jq -r '.result | map(.type + " " + .name + " " + .content) | join("\n")'
   ```

   Expected: the first answers `"success":true` with `"result":[]` on the first deploy, and only the Worker's own `AAAA api.todz.app 100::` record after it. The second prints one line per record; write the apex `MX` and `TXT` lines (name `todz.app`) in the run log, because step 11 compares them. Neither `todz.app` nor `www.todz.app` has an `A`, `AAAA` or `CNAME` line before the site's first deploy, and after it each has only the Worker's own `AAAA … 100::` record; the apex `MX` and `TXT` lines do not stop a custom domain.
   If it fails: `"success":false` with an authentication error names the missing permission, Zone Read or DNS Edit (read). Any other `A`, `AAAA` or `CNAME` record named `api.todz.app`, `todz.app` or `www.todz.app` means something else already answers there; stop and tell the owner, because the custom domain would refuse to attach over it.

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

   Expected: the file `before-<commit>.sql` exists in the folder; on the first deploy the database is empty and it holds the schema only, or nothing. Step 13 deletes it once the smoke check passes, because after the first sign-in it holds owners' email addresses.
   If it fails: an authentication error names D1 Edit. An empty database that the export refuses is the one failure to accept, and only on a first deploy that step 4 showed to be empty; say so in the run log.

7. **Apply the migrations.** List what is unapplied, apply it, and list again:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   ```

   Expected: the first list names `0001_directory.sql` to `0006_admin.sql` on a first deploy, and only the migrations that are new since the last run after it (`0006_admin.sql` for the admin's first deploy); the apply prints each migration as applied; the second list says there is nothing to apply. Migrations only move forward and must keep working with the Worker that is live.
   If it fails: a failed migration changes nothing from that file on; read the error, fix the migration in a pull request and start over. An authentication error names D1 Edit. To undo a bad migration, ask the owner; on their word, restore the bookmark of step 5 with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 time-travel restore todz-directory --bookmark <bookmark>`, because it discards the writes made since. Never restore without that word.

8. **Deploy the Worker.** Deploy alone: no variable override and no environment:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deploy
   ```

   Expected: the bindings list `env.DIRECTORY`, shown with the nil `preview_database_id` (Wrangler 4.167.0 prints the preview id there; step 9 reads the version's real binding), `env.PROJECT_STORE (ProjectStore)`, `env.EMAIL`, `env.SIGN_IN_LIMITER (10 requests/60s)`, `env.SIGN_IN_ADDRESS_LIMITER (3 requests/60s)`, `env.SIGN_IN_GLOBAL_LIMITER (100 requests/60s)`, `env.WAITLIST_LIMITER (10 requests/60s)`, `env.WAITLIST_ADDRESS_LIMITER (3 requests/60s)`, `env.WAITLIST_GLOBAL_LIMITER (60 requests/60s)`, `env.ADMIN_LIMITER (10 requests/60s)`, `env.ADMIN_ADDRESS_LIMITER (3 requests/60s)` and `env.ADMIN_GLOBAL_LIMITER (30 requests/60s)` (rate limit namespaces `8601` to `8609`), the four variables `SIGN_IN_PROVIDER ("email")`, `EMAIL_SENDER ("cloudflare")`, `PUBLIC_ORIGIN ("https://api.todz.app")` and `SITE_ORIGIN ("https://todz.app")`, and `TURNSTILE_SITE_KEY` once a pull request has put the widget's site key in `wrangler.jsonc`; the output names `api.todz.app (custom domain)`, `todz.app (custom domain)` and `www.todz.app (custom domain)`, then `schedule: 0 11 * * *` (the waitlist digest, [ADR 0052](../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md)), and a Current Version ID, which goes in the run log. The first digest reaches `ADMIN_EMAIL` at the next 11:00 UTC; the Worker's Cron Events in the dashboard show each run, and a run without the `ADMIN_EMAIL` secret fails there by design. Wrangler creates the DNS record and the certificate for each custom domain.
   If it fails: an authentication error names Workers Scripts Edit; an error about the custom domain names Workers Routes Edit and DNS Edit on the zone. An error that names a plan, or refuses a Durable Object, the rate limit binding or the email binding, means Workers Paid lapsed (it was active on 2026-11-24); tell the owner. A deploy that fails changes nothing in production; the first deploy's backout and a later deploy's rollback are at the end of this runbook.

9. **Confirm the Worker and its custom domains.** Read the account's domain entry for each host, then the deployments:

   ```bash
   scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=api.todz.app"
   scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=todz.app"
   scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=www.todz.app"
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler versions view <version-id> --json
   ```

   Expected: exactly one domain entry per host, each with its own `"hostname"` and `"service":"todz-api"`; the newest deployment names the Version ID of step 8 at 100 percent; that version's `d1` binding `DIRECTORY` has the `id` `dc22b1c3-1869-44a0-b805-91bf92017f19`, never the nil uuid ([the learning](../learnings/2026-11-24-wrangler-deploy-lists-the-preview-database-id-in-its-bindings.md)).
   If it fails: no entry, or an entry for another service, means the custom domain is not attached to this Worker; run step 8 again once, and if it repeats, roll back as at the end. A permission error names Workers Scripts Read. Another version at 100 percent means the deploy did not finish.

   The digest's schedule has no read through the wrapper; step 8's `schedule: 0 11 * * *` line is its proof. After the next 11:00 UTC, check that the digest arrived at `ADMIN_EMAIL` (a mail "Your todz waitlist: …" from `noreply@todz.app`) and that the Worker's Cron Events in the dashboard show the run as a success, and add a row for it to the run log.
   If it fails: a failed run whose error says `the waitlist digest is missing admin_email` means step 10's `ADMIN_EMAIL` secret is missing; put it. Any other failure, or no run at all, means the schedule did not register; deploy again from the same commit and tell the owner if it repeats.

10. **Create the Turnstile widget and put its secret.** The owner creates the widget in the dashboard, because the token lacks Turnstile Edit: Turnstile, Add widget, name `todz`, hostname `todz.app` (it covers `api.todz.app`), widget mode Managed. The dashboard then shows a site key and a secret key. The site key is public: a pull request puts it in the `vars` of `apps/api/wrangler.jsonc` as `TURNSTILE_SITE_KEY`, with its pin in `api-source.test.ts`, and this runbook runs again from step 1 once it is on `main`. The secret never touches a file or a command line: the owner runs the first command and pastes it at its prompt, then anyone lists the secrets:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Expected: the first asks for the value and says it uploaded the secret `TURNSTILE_SECRET_KEY` for `todz-api`; the list names `TURNSTILE_SECRET_KEY` and prints no value. Until both the secret and the site key exist, the two sign-in posts answer 503 `sign_in_unavailable` and both pages answer 503, which is the safe state; steps 13 to 15 say what each state answers.
    The admin's address is a secret too, though not a sensitive one: it keeps a fork that never sets it closed ([ADR 0051](../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md)). Put it once, without waiting for the widget, by typing `hello@todz.app` at the prompt, then list the secrets again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put ADMIN_EMAIL
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Expected: the first says it uploaded the secret `ADMIN_EMAIL` for `todz-api`; the list names `ADMIN_EMAIL`. Until it exists `https://todz.app/admin` answers 503, "The admin is closed right now."; after it, the sign-in card, whose post answers 503 until the Turnstile secret and site key exist too.
    If it fails: an authentication error on the secret names Workers Scripts Edit. A dashboard that refuses `todz.app` as a hostname means the zone is not on this account; tell the owner. If the owner grants the token Account, Turnstile, Edit instead, the widget can be made through the API only once `scripts/todz-cloudflare.sh` allows the widget path; until then it stays a dashboard step. A secret that was pasted anywhere else, a chat, a file or a log, is rotated: the owner rotates it in the widget's settings and puts it again.

11. **Onboard `todz.app` for Email Sending.** Enable sending for the zone, read the state and the records, and list the zone again to compare it with the snapshot of step 3:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending enable todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending list todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending dns get todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?per_page=100" | jq -r '.result | map(.type + " " + .name + " " + .content) | join("\n")'
    ```

    Expected: the first prints `Email Sending enabled for todz.app (enabled: ...)`, and an already onboarded domain says so, which is fine. The list is a table with the columns `name`, `enabled` and `tag`, and `todz.app` shows `enabled` `yes`. `dns get` prints each record with its type, Name, Content, Priority and TTL, and the zone listing now holds them. The apex `MX` and `TXT` lines of step 3 are unchanged. Never add an apex SPF record by hand and never edit one: the sending records belong to the names `dns get` prints, and a merge of the apex SPF is the owner's call. The zone already publishes DMARC with `p=none`; leave it. Raising the policy is a later step, after the first deliveries are seen.
    If it fails: an authentication error names Email Sending Edit and Zone Read. If `enabled` is `no` or the records are missing, run steps 12 and 13 and repeat this list for up to fifteen minutes, because the records verify in the background; link requests answer 503 until then, which is the safe state. If Cloudflare did not add the records to the zone, stop and tell the owner; no record is written by hand. A changed or missing apex record means stop and tell the owner. The Email Sending API is in open beta, and its documentation was not available to check this step beyond Wrangler 4.167.0's own commands.

12. **Turn on Always Use HTTPS for the zone.** Read the pseudo IPv4 setting, set the zone setting, then ask for the plain address:

    ```bash
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/settings/pseudo_ipv4
    scripts/todz-cloudflare.sh api PATCH /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https scripts/deploy-bodies/always-use-https-on.json
    curl -sI http://api.todz.app/owner/sign-in-method
    curl -sI http://todz.app/
    curl -sI http://www.todz.app/
    ```

    Expected: the first answers `"value":"off"` or `"value":"add_header"`; the second answers `"success":true` with `"value":"on"`; the third prints `HTTP/1.1 301` and a `location` header of `https://api.todz.app/owner/sign-in-method`, and the last two each print `HTTP/1.1 301` with a `location` on `https://` of the same host. The site sends HSTS only on its pages, so this zone setting is what keeps `www.todz.app` and the site's other answers on HTTPS.
    If it fails: any other pseudo IPv4 value (`overwrite_header`) means Cloudflare replaces the client's IPv6 address with a pseudo IPv4 one, which would hide IPv6 from the per-/64 key of the sign-in limiter; stop before the PATCH and tell the owner. An authentication error names Zone Settings Edit on the zone. A connection error right after step 8 means DNS is still settling; run the second command again every minute for up to fifteen minutes. A 200 over plain HTTP means the setting did not apply; read it back with `api GET /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https` and tell the owner.

13. **Smoke check the live routes.** Ask the live Worker, then its account's `workers.dev` address:

    ```bash
    curl -sS https://api.todz.app/owner/sign-in-method
    curl -sS -D - -o /dev/null https://api.todz.app/sign-in
    curl -sS -D - -o /dev/null https://api.todz.app/sign-in/challenge
    curl -sS -D - -o /dev/null https://api.todz.app/mcp
    curl -sS -D - -o /dev/null https://todz.app/
    curl -sS -D - -o /dev/null https://todz.app/self-host
    curl -sS -D - -o /dev/null "https://www.todz.app/self-host?from=runbook"
    curl -sS -D - -o /dev/null https://todz.app/owner/sign-in-method
    curl -sS -D - -o /dev/null https://api.todz.app/
    curl -sS -D - -o /dev/null https://todz.app/admin
    curl -sS -D - -o /dev/null https://api.todz.app/admin
    scripts/todz-cloudflare.sh api GET /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/subdomain
    curl -sS -D - -o /dev/null https://todz-api.<subdomain>.workers.dev/owner/sign-in-method
    ```

    Expected: `{"method":"link"}`, then for each page `HTTP/2 503` with `content-type: text/html; charset=utf-8` until the site key is in `wrangler.jsonc` and `HTTP/2 200` after, then `HTTP/2 401`, then `HTTP/2 200` for the landing and for the self-host guide, each with `strict-transport-security: max-age=31536000` and a `content-security-policy` that starts with `default-src 'none'`, then `HTTP/2 301` with `location: https://todz.app/self-host?from=runbook`, then `HTTP/2 404` for the owner route on the site host and for the landing on the API host, then for `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex` (the admin's sign-in card), then `HTTP/2 404` for `api.todz.app/admin`, then the account's `workers.dev` subdomain, then for the last no answer from the Worker: a connection error, 404 or a Cloudflare error page, never `{"method":"link"}`. The first proves the production variables are the ones in `wrangler.jsonc`; any other body means a `--var` or a dashboard variable overrides them, so stop and read the Worker's settings. When all thirteen pass, delete the export of step 6:

    ```bash
    rm ~/.todz-deploy/backups/before-<commit>.sql
    ```

    If it fails: a TLS error right after step 8 means the certificate is still being issued; run it again every minute for up to fifteen minutes. `{"method":"identity"}` or a 503 `sign_in_unavailable` on the method route means the fake provider was refused or the variables are wrong; never leave it, and roll back as at the end. A 522 or 1014 means the custom domain is not attached; go back to step 9 (token permission Workers Routes Edit). A page that answers 503 with the site key in `wrangler.jsonc` means the deployed version is older than that pull request; run step 8 again from its commit. A reply from the `workers.dev` host means `workers_dev` is on in the dashboard or in a stale deploy; turn it off in the Worker's settings, deploy again and tell the owner. A missing account subdomain means there is no address to check; write that in the run log. A permission error names Workers Scripts Read.

14. **Check that a link request needs a solved challenge.** Post a link request whose Turnstile token was never solved, and keep only the status, the `retry-after` line and the body:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/junk-turnstile-link.json https://api.todz.app/owner/sign-in-links
    ```

    Expected: before step 10's secret exists, `HTTP/2 503` and `{"error":"sign_in_unavailable"}`; after it, `HTTP/2 429`, `retry-after: 60` and `{"error":"sign_in_refused"}`. No mail leaves either way. A real link, with a real mail to the owner, is asked for in the production smoke walk with the app, never here.
    If it fails: a 202 means the Worker sent a link without a solved challenge; close sign-in as the Rollback section says and tell the owner. A 503 after the secret exists means siteverify, the secret or a binding is missing; read step 8's bindings and step 10's list again. A 400 means the body file changed; restore it from `main`.

    Then check that the waitlist keeps nothing without a solved challenge. Count the rows, post an address with an unsolved token, and count again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-waitlist.txt https://todz.app/join
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    ```

    Expected: both counts are `0`; the post prints `503` (the waitlist opens soon) until both the site key is in `wrangler.jsonc` and step 10's secret exists, and `429` (try again) after both. Only a count of the probe address is read, never a visitor's address, so a real join during the check changes nothing.
    If it fails: a `200` or a count of `1` means the waitlist kept an address without a solved challenge; detach `todz.app` as the Rollback section says and tell the owner.

    Then check that the admin stores no link without a solved challenge. Count the unspent admin links, post an unsolved request from the site's origin, and count again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS admin_links FROM admin_sign_in_links WHERE consumed_at IS NULL"
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://todz.app" -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-admin.txt https://todz.app/admin/sign-in-links
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS admin_links FROM admin_sign_in_links WHERE consumed_at IS NULL"
    ```

    Expected: the status code is the check; the two counts only show that nothing was written, which holds for any probe address that is not `ADMIN_EMAIL`. They are equal, and the post prints `503` (the admin is closed) until the site key is in `wrangler.jsonc` and both of step 10's secrets exist, and `429` (try again) after all three. No mail leaves.
    If it fails: a `403` means the `Origin` header was lost; run the command as written. A `200` means siteverify accepted an unsolved token or the guard was skipped; close the admin as the Rollback section says, and tell the owner.

15. **Check the per-client limit.** Post wrong session tokens from this machine, fourteen in one command, and keep only the statuses and `retry-after` values; each answer's body ends without a newline, so the next status starts mid-line and a `^HTTP` match would miss it. The body carries a malformed link verifier, which the Worker refuses before it asks siteverify, and an unsolved Turnstile token:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions | grep -oE "HTTP/2 [0-9]+|retry-after: [0-9]+"
    ```

    Expected: the first ten answers are `HTTP/2 401` (the malformed verifier), or `HTTP/2 503` before step 10's secret exists, and from the eleventh on they are `HTTP/2 429` followed by `retry-after: 60`; the binding counts per Cloudflare location and may let a request or two more than ten through, so at least one of the last four is a 429. A minute later, one single request answers as the first did:

    ```bash
    curl -sS -D - -o /dev/null -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions
    ```
    If it fails: no 429 means run the command once more; none in the second run either means the binding is not enforcing, or Cloudflare did not send `CF-Connecting-IP` or the request counted as local; tell the owner before the app ships. A 429 on the first request means another client on this address used the quota; wait a minute and run it again.

16. **Record the run.** Add one row per step above to the run log, with the date, the commit, the step and the actual result, in a pull request on `docs/`.
    Expected: no token, link, secret or challenge appears in the log; the Version ID, the database id and the Time Travel bookmark do.
    If it fails: a secret that reached the log is rotated first (see the end of this runbook), then removed from the commit with a new one, never by rewriting history.

## Rollback

- First deploy, and only while no owner exists: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) FROM owners"`. If it prints anything but `0`, stop and tell the owner: deleting the Worker deletes its Durable Object storage, which holds every project.
- With the count at `0`, detach the custom domain chosen by hostname and service, never by a remembered id: run `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=api.todz.app&service=todz-api"`. Exactly one entry must come back, else stop, and its `hostname` must be `api.todz.app` and its `service` `todz-api`, else stop. Delete it with `scripts/todz-cloudflare.sh api DELETE /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains/<domain-id>`, using that entry's `id` (the endpoint is not verified; the dashboard's Worker settings detach it too). Then run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler delete todz-api`.
- Rolling back to a version from before the site (the `landing` feature): detach `todz.app` and `www.todz.app` first, as in the site bullet below, because that version routes by path alone and would answer the API on the site hosts.
- Later deploys: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler rollback` to go back to the previous version, or the same with a version id for a named one, and note the reason with `-m`. The migrations stay applied: they only move forward and must keep working with the previous Worker, so write each one that way.
- A bad migration: restore the bookmark of step 5, which needs the owner's word because it discards writes made since.
- Never roll back to a version from before `sign-in-guard`: it reopens the unguarded sign-in routes. To close sign-in on the current version instead, delete the secret with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret delete TURNSTILE_SECRET_KEY`; both posts then answer 503 `sign_in_unavailable` until it is put again.
- The site alone: detach `todz.app` and `www.todz.app` the same way, each chosen by `?hostname=<host>&service=todz-api` with exactly one entry back, and delete each by its `id`; `api.todz.app` keeps answering. The site sends `Strict-Transport-Security: max-age=31536000` without `includeSubDomains` or `preload`, so browsers that saw it keep using HTTPS on `todz.app` for a year; to lift it, a version must first serve `max-age=0` to those browsers.
- The `waitlist` table (migration 0005) stays through any rollback: `wrangler rollback` changes the code, never the rows, and an older version simply never reads it.
- The `admin_sign_in_links` and `admin_sessions` tables and the `waitlist_joined_at` index (migration 0006) stay through any rollback; an older version never reads them, so no admin session works on it, but the rows live up to twelve hours and work again if a version with the admin comes back in that time. To close the admin on the current version, delete the secret with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret delete ADMIN_EMAIL`: the panel then answers 503, the link request 503, the export and sign-out redirect to the panel, and no session counts while the secret is missing; putting it back revives the unexpired ones. To end every session for good, and only on the owner's word, run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM admin_sessions"`.
- When the admin's own request mails nothing because someone filled its five links per fifteen minutes, and only on the owner's word, clear the unspent links with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM admin_sign_in_links WHERE consumed_at IS NULL"`; spent links and sessions are untouched.
- The digest's cron belongs to the Worker, not to a version: `wrangler rollback` keeps the `0 11 * * *` schedule, and a version without the digest then fails each run, which only shows in Cron Events. To stop it, set `"triggers": { "crons": [] }` in `wrangler.jsonc` through a pull request and deploy.
- Durable Object classes are never deleted: a `migrations` entry in `wrangler.jsonc` never removes `ProjectStore`.

## Rotate the token

The owner rotates the Keychain token after a run that went wrong, when it may have leaked, and on a schedule of their choosing: create a new token in the dashboard with the permissions at the top, store it with `security add-generic-password -U -s todz-cloudflare -a todz -w` (it asks for the value; never type it on a command line), delete the old one in the dashboard, then run step 2 again.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
| 2026-11-24 | 2bde053 | 1 | Clean tree on `main`, 0 ahead and 0 behind `origin/main`; `pnpm verify all` 7 gates green at 2bde053 |
| 2026-11-24 | 2bde053 | 2 | `whoami`: an API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-24 | 2bde053 | 3 | No record named `api.todz.app`. Apex snapshot: `MX todz.app` route1, route2, route3 `.mx.cloudflare.net`; `TXT todz.app "v=spf1 include:_spf.mx.cloudflare.net ~all"`; `_dmarc` `p=none` |
| 2026-11-24 | 2bde053 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 0 tables, region ENAM |
| 2026-11-24 | 2bde053 | 5 | Bookmark `00000001-00000000-0000512e-9bf3b19ce0f9fe34dd3ab3d35b05c798` |
| 2026-11-24 | 2bde053 | 6 | Exported `before-2bde053.sql` (32 bytes, empty database) into the private folder |
| 2026-11-24 | 2bde053 | 7 | Four migrations listed and applied (0001 to 0004); the second list says nothing to apply; 9 tables. Wrangler labels the target "preview database" while naming the production id |
| 2026-11-24 | 2bde053 | 8 | Deployed, Current Version ID `8d389ed9-126b-475d-b936-ab951e1141c9`, `api.todz.app (custom domain)`; the three limiters, the three variables; the table showed `env.DIRECTORY` with the nil preview id ([learning](../learnings/2026-11-24-wrangler-deploy-lists-the-preview-database-id-in-its-bindings.md)) |
| 2026-11-24 | 2bde053 | 9 | One domain entry `api.todz.app` → `todz-api`; the version at 100 percent; `versions view` binds `DIRECTORY` to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-24 | 2bde053 | 10 | Not run: the widget is the owner's step (the token lacks Turnstile Edit). No site key and no secret, so sign-in stays closed by design |
| 2026-11-24 | 2bde053 | 11 | Sending enabled for `todz.app` (tag `e334383f152c44038f0216e0e35bcf85`, enabled yes). Cloudflare added the `cf-bounce` MX, SPF and DKIM records. The apex MX and SPF and `_dmarc` `p=none` are unchanged. `dns get` suggests `_dmarc p=reject`; left as is |
| 2026-11-24 | 2bde053 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`. The first plain request answered 404 while it propagated; read back `on`, then `HTTP/1.1 301` to `https://api.todz.app/owner/sign-in-method` |
| 2026-11-24 | 2bde053 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 503` text/html (no site key yet); `/mcp` `HTTP/2 401`; the account subdomain read, and the Worker's `workers.dev` address gave no answer in 120 s. A wrong session on `/owner` answered 401, so D1 serves. The export was deleted |
| 2026-11-24 | 2bde053 | 14 | `HTTP/2 503` `{"error":"sign_in_unavailable"}`, as expected before the secret; no mail |
| 2026-11-24 | 2bde053 | 15 | First run: 503s, then `429` with `retry-after: 60` (three visible through the old `^HTTP` grep, which this run corrected). The second run within the window: fourteen `429` `sign_in_refused`. A minute later, one request answered `503` again |
| 2026-11-25 | fe34431 | 1 | Clean tree on `main`, 0 ahead and 0 behind `origin/main`; `pnpm verify all` 8 gates green at fe34431 (with `e2e` and `macos`) |
| 2026-11-25 | fe34431 | 2 | `whoami`: an API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | fe34431 | 3 | `api.todz.app`: only the Worker's `AAAA 100::`. `todz.app`: no `A`, `AAAA` or `CNAME`; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, as on 2026-11-24. `www.todz.app`: no record |
| 2026-11-25 | fe34431 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | fe34431 | 5 | Bookmark `00000002-00000000-0000512e-450133f5c742e8e9cbe6e61cf59fcdd1` |
| 2026-11-25 | fe34431 | 6 | Exported `before-fe34431.sql` (3031 bytes) into the private folder |
| 2026-11-25 | fe34431 | 7 | No migrations to apply |
| 2026-11-25 | fe34431 | 8 | Deployed, Current Version ID `bafcf42c-9857-4ada-9ff1-6d1d068711dc`; `api.todz.app`, `todz.app` and `www.todz.app (custom domain)`; the three limiters and the four variables with `SITE_ORIGIN ("https://todz.app")`; six `/landing/` assets uploaded |
| 2026-11-25 | fe34431 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `versions view` binds `DIRECTORY` to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | fe34431 | 10 | Not run: the owner's `todz` widget still does not exist (the account lists none for `todz.app`). Sign-in stays closed by design |
| 2026-11-25 | fe34431 | 11 | `enable` answered `Subdomain already exists [code: 2040]`, which is the already-onboarded case; the list shows `todz.app` enabled yes. The apex `MX` and `TXT` are unchanged; `todz.app` and `www.todz.app` each gained only the Worker's `AAAA 100::` |
| 2026-11-25 | fe34431 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; `http://api.todz.app/owner/sign-in-method`, `http://todz.app/` and `http://www.todz.app/` each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | fe34431 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 503` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with `strict-transport-security: max-age=31536000` and a CSP starting `default-src 'none'`; `www.todz.app/self-host?from=runbook` `HTTP/2 301` to `https://todz.app/self-host?from=runbook`; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | fe34431 | 14 | `HTTP/2 503` `{"error":"sign_in_unavailable"}`, as expected before the secret; no mail |
| 2026-11-25 | fe34431 | 15 | Run after the reviews, through the new host dispatch: eleven `HTTP/2 503`, then three `HTTP/2 429` each with `retry-after: 60`. The single request a minute later was not repeated |
| 2026-11-25 | 6a65b68 | 1 | Clean tree on `main`, 0 ahead and 0 behind `origin/main`; `pnpm verify all` 8 gates green at 6a65b68 (with `e2e` and `macos`) |
| 2026-11-25 | 6a65b68 | 2 | `whoami`: an API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 6a65b68 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged |
| 2026-11-25 | 6a65b68 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 6a65b68 | 5 | Bookmark `00000003-00000000-0000512e-db31c6c3d5077076a0d3e0d4f7143620` |
| 2026-11-25 | 6a65b68 | 6 | Exported `before-6a65b68.sql` (3031 bytes) into the private folder |
| 2026-11-25 | 6a65b68 | 7 | The first list named `0005_waitlist.sql`; applied; the second list says nothing to apply |
| 2026-11-25 | 6a65b68 | 8 | Deployed, Current Version ID `15252c7f-ec20-42f9-9e53-17db3a4c7ba1`; the three custom domains; the six limiters (10, 3, 100, 10, 3 and 60 requests/60s) and the four variables; no asset changed |
| 2026-11-25 | 6a65b68 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `versions view` binds `DIRECTORY` to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 6a65b68 | 10 | Not run: the owner's `todz` widget does not exist yet. Sign-in and the waitlist stay closed by design |
| 2026-11-25 | 6a65b68 | 11 | `enable` answered `Subdomain already exists [code: 2040]`, the already-onboarded case; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the `cf-bounce` and DKIM records; the zone records match step 3 |
| 2026-11-25 | 6a65b68 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 6a65b68 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 503` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS `max-age=31536000` and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | 6a65b68 | 14 | Link post `HTTP/2 503` `{"error":"sign_in_unavailable"}`; waitlist probe counts `0`, post `503`, count `0`; no mail |
| 2026-11-25 | 6a65b68 | 15 | Eleven `HTTP/2 503`, then three `HTTP/2 429` each with `retry-after: 60`. The single request later answered `HTTP/2 503`, as the first did |
| 2026-11-25 | 217d5c3 | 1 | Clean tree on `main`, 0 ahead and 0 behind `origin/main`; `pnpm verify all` 8 gates green at 217d5c3 (with `e2e` and `macos`) |
| 2026-11-25 | 217d5c3 | 2 | `whoami`: an API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 217d5c3 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged |
| 2026-11-25 | 217d5c3 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 217d5c3 | 5 | Bookmark `00000006-00000000-0000512e-1b2e2abfdcdcb502c500957dc0780816` |
| 2026-11-25 | 217d5c3 | 6 | Exported `before-217d5c3.sql` (3299 bytes) into the private folder |
| 2026-11-25 | 217d5c3 | 7 | The first list named `0006_admin.sql`; applied; the second list says nothing to apply |
| 2026-11-25 | 217d5c3 | 8 | Deployed, Current Version ID `2148e758-9c33-4d5d-a168-5468fe89ff11`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the four variables; no asset changed |
| 2026-11-25 | 217d5c3 | 9 | One domain entry per host, each `todz-api`; `2148e758` at 100 percent at that point (`f98645a5` after step 10) with `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19`. The first digest's arrival is checked after the next 11:00 UTC |
| 2026-11-25 | 217d5c3 | 10 | Turnstile not run: the owner's widget does not exist yet. `ADMIN_EMAIL` put from standard input, with no file holding it (`Success! Uploaded secret ADMIN_EMAIL`), which deployed version `f98645a5-c4ac-468d-b003-4bb60b248ada` at 100 percent; `secret list` names `ADMIN_EMAIL` only |
| 2026-11-25 | 217d5c3 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; the zone records match step 3 |
| 2026-11-25 | 217d5c3 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 217d5c3 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 503` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | 217d5c3 | 14 | Link post `HTTP/2 503` `{"error":"sign_in_unavailable"}`; waitlist probe counts `0`, post `503`, count `0`; admin probe unspent links `0`, post `503`, `0`; no mail |
| 2026-11-25 | 217d5c3 | 15 | Eleven `HTTP/2 503`, then three `HTTP/2 429` each with `retry-after: 60`. The single request later answered `HTTP/2 503`, as the first did |
