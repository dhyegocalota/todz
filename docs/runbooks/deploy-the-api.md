# Deploy the API

Deploy the todz Worker to `api.todz.app` from `main`: the database, its migrations, the Worker with its Durable Objects, the custom domain, mail sending for `todz.app`, HTTPS only and a smoke check of the live routes ([ADR 0044](../adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md), [ADR 0043](../adr/0043-mail-leaves-through-cloudflare-email-service-from-noreply-at-todz-app.md)). An agent runs it only through the `deploy` skill, under the owner's authorization of 2026-11-24, and a person runs the same steps after that; each run adds rows to the run log at the end.

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

   Expected: `whoami` says the login is a User API Token and lists one account, `e2035d8e0b7173d520ccf643f6f4661c`, and nothing else; the verify call answers `"status":"active"`. Neither prints the token.
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

   Then export the waitlist rows once, because migration `0014_drop_waitlist.sql` drops the table in step 7 ([ADR 0097](../adr/0097-the-waitlist-is-removed-the-join-route-its-mails-its-admin-list-and-its-table-are-deleted.md)). Count the rows, write them as JSON outside the repository, and count what the file holds:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist"
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --json --command "SELECT address, joined_at, confirmation_claimed_at, confirmation_failed_at FROM waitlist ORDER BY joined_at" > ~/Projects/todz/todz-loop/notes/waitlist-export-2026-11-26.json
   chmod 600 ~/Projects/todz/todz-loop/notes/waitlist-export-2026-11-26.json
   jq 'first | .results | length' ~/Projects/todz/todz-loop/notes/waitlist-export-2026-11-26.json
   ```

   Expected: the first count and the length `jq` prints are the same number, and the file holds one object per row with its `address`, `joined_at`, `confirmation_claimed_at` and `confirmation_failed_at`. The file lives in the loop's notes, outside the repository, and is never committed, attached or pasted anywhere; write its path and the row count in the run log, never an address. Run it once: when the first count answers `no such table: waitlist`, the table is already dropped; write `already dropped` in the run log and go on.
   If it fails: a count that differs from the length, an empty file or invalid JSON means the export is not safe; do not run step 7, because the migration drops the rows for good and only the bookmark of step 5 brings them back, with the owner's word.

7. **Apply the migrations.** List what is unapplied, apply it, and list again:

   ```bash
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
   scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
   ```

   Expected: the first list names `0001_directory.sql` to `0008_day_email.sql` on a first deploy, and only the migrations that are new since the last run after it (`0008_day_email.sql` for the day email's first deploy, `0014_drop_waitlist.sql` for the removal of the waitlist, which runs only after the export of step 6 exists); the apply prints each migration as applied; the second list says there is nothing to apply. Migrations only move forward and must keep working with the Worker that is live.
   `scripts/deploy-worker.sh` lists the remote migrations again before it deploys and refuses while any is pending, so a Worker never runs ahead of its schema.
   If it fails: a failed migration changes nothing from that file on; read the error, fix the migration in a pull request and start over. An authentication error names D1 Edit. To undo a bad migration, ask the owner; on their word, restore the bookmark of step 5 with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 time-travel restore todz-directory --bookmark <bookmark>`, because it discards the writes made since. Never restore without that word.

8. **Deploy the Worker.** Deploy alone through the script that stamps the version ([ADR 0069](../adr/0069-the-api-states-its-build-version-and-the-oldest-app-it-accepts-and-the-app-shows-one-compatibility-line.md)): no variable override and no environment. `scripts/deploy-worker.sh` stages `git archive HEAD apps/api/public` and the released downloads of `~/.todz-release/site/` into a new folder, then runs that stamping script with `--assets` and `HEAD`'s sha as the deployment message, and records the new version id. A bare `wrangler deploy` serves no version and every app then shows "Server needs an update":

   ```bash
   scripts/deploy-worker.sh
   ```

   Expected: `staged <n> files` first, then the last line is `todz server ready: https://api.todz.app · server <stamp> · accepts app 0.2.4 or later  →  paste it in todz › Settings › Server`, where `<stamp>` is `YYYY.MM.DD+` and the first seven characters of step 1's commit, the UTC date of that commit first. The bindings list `env.DIRECTORY`, shown with the nil `preview_database_id` (Wrangler 4.167.0 prints the preview id there; step 9 reads the version's real binding), `env.PROJECT_STORE (ProjectStore)`, `env.EMAIL`, `env.SIGN_IN_LIMITER (10 requests/60s)`, `env.SIGN_IN_ADDRESS_LIMITER (3 requests/60s)`, `env.SIGN_IN_GLOBAL_LIMITER (100 requests/60s)`, `env.ADMIN_LIMITER (10 requests/60s)`, `env.ADMIN_ADDRESS_LIMITER (3 requests/60s)`, `env.ADMIN_GLOBAL_LIMITER (30 requests/60s)` `env.DAY_EMAIL_REPLY_LIMITER (5 requests/60s)`, `env.OWNER_LIMITER (600 requests/60s)`, `env.MCP_LIMITER (3600 requests/60s)` and `env.DAY_EMAIL_STOP_LIMITER (10 requests/60s)`, `env.USAGE_LIMITER (1 requests/60s)`, `env.USAGE_INSTALL_LIMITER (1 requests/60s)`, `env.USAGE_GLOBAL_LIMITER (60 requests/60s)`, `env.APPCAST_LIMITER (60 requests/60s)`, `env.APPCAST_ADDRESS_LIMITER (1 requests/60s)` and `env.CLOUD_READ_LIMITER (10 requests/60s)` (rate limit namespaces `8601` to `8616`), the seven variables `SIGN_IN_PROVIDER ("email")`, `EMAIL_SENDER ("cloudflare")`, `PUBLIC_ORIGIN ("https://api.todz.app")`, `SITE_ORIGIN ("https://todz.app")`, `TELEMETRY ("on")`, `CLOUD_ACCOUNTS_MAX ("50")` and `CLOUDFLARE_ACCOUNT_ID` (the account tag), and `TURNSTILE_SITE_KEY` once a pull request has put the widget's site key in `wrangler.jsonc`; the output names `api.todz.app (custom domain)`, `todz.app (custom domain)` and `www.todz.app (custom domain)`, then the two schedules `*/15 * * * *` and `0 3 * * *` (the first is the day email, [ADR 0063](../adr/0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md)), and a Current Version ID, which goes in the run log and in `~/.todz-deploy/deployments/<commit>`. `/download/latest` answers as it did before the deploy, and step 13's smoke checks pass on this staged deploy. The Worker's Cron Events in the dashboard show each run of the day email. Wrangler creates the DNS record and the certificate for each custom domain.
   If it fails: a refusal of `deploy-worker.sh` names the file or the check (a stray entry, a sum or signature that does not verify, "would remove the published download", a file over 25 MiB) and deploys nothing; "would remove the published download" means this Mac lacks the release folder, so deploy from the Mac that holds it or rebuild it with [Release the Mac app](release-the-mac-app.md) step 11. A lock held by a release or another deploy is never removed by hand. `Cannot stamp the server version` means git could not read the commit or its date; run it from a checkout of `main` and nothing was deployed. A ready line that says `server null` means the stamp did not reach the build; deploy again with this command. an authentication error names Workers Scripts Edit; an error about the custom domain names Workers Routes Edit and DNS Edit on the zone. An error that names a plan, or refuses a Durable Object, the rate limit binding or the email binding, means Workers Paid lapsed (it was active on 2026-11-24); tell the owner. A deploy that fails changes nothing in production; the first deploy's backout and a later deploy's rollback are at the end of this runbook.

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
    curl -sS -H "Todz-App-Version: 0.2.4" https://api.todz.app/owner/sign-in-method
    curl -sS https://api.todz.app/owner/sign-in-method
    curl -sS https://api.todz.app/health
    curl -sSI https://api.todz.app/health
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
    curl -sS -D - -o /dev/null -H "Todz-App-Version: 0.2.4" https://api.todz.app/owner
    curl -sS -D - -o /dev/null https://todz.app/brand/todz-lockup.png
    scripts/todz-cloudflare.sh api GET /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/subdomain
    curl -sS -D - -o /dev/null https://todz-api.<subdomain>.workers.dev/owner/sign-in-method
    ```

    Expected: `{"method":"link"}`, then, for the same route without the app version header, `{"error":"app_too_old","minimum_app_version":"0.2.4"}`, then `{"service":"todz","origin":"https://api.todz.app","version":"<stamp>","minimum_app_version":"0.2.4"}` where `<stamp>` is the one step 8 printed, then `HTTP/2 200` with `cache-control: no-store`, `todz-api-version: <stamp>` and no `server-timing` for the `HEAD` probe of `/health` (`/health` carries no `Server-Timing` by design: `serveTimed` wraps only the owner and MCP routes and withholds the header on 401 and on the 101 upgrade), then for each page `HTTP/2 503` with `content-type: text/html; charset=utf-8` until the site key is in `wrangler.jsonc` and `HTTP/2 200` after, then `HTTP/2 401`, then `HTTP/2 200` for the landing with `strict-transport-security: max-age=31536000; includeSubDomains` and a `content-security-policy` that starts with `default-src 'none'`, then for the self-host guide `HTTP/2 301` with `location: https://docs.todz.app/self-host` and `cache-control: max-age=3600`, then for the `www` address the same `HTTP/2 301` with `location: https://docs.todz.app/self-host`, its query dropped, then `HTTP/2 404` for the owner route on the site host and for the landing on the API host, then for `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex` (the admin's sign-in card), then `HTTP/2 404` for `api.todz.app/admin`, then `HTTP/2 401` for `api.todz.app/owner` (an owner route without a bearer) and `HTTP/2 200` with `content-type: image/png` for the lockup asset, then the account's `workers.dev` subdomain, then for the last no answer from the Worker: a connection error, 404 or a Cloudflare error page, never `{"method":"link"}`. Every answer of the API host, the two redirects to the docs and the asset carries `strict-transport-security: max-age=31536000; includeSubDomains`, `x-content-type-options: nosniff` and `referrer-policy: no-referrer`, and every answer of the API host and the two redirects that is not one of the sign-in pages carries `content-security-policy: default-src 'none'; frame-ancestors 'none'`. The first proves the production variables are the ones in `wrangler.jsonc`; any other body means a `--var` or a dashboard variable overrides them, so stop and read the Worker's settings. When all eighteen pass, delete the export of step 6:

    ```bash
    rm ~/.todz-deploy/backups/before-<commit>.sql
    ```

    If it fails: a `version` of `null` or no `todz-api-version` header means the deploy skipped the stamp; run step 8 again with `server:deploy`. A `426` where `{"method":"link"}` is expected means `MINIMUM_APP_VERSION` is above `0.2.4` in the deployed build or the header was lost; read `libs/types/src/constants.ts` at the deployed commit. A `200` where the `426` body is expected means the deployed build predates the version gate; run step 8 again from `main`. A TLS error right after step 8 means the certificate is still being issued; run it again every minute for up to fifteen minutes. `{"method":"identity"}` or a 503 `sign_in_unavailable` on the method route means the fake provider was refused or the variables are wrong; never leave it, and roll back as at the end. A 522 or 1014 means the custom domain is not attached; go back to step 9 (token permission Workers Routes Edit). A page that answers 503 with the site key in `wrangler.jsonc` means the deployed version is older than that pull request; run step 8 again from its commit. A `HTTP/2 200` for `todz.app/self-host`, or a `location` of `https://todz.app/self-host?from=runbook` for the `www` address, means the deployed version predates `docs-cutover`; run step 8 again from `main`. A reply from the `workers.dev` host means `workers_dev` is on in the dashboard or in a stale deploy; turn it off in the Worker's settings, deploy again and tell the owner. A missing account subdomain means there is no address to check; write that in the run log. A permission error names Workers Scripts Read.

15. **Check that a link request needs a solved challenge.** Post a link request whose Turnstile token was never solved, and keep only the status, the `retry-after` line and the body:

    ```bash
    curl -sS -D - -X POST -H "Todz-App-Version: 0.2.4" -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/junk-turnstile-link.json https://api.todz.app/owner/sign-in-links
    ```

    Expected: before step 11's secret exists, `HTTP/2 503` and `{"error":"sign_in_unavailable"}`; after it, `HTTP/2 429`, `retry-after: 60` and `{"error":"sign_in_refused"}`. No mail leaves either way. A real link, with a real mail to the owner, is asked for in the production smoke walk with the app, never here.
    If it fails: a 202 means the Worker sent a link without a solved challenge; close sign-in as the Rollback section says and tell the owner. A 503 after the secret exists means siteverify, the secret or a binding is missing; read step 8's bindings and step 11's list again. A 400 means the body file changed; restore it from `main`. A 426 means the `Todz-App-Version` header was left off and the check proved nothing; run the command as written.

    Then check that the join path is gone. Post to it and keep only the status:

    ```bash
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-binary "email=nobody@example.com" https://todz.app/join
    ```

    Expected: `404`, with no body.
    If it fails: a `410` or a `429` means the deployed version still carries the join route; deploy `main` again and tell the owner.

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
    curl -sS -D - -X POST -H "Todz-App-Version: 0.2.4" -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions | grep -oE "HTTP/2 [0-9]+|retry-after: [0-9]+"
    ```

    Expected: the first ten answers are `HTTP/2 401` (the malformed verifier), or `HTTP/2 503` before step 11's secret exists, and from the eleventh on they are `HTTP/2 429` followed by `retry-after: 60`; the binding counts per Cloudflare location and may let a request or two more than ten through, so at least one of the last four is a 429. Refused requests count against the window too, so wait at least seventy seconds after the last one, then one single request answers as the first did:

    ```bash
    curl -sS -D - -o /dev/null -X POST -H "Todz-App-Version: 0.2.4" -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions
    ```
    If it fails: a 426 means the `Todz-App-Version` header was left off and the check proved nothing; run the commands as written. No 429 means run the command once more; none in the second run either means the binding is not enforcing, or Cloudflare did not send `CF-Connecting-IP` or the request counted as local; tell the owner before the app ships. A 429 on the first request means another client on this address used the quota; wait a minute and run it again.

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

## Turning on a default for owners who never chose it

Steps 19 to 24 ship a setting that is on by default (the agent nudge and the day email, [ADR 0068](../adr/0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md)) to owners who already exist, in an order that never mails anyone before the mail can be stopped in one click. They run after steps 1 to 6 on the merged head and replace steps 7 and 8 for this deploy: step 19 applies 0009 alone and step 20 deploys the Worker, so steps 7 and 8 are skipped; `<schema-commit>` is the parent of the commit that adds `apps/api/migrations/0010_agent_nudge_default.sql`: `git log --diff-filter=A --format=%h -n 1 -- apps/api/migrations/0010_agent_nudge_default.sql` names that commit, and `<schema-commit>` is its hash followed by `^`.

19. **Apply migration 0009 alone.** `wrangler d1 migrations apply` has no stop point, so run it from a detached worktree at `<schema-commit>`, which holds no `0010` file. Count the flags first and again after; the counts carry no address:

    ```bash
    git worktree add --detach ../todz-deploy-schema <schema-commit>
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT agent_nudge, day_email, count(*) AS owners FROM owners GROUP BY agent_nudge, day_email"
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT agent_nudge, day_email, count(*) AS owners FROM owners GROUP BY agent_nudge, day_email"
    git worktree remove ../todz-deploy-schema
    ```

    Run the four wrangler lines from the root of that worktree, after `pnpm install --frozen-lockfile` there. Expected: the list names `0009_setting_choices.sql` and no other; the apply prints it applied; the two counts are the same rows, so 0009 changed no flag.
    If it fails: a list that names `0010_agent_nudge_default.sql` means the worktree is on the wrong commit; stop before the apply. A failed migration changes nothing from that file on; fix it in a pull request. Nothing depends on 0009 until step 20.

20. **Deploy the Worker, then check the stop route.** From the merged head, deploy as step 8 does, then ask the live route with a token that names nothing (`openssl rand -hex 32` prints one; use it as `<random-token>`), once with `GET` and once with `POST`:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api server:deploy
    curl -sS https://api.todz.app/health
    curl -sS -D - -o /dev/null "https://api.todz.app/day-email/stop?token=<random-token>"
    curl -sS -D - -o /dev/null -X POST "https://api.todz.app/day-email/stop?token=<random-token>"
    ```

    Expected: the deploy lists `env.DAY_EMAIL_STOP_LIMITER (10 requests/60s)`; the health answer names `https://api.todz.app`; both stop requests answer `HTTP/2 404` with `x-robots-tag: noindex`, `cache-control: no-store` and a `content-security-policy` that starts `default-src 'none'; style-src 'sha256-` and ends `frame-ancestors 'none'`.
    If it fails: a `5xx` or a missing policy means the route is broken: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler rollback`. No owner who never chose has been turned on yet, so the rollback mails no one new.

21. **Read the owner's own mail.** The project owner's day email is already chosen on (if it is not, the owner turns it on in Settings first, which stamps it). At its next send the owner reads the mail's original source and the loop opens its stop link with `GET` only; a real stop link is never posted in production. Then count the failed sends since the deploy:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT count(*) AS failed FROM day_emails WHERE failure = 'send_failed' AND claimed_at > <deploy-time-milliseconds>"
    ```

    Expected: the source holds `List-Unsubscribe: <https://api.todz.app/day-email/stop?token=` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; the `GET` shows the page with one button, and `GET /owner` still answers `day_email: true`; the count is `0`.
    If it fails: a `send_failed` row, or a mail without the headers, means the `send_email` binding refused them: stop here. The counts, 0010 and the day email default do not run; roll back as the Rollback section says.

22. **Count the candidates.** Read-only; it answers four numbers and no address or id:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --json --command "SELECT (SELECT count(*) FROM owners) AS owners, (SELECT count(*) FROM owners WHERE EXISTS (SELECT 1 FROM owner_identities WHERE owner_identities.owner_id = owners.id AND owner_identities.provider = 'email') AND EXISTS (SELECT 1 FROM workspaces WHERE workspaces.owner_id = owners.id)) AS candidates, (SELECT count(*) FROM owners WHERE agent_nudge = 1) AS agent_nudge_on, (SELECT count(*) FROM owners WHERE day_email_chosen_at IS NULL AND EXISTS (SELECT 1 FROM owner_identities WHERE owner_identities.owner_id = owners.id AND owner_identities.provider = 'email')) AS untouched_email_owners;"
    ```

    The statement is `apps/api/scripts/setting-defaults/candidate-counts.sql` on one line, passed with `--command` because `--file` imports the statements remotely and prints no rows.

    Expected: `owners`, `candidates`, `agent_nudge_on` and `untouched_email_owners`, which go in the run log. `untouched_email_owners` counts every owner with an email identity whose day email was never chosen, with or without a workspace. Step 21 proved the project owner's `day_email` is on, so 0009 stamped that row and the count holds only other owners.
    If it fails: a `no such column` error means the migrations of step 19 did not apply; stop and check step 19.

23. **Apply migration 0010.** From the merged head, as step 7 does, then count the nudges still off with no choice:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations list todz-directory --remote
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT count(*) AS untouched_off FROM owners WHERE agent_nudge = 0 AND agent_nudge_chosen_at IS NULL"
    ```

    Expected: the list names `0010_agent_nudge_default.sql` and no other; `untouched_off` is `0`. The nudge sends no mail.
    If it fails: a nonzero count means an owner was created between the list and the apply; run the same `UPDATE` as the migration once: `UPDATE owners SET agent_nudge = 1 WHERE agent_nudge_chosen_at IS NULL`. To undo the default, `UPDATE owners SET agent_nudge = 0 WHERE agent_nudge_chosen_at IS NULL` restores it exactly for owners who never chose.

24. **Default the day email, only when no other owner would be mailed.** When `untouched_email_owners` of step 22 is `0`, run the statement; when it is not `0`, run nothing and tell the owner:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --file ./scripts/setting-defaults/day-email-default.sql
    ```

    Expected: the statement changes no row, because it reaches only owners with an email identity whose day email was never chosen, and step 22 counted none; an owner with no email address is never touched. The call and the row count go in the run log.
    If it fails: an owner mailed by mistake is stopped by `UPDATE owners SET day_email = 0 WHERE day_email_chosen_at IS NULL` run through `wrangler d1 execute todz-directory --remote --command` before the next quarter-hour tick; the owner is told.

25. **Put the sign-up key secret, once, before the Worker that reads it.** The daily cap on new accounts per client keys each client address with a secret, so the stored counters cannot be turned back into addresses ([ADR 0089](../adr/0089-sign-up-abuse-is-capped-per-client-per-day-and-disposable-email-domains-are-refused-for-new-accounts.md)). Generate 32 random bytes and pipe them in, so no file, shell history or screen holds the value:

    ```bash
    openssl rand -hex 32 | scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put SIGN_UP_KEY_SECRET
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Expected: the put says it uploaded the secret `SIGN_UP_KEY_SECRET` for `todz-api`; the list names `SIGN_UP_KEY_SECRET` and prints no value. Put it once and never rotate it casually: a new value starts every client's daily count again.
    If it fails: until the secret exists, a sign-up of a new account answers 503 `sign_in_unavailable` (an existing owner still signs in), which is the safe state; put it and try again.

## The todz cloud capacity guard

26. **Put the analytics token secret, once, before the Worker that reads it.** The nightly budget guard reads the month's real totals from Cloudflare's GraphQL Analytics API when the Worker holds `CLOUDFLARE_ANALYTICS_TOKEN`, and estimates them from D1 when it does not ([ADR 0099](../adr/0099-the-todz-cloud-admits-at-most-fifty-active-accounts-and-a-monthly-budget-guard-stops-heavy-writes-before-any-included-quota-runs-out.md)). The owner creates a separate token with the one permission Account Analytics Read, never the deploy token, and pastes it at Wrangler's own prompt, so no file, history line or agent holds it; the owner runs the first command in their own terminal:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret list
    ```

    Expected: the put says it uploaded the secret `CLOUDFLARE_ANALYTICS_TOKEN` for `todz-api`; the list names it and prints no value. The next 03:00 UTC run uses the real totals, which is the production path, and the admin Cloud queue page shows no "budget guard: estimate only" line.
    If it fails: when `vars.CLOUD_ACCOUNTS_MAX` is set and the list lacks `CLOUDFLARE_ANALYTICS_TOKEN`, stop and tell the owner: the guard is estimate only, the nightly run logs "budget guard: estimate only" and the admin page says so. Only a server with no cap needs no token. A token with the wrong permission makes the nightly run fail with `the Cloudflare analytics answered 403`; the previous night's level stands until the token is fixed. Delete the secret with `wrangler secret delete CLOUDFLARE_ANALYTICS_TOKEN` to go back to the estimate.

## Rollback

- First deploy, and only while no owner exists: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) FROM owners"`. If it prints anything but `0`, stop and tell the owner: deleting the Worker deletes its Durable Object storage, which holds every project.
- With the count at `0`, detach the custom domain chosen by hostname and service, never by a remembered id: run `scripts/todz-cloudflare.sh api GET "/accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains?hostname=api.todz.app&service=todz-api"`. Exactly one entry must come back, else stop, and its `hostname` must be `api.todz.app` and its `service` `todz-api`, else stop. Delete it with `scripts/todz-cloudflare.sh api DELETE /accounts/e2035d8e0b7173d520ccf643f6f4661c/workers/domains/<domain-id>`, using that entry's `id` (the endpoint is not verified; the dashboard's Worker settings detach it too). Then run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler delete todz-api`.
- Rolling back to a version from before the site (the `landing` feature): detach `todz.app` and `www.todz.app` first, as in the site bullet below, because that version routes by path alone and would answer the API on the site hosts.
- Later deploys: run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler rollback` to go back to the previous version, or the same with a version id for a named one, and note the reason with `-m`. The migrations stay applied: they only move forward and must keep working with the previous Worker, so write each one that way.
- A bad migration: restore the bookmark of step 5, which needs the owner's word because it discards writes made since.
- Never roll back to a version from before `sign-in-guard`: it reopens the unguarded sign-in routes. To close sign-in on the current version instead, delete the secret with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret delete TURNSTILE_SECRET_KEY`; both posts then answer 503 `sign_in_unavailable` until it is put again.
- The site alone: detach `todz.app` and `www.todz.app` the same way, each chosen by `?hostname=<host>&service=todz-api` with exactly one entry back, and delete each by its `id`; `api.todz.app` keeps answering. The site sends `Strict-Transport-Security: max-age=31536000; includeSubDomains` without `preload`, so browsers that saw it keep using HTTPS on `todz.app` and every subdomain, `docs.todz.app` included, for a year; a new subdomain must answer on HTTPS from its first day, and to lift it a version must first serve `max-age=0` to those browsers.
- The `waitlist` table (migration 0005) was dropped by migration 0014 after the export of step 6, which holds its rows in the loop's notes. Never roll back to a version older than `waitlist-off`: it reads the table and fails without it. A version from `waitlist-off` on never reads it, so `wrangler rollback` to one of them needs nothing. To bring the table back, and only on the owner's word, restore the bookmark of step 5.
- The `admin_sign_in_links` and `admin_sessions` tables (migration 0006) stay through any rollback; an older version never reads them, so no admin session works on it, but the rows live up to twelve hours and work again if a version with the admin comes back in that time. To close the admin on the current version, delete the secret with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler secret delete ADMIN_EMAIL`: the panel then answers 503, the link request 503, the metrics export and sign-out redirect to the panel, and no session counts while the secret is missing; putting it back revives the unexpired ones. To end every session for good, and only on the owner's word, run `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM admin_sessions"`.
- The `owners.agent_nudge` column (migration 0007) stays through any rollback, and an older version never reads it: agents stop hearing the line, and the app's switch reads as unknown and cannot be changed until a version with the nudge is back, when every owner's choice is still there.
- When the admin's own request mails nothing because someone filled its five links per fifteen minutes, and only on the owner's word, clear the unspent links with `scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM admin_sign_in_links WHERE consumed_at IS NULL"`; spent links and sessions are untouched.
- The cron belongs to the Worker, not to a version: `wrangler rollback` keeps the `*/15 * * * *` schedule, and a version without the day email then fails each run, which only shows in Cron Events. To stop it, set `"triggers": { "crons": [] }` in `wrangler.jsonc` through a pull request and deploy.
- The reply rule: to turn the inbound half of the day email off without a deploy, delete the `reply@` rule. Read `scripts/todz-cloudflare.sh api GET /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules`, pick the entry named `todz day email replies` whose matcher is the literal `to` `reply@todz.app` (exactly one, else stop), and delete it with `scripts/todz-cloudflare.sh api DELETE /zones/06490974636c535e2cbfd7c5b09925a5/email/routing/rules/<rule-id>` using its `id`. Replies then reach no Worker and add nothing; the mail out keeps going. Subaddressing may stay on: `hello+x@` and `support+x@` keep forwarding to the owner, and the Worker refuses addresses on `todz.app` anywhere else. To stop the mail out too, the owner turns Email me my day off in the app, or `wrangler.jsonc` drops the `*/15 * * * *` cron through a pull request.
- The day email's tables (migration 0008) and the owner's `day_email` and `day_email_minutes` columns stay through any rollback; an older version never reads them and the stored choices come back with a version that does.
- The setting choice columns and the stop link table (migration 0009) stay through any rollback, and an older version never reads them. After step 20 and before any rollback, first turn the untouched day emails off with `UPDATE owners SET day_email = 0 WHERE day_email_chosen_at IS NULL` through `wrangler d1 execute todz-directory --remote --command`, because an older version mails every owner whose `day_email` is on and a mail already sent carries a stop link that answers 404 there; then roll back. Migration 0010's nudge default is undone, for owners who never chose, by `UPDATE owners SET agent_nudge = 0 WHERE agent_nudge_chosen_at IS NULL`.
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
| 2026-11-25 | 3455139 | 1 | Deviation: `rev-parse` printed `HEAD`, not `main`: the run used a clean worktree detached at `origin/main` 3455139 (the merge of PR #47 `performance`), because the main worktree is the owner's; 0 ahead and 0 behind, so its tree is `main`'s. `pnpm install --frozen-lockfile` clean; `sign-in-guard` has its `Shipped` row. `pnpm verify all`: 9 gates green at 3455139 on the first run (no flake) |
| 2026-11-25 | 3455139 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 3455139 | 3 | `api.todz.app`, `todz.app` and `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`, unchanged; the zone also holds the `docs.todz.app` records, the `cf-bounce` sending records and the `cf2024-1` DKIM record |
| 2026-11-25 | 3455139 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19`, 12 tables |
| 2026-11-25 | 3455139 | 5 | Bookmark `0000001b-00000000-0000512e-baeab5c64cb227c94cd733709da89ee7` |
| 2026-11-25 | 3455139 | 6 | Exported `before-3455139.sql` (4313 bytes) into the private folder |
| 2026-11-25 | 3455139 | 7 | The first list says nothing to apply; apply says nothing to apply; the second list says nothing to apply (no D1 migration in this release; the project-store schema v3 indexes are applied lazily by each Durable Object) |
| 2026-11-25 | 3455139 | 8 | Deployed, Current Version ID `4c612516-6edb-4115-8454-34e0b66637cd`; the three custom domains and `schedule: 0 11 * * *`; nine limiters (10, 3, 100, 10, 3, 60, 10, 3 and 30 requests/60s) and the five variables including `TURNSTILE_SITE_KEY`; no updated asset files to upload |
| 2026-11-25 | 3455139 | 9 | One domain entry per host, each `todz-api`; `4c612516` at 100 percent (newest deployment); `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 3455139 | 10 | No secret put; `secret list` names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` |
| 2026-11-25 | 3455139 | 11 | `enable` answered `Subdomain already exists [code: 2040]`; the list shows `todz.app` enabled yes, tag `e334383f152c44038f0216e0e35bcf85`; `dns get` prints the sending records; the apex and host records match step 3 and the zone's DMARC stays `p=none` |
| 2026-11-25 | 3455139 | 12 | pseudo IPv4 `off`; Always Use HTTPS `on`; plain HTTP on the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 3455139 | 13 | `{"method":"link"}`; `api.todz.app/health` `HTTP/2 200` `{"service":"todz","origin":"https://api.todz.app"}`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html with HSTS, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `/mcp` `HTTP/2 401`; `todz.app/` `HTTP/2 200` with HSTS `max-age=31536000`, nosniff, `no-referrer` and a CSP starting `default-src 'none'`; `todz.app/self-host` and `www.todz.app/self-host?from=runbook` each `HTTP/2 301` with `location: https://docs.todz.app/self-host` (query dropped) and `cache-control: max-age=3600`, with HSTS, nosniff, `no-referrer` and `default-src 'none'; frame-ancestors 'none'`; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the three headers and the CSP; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; `api.todz.app/owner` `HTTP/2 401`; `todz.app/brand/todz-lockup.png` `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; `todz.app/icon.svg` `HTTP/2 200` `image/svg+xml` with `content-security-policy: default-src 'none'; style-src 'unsafe-inline'`; the account subdomain read, and the Worker's `workers.dev` address gave no answer in 30 s (connection timed out). `Server-Timing` present on `https://api.todz.app/owner/sign-in-method` (GET `HTTP/2 200` and HEAD `HTTP/2 404`): `server-timing: directory;dur=0.0, project;dur=0.0`. The export was deleted |
| 2026-11-25 | 3455139 | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 3455139 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later (a node timer) answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 3455139 | 16 | `robots.txt` `HTTP/2 200` `text/plain; charset=utf-8`: the Worker's thirteen `User-agent` groups starting at `User-agent: *` (no `Disallow`, no `Content-Signal`, nothing above) and both `Sitemap:` lines, so Cloudflare's managed robots.txt and content signals are off and no zone setting was changed; `sitemap.xml` `application/xml; charset=utf-8`; `llms.txt` and `llms-full.txt` `text/plain; charset=utf-8`; `site.webmanifest` `application/manifest+json`; `.well-known/ard.json` `application/json`; the card on `todz.app/.well-known/mcp/server-card.json` and `api.todz.app/mcp/server-card` `application/mcp-server-card+json`, each with `access-control-allow-origin: *` and `cache-control: public, max-age=3600`; all `HTTP/2 200`; `favicon.ico` `image/vnd.microsoft.icon`; `og/todz.png` `image/png`; `GPTBot` 200, `ClaudeBot` 200; `cloudflareinsights` count `0` (Web Analytics beacon off). Lighthouse 13.6.0, default phone profile, three runs on `https://todz.app/`: Performance, Accessibility, Best Practices, SEO and Agentic browsing `1` in every run, so every median is `1`; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` pass in the runs. No owner step. `pnpm perf` against production not run, as instructed |
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
| 2026-11-25 | 2ac3e03 | 13 | `{"method":"link"}`; `api.todz.app/health` `{"service":"todz","origin":"https://api.todz.app"}`; `HEAD /health` `HTTP/2 200`, `cache-control: no-store`, no `server-timing`, with HSTS, nosniff, `no-referrer` and `default-src 'none'; frame-ancestors 'none'`; `/sign-in` and `/sign-in/challenge` `HTTP/2 200` text/html (the first with HSTS, nosniff, `no-referrer` and a CSP starting `default-src 'none'`); `/mcp` `HTTP/2 401`; `todz.app/` `HTTP/2 200` with HSTS and a CSP starting `default-src 'none'`; `todz.app/self-host` and `www.todz.app/self-host?from=runbook` each `HTTP/2 301` with `location: https://docs.todz.app/self-host` (query dropped) and `cache-control: max-age=3600`, with HSTS, nosniff, `no-referrer` and the CSP; `todz.app/owner/sign-in-method` and `api.todz.app/` `HTTP/2 404` with the headers; `todz.app/admin` `HTTP/2 200` with `cache-control: no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` `HTTP/2 404`; `api.todz.app/owner` `HTTP/2 401`; lockup `HTTP/2 200` `image/png` with HSTS, nosniff and `no-referrer`; the account subdomain read; `todz-api.<subdomain>.workers.dev` timed out with no answer from the Worker. All seventeen pass; export deleted |
| 2026-11-25 | 2ac3e03 | 14 | Link post `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist probe counts `0`, post `429`, count `0`; admin probe unspent links `0`, post `429`, `0`; no mail |
| 2026-11-25 | 2ac3e03 | 15 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`; one single request sent 80 seconds later (a node timer) answered `HTTP/2 401`, as the first did |
| 2026-11-25 | 2ac3e03 | 16 | `robots.txt` `HTTP/2 200` `text/plain; charset=utf-8`, starts at `User-agent: *`, no `Disallow` and no `Content-Signal` line, two `Sitemap:` lines; `sitemap.xml` `application/xml; charset=utf-8`; `llms.txt` and `llms-full.txt` `text/plain; charset=utf-8`; `site.webmanifest` `application/manifest+json`; `ard.json` `application/json`; both cards `application/mcp-server-card+json` (the site's with `access-control-allow-origin: *` and `cache-control: public, max-age=3600`, the API's the same plus `access-control-allow-methods: GET`); `favicon.ico` `image/vnd.microsoft.icon`; `og/todz.png` `image/png`; all `HTTP/2 200`; `GPTBot` 200, `ClaudeBot` 200; `cloudflareinsights` count `0`. Lighthouse on `todz.app`, three runs, each Performance 1, Accessibility 1, Best Practices 1, SEO 1, Agentic browsing 1; audits `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` score 1 (checked on run 3) |
| 2026-11-25 | 2ac3e03 | 17 | These rows; nothing was committed to the repository by this run, and no token, link, secret or challenge is in them |
| 2026-11-25 | 217d5c3 | 9 | The digest check of that deploy, closed on 2026-11-25: the owner confirmed that the first waitlist digest arrived at `ADMIN_EMAIL`; the loop did not read the Cron Events dashboard |
| 2026-11-25 | 701f3f4 | 1 | Deviation: run from a detached worktree at `origin/main` (clean, 0 ahead, 0 behind); first targeted 78b8d959 and retargeted to 701f3f4f before any deploy; `pnpm verify all` 9 gates green at 701f3f4f |
| 2026-11-25 | 701f3f4 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 701f3f4 | 3 | `api.todz.app`, `todz.app`, `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1, route2, route3 `.mx.cloudflare.net` and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"`; `_dmarc` `p=none` |
| 2026-11-25 | 701f3f4 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 701f3f4 | 5 | Bookmark `00000027-00000000-0000512e-5ee7a910cf25a2ca2460e214caed1373` |
| 2026-11-25 | 701f3f4 | 6 | Exported `before-701f3f4f.sql` (5972 bytes) into the private folder |
| 2026-11-25 | 701f3f4 | 7 | Listed `0008_day_email.sql`; applied; second list says nothing to apply. No new secret |
| 2026-11-25 | 701f3f4 | 8 | Deployed, Current Version ID `1c2e6dee-ecf9-485f-bcc3-81f7613e9ab5`; `api.todz.app`, `todz.app`, `www.todz.app (custom domain)`; schedules `0 11 * * *` and `*/15 * * * *`; ten limiters including `DAY_EMAIL_REPLY_LIMITER (5 requests/60s)`; four variables and `TURNSTILE_SITE_KEY`; `env.DIRECTORY` shown with the nil preview id |
| 2026-11-25 | 701f3f4 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `versions view` binds `DIRECTORY` to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 701f3f4 | 10 | Before: routing enabled, `support_subaddress` false; rules `todz support`, `todz hello` forwards and the disabled catch-all. PATCH `"success":true` (subaddressing true); POST `"success":true` created `todz day email replies`, literal `to` `reply@todz.app`, action `worker` `todz-api`, enabled. Read back: subaddressing true, four rules, forwards unchanged, catch-all still disabled. `day_emails` has no rows. The Workers Logs `rcptTo` and `mailFrom` search is a dashboard read and was not run: owner step |
| 2026-11-25 | 701f3f4 | 11 | Nothing put: `wrangler secret list` already names `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY`; the site key is in the deployed variables |
| 2026-11-25 | 701f3f4 | 12 | `enable` failed with `already exists [code: 2040]` (the already-onboarded case); the list shows `todz.app` enabled yes; apex `MX` and `TXT` unchanged |
| 2026-11-25 | 701f3f4 | 13 | pseudo IPv4 `off`; Always Use HTTPS `on`; `http://api.todz.app/owner/sign-in-method`, `http://todz.app/` and `http://www.todz.app/` each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 701f3f4 | 14 | `{"method":"link"}`; `/health` body and HEAD `200` with `no-store`, no `server-timing`; `/sign-in` and `/sign-in/challenge` `200`; `/mcp` `401`; `todz.app/` `200` with HSTS and CSP `default-src 'none'`; `/self-host` and `www` `/self-host?from=runbook` `301` to `https://docs.todz.app/self-host` with `max-age=3600`; `todz.app/owner/sign-in-method` and `api.todz.app/` `404`; `todz.app/admin` `200` `no-store` `noindex`; `api.todz.app/admin` `404`; `api.todz.app/owner` `401`; lockup `200` `image/png`; the `workers.dev` address timed out with no answer. The export was deleted |
| 2026-11-25 | 701f3f4 | 14 | Waitlist-inline check: Landing holds `data-appearance="always"`, the `todz_fax` honeypot and a `stamp` hidden field; no `unsafe-inline` in its CSP |
| 2026-11-25 | 701f3f4 | 14 | Waitlist-inline check: JSON post without a token: `HTTP/2 403`, `{"outcome":"check-failed"}`, `cache-control: no-store`, `vary: Accept` |
| 2026-11-25 | 701f3f4 | 14 | Waitlist-inline check: The same without `Accept`: `HTTP/2 429` |
| 2026-11-25 | 701f3f4 | 14 | Waitlist-inline check: Count for `nobody@example.com` is 0 after the posts. A real join with a solved Turnstile needs a browser: left to the owner |
| 2026-11-25 | 701f3f4 | 15 | Link request: `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist count 0, post `429`, count 0; admin links 0, post `429`, links 0; no mail |
| 2026-11-25 | 701f3f4 | 16 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`. A single request right after step 17's checks answered `429` (inside the window); one later, after Lighthouse, answered `401` |
| 2026-11-25 | 701f3f4 | 17 | Every discovery file `200` with the expected content types; both cards carry `access-control-allow-origin: *` and `max-age=3600`; `robots.txt` has the Worker's groups and both `Sitemap:` lines; GPTBot and ClaudeBot `200`; beacon count 0. Lighthouse three runs: Performance 0.86, 1, 1 (median 1); Accessibility, Best Practices, SEO and Agentic browsing 1 each run; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console` and `image-aspect-ratio` pass |
| 2026-11-25 | 701f3f4 | 18 | This file |
| 2026-11-25 | 6f283d2 | 1 | Deviation: detached worktree at `origin/main` (clean, 0 ahead, 0 behind); `pnpm verify all` 9 gates green at 6f283d2b |
| 2026-11-25 | 6f283d2 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-25 | 6f283d2 | 3 | `api.todz.app`, `todz.app`, `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1 to route3 and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"` unchanged |
| 2026-11-25 | 6f283d2 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 6f283d2 | 5 | Bookmark `00000038-00000000-0000512e-7fb638e2078dd3c092647cdc23b79861` |
| 2026-11-25 | 6f283d2 | 6 | Exported `before-6f283d2b.sql` (7840 bytes) into the private folder; deleted after step 14 |
| 2026-11-25 | 6f283d2 | 7 | Skipped, replaced by steps 19 and 23 as the runbook says |
| 2026-11-25 | 6f283d2 | 19 | Worktree at `8c92d9f5` (parent of the commit adding 0010), no 0010 file. Counts before and after identical: one owner, `agent_nudge` 0, `day_email` 1. List named `0009_setting_choices.sql` only; applied. Worktree removed |
| 2026-11-25 | 6f283d2 | 20 | Deployed with `pnpm --filter @todz/api server:deploy` (step 8's script), not the bare `wrangler deploy` that step 20's block shows, which would serve no version. Current Version ID `2d31bf84-da1e-4fb7-99f8-0837c512ab0d`, created 2026-11-25T23:51:05Z. Ready line: `todz server ready: https://api.todz.app · server 2026.11.25+6f283d2 · accepts app 0.2.0 or later`. Bindings: the thirteen limiters including `OWNER_LIMITER (600/60s)`, `MCP_LIMITER (3600/60s)`, `DAY_EMAIL_REPLY_LIMITER`, `DAY_EMAIL_STOP_LIMITER (10/60s)`; four variables and `TURNSTILE_SITE_KEY`; custom domains `api.todz.app`, `todz.app`, `www.todz.app`; schedules `0 11 * * *` and `*/15 * * * *` |
| 2026-11-25 | 6f283d2 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-25 | 6f283d2 | 10 | Read only: routing enabled, subaddressing true, four rules (`todz day email replies` worker, the two forwards, the disabled catch-all), as left on 701f3f4f |
| 2026-11-25 | 6f283d2 | 11 | Nothing put: `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` are listed |
| 2026-11-25 | 6f283d2 | 12 | `todz.app` sending enabled yes; `enable` not rerun |
| 2026-11-25 | 6f283d2 | 13 | pseudo IPv4 `off`; Always Use HTTPS `on`; the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-25 | 6f283d2 | 20 | `/health`: `{"service":"todz","origin":"https://api.todz.app","version":"2026.11.25+6f283d2","minimum_app_version":"0.2.0"}`. `GET` and `POST` of `/day-email/stop` with a random unknown token: `HTTP/2 404`, `x-robots-tag: noindex`, `cache-control: no-store`, CSP `default-src 'none'; style-src 'sha256-…'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. No real stop link was posted |
| 2026-11-25 | 6f283d2 | 14 | With `Todz-App-Version: 0.2.0`: `{"method":"link"}`; without it: `{"error":"app_too_old","minimum_app_version":"0.2.0"}`; `/health` as above; `/health` HEAD `200`, `no-store`, `todz-api-version: 2026.11.25+6f283d2`, no `server-timing`; `/sign-in`, `/sign-in/challenge` `200`; `/mcp` `401`; `todz.app/` `200`; `/self-host` and `www` `/self-host?from=runbook` `301` to `https://docs.todz.app/self-host`; `todz.app/owner/sign-in-method`, `api.todz.app/` `404`; `todz.app/admin` `200` `no-store` `noindex`; `api.todz.app/admin` `404`; `api.todz.app/owner` with the version header `401`; lockup `200` `image/png`; every API answer carries `todz-api-version`; HSTS now `max-age=31536000; includeSubDomains`; `workers.dev` timed out with no answer. The landing links `https://docs.todz.app/install-on-mac` and `https://docs.todz.app/self-host` |
| 2026-11-25 | 6f283d2 | 15 | Link request `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist post `429`, probe-address count 0; admin post `429`; no mail |
| 2026-11-25 | 6f283d2 | 16 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60`. The single request after the window was not repeated |
| 2026-11-25 | 6f283d2 | 17 | Every discovery file `200` with the expected content types, both cards `access-control-allow-origin: *`; `robots.txt` starts at `User-agent: *` and has two `Sitemap:` lines; GPTBot and ClaudeBot `200`; beacon 0. Lighthouse once: Performance 0.85, Accessibility, Best Practices, SEO and Agentic browsing 1; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console`, `image-aspect-ratio` pass. Performance under 0.95 on a single run on a machine at load average 6 to 10; the previous run's three-run median was 1 |
| 2026-11-25 | 6f283d2 | 21 | Failed sends since the deploy (`claimed_at` after 1795650665000): `0`. The newest `day_emails` row is `2026-11-25`, `sent`, no failure. The mail-source check (`List-Unsubscribe` and `List-Unsubscribe-Post`, stop link opened with `GET`) waits for the owner's next day mail after the deploy: not yet done |
| 2026-11-25 | 6f283d2 | 22 | `owners` 1, `candidates` 1, `agent_nudge_on` 0, `untouched_email_owners` 0. The runbook's `--file` form prints no SELECT rows (only query statistics), so the same SQL was run through `--command` |
| 2026-11-25 | 6f283d2 | 23 | The build loop's call: 23 and 24 ran before step 21's header check closed, because neither sends mail (0010 turns on only the nudge for the one untouched owner, who asked for it on; step 24 changes no row). Step 21's check closes at the owner's next day mail, 2026-11-26 10:00 UTC; if it fails, roll back per the runbook. List named `0010_agent_nudge_default.sql` only; applied. `untouched_off` 0. Read-back for the owner: `agent_nudge` 1, `agent_nudge_chosen_at` null, `day_email` 1, `day_email_chosen_at` 1795650649791 |
| 2026-11-25 | 6f283d2 | 24 | `day-email-default.sql` ran with `untouched_email_owners` 0: `changes` 0, rows written 0, no row changed |
| 2026-11-25 | 6f283d2 | 22 | Deviations: Step 20's block shows a bare `wrangler deploy`; `server:deploy` was used, as step 8 says. `wrangler d1 execute --file` prints no SELECT rows, so step 22's counts came through `--command` with the file's SQL. Step 7 was skipped by design. Worktree detached |
| 2026-11-26 | 94a63f2 | 8 | Deploy skill: Ran the `deploy` skill's order with `--skip-release`: step 3 reports "no release due (--skip-release)"; no Mac release, no `release:mac`, no download checks of step 5 |
| 2026-11-26 | 94a63f2 | 1 | Deviation: detached worktree at `origin/main` (clean, 0 ahead, 0 behind); `pnpm verify all` 9 gates green at 94a63f22 |
| 2026-11-26 | 94a63f2 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-26 | 94a63f2 | 3 | `api.todz.app`, `todz.app`, `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` route1 to route3 and `TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"` unchanged |
| 2026-11-26 | 94a63f2 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 94a63f2 | 5 | Bookmark `0000003e-00000000-0000512f-035f7c6dad76c9cd3074c7c923c4a853` |
| 2026-11-26 | 94a63f2 | 6 | Exported `before-94a63f22.sql` (8567 bytes) into the private folder; deleted after step 14 |
| 2026-11-26 | 94a63f2 | 7 | `migrations list`: no migrations to apply. Steps 19 to 24 were one-time (0009 and 0010 applied on 6f283d2b) and did not run |
| 2026-11-26 | 94a63f2 | 8 | `scripts/deploy-worker.sh`: `/download/latest` answered 404 before the deploy, so nothing published is removed; staged 36 asset files (the landing's own, no released versions); bindings list includes `env.ASSETS` and the thirteen limiters; `api.todz.app`, `todz.app`, `www.todz.app (custom domain)`; schedules `0 11 * * *` and `*/15 * * * *`. Current Version ID `4085b690-4b30-4293-a4a2-3a92e1fbc736`, message the full commit sha. Ready line: `server 2026.11.26+94a63f2 · accepts app 0.2.0 or later`. The stamp's date is 2026.11.26 because the commit's UTC date is 2026-11-26 (21:00 at UTC-3 on 2026-11-25) |
| 2026-11-26 | 94a63f2 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent with message `94a63f22...`; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 94a63f2 | 10 | Read only: routing enabled, subaddressing true, four rules (`todz day email replies` worker, the two forwards, the disabled catch-all) |
| 2026-11-26 | 94a63f2 | 11 | Nothing put: `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` listed |
| 2026-11-26 | 94a63f2 | 12 | `todz.app` sending enabled yes; `enable` not rerun |
| 2026-11-26 | 94a63f2 | 13 | pseudo IPv4 `off`; Always Use HTTPS `on`; the three hosts each `HTTP/1.1 301` to `https://` on the same host |
| 2026-11-26 | 94a63f2 | 14 | With `Todz-App-Version: 0.2.0`: `{"method":"link"}`; without: `{"error":"app_too_old","minimum_app_version":"0.2.0"}`; `/health` `{"service":"todz","origin":"https://api.todz.app","version":"2026.11.26+94a63f2","minimum_app_version":"0.2.0"}`; `/health` HEAD `200`, `no-store`, `todz-api-version: 2026.11.26+94a63f2`; `/sign-in` and `/sign-in/challenge` `200`; `/mcp` `401`; `todz.app/` `200`; `/self-host` and `www` `/self-host?from=runbook` `301` to `https://docs.todz.app/self-host`; `todz.app/owner/sign-in-method` and `api.todz.app/` `404`; `todz.app/admin` `200` `no-store` `noindex`; `api.todz.app/admin` `404`; `api.todz.app/owner` `401`; lockup `200` `image/png`; every Worker answer carries `todz-api-version`; `workers.dev` timed out with no answer. With the assets in place every route above still answers the Worker. `/day-email/stop` with an unknown token, `GET` and `POST`: `HTTP/2 404`, `noindex`, `no-store`, the stop page CSP |
| 2026-11-26 | 94a63f2 | 14 | Download gate check: Landing says "Coming soon"; the word "download" appears only in CSS class names (`.download-button`, `.download-note`), with no `<a>` or `<button>` and no `/download` href; `/download`, `/download/latest`, `/download/appcast.xml` and `/download/0.2.0/Todz-0.2.0.dmg` each `404`; `/llms.txt` and `/llms-full.txt` line 5: "todz is in development: the macOS app is not yet notarized by Apple and the waitlist is open."; `/llms.txt` links `https://docs.todz.app/install-on-mac` and makes no download claim |
| 2026-11-26 | 94a63f2 | 15 | Link request `HTTP/2 429`, `retry-after: 60`, `{"error":"sign_in_refused"}`; waitlist post `429`, probe-address count 0; admin post `429`; no mail |
| 2026-11-26 | 94a63f2 | 16 | Eleven `HTTP/2 401`, then three `HTTP/2 429` each with `retry-after: 60` |
| 2026-11-26 | 94a63f2 | 17 | Every discovery file `200` with the expected content types, both cards `access-control-allow-origin: *`; `robots.txt` starts at `User-agent: *` with two `Sitemap:` lines; GPTBot and ClaudeBot `200`; beacon 0. Lighthouse once: Performance 1, Accessibility, Best Practices, SEO and Agentic browsing 1; `robots-txt`, `llms-txt`, `ard-schema`, `errors-in-console`, `image-aspect-ratio` pass |
| 2026-11-26 | 94a63f2 | 18 | This file. Step 21's mail-header check of the previous deploy is still open until the owner's 10:00 UTC day mail |
| 2026-11-26 | 104a531 | 1 | Deviation: fresh detached worktree at `origin/main` (clean, 0 ahead, 0 behind) instead of a `git pull` on main; `pnpm verify all` 9 gates green at 104a5316 (docs-only change over 94a63f22) |
| 2026-11-26 | 104a531 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-26 | 104a531 | 3 | `api.todz.app`, `todz.app`, `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` and `TXT` unchanged |
| 2026-11-26 | 104a531 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 104a531 | 5 | Bookmark `00000042-00000000-0000512f-b920c32ef26230279dd3312776e59522` |
| 2026-11-26 | 104a531 | 6 | Exported `before-104a5316.sql` (8344 bytes) into the private folder; deleted after step 14 |
| 2026-11-26 | 104a531 | 7 | No migrations to apply; steps 19 to 24 were one-time and did not run |
| 2026-11-26 | 104a531 | 8 | `scripts/deploy-worker.sh`: `/download/latest` 404 before, staged 28 files, `env.ASSETS` bound, three custom domains, schedules `0 11 * * *` and `*/15 * * * *`. Current Version ID `9b2de0e8-5fd6-4988-9b45-8e28a2ae074c`, message the full commit sha. Ready line `server 2026.11.26+104a531 · accepts app 0.2.0 or later`; the stamp's date is the commit's UTC date (2026-11-25 22:24 at UTC-3 is 2026-11-26 UTC), not 2026.11.25 |
| 2026-11-26 | 104a531 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 104a531 | 10 | Steps 10 to 13: Read only as before: routing enabled with subaddressing and the `reply@todz.app` worker rule, `ADMIN_EMAIL` and `TURNSTILE_SECRET_KEY` listed, sending enabled yes, Always Use HTTPS `on` with three `301`s |
| 2026-11-26 | 104a531 | 14 | With `Todz-App-Version: 0.2.0` `{"method":"link"}`; without `{"error":"app_too_old","minimum_app_version":"0.2.0"}`; `/health` `{"service":"todz","origin":"https://api.todz.app","version":"2026.11.26+104a531","minimum_app_version":"0.2.0"}`; the same routes as the previous run with the same statuses, every Worker answer carrying `todz-api-version: 2026.11.26+104a531`; `/day-email/stop` unknown token `GET` and `POST` `404` `noindex` `no-store`; `workers.dev` timed out |
| 2026-11-26 | 104a531 | 14 | Download gate check: Landing says "Coming soon", "download" only in CSS class names, no download link; `/download`, `/download/latest`, `/download/appcast.xml`, `/download/0.2.0/Todz-0.2.0.dmg` `404`; `/llms.txt` and `/llms-full.txt` say the macOS app is "not yet notarized by Apple" with no download claim |
| 2026-11-26 | 104a531 | 15 | Link request `429` `retry-after: 60` `sign_in_refused`; waitlist post `429`, probe count 0; admin post `429`; no mail |
| 2026-11-26 | 104a531 | 16 | Eleven `401`, then three `429` each with `retry-after: 60` |
| 2026-11-26 | 104a531 | 17 | Discovery files, crawlers and beacon as before. Lighthouse once: every category 1; the five named audits pass |
| 2026-11-26 | 104a531 | 18 | This file. Step 21's mail-header check of the 6f283d2b deploy is still open until the owner's 10:00 UTC day mail |
| 2026-11-26 | 98ed052 | 1 | Clean `main` equal to `origin/main`; `pnpm verify all` 9 gates green at 98ed052a |
| 2026-11-26 | 98ed052 | 2 | `whoami`: a User API Token, one account `e2035d8e0b7173d520ccf643f6f4661c`; verify `"status":"active"` |
| 2026-11-26 | 98ed052 | 3 | `api.todz.app`, `todz.app`, `www.todz.app`: only the Worker's `AAAA 100::` each; apex `MX` and `TXT` unchanged |
| 2026-11-26 | 98ed052 | 4 | `todz-directory`, uuid `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 98ed052 | 5 | Bookmark `0000006f-00000000-0000512f-66a571ba523cff2849a335ee4e165627` |
| 2026-11-26 | 98ed052 | 6 | Exported `before-98ed052a.sql` (8567 bytes) into the private folder; deleted after step 14 |
| 2026-11-26 | 98ed052 | 7 | No migrations to apply |
| 2026-11-26 | 98ed052 | 8 | `scripts/deploy-worker.sh`: staged 28 files, three custom domains, both schedules. Current Version ID `f22cee2d-c5f9-4157-89b8-1335422fff62`, message the full commit sha. Ready line `server 2026.11.26+98ed052 · accepts app 0.2.0 or later` |
| 2026-11-26 | 98ed052 | 9 | One domain entry per host, each `todz-api`; the version at 100 percent; `DIRECTORY` bound to `dc22b1c3-1869-44a0-b805-91bf92017f19` |
| 2026-11-26 | 98ed052 | 14 | `{"method":"link"}`, the `app_too_old` body without the header, `/health` version `2026.11.26+98ed052`; every route as the previous run; `/download`, `/download/latest` and the appcast `404` before the release. Steps 15 and 16 skipped: no limiter probes while the owner's walk holds production |
| 2026-11-26 | c4d3eb9 | 1 | `pnpm verify all` 9 gates green at c4d3eb94 (PR #69, the release script fix; no API change) |
| 2026-11-26 | c4d3eb9 | 5 | Bookmark `00000071-00000000-0000512f-bd47b38ea1921f0c4b3cebaa664d7434` |
| 2026-11-26 | c4d3eb9 | 6 | Exported `before-c4d3eb94.sql` into the private folder; deleted after step 14 |
| 2026-11-26 | c4d3eb9 | 7 | No migrations to apply |
| 2026-11-26 | c4d3eb9 | 8 | Current Version ID `12c381b9-0e01-4182-9697-797af02025be`; ready line `server 2026.11.26+c4d3eb9 · accepts app 0.2.0 or later` |
| 2026-11-26 | c4d3eb9 | 14 | Same answers as the 98ed052 run with version `2026.11.26+c4d3eb9` |
| 2026-11-26 | c4d3eb9 | 18 | This file. `pnpm release:mac` 0.2.0 followed (the releases table of the release runbook): Current Version ID `48062362-9a9d-4034-ad9d-de803d106b9f`; `/download` and `/download/latest` `302` to `/download/0.2.0/Todz-0.2.0.dmg`; the DMG `200` with `attachment` and `immutable`; sum `OK`; signature `Good`; the appcast names 0.2.0, build 2063, with `sparkle:edSignature`; tag `mac-v0.2.0` on c4d3eb94 |
| 2026-11-26 | 3ecdab2 | 1 | `pnpm verify all` 9 gates green at 3ecdab23 (PR #70, docs only) |
| 2026-11-26 | 3ecdab2 | 5 | Bookmark `00000073-00000000-0000512f-9d1cecd308e06ea34efbed0bb511750d` |
| 2026-11-26 | 3ecdab2 | 6 | Exported `before-3ecdab23.sql` into the private folder; deleted after step 14 |
| 2026-11-26 | 3ecdab2 | 7 | No migrations to apply |
| 2026-11-26 | 3ecdab2 | 8 | Staged 33 files (0.2.0 kept served); Current Version ID `649dd31c-ff61-4238-97a9-c6f8a6c5b8ac`; ready line `server 2026.11.26+3ecdab2 · accepts app 0.2.0 or later` |
| 2026-11-26 | 3ecdab2 | 14 | Same answers as the c4d3eb9 run with version `2026.11.26+3ecdab2`; `/download` and `/download/latest` `302` to 0.2.0, the appcast `200` |
| 2026-11-26 | 3ecdab2 | 18 | This file. `pnpm release:mac` 0.2.1 (the second try, after a missed `generate_keys` prompt) followed: Current Version ID `36e12103-58fe-4870-81f8-8900cab277de`; `/download` and `/download/latest` `302` to `/download/0.2.1/Todz-0.2.1.dmg`; 0.2.0 still `200`; sum `OK`; signature `Good`; the appcast names 0.2.1, build 2069, with `sparkle:edSignature`; tag `mac-v0.2.1` on 3ecdab23 |
| 2026-11-26 | f7d4810 | 1 | `pnpm verify all` 9 gates green at f7d48103 |
| 2026-11-26 | f7d4810 | 5 | Bookmark `0000008b-00000000-0000512f-d20a0a6dfb3f9f52c8fae2e759575278` |
| 2026-11-26 | f7d4810 | 6 | Exported `before-f7d48103.sql`; deleted after step 14 |
| 2026-11-26 | f7d4810 | 7 | Applied `0011_metrics_daily.sql` |
| 2026-11-26 | f7d4810 | 8 | Staged 36 files; Current Version ID `6c40153d-2881-49d0-97f3-6ead2f4c778b`; schedules `*/15 * * * *` and `0 3 * * *` (the digest cron removed by waitlist-off); `TELEMETRY` on |
| 2026-11-26 | f7d4810 | 14 | `{"method":"link"}`; `/health` `2026.11.26+f7d4810`; landing 200 with Download for Mac — Free, the star pill, todz cloud and Self-host, the signature; `POST /join` 410; llms.txt, index.md, api-catalog, the server card on api.todz.app 200; the appcast 200 with `cache-control: public, max-age=300`; `/admin/metrics` the sign-in card |
| 2026-11-26 | f7d4810 | 18 | This file. `pnpm release:mac` 0.2.2: Current Version ID `ad9a0ee2-876c-4fb6-bba6-20cd5fc3ce66`; `/download/latest` 302 to 0.2.2; sum `OK`; signature `Good`; appcast 0.2.2 build 2165 signed; tag `mac-v0.2.2` |
| 2026-11-26 | 8864b25 | 1 | Deviation accepted: detached worktree at the fixed origin/main sha 8864b252 instead of the `main` branch. Clean tree. `pnpm verify all`: exit 0, "verify: 9 gates green at 8864b252 (docs)". |
| 2026-11-26 | 8864b25 | 2 | `wrangler whoami` lists the one account e2035d8e0b7173d520ccf643f6f4661c (it words the login "User API Token", not "API Token"); `/user/tokens/verify` answers `"status":"active"`. |
| 2026-11-26 | 8864b25 | 3 | `api.todz.app` holds only the Worker's `AAAA 100::`; the zone lists the apex MX route1/2/3.mx.cloudflare.net and apex TXT `v=spf1 include:_spf.mx.cloudflare.net ~all`; `todz.app` and `www.todz.app` have only the Worker's `AAAA 100::`. |
| 2026-11-26 | 8864b25 | 4 | Database `todz-directory`, uuid dc22b1c3-1869-44a0-b805-91bf92017f19, `"success":true`. |
| 2026-11-26 | 8864b25 | 5 | Time Travel bookmark 000000a4-00000000-0000512f-89a9f7fcf86eac943fd497bc4ab00638. |
| 2026-11-26 | 8864b25 | 6 | Export written to `~/.todz-deploy/backups/before-8864b25.sql` (9590 bytes); deleted after step 14. |
| 2026-11-26 | 8864b25 | 7 | `migrations list --remote`: "No migrations to apply!" (0001 to 0011 already applied); apply not run. |
| 2026-11-26 | 8864b25 | 8 | `scripts/deploy-worker.sh`: staged 36 files; Current Version ID f36e522a-d200-4f8b-a951-af9cfbfdaa26; last line `todz server ready: https://api.todz.app · server 2026.11.26+8864b25 · accepts app 0.2.0 or later`. Custom domains api.todz.app, todz.app, www.todz.app. TURNSTILE_SITE_KEY present. The bindings and triggers differ from the runbook text: also `USAGE_LIMITER`, `USAGE_INSTALL_LIMITER`, `USAGE_GLOBAL_LIMITER`, `APPCAST_LIMITER`, `APPCAST_ADDRESS_LIMITER`, the variable `TELEMETRY ("on")`, and a second schedule `0 3 * * *` beside `*/15 * * * *` (the runbook still says the first alone). Version id recorded in `~/.todz-deploy/deployments/8864b25`. |
| 2026-11-26 | 8864b25 | 9 | One domain entry per host (api.todz.app, todz.app, www.todz.app), each `"service":"todz-api"`; newest deployment f36e522a-d200-4f8b-a951-af9cfbfdaa26 at 100 percent; version binding DIRECTORY id dc22b1c3-1869-44a0-b805-91bf92017f19. |
| 2026-11-26 | 8864b25 | 14 | All eighteen as expected: `{"method":"link"}`; `app_too_old` with 0.2.0; `/health` `{"service":"todz","origin":"https://api.todz.app","version":"2026.11.26+8864b25","minimum_app_version":"0.2.0"}` with `todz-api-version`, `cache-control: no-store`; `/sign-in` and `/sign-in/challenge` 200 (site key deployed); `/mcp` 401; landing 200 with HSTS and CSP `default-src 'none'`; `/self-host` and the `www` address 301 to https://docs.todz.app/self-host with `cache-control: max-age=3600`; owner route on the site host 404; landing on the API host 404; `todz.app/admin` 200 with `no-store` and `x-robots-tag: noindex`; `api.todz.app/admin` 404; `api.todz.app/owner` 401; lockup 200 `image/png`; workers.dev subdomain `dhyegofernando`, its host timed out (no answer from the Worker). HSTS reads `max-age=31536000; includeSubDomains`, a superset of the expected prefix. |
| 2026-11-26 | 8864b25 | 17 | Discovery: robots.txt, sitemap, llms.txt, llms-full.txt, manifest, ard.json, both server cards 200 with the expected types and CORS and cache headers; favicon `image/vnd.microsoft.icon`; share image `image/png`; GPTBot 200, ClaudeBot 200; `cloudflareinsights` count 0. Lighthouse not run (not requested for this deploy). |
| 2026-11-26 | 8864b25 | 10 | Steps 10 to 13, 15, 16 and 18 skipped by instruction (one-time setup, limiter probes, record step replaced by this file). |
| 2026-11-26 | aef5360a | 1 | Clean main = origin/main, `pnpm verify all`: 9 gates green at aef5360a. |
| 2026-11-26 | aef5360a | 2 | `wrangler whoami`: one account e2035d8e...; it says "User API Token" (the runbook expected "API Token"); verify status active. |
| 2026-11-26 | aef5360a | 3 | `api.todz.app` only the Worker's own `AAAA 100::`; apex and `www` `AAAA 100::`; apex MX route1-3.mx.cloudflare.net, TXT SPF and DKIM unchanged. |
| 2026-11-26 | aef5360a | 4 | `success`, `todz-directory`, uuid dc22b1c3-1869-44a0-b805-91bf92017f19. |
| 2026-11-26 | aef5360a | 5 | Time Travel bookmark 000000aa-00000000-0000512f-38fd26b1a9eccc504a56287092c85585. |
| 2026-11-26 | aef5360a | 6 | Export written (9590 bytes), deleted after step 14. |
| 2026-11-26 | aef5360a | 7 | Pending `0013_workspace_last_activity.sql`, applied; second list: nothing to apply. |
| 2026-11-26 | aef5360a | 8 | Ready line `server 2026.11.26+aef5360`; Version ID 0c54e400-9029-465d-8505-f34d236201db; the bindings now include the `USAGE_*` and `APPCAST_*` limiters and the `TELEMETRY` variable, schedules `*/15 * * * *` and `0 3 * * *` (the runbook text expected only the first and fewer limiters). |
| 2026-11-26 | aef5360a | 9 | One domain entry per host, service todz-api; newest deployment 0c54e400 at 100 percent; `DIRECTORY` d1 id dc22b1c3-... |
| 2026-11-26 | aef5360a | 14 | All routes as expected (health version 2026.11.26+aef5360); workers.dev host timed out (no answer from the Worker). |
| 2026-11-26 | aef5360a | 17 | Discovery files 200 with expected types; GPTBot 200, ClaudeBot 200, beacon 0; Lighthouse three runs, all five categories 1, audits 1. |
| 2026-11-26 | aef5360a | 18 | `pnpm release:mac` 0.2.3 (build 2300) FAILED at "production check failed: the served signature does not verify"; the release command rolled the Worker back to 0c54e400 (rollback deployment "release-mac rollback of 0.2.3"), removed site/download/0.2.3; `released` still ends 0.2.2, no mac-v0.2.3 tag; candidate Worker version 3272e891-3046-4ae4-be34-aaaafb49f603. |
| 2026-11-26 | aef5360a | 8 | Release retry: the first attempt rolled back, so the Worker was redeployed per this step as f890f087-44c6-4ffa-90de-25b07ddb0a6a because the rollback's message no longer carried the sha. |
| 2026-11-26 | aef5360a | 18 | Release retry: the second `pnpm release:mac` PUBLISHED 0.2.3 (build 2300), Worker version b2bfc11f-15c2-42bd-8b34-8def27d366b1; `/download/latest` 302 to /download/0.2.3/Todz-0.2.3.dmg; sum OK; Good "todz-release" signature; appcast 0.2.3 build 2300 with edSignature; tag mac-v0.2.3 pushed. |
| 2026-11-26 | 44f8bdf | 1 | First attempt at 44f8bdf7 stopped at the gate on the feature-status test (the landing-proactive spec still said Building); fixed by PR #101. |
| 2026-11-26 | b1cbadb | 1 | Detached worktree at origin/main b1cbadbc (accepted deviation); `pnpm verify all`: 9 gates green at b1cbadbc (docs). |
| 2026-11-26 | b1cbadb | 2 | `whoami`: User API Token, one account e2035d8e0b7173d520ccf643f6f4661c; verify `"status":"active"`. |
| 2026-11-26 | b1cbadb | 3 | `api.todz.app` has only the Worker's own `AAAA 100::`; zone lists apex MX route1-3.mx.cloudflare.net and apex TXT `v=spf1 include:_spf.mx.cloudflare.net ~all`; `todz.app` and `www` have only `AAAA 100::`. |
| 2026-11-26 | b1cbadb | 4 | D1 `todz-directory` uuid dc22b1c3-1869-44a0-b805-91bf92017f19, `success:true`. |
| 2026-11-26 | b1cbadb | 5 | Time Travel bookmark 000000af-00000000-0000512f-92983cc02a3aca38ee2bfc4e69e65692. |
| 2026-11-26 | b1cbadb | 6 | Skipped: no migration pending, no waitlist export asked for. |
| 2026-11-26 | b1cbadb | 7 | `migrations list --remote`: No migrations to apply; apply skipped. |
| 2026-11-26 | b1cbadb | 8 | `scripts/deploy-worker.sh` exit 0; Current Version ID c3675cf5-5daf-4d6e-8ffd-d0d2e1524340; `server 2026.11.26+b1cbadb`, accepts app 0.2.0 or later; custom domains api, apex, www; schedules `*/15 * * * *` and `0 3 * * *`. |
| 2026-11-26 | b1cbadb | 9 | One domain entry per host, service todz-api; newest deployment 100% c3675cf5; the version's `DIRECTORY` d1 id dc22b1c3-1869-44a0-b805-91bf92017f19. |
| 2026-11-26 | b1cbadb | 14 | All probes as expected: `{"method":"link"}`, app_too_old, /health stamp 2026.11.26+b1cbadb, sign-in pages 200, /mcp 401, landing 200, self-host and www 301 to docs, owner route on site host 404, api root 404, todz.app/admin 200 no-store noindex, api admin 404, api owner 401, lockup 200 image/png; workers.dev subdomain `dhyegofernando` timed out (no answer from the Worker). |
| 2026-11-26 | b1cbadb | 17 | robots, sitemap, llms, llms-full, manifest, ard, both cards, favicon, og all 200 with expected types; GPTBot 200, ClaudeBot 200; cloudflareinsights 0; `grep -c proactive-day` 1; Lighthouse not run. |
| 2026-11-26 | 7ec2b2a | 1 | `pnpm verify all`: 9 gates green at 7ec2b2ad (docs); detached worktree at the sha; batch of #94 fair-use, #98 remove-waitlist, #99 mcp-parity, `--skip-release`. |
| 2026-11-26 | 7ec2b2a | 2 | `whoami`: one account e2035d8e...; verify `"status":"active"` (wrangler words the login "User API Token"). |
| 2026-11-26 | 7ec2b2a | 3 | No record on `api.todz.app` but the Worker's own AAAA; apex MX (route1-3.mx.cloudflare.net) and TXT SPF unchanged. |
| 2026-11-26 | 7ec2b2a | 4 | `todz-directory` `dc22b1c3-1869-44a0-b805-91bf92017f19`, 17 tables. |
| 2026-11-26 | 7ec2b2a | 5 | Bookmark `000000b1-00000000-0000512f-6d8a827eefedbc2703ac9c9db62f6f3f`. |
| 2026-11-26 | 7ec2b2a | 6 | `before-7ec2b2a.sql` exported (9764 bytes), deleted after step 14; waitlist export of 1 row (JSON length 1), file mode 600, never committed. |
| 2026-11-26 | 7ec2b2a | 25 | `SIGN_UP_KEY_SECRET` put from a piped random value; the secret list names ADMIN_EMAIL, SIGN_UP_KEY_SECRET, TURNSTILE_SECRET_KEY. |
| 2026-11-26 | 7ec2b2a | 7 | Pending 0012_fair_use, 0014_drop_waitlist, 0015_owner_keys; applied all three; second list: nothing to apply. |
| 2026-11-26 | 7ec2b2a | 8 | Current Version ID `a472c53d-b001-4e79-aaf6-784d6ec03ad2`, `server 2026.11.26+7ec2b2a`; schedules `*/15 * * * *` and `0 3 * * *` (the runbook said the first alone). |
| 2026-11-26 | 7ec2b2a | 9 | One entry per host, service todz-api; newest deployment at 100 percent a472c53d; `DIRECTORY` d1 id dc22b1c3-... |
| 2026-11-26 | 7ec2b2a | 14 | All answers as expected; /health `{"service":"todz","origin":"https://api.todz.app","version":"2026.11.26+7ec2b2a","minimum_app_version":"0.2.0"}`; POST todz.app/join 404; workers.dev host timed out (no answer from the Worker). |
| 2026-11-26 | 7ec2b2a | 17 | All files 200 with the expected types; GPTBot 200, ClaudeBot 200, beacon 0; Lighthouse three runs all five scores 1, five audits 1. |
| 2026-11-26 | 00ed0f4 | 1 | `pnpm verify all`: 9 gates green at 00ed0f42 (docs), on the main checkout; batch of #102, #103 and #105 for release 0.2.4. |
| 2026-11-26 | 00ed0f4 | 2 | `whoami`: User API Token, one account e2035d8e0b7173d520ccf643f6f4661c; verify `"status":"active"`. |
| 2026-11-26 | 00ed0f4 | 3 | `api.todz.app` has only the Worker's own `AAAA 100::`. |
| 2026-11-26 | 00ed0f4 | 4 | D1 `todz-directory` uuid dc22b1c3-1869-44a0-b805-91bf92017f19, `success:true`. |
| 2026-11-26 | 00ed0f4 | 5 | Bookmark `000000be-00000000-0000512f-07ff0393df11ea1d9bcf502616da92e9`. |
| 2026-11-26 | 00ed0f4 | 6 | `before-00ed0f4.sql` exported, deleted after step 14; the waitlist table is already dropped. |
| 2026-11-26 | 00ed0f4 | 7 | No migrations to apply. |
| 2026-11-26 | 00ed0f4 | 8 | Current Version ID `b77a194c-59fa-4644-a288-07b0ef000217`, `server 2026.11.26+00ed0f4`, accepts app 0.2.0 or later. |
| 2026-11-26 | 00ed0f4 | 9 | Domain entries api.todz.app, todz.app and www.todz.app on todz-api; newest deployment 100 percent b77a194c. |
| 2026-11-26 | 00ed0f4 | 18 | Release 0.2.4: the first `pnpm release:mac` stopped at `generate_keys timed out after 60s` before any upload; the retry redeployed as b2d0de3a-c4e9-4d29-97bb-f04bccac04a1 and published 0.2.4. |
| 2026-11-26 | ca3ae35 | 1 | `pnpm verify all`: 9 gates green at ca3ae350 (docs); #106, minimum app 0.2.4, `--skip-release`. |
| 2026-11-26 | ca3ae35 | 5 | Bookmark `000000c3-00000000-0000512f-8df5934bae827f49256e6a25c7eb6b0c`. |
| 2026-11-26 | ca3ae35 | 7 | No migrations to apply. |
| 2026-11-26 | ca3ae35 | 8 | Current Version ID `9bee5be0-c4ab-45b0-ad1f-c04387845a97`, `server 2026.11.26+ca3ae35`, accepts app 0.2.4 or later. |
| 2026-11-26 | ca3ae35 | 14 | Probes 1–16 as expected: `{"method":"link"}`, then `app_too_old` with minimum 0.2.4, the /health stamp, sign-in pages 200, /mcp 401, landing 200 with HSTS and CSP, self-host and www 301 to docs, owner route on the site and landing on the API 404, admin 200 noindex, api admin 404, /owner 401, lockup png 200; the workers.dev probe was not run. The export was deleted. |
| 2026-11-26 | ca3ae35 | 26 | The owner put `CLOUDFLARE_ANALYTICS_TOKEN` in his own terminal; `wrangler secret list` names ADMIN_EMAIL, CLOUDFLARE_ANALYTICS_TOKEN, SIGN_UP_KEY_SECRET and TURNSTILE_SECRET_KEY. |
| 2026-11-26 | 86b2a65 | 1 | `pnpm verify all`: 9 gates green at 86b2a653 (docs); #107 and #108 for release 0.2.5. |
| 2026-11-26 | 86b2a65 | 8 | `scripts/deploy-worker.sh`: Current Version ID `db02080e-97d8-478d-a93e-03b62c0ce950`, `server 2026.11.26+86b2a65`; steps 5–7 skipped, no migration pending (the script re-checks). |
| 2026-11-26 | 86b2a65 | 18 | Release 0.2.5 redeployed as 8a17c00c-f159-48dc-85ee-411cd6a3dc1d; probes 1–4 as expected. |
| 2026-11-26 | 91c1662 | 1 | `pnpm verify all`: 9 gates green at 91c1662f (docs); batch of #104 cloud capacity, #109, #110, #111 and #112. |
| 2026-11-26 | 91c1662 | 5 | Bookmark `000000cc-00000000-00005130-0536c5a3b657d58fdfa8ba14bff4ce33`. |
| 2026-11-26 | 91c1662 | 6 | `before-91c1662.sql` exported, deleted after step 14. |
| 2026-11-26 | 91c1662 | 7 | Pending `0016_cloud_capacity.sql`; applied (8 commands); second list: nothing to apply. |
| 2026-11-26 | 91c1662 | 8 | Current Version ID `ac33cbd1-8c99-4a29-83d9-f37371460d4e`, `server 2026.11.26+91c1662`, accepts app 0.2.4 or later; new `CLOUD_READ_LIMITER (10 requests/60s)`, `CLOUD_ACCOUNTS_MAX ("50")` and `CLOUDFLARE_ACCOUNT_ID`. |
| 2026-11-26 | 91c1662 | 14 | Probes 1–16 as expected; `todz.app/cloud-queue` without a token 400 (the Invalid page); `POST api.todz.app/owner/cloud-queue` 404 (removed). |
| 2026-11-26 | 91c1662 | 18 | Release 0.2.6: the first `pnpm release:mac` stopped at `generate_keys timed out after 120s` before any upload; the retry redeployed as 1814b0fd-a2c0-4d90-bfd6-c2cb518df0f9 and published 0.2.6 (build 2450); `/download/latest` 302 to /download/0.2.6. |
| 2026-11-27 | 8c3d8fe | 1 | `pnpm verify all`: 9 gates green at 8c3d8fee (docs); batch of #115 workspace-lock, #116 MCP over OAuth and #117. The first run at 86d4fe15 stopped at the feature-status shape test until #117 marked `mcp-oauth` shipped. |
| 2026-11-27 | 8c3d8fe | 5 | Bookmark `000000de-00000000-00005130-9179b3835d8561453f56acbdfadc4e3a`. |
| 2026-11-27 | 8c3d8fe | 6 | `before-8c3d8fee.sql` exported, deleted after step 14. |
| 2026-11-27 | 8c3d8fe | 7 | Pending `0017_oauth.sql`, never applied before; applied (14 commands); second list: nothing to apply. |
| 2026-11-27 | 8c3d8fe | 8 | Current Version ID `f4f6731a-f401-4a61-8863-9d1db53227c6`, `server 2026.11.27+8c3d8fe`, accepts app 0.2.4 or later. |
| 2026-11-27 | 8c3d8fe | 14 | The /health stamp as expected; both OAuth metadata documents name `https://api.todz.app`; `POST /mcp` without a token 401 with the `resource_metadata` challenge; a probe registration answered a client id, its authorize 200 (the email form), the same query plus `decision=approve&choice=owner` 400 with no Location, a refresh with an unknown token 400. |
| 2026-11-27 | 8c3d8fe | 18 | Release 0.2.7: two `pnpm release:mac` attempts stopped at `generate_keys timed out after 120s` before any upload, the owner being away from the Keychain prompt; nothing was deployed and `/download/latest` still 302s to /download/0.2.6. The release waits for the owner. |
