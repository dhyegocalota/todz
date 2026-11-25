# Deploy the API

Deploy the todz Worker to `api.todz.app` from `main`: the database, its migrations, the Worker with its Durable Objects, the custom domain, mail sending for `todz.app`, HTTPS only and a smoke check of the live routes ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0043](../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)). The build loop runs it under the owner's authorization of 2026-11-24, and a person runs the same steps after that; each run adds rows to the run log at the end.

Every command runs from the repository root, one command per call, and every command that needs the token starts with `scripts/todz-cloudflare.sh`: it reads the token from the Keychain item `todz-cloudflare` and gives it only to that one command, so no step exports a variable, echoes the token or puts it on a command line. A Wrangler call is `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler ...`, a Cloudflare API call is `scripts/todz-cloudflare.sh api <METHOD> <path> [json-body-file]` and prints the JSON. No step passes `--var`, and every database command names `--remote`. The values: account `e2035d8e0b7173d520ccf643f6f4661c`, zone `todz.app` `06490974636c535e2cbfd7c5b09925a5`, database `todz-directory` `dc22b1c3-1869-44a0-b805-91bf92017f19`, Worker `todz-api`.

Prerequisites: the `sign-in-guard` feature has shipped. It adds Turnstile, failing closed, and the per-client, per-address and global limits on every public sign-in endpoint. The owner said on 2026-11-24 that sign-in never goes to production without it, so check `docs/features/README.md` for its `Shipped` row and stop if it is missing. The account is on Workers Paid (the owner confirmed it active on 2026-11-24), and the token has these permissions by the dashboard's names: Workers Scripts Edit, D1 Edit, Workers Routes Edit and DNS Edit and Zone Settings Edit on the zone, Zone Read scoped to the `todz.app` zone, Email Sending Edit, and Email Routing Rules Edit and Zone Settings Edit on the zone for the reply rule of step 10 (without them step 10 is the owner's, in the dashboard). The dashboard names are not checked against Cloudflare's documentation.

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

   Expected: the file `before-<commit>.sql` exists in the folder; on the first deploy the database is empty and it holds the schema only, or nothing. Step 14 deletes it once the smoke check passes, because after the first sign-in it holds owners' email addresses.
   If it fails: an authentication error names D1 Edit. An empty database that the export refuses is the one failure to accept, and only on a first deploy that step 4 showed to be empty; say so in the run log.

7. **Apply the migrations.** List what is unapplied, apply it, and list again:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   ```

   Expected: the first list names `0001_directory.sql` to `0008_day_email.sql` on a first deploy, and only the migrations that are new since the last run after it (`0008_day_email.sql` for the day email's first deploy); the apply prints each migration as applied; the second list says there is nothing to apply. Migrations only move forward and must keep working with the Worker that is live.
   If it fails: a failed migration changes nothing from that file on; read the error, fix the migration in a pull request and start over. An authentication error names D1 Edit. To undo a bad migration, ask the owner; on their word, restore the bookmark of step 5 with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 time-travel restore todz-directory --bookmark <bookmark>`, because it discards the writes made since. Never restore without that word.

8. **Deploy the Worker.** Deploy alone: no variable override and no environment:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deploy
   ```

   Expected: the bindings list `env.DIRECTORY`, shown with the nil `preview_database_id` (Wrangler 4.167.0 prints the preview id there; step 9 reads the version's real binding), `env.PROJECT_STORE (ProjectStore)`, `env.EMAIL`, `env.SIGN_IN_LIMITER (10 requests/60s)`, `env.SIGN_IN_ADDRESS_LIMITER (3 requests/60s)`, `env.SIGN_IN_GLOBAL_LIMITER (100 requests/60s)`, `env.WAITLIST_LIMITER (10 requests/60s)`, `env.WAITLIST_ADDRESS_LIMITER (3 requests/60s)`, `env.WAITLIST_GLOBAL_LIMITER (60 requests/60s)`, `env.ADMIN_LIMITER (10 requests/60s)`, `env.ADMIN_ADDRESS_LIMITER (3 requests/60s)` and `env.ADMIN_GLOBAL_LIMITER (30 requests/60s)` (rate limit namespaces `8601` to `8609`), the four variables `SIGN_IN_PROVIDER ("email")`, `EMAIL_SENDER ("cloudflare")`, `PUBLIC_ORIGIN ("https://api.todz.app")` and `SITE_ORIGIN ("https://todz.app")`, and `TURNSTILE_SITE_KEY` once a pull request has put the widget's site key in `wrangler.jsonc`; the output names `api.todz.app (custom domain)`, `todz.app (custom domain)` and `www.todz.app (custom domain)`, then `schedule: 0 11 * * *` (the waitlist digest, [ADR 0052](../adr/0052-the-waitlist-digest-goes-to-the-admin-address-once-a-day-from-a-cron.md)) and `schedule: */15 * * * *` (the day email, [ADR 0063](../adr/0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md)), and a Current Version ID, which goes in the run log. The first digest reaches `ADMIN_EMAIL` at the next 11:00 UTC; the Worker's Cron Events in the dashboard show each run, and a run without the `ADMIN_EMAIL` secret fails there by design. Wrangler creates the DNS record and the certificate for each custom domain.
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
   If it fails: a failed run whose error says `the waitlist digest is missing admin_email` means step 11's `ADMIN_EMAIL` secret is missing; put it. Any other failure, or no run at all, means the schedule did not register; deploy again from the same commit and tell the owner if it repeats.

10. **Turn on subaddressing and route `reply@todz.app` to the Worker.** Only after step 8 has deployed the version with the `email` handler, because a rule to a Worker without it would drop every reply. Read the zone's Email Routing settings and rules, turn subaddressing on, create the one rule, and read both again ([ADR 0064](../adr/0064-a-reply-to-the-day-email-adds-one-task-only-from-the-owner-s-own-authenticated-address.md) §2 and §8):

    ```bash
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules
    scripts/todz-cloudflare.sh api PATCH /zones/06490974636c535e2cbfd7c5b09925a5/email/routing scripts/deploy-bodies/email-routing-subaddressing-on.json
    scripts/todz-cloudflare.sh api POST /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules scripts/deploy-bodies/email-routing-reply-rule.json
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules
    ```

    Expected: the first answers `"enabled":true`, and `"support_subaddress":false` on the first run; the second lists the `hello@` and `support@` forwards to the owner and a disabled catch-all, and no rule for `reply@todz.app` (when one exists already, skip the POST and read its `actions`). The PATCH answers `"success":true`. The POST answers `"success":true` with a rule named `todz day email replies` whose matcher is the literal `to` `reply@todz.app`, whose action is `worker` with `todz-api`, and `"enabled":true`. The last two reads show `"support_subaddress":true` and four rules: the two forwards, the catch-all still disabled, and the new one. No endpoint of this step was checked against Cloudflare's documentation; the answers are the check.
    If it fails: an authentication error or a 403 on either write means the token lacks Email Routing Rules Edit or Zone Settings Edit; the writes then become the owner's steps of ADR 0064 §8, in the dashboard: Email Routing, Settings, Subaddressing on; Routing rules, Create address, custom address `reply`, Send to a Worker, `todz-api`; the mail out works without them and the replies are dropped by Cloudflare until they exist. A body the API refuses means the endpoint or its shape changed; read the error, do not guess a second shape, and tell the owner. A `hello@` or `support@` rule that changed or disappeared means stop and tell the owner, because this step never edits them. If a reply that should reach the Worker is not logged, read the rule's `actions` first.

    Then read the day mail's own record. The table has no address column, so nothing here prints one:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT day, claimed_at, sent_at, failed_at, failure FROM day_emails ORDER BY claimed_at DESC LIMIT 5"
    ```

    Expected: no rows until an owner turns Email me my day on; then one row per owner per day with `sent_at` set and `failed_at` and `failure` null. A row with `failure` `send_failed` names the sender, `read_failed` the project store and `too_many_projects` the cap.
    If it fails: an authentication error names D1 Edit. A row with `claimed_at` and neither `sent_at` nor `failed_at` after a quarter hour means a tick died between the claim and the send; the day is lost by design, never sent twice, so tell the owner and read the Worker's Cron Events.

    Then check Workers Logs for the Worker in the dashboard (Workers and Pages, `todz-api`, Observability, Logs), which no command of the wrapper reads: search the last day for `rcptTo` and for `mailFrom`, then open one `day_email_run` event and, once a reply was sent, one `day_email_reply` event.

    Expected: no event carries `rcptTo` or `mailFrom`, or any address, subject or header text; a `day_email_run` event holds only the counts `due`, `sent` and `failed`, and a `day_email_reply` event only an `outcome` (and a verdict for `unauthenticated`).
    If it fails: a match means invocation logs are on or a handler logs an address; turn `invocation_logs` off in `wrangler.jsonc` through a pull request, deploy, and tell the owner, because the envelope addresses are already stored for the log's retention.

11. **Create the Turnstile widget and put its secret.** The owner creates the widget in the dashboard, because the token lacks Turnstile Edit: Turnstile, Add widget, name `todz`, hostname `todz.app` (it covers `api.todz.app`), widget mode Managed. The dashboard then shows a site key and a secret key. The site key is public: it sits in the `vars` of `apps/api/wrangler.jsonc` as `TURNSTILE_SITE_KEY`, with its pin in `api-source.test.ts`, so step 8 deploys it. The secret never touches a file or a command line: the owner runs the first command and pastes it at its prompt, or, when the owner saved it in the Keychain item `todz-turnstile` (with `security add-generic-password -s todz-turnstile -a todz-turnstile-secret -w` and no value, so `security` prompts for it), pipes it from there without printing it (the wrapper hands its standard input to the command), then anyone lists the secrets:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY
    security find-generic-password -s todz-turnstile -w | scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Run one of the two puts, not both.

    Expected: the put says it uploaded the secret `TURNSTILE_SECRET_KEY` for `todz-api` (the paste path asks for the value first); the list names `TURNSTILE_SECRET_KEY` and prints no value. Until the secret exists, the two sign-in posts answer 503 `sign_in_unavailable` and the waitlist and admin posts answer 503, which is the safe state; the two sign-in pages answer 200 once step 8 has deployed the site key. Steps 14 to 16 say what each state answers. The list proves only that the name exists: the production smoke walk's real sign-in is what proves the value is right.
    If it fails: an error from `security`, or wrangler refusing an empty value, means the Keychain item is missing and nothing was uploaded; save it as above and put it again. A 503 on a solved sign-in after the put means the stored value is wrong; put it again.
    The admin's address is a secret too, though not a sensitive one: it keeps a fork that never sets it closed ([ADR 0051](../adr/0051-the-admin-signs-in-by-a-mail-link-bound-to-the-browser-that-asked-into-a-cookie-session.md)). Put it once, without waiting for the widget, by typing `hello@todz.app` at the prompt, then list the secrets again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put ADMIN_EMAIL
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Expected: the first says it uploaded the secret `ADMIN_EMAIL` for `todz-api`; the list names `ADMIN_EMAIL`. Until it exists `https://todz.app/admin` answers 503, "The admin is closed right now."; after it, the sign-in card, whose post answers 503 until the Turnstile secret and site key exist too.
    If it fails: an authentication error on the secret names Workers Scripts Edit. A dashboard that refuses `todz.app` as a hostname means the zone is not on this account; tell the owner. If the owner grants the token Account, Turnstile, Edit instead, the widget can be made through the API only once `scripts/todz-cloudflare.sh` allows the widget path; until then it stays a dashboard step. A secret that was pasted anywhere else, a chat, a file or a log, is rotated: the owner rotates it in the widget's settings and puts it again.

12. **Onboard `todz.app` for Email Sending.** Enable sending for the zone, read the state and the records, and list the zone again to compare it with the snapshot of step 3:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending enable todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending list todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler email sending dns get todz.app --zone-id 06490974636c535e2cbfd7c5b09925a5
    scripts/todz-cloudflare.sh api GET "/zones/06490974636c535e2cbfd7c5b09925a5/dns_records?per_page=100" | jq -r '.result | map(.type + " " + .name + " " + .content) | join("\n")'
    ```

    Expected: the first prints `Email Sending enabled for todz.app (enabled: ...)`, and an already onboarded domain says so, which is fine. The list is a table with the columns `name`, `enabled` and `tag`, and `todz.app` shows `enabled` `yes`. `dns get` prints each record with its type, Name, Content, Priority and TTL, and the zone listing now holds them. The apex `MX` and `TXT` lines of step 3 are unchanged. Never add an apex SPF record by hand and never edit one: the sending records belong to the names `dns get` prints, and a merge of the apex SPF is the owner's call. The zone already publishes DMARC with `p=none`; leave it. Raising the policy is a later step, after the first deliveries are seen.
    If it fails: an authentication error names Email Sending Edit and Zone Read. If `enabled` is `no` or the records are missing, run steps 13 and 14 and repeat this list for up to fifteen minutes, because the records verify in the background; link requests answer 503 until then, which is the safe state. If Cloudflare did not add the records to the zone, stop and tell the owner; no record is written by hand. A changed or missing apex record means stop and tell the owner. The Email Sending API is in open beta, and its documentation was not available to check this step beyond Wrangler 4.167.0's own commands.

13. **Turn on Always Use HTTPS for the zone.** Read the pseudo IPv4 setting, set the zone setting, then ask for the plain address:

    ```bash
    scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/settings/pseudo_ipv4
    scripts/todz-cloudflare.sh api PATCH /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https scripts/deploy-bodies/always-use-https-on.json
    curl -sI http://api.todz.app/owner/sign-in-method
    curl -sI http://todz.app/
    curl -sI http://www.todz.app/
    ```

    Expected: the first answers `"value":"off"` or `"value":"add_header"`; the second answers `"success":true` with `"value":"on"`; the third prints `HTTP/1.1 301` and a `location` header of `https://api.todz.app/owner/sign-in-method`, and the last two each print `HTTP/1.1 301` with a `location` on `https://` of the same host. The site sends HSTS only on its pages, so this zone setting is what keeps `www.todz.app` and the site's other answers on HTTPS.
    If it fails: any other pseudo IPv4 value (`overwrite_header`) means Cloudflare replaces the client's IPv6 address with a pseudo IPv4 one, which would hide IPv6 from the per-/64 key of the sign-in limiter; stop before the PATCH and tell the owner. An authentication error names Zone Settings Edit on the zone. A connection error right after step 8 means DNS is still settling; run the second command again every minute for up to fifteen minutes. A 200 over plain HTTP means the setting did not apply; read it back with `api GET /zones/06490974636c535e2cbfd7c5b09925a5/settings/always_use_https` and tell the owner.

14. **Smoke check the live routes.** Ask the live Worker, then its account's `workers.dev` address:

    ```bash
    curl -sS https://api.todz.app/owner/sign-in-method
    curl -sS https://api.todz.app/health
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
    curl -sS -D - -o /dev/null https://api.todz.app/owner
    curl -sS -D - -o /dev/null https://todz.app/brand/todz-lockup.png
    scripts/todz-cloudflare.sh api GET /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/subdomain
    curl -sS -D - -o /dev/null https://todz-api.<subdomain>.workers.dev/owner/sign-in-method
    ```

    Expected: `{"method":"link"}`, then `{"service":"todz","origin":"https://api.todz.app"}`, then for each page `HTTP/2 503` with `content-type: text/html; charset=utf-8` until the site key is in `wrangler.jsonc` and `HTTP/2 200` after, then `HTTP/2 401`, then `HTTP/2 200` for the landing with `strict-transport-security: max-age=31536000` and a `content-security-policy` that starts with `default-src 'none'`, then for the self-host guide `HTTP/2 301` with `location: https://docs.todz.app/self-host` and `cache-control: max-age=3600`, then for the `www` address the same `HTTP/2 301` with `location: https://docs.todz.app/self-host`, its query dropped, then `HTTP/2 404` for the owner route on the site host and for the landing on the API host, then for `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex` (the admin's sign-in card), then `HTTP/2 404` for `api.todz.app/admin`, then `HTTP/2 401` for `api.todz.app/owner` (an owner route without a bearer) and `HTTP/2 200` with `content-type: image/png` for the lockup asset, then the account's `workers.dev` subdomain, then for the last no answer from the Worker: a connection error, 404 or a Cloudflare error page, never `{"method":"link"}`. Every answer of the API host, the two redirects to the docs and the asset carries `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff` and `referrer-policy: no-referrer`, and every answer of the API host and the two redirects that is not one of the sign-in pages carries `content-security-policy: default-src 'none'; frame-ancestors 'none'`. The first proves the production variables are the ones in `wrangler.jsonc`; any other body means a `--var` or a dashboard variable overrides them, so stop and read the Worker's settings. When all sixteen pass, delete the export of step 6:

    ```bash
    rm ~/.todz-deploy/backups/before-<commit>.sql
    ```

    If it fails: a TLS error right after step 8 means the certificate is still being issued; run it again every minute for up to fifteen minutes. `{"method":"identity"}` or a 503 `sign_in_unavailable` on the method route means the fake provider was refused or the variables are wrong; never leave it, and roll back as at the end. A 522 or 1014 means the custom domain is not attached; go back to step 9 (token permission Workers Routes Edit). A page that answers 503 with the site key in `wrangler.jsonc` means the deployed version is older than that pull request; run step 8 again from its commit. A `HTTP/2 200` for `todz.app/self-host`, or a `location` of `https://todz.app/self-host?from=runbook` for the `www` address, means the deployed version predates `docs-cutover`; run step 8 again from `main`. A reply from the `workers.dev` host means `workers_dev` is on in the dashboard or in a stale deploy; turn it off in the Worker's settings, deploy again and tell the owner. A missing account subdomain means there is no address to check; write that in the run log. A permission error names Workers Scripts Read.

15. **Check that a link request needs a solved challenge.** Post a link request whose Turnstile token was never solved, and keep only the status, the `retry-after` line and the body:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/junk-turnstile-link.json https://api.todz.app/owner/sign-in-links
    ```

    Expected: before step 11's secret exists, `HTTP/2 503` and `{"error":"sign_in_unavailable"}`; after it, `HTTP/2 429`, `retry-after: 60` and `{"error":"sign_in_refused"}`. No mail leaves either way. A real link, with a real mail to the owner, is asked for in the production smoke walk with the app, never here.
    If it fails: a 202 means the Worker sent a link without a solved challenge; close sign-in as the Rollback section says and tell the owner. A 503 after the secret exists means siteverify, the secret or a binding is missing; read step 8's bindings and step 11's list again. A 400 means the body file changed; restore it from `main`.

    Then check that the waitlist keeps nothing without a solved challenge. Count the rows, post an address with an unsolved token, and count again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-waitlist.txt https://todz.app/join
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    ```

    Expected: both counts are `0`; the post prints `503` (the waitlist opens soon) until both the site key is in `wrangler.jsonc` and step 11's secret exists, and `429` (try again) after both. Only a count of the probe address is read, never a visitor's address, so a real join during the check changes nothing.
    If it fails: a `200` or a count of `1` means the waitlist kept an address without a solved challenge; detach `todz.app` as the Rollback section says and tell the owner.

    Then check that the admin stores no link without a solved challenge. Count the unspent admin links, post an unsolved request from the site's origin, and count again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS admin_links FROM admin_sign_in_links WHERE consumed_at IS NULL"
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://todz.app" -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-admin.txt https://todz.app/admin/sign-in-links
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS admin_links FROM admin_sign_in_links WHERE consumed_at IS NULL"
    ```

    Expected: the status code is the check; the two counts only show that nothing was written, which holds for any probe address that is not `ADMIN_EMAIL`. They are equal, and the post prints `503` (the admin is closed) until the site key is in `wrangler.jsonc` and both of step 11's secrets exist, and `429` (try again) after all three. No mail leaves.
    If it fails: a `403` means the `Origin` header was lost; run the command as written. A `200` means siteverify accepted an unsolved token or the guard was skipped; close the admin as the Rollback section says, and tell the owner.

16. **Check the per-client limit.** Post wrong session tokens from this machine, fourteen in one command, and keep only the statuses and `retry-after` values; each answer's body ends without a newline, so the next status starts mid-line and a `^HTTP` match would miss it. The body carries a malformed link verifier, which the Worker refuses before it asks siteverify, and an unsolved Turnstile token:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions | grep -oE "HTTP/2 [0-9]+|retry-after: [0-9]+"
    ```

    Expected: the first ten answers are `HTTP/2 401` (the malformed verifier), or `HTTP/2 503` before step 11's secret exists, and from the eleventh on they are `HTTP/2 429` followed by `retry-after: 60`; the binding counts per Cloudflare location and may let a request or two more than ten through, so at least one of the last four is a 429. Refused requests count against the window too, so wait at least seventy seconds after the last one, then one single request answers as the first did:

    ```bash
    curl -sS -D - -o /dev/null -X POST -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions
    ```
    If it fails: no 429 means run the command once more; none in the second run either means the binding is not enforcing, or Cloudflare did not send `CF-Connecting-IP` or the request counted as local; tell the owner before the app ships. A 429 on the first request means another client on this address used the quota; wait a minute and run it again.

17. **Check the landing's discovery files, icons and scores.** Ask the live site for each discovery file, the card on both hosts, the icon and the share image, then for the landing as two crawlers, then for the analytics beacon:

    ```bash
    curl -sS -D - https://todz.app/robots.txt
    curl -sS -D - -o /dev/null https://todz.app/sitemap.xml
    curl -sS -D - -o /dev/null https://todz.app/llms.txt
    curl -sS -D - -o /dev/null https://todz.app/llms-full.txt
    curl -sS -D - -o /dev/null https://todz.app/site.webmanifest
    curl -sS -D - -o /dev/null https://todz.app/.well-known/ard.json
    curl -sS -D - -o /dev/null https://todz.app/.well-known/mcp/server-card.json
    curl -sS -D - -o /dev/null https://api.todz.app/mcp/server-card
    curl -sS -D - -o /dev/null https://todz.app/favicon.ico
    curl -sS -D - -o /dev/null https://todz.app/og/todz.png
    curl -sS -o /dev/null -w "%{http_code}\n" -A GPTBot https://todz.app/
    curl -sS -o /dev/null -w "%{http_code}\n" -A ClaudeBot https://todz.app/
    curl -sS https://todz.app/ | grep -c cloudflareinsights
    ```

    Expected: `HTTP/2 200` for every file with `text/plain; charset=utf-8` for `robots.txt`, `llms.txt` and `llms-full.txt`, `application/xml; charset=utf-8` for the sitemap, `application/manifest+json` for the manifest, `application/json` for the catalog and `application/mcp-server-card+json` for both cards, which carry `access-control-allow-origin: *` and `cache-control: public, max-age=3600`; `image/x-icon` or `image/vnd.microsoft.icon` for the favicon and `image/png` for the share image. `robots.txt` holds the Worker's groups and both `Sitemap:` lines, and above its first `User-agent: *` line nothing or comments only. Then `200` and `200` for the two crawlers, and `0` for the beacon.

    Then run Lighthouse on the landing, three times, on the Chromium that `@playwright/test` installs, and keep the five scores of each run:

    ```bash
    CHROME_PATH=~/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/"Google Chrome for Testing.app"/Contents/MacOS/"Google Chrome for Testing" pnpm dlx lighthouse@13.6.0 https://todz.app/ --chrome-flags="--headless=new" --quiet --output=json --output-path=stdout > ~/.todz-deploy/lighthouse-1.json
    jq -c '.categories | map_values(.score)' ~/.todz-deploy/lighthouse-1.json
    ```

    Expected: on the median of three runs SEO, Best Practices, Accessibility and Agentic browsing `1` and Performance `0.95` or more; the audits `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` pass.
    If it fails: a `User-agent`, `Disallow` or `Content-Signal` line above the Worker's groups, or a `cloudflareinsights` match, means Cloudflare's managed `robots.txt` or its analytics beacon is on: read `scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/bot_management` and, when it shows `is_robots_txt_managed` or content signals on, turn them off with a `PATCH` of the same path through the wrapper, then run this step again. Web Analytics' automatic setup lives under the account's RUM path, which the wrapper refuses, so turning it off is an owner step (dashboard, Web Analytics, the `todz.app` site, automatic setup off), as is any setting the token's permission refuses (an authentication error). A `403` to a crawler is the zone's bot rule, an owner step. A Performance median under `0.95` is recorded in the run log and opens the follow-up `fix/landing-performance`; it does not roll the deploy back.

18. **Record the run.** Add one row per step above to the run log, with the date, the commit, the step and the actual result, in a pull request on `docs/`.
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
- The `owners.agent_nudge` column (migration 0007) stays through any rollback, and an older version never reads it: agents stop hearing the line, and the app's switch reads as unknown and cannot be changed until a version with the nudge is back, when every owner's choice is still there.
- When the admin's own request mails nothing because someone filled its five links per fifteen minutes, and only on the owner's word, clear the unspent links with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM admin_sign_in_links WHERE consumed_at IS NULL"`; spent links and sessions are untouched.
- The digest's cron belongs to the Worker, not to a version: `wrangler rollback` keeps the `0 11 * * *` and `*/15 * * * *` schedules, and a version without the digest or the day email then fails each run, which only shows in Cron Events. To stop it, set `"triggers": { "crons": [] }` in `wrangler.jsonc` through a pull request and deploy.
- The reply rule: to turn the inbound half of the day email off without a deploy, delete the `reply@` rule. Read `scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules`, pick the entry named `todz day email replies` whose matcher is the literal `to` `reply@todz.app` (exactly one, else stop), and delete it with `scripts/todz-cloudflare.sh api DELETE /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules/<rule-id>` using its `id`. Replies then reach no Worker and add nothing; the mail out keeps going. Subaddressing may stay on: `hello+x@` and `support+x@` keep forwarding to the owner, and the Worker refuses addresses on `todz.app` anywhere else. To stop the mail out too, the owner turns Email me my day off in the app, or `wrangler.jsonc` drops the `*/15 * * * *` cron through a pull request.
- The day email's tables (migration 0008) and the owner's `day_email` and `day_email_minutes` columns stay through any rollback; an older version never reads them and the stored choices come back with a version that does.
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
| 2026-11-25 | 59d3966 | 1 | Clean tree on `main`, 0 ahead and 0 behind `origin/main`; `pnpm verify all` 8 gates green at 59d3966 (with `e2e` and `macos`) |
| 2026-11-25 | 59d3966 | 2 | `whoami`: an API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 59d3966 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged |
| 2026-11-25 | 59d3966 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 59d3966 | 5 | Bookmark `00000009-00000000-0000512e-d7b120f79ecd9633667443e73ae2d6fb` |
| 2026-11-25 | 59d3966 | 6 | Exported `before-59d3966.sql` (4132 bytes) into the private folder |
| 2026-11-25 | 59d3966 | 7 | The first list named `0007_agent_nudge.sql` only; applied; the second list says nothing to apply; `owners` counts 0 rows |
| 2026-11-25 | 59d3966 | 8 | Deployed, Current Version ID `25bc8121-a464-448e-9548-d4c10aa9c339`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the four variables; no asset changed |
| 2026-11-25 | 59d3966 | 9 | One domain entry per host, each `todz-api`; `25bc8121` at 100 percent (after `f98645a5`) with `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 59d3966 | 10 | Not run: the owner's `todz` widget does not exist yet. `secret list` names `ADMIN_EMAIL` only; no secret put |
| 2026-11-25 | 59d3966 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; the zone records match step 3 |
| 2026-11-25 | 59d3966 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 59d3966 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 503` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | 59d3966 | 14 | Link post `HTTP/2 503` `{"error":"sign_in_unavailable"}`; waitlist probe counts `0`, post `503`, count `0`; admin probe unspent links `0`, post `503`, `0`; no mail |
| 2026-11-25 | 59d3966 | 15 | Eleven `HTTP/2 503`, then three `HTTP/2 429` each with `retry-after: 60`. The single request a minute later was not sent this run |
| 2026-11-25 | 43d8505 | 1 | Clean detached worktree at `origin/main`, 0 ahead and 0 behind. First `pnpm verify all` red: the `e2e` gate failed on one test, `[mobile] landing.spec.ts:278` (a second click while the token is pending posts the form once), 45 passed, 1 failed, 2 skipped, under load; the test alone passed 6 of 6 (desktop and mobile). Second `pnpm verify all` 8 gates green at 43d8505 (with `e2e` and `macos`) |
| 2026-11-25 | 43d8505 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 43d8505 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged |
| 2026-11-25 | 43d8505 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 43d8505 | 5 | Bookmark `0000000c-00000000-0000512e-df32e45ea6a21f28624a6d9fe9f0b16a` |
| 2026-11-25 | 43d8505 | 6 | Exported `before-43d8505.sql` (4313 bytes) into the private folder |
| 2026-11-25 | 43d8505 | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | 43d8505 | 8 | Deployed, Current Version ID `ff22ab6f-ccfe-4e7a-af87-2dea0fba5d2d`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no asset changed |
| 2026-11-25 | 43d8505 | 9 | One domain entry per host, each `todz-api`; `ff22ab6f` at 100 percent at that point (`d5b4698c-8df6-4d34-8a8d-ecef7c89845c` after step 10) with `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 43d8505 | 10 | `TURNSTILE_SECRET_KEY` put from the Keychain through the pipe, with no file holding it (`Success! Uploaded secret TURNSTILE_SECRET_KEY`), which deployed version `d5b4698c-8df6-4d34-8a8d-ecef7c89845c` at 100 percent; `ADMIN_EMAIL` not put again; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 43d8505 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; the zone records match step 3 (the three hosts each only the Worker's `AAAA 100::`) |
| 2026-11-25 | 43d8505 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 43d8505 | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html (site key deployed); `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | 43d8505 | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 43d8505 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`. Two single requests within the next minute still answered `429` (blocked requests count against the window); one sent 70 seconds later answered `HTTP/2 401`, as the first did |
| 2026-11-25 | a9982af | 1 | Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` a9982af, because the main worktree held a feature branch; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm verify all`: 8 gates green at a9982af on the first run (no flake) |
| 2026-11-25 | a9982af | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | a9982af | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"` |
| 2026-11-25 | a9982af | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | a9982af | 5 | Bookmark `0000000f-00000000-0000512e-a301e824945c5c7f0293fbc3ff569465` |
| 2026-11-25 | a9982af | 6 | Exported `before-a9982af.sql` (4313 bytes) into the private folder |
| 2026-11-25 | a9982af | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | a9982af | 8 | Deployed, Current Version ID `c857d53e-40ab-4846-b027-6c7d245d82da`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no asset changed |
| 2026-11-25 | a9982af | 9 | One domain entry per host, each `todz-api`; `c857d53e` at 100 percent; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | a9982af | 10 | No secret put (both exist); `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | a9982af | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the zone records match step 3 |
| 2026-11-25 | a9982af | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | a9982af | 13 | `{"method":"link"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; the `workers.dev` address timed out with no answer from the Worker; export deleted. The deployed landing carries `todz is a product of <a class="footer-credit-link" href="https://logicbit.com.br" rel="noopener noreferrer">Logic Bit</a>, made in Brazil` |
| 2026-11-25 | a9982af | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | a9982af | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 75 seconds later answered `HTTP/2 401`, as the first did |
| 2026-11-25 | b88f11e | 1 | Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` b88f11e, because the main worktree held another branch; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm install --frozen-lockfile` clean; `sign-in-guard` has its `Shipped` row. `pnpm verify all`: 8 gates green at b88f11e on the first run (no flake) |
| 2026-11-25 | b88f11e | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | b88f11e | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"` |
| 2026-11-25 | b88f11e | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | b88f11e | 5 | Bookmark `00000012-00000000-0000512e-652bd79e77f0c70e64301fdd087b5fd9` |
| 2026-11-25 | b88f11e | 6 | Exported `before-b88f11e.sql` (4313 bytes) into the private folder |
| 2026-11-25 | b88f11e | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | b88f11e | 8 | Deployed, Current Version ID `0f38adca-dde1-44b5-8be3-ad715d779880`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no asset changed |
| 2026-11-25 | b88f11e | 9 | One domain entry per host, each `todz-api`; `0f38adca` at 100 percent; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | b88f11e | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | b88f11e | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the apex and host records match step 3 |
| 2026-11-25 | b88f11e | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | b88f11e | 13 | `{"method":"link"}`; `api.todz.app/health` `HTTP/2 200` `{"service":"todz","origin":"https://api.todz.app"}` with `cache-control: no-store`; outside step 13, an extra probe of `todz.app/health` answered `HTTP/2 200` with the same body; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301`; the two cross-host routes `HTTP/2 404`; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; the `workers.dev` address timed out with no answer from the Worker; export deleted |
| 2026-11-25 | b88f11e | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | b88f11e | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent at least 75 seconds later answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 2cbca72 | 1 | Before the run, read-only production counts ahead of step 8: `waitlist` rows whose address holds `:` or `/` 0; `owner_identities` rows (`provider = 'email'`) whose subject holds `:` or `/` 0. Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` 2cbca72, because the main worktree is the owner's; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm install --frozen-lockfile` clean; `sign-in-guard` has its `Shipped` row. `pnpm verify all`: 9 gates green at 2cbca72 on the first run (no flake) |
| 2026-11-25 | 2cbca72 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 2cbca72 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged; the zone also holds `docs.todz.app` records, which are not one of the three hosts |
| 2026-11-25 | 2cbca72 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 2cbca72 | 5 | Bookmark `00000015-00000000-0000512e-245f7f9d3e76e28346dddc2e57ac85e0` |
| 2026-11-25 | 2cbca72 | 6 | Exported `before-2cbca72.sql` (4313 bytes) into the private folder |
| 2026-11-25 | 2cbca72 | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | 2cbca72 | 8 | Deployed, Current Version ID `f706911b-9656-4344-9548-3cb38e30912e`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no asset changed |
| 2026-11-25 | 2cbca72 | 9 | One domain entry per host, each `todz-api`; `f706911b` at 100 percent (newest deployment); `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 2cbca72 | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 2cbca72 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the apex and host records match step 3 |
| 2026-11-25 | 2cbca72 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 2cbca72 | 13 | `{"method":"link"}`; `api.todz.app/health` `HTTP/2 200` `{"service":"todz","origin":"https://api.todz.app"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html with HSTS, nosniff, `referrer-policy: no-referrer` and a CSP starting `default-src 'none'`; `/mcp` `HTTP/2 401`; `todz.app/` and `/self-host` `HTTP/2 200` with HSTS `max-age=31536000`, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; the `www` redirect `HTTP/2 301` with the three headers and `default-src 'none'; frame-ancestors 'none'`; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the three headers and the CSP; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404` with the headers; `api.todz.app/owner` `HTTP/2 401` with the headers and the CSP (the runbook said 404; every earlier run saw 401 from the Worker on `/owner`, so its text was stale and `docs-cutover` corrects it); the lockup asset `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; the `workers.dev` address timed out with no answer from the Worker; export deleted |
| 2026-11-25 | 2cbca72 | 14 | Link post (now with `app_link_scheme`) `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 2cbca72 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 26842db | 1 | Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` 26842db, because the main worktree is the owner's; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm install --frozen-lockfile` clean; `sign-in-guard` has its `Shipped` row. `pnpm verify all`: 9 gates green at 26842db on the first run (no flake) |
| 2026-11-25 | 26842db | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 26842db | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged; the zone also holds `docs.todz.app` records (a `CNAME` to Mintlify and its two verification `TXT`) |
| 2026-11-25 | 26842db | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 26842db | 5 | Bookmark `00000017-00000000-0000512e-465265273945b5af1e1e8bd9e337e10c` |
| 2026-11-25 | 26842db | 6 | Exported `before-26842db.sql` (4313 bytes) into the private folder |
| 2026-11-25 | 26842db | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | 26842db | 8 | Deployed, Current Version ID `07dd5cc1-6265-491e-ac71-54e9a654a4bf`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no asset changed |
| 2026-11-25 | 26842db | 9 | One domain entry per host, each `todz-api`; `07dd5cc1` at 100 percent (newest deployment); `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 26842db | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 26842db | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the apex and host records match step 3 |
| 2026-11-25 | 26842db | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 26842db | 13 | `{"method":"link"}`; `api.todz.app/health` `HTTP/2 200` `{"service":"todz","origin":"https://api.todz.app"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html with HSTS, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `/mcp` `HTTP/2 401`; `todz.app/` `HTTP/2 200` with HSTS `max-age=31536000`, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `todz.app/self-host` `HTTP/2 301` with `location: https://docs.todz.app/self-host` and `cache-control: max-age=3600`; `www.todz.app/self-host?from=runbook` `HTTP/2 301` with the same `location` (query dropped) and `cache-control: max-age=3600`; both redirects carry HSTS, nosniff, `no-referrer` and `default-src 'none'; frame-ancestors 'none'`; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the headers and the CSP; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404` with the headers; `api.todz.app/owner` `HTTP/2 401` with the headers and the CSP; the lockup asset `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; the `workers.dev` address timed out with no answer from the Worker; export deleted |
| 2026-11-25 | 26842db | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 26842db | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later (a node timer) answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 26ad086 | 1 | Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` 26ad086, because the main worktree is the owner's; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm install --frozen-lockfile` clean; `sign-in-guard` has its `Shipped` row. `pnpm verify all`: 9 gates green at 26ad086 on the first run (no flake) |
| 2026-11-25 | 26ad086 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 26ad086 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged; the zone also holds `docs.todz.app` records (a `CNAME` to Mintlify and its two verification `TXT`) |
| 2026-11-25 | 26ad086 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 26ad086 | 5 | Bookmark `00000019-00000000-0000512e-f5a33e7e6abb2ca75dda6f405dc24cf4` |
| 2026-11-25 | 26ad086 | 6 | Exported `before-26ad086.sql` (4313 bytes) into the private folder |
| 2026-11-25 | 26ad086 | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply |
| 2026-11-25 | 26ad086 | 8 | Deployed, Current Version ID `c1ed8d96-639d-482d-9b50-60eb246c139a`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; 20 new or modified assets uploaded (`/icon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, the 192 and 512 icons and maskable icons, `/og/todz.png` and the landing's webp images) |
| 2026-11-25 | 26ad086 | 9 | One domain entry per host, each `todz-api`; `c1ed8d96` at 100 percent (newest deployment); `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 26ad086 | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 26ad086 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the apex and host records match step 3 |
| 2026-11-25 | 26ad086 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 26ad086 | 13 | `{"method":"link"}`; `api.todz.app/health` `HTTP/2 200` `{"service":"todz","origin":"https://api.todz.app"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html with HSTS, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `/mcp` `HTTP/2 401`; `todz.app/` `HTTP/2 200` with HSTS `max-age=31536000`, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `todz.app/self-host` and `www.todz.app/self-host?from=runbook` each `HTTP/2 301` with `location: https://docs.todz.app/self-host` (query dropped) and `cache-control: max-age=3600`, with HSTS, nosniff, `no-referrer` and `default-src 'none'; frame-ancestors 'none'`; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the three headers and the CSP; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; `api.todz.app/owner` `HTTP/2 401`; `todz.app/brand/todz-lockup.png` `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; `todz.app/icon.svg` `HTTP/2 200` `image/svg+xml` with `content-security-policy: default-src 'none'; style-src 'unsafe-inline'`; the account subdomain read, and the Worker's `workers.dev` address gave no answer in 30 s (connection timed out). The export was deleted |
| 2026-11-25 | 26ad086 | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 26ad086 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later (a node timer) answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 26ad086 | 16 | `robots.txt` `HTTP/2 200` `text/plain; charset=utf-8`: the Worker's thirteen `Allow: /` groups starting at `User-agent: *` (no `Disallow`, no `Content-Signal`, nothing above) and both `Sitemap:` lines, so Cloudflare's managed robots.txt and content signals are off and no zone setting was changed; `sitemap.xml` `application/xml; charset=utf-8`; `llms.txt` and `llms-full.txt` `text/plain; charset=utf-8`; `site.webmanifest` `application/manifest+json`; `.well-known/ard.json` `application/json`; the card on `todz.app/.well-known/mcp/server-card.json` and `api.todz.app/mcp/server-card` `application/mcp-server-card+json`, each with `access-control-allow-origin: *` and `cache-control: public, max-age=3600`; all `HTTP/2 200`; `favicon.ico` `image/vnd.microsoft.icon`; `og/todz.png` `image/png`; `GPTBot` 200, `ClaudeBot` 200; `cloudflareinsights` count `0` (Web Analytics beacon off). Lighthouse 13.6.0, default phone profile, three runs on `https://todz.app/`: Performance, Accessibility, Best Practices, SEO and Agentic browsing `1` in every run, so every median is `1`; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` pass in all three. No owner step |
| 2026-11-25 | 2ac3e03 | 1 | Deviation: run from a detached worktree at `origin/main` (HEAD, 0 ahead, 0 behind, clean tree), as earlier runs did; `pnpm verify all` 9 gates green at 2ac3e03; `sign-in-guard` is Shipped 2026-11-24 |
| 2026-11-25 | 2ac3e03 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 2ac3e03 | 3 | `api.todz.app` has only the Worker's own `AAAA 100::`. Snapshot: `MX todz.app` route1, route2, route3 `.mx.cloudflare.net`; `TXT todz.app "v=spf1 include:_spf.mx.cloudflare.net ~all"`; `_dmarc` `p=none`; `AAAA todz.app` and `AAAA www.todz.app` `100::`; the `cf-bounce` MX, SPF and DKIM records and the `docs` CNAME and TXT records present |
| 2026-11-25 | 2ac3e03 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 2ac3e03 | 5 | Bookmark `0000001d-00000000-0000512e-ad43d0bfc119e78bb75a267312982ca1` |
| 2026-11-25 | 2ac3e03 | 6 | Exported `before-2ac3e03.sql` (4313 bytes) into the private folder; deleted after step 13 |
| 2026-11-25 | 2ac3e03 | 7 | First list, apply and second list each say `No migrations to apply!` (none new in this commit) |
| 2026-11-25 | 2ac3e03 | 8 | Deployed, Current Version ID `20fafd55-9696-4421-b359-5adc4ba5d6ee`; bindings as listed (`env.DIRECTORY` with the nil preview id, `PROJECT_STORE`, `EMAIL`, nine limiters, five variables including `TURNSTILE_SITE_KEY`); `api.todz.app`, `todz.app` and `www.todz.app (custom domain)`; `schedule: 0 11 * * *`; assets: no updated files |
| 2026-11-25 | 2ac3e03 | 9 | One domain entry per host, each `todz-api`; `20fafd55` at 100 percent (newest deployment); `versions view` binds `DIRECTORY` to `dc22b1c3-1869-44a0-b805-91bf92017f19`. The 11:00 UTC digest check is not part of this run |
| 2026-11-25 | 2ac3e03 | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 2ac3e03 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the zone listing is identical to step 3's snapshot and the zone's DMARC stays `p=none` |
| 2026-11-25 | 2ac3e03 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 2ac3e03 | 13 | `{"method":"link"}`; `api.todz.app/health` `{"service":"todz","origin":"https://api.todz.app"}`; `HEAD /health` `HTTP/2 200`, `cache-control: no-store`, no `server-timing`, with HSTS, nosniff, `no-referrer` and `default-src 'none'; frame-ancestors 'none'`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html (the first with HSTS, nosniff, `no-referrer` and a CSP starting `default-src 'none'`); `/mcp` `HTTP/2 401`; `todz.app/` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; `todz.app/self-host` and `www.todz.app/self-host?from=runbook` each `HTTP/2 301` with `location: https://docs.todz.app/self-host` (query dropped) and `cache-control: max-age=3600`, with HSTS, nosniff, `no-referrer` and the CSP; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the headers; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; `api.todz.app/owner` `HTTP/2 401`; lockup `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; account subdomain `dhyegofernando`; `todz-api.dhyegofernando.workers.dev` timed out with no answer from the Worker. All seventeen pass; export deleted |
| 2026-11-25 | 2ac3e03 | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 2ac3e03 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later (a node timer) answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 2ac3e03 | 16 | `robots.txt` `HTTP/2 200` `text/plain; charset=utf-8`, starts at `User-agent: *`, no `Disallow` and no `Content-Signal` line, two `Sitemap:` lines; `sitemap.xml` `application/xml; charset=utf-8`; `llms.txt` and `llms-full.txt` `text/plain; charset=utf-8`; `site.webmanifest` `application/manifest+json`; `ard.json` `application/json`; both cards `application/mcp-server-card+json` (the site's with `access-control-allow-origin: *` and `cache-control: public, max-age=3600`, the API's the same plus `access-control-allow-methods: GET`); `favicon.ico` `image/vnd.microsoft.icon`; `og/todz.png` `image/png`; all `HTTP/2 200`; `GPTBot` 200, `ClaudeBot` 200; `cloudflareinsights` count `0`. Lighthouse on `todz.app`, three runs, each Performance 1, Accessibility 1, Best Practices 1, SEO 1, Agentic browsing 1; audits `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` score 1 (checked on run 3) |
| 2026-11-25 | 2ac3e03 | 17 | These rows; nothing was committed to the repository by this run, and no token, link, secret or challenge is in them |
| 2026-11-25 | 217d5c3 | 9 | The digest check of that deploy, closed on 2026-11-25: the owner confirmed that the first waitlist digest arrived at `ADMIN_EMAIL`; the loop did not read the Cron Events dashboard |
