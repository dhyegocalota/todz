# Production smoke walk

Walk todz on `todz.app` and `api.todz.app` once the last deploy has landed, from a real mail in the owner's inbox to a task an agent added and the menu bar and widget followed: the proof that production is done ([deploy-the-api.md](deploy-the-api.md) and [performance.md](performance.md) hold the commands this walk reuses).

Every command runs from the repository root, one command per call; a Wrangler or Cloudflare call starts with `scripts/todz-cloudflare.sh`, as in the deploy runbook. Steps marked **the owner's session** are done by the owner or by the session that drives the Mac app, in the Release app in `/Applications` signed in to production; the loop runs the others, and only the probes that read, the posts of an unsolved or missing token for `nobody@example.com`, the performance run's own `todz-perf <run> #<slot>` tasks and the tasks whose title starts with `smoke-`. Steps marked **conditional** apply only once their feature is deployed: write `not deployed` in the run log for a step that does not apply. The step that sends the forged reply runs only with the owner's explicit OK. The walk uses the workspace named `todz-perf` for every task it adds, so the owner's real tasks are never touched.

Take `<commit>` as `git rev-parse --short origin/main` and `<short>` as the same value; both go in the run log.

Once `version-compat` is deployed, every `/owner/*` request without a `Todz-App-Version` of at least the `MINIMUM_APP_VERSION` of `libs/types` answers `426` with `{"error":"app_too_old","minimum_app_version":"<minimum>"}`, before its body is read. Read `<minimum>` from `libs/types/src/constants.ts` and send `-H "Todz-App-Version: <minimum>"` on every `/owner/*` probe below; the plain form without the header is for a Worker deployed before `version-compat`, which ignores it.

1. **Confirm what is deployed.** Read the deployed commit of the Worker against `main`, then ask the live health route with both methods:

    ```bash
    git fetch origin
    git rev-parse --short origin/main
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler deployments list --name todz-api
    curl -sS https://api.todz.app/health
    curl -sSI https://api.todz.app/health
    curl -sSI https://todz.app/health
    ```

    Expected: the newest deployment is at 100 percent and is newer than the last deploy row of the run log of [deploy-the-api.md](deploy-the-api.md) (Wrangler shows no commit, so the stamp below is the proof of what runs); `HTTP/2 200` with `cache-control: no-store` and no `server-timing` for both `HEAD` probes. The body is `{"service":"todz","origin":"https://api.todz.app","version":"YYYY.MM.DD+<deployed hash>","minimum_app_version":"<minimum>"}` once `version-compat` is deployed, and `{"service":"todz","origin":"https://api.todz.app"}` before it. The `version` stamp is the proof of the deployed commit: its date is that commit's UTC date and its hash is the commit's short hash, so `git log -1 --format=%h <hash>` must name a commit that is `<commit>` or an ancestor of it, never a later one; `minimum_app_version` equals `MINIMUM_APP_VERSION`.
    If it fails: a `404` for `HEAD /health` means the deployed version predates `health-head`; stop, tell the owner and deploy as [deploy-the-api.md](deploy-the-api.md) says before the walk. A deployment older than the merge, or a stamp whose hash is not `<commit>` or an ancestor of it, means the last deploy has not landed; wait for it. A `"version":null` means the deploy skipped `server:deploy`'s stamp; deploy again through it. A hash that is not in the repository means the deploy came from another checkout; tell the owner.

2. **Check the version line (conditional on `version-compat`).** Ask the API for its version header on an answer of each kind:

    ```bash
    curl -sS -D - -o /dev/null https://api.todz.app/health
    curl -sS -D - -o /dev/null -H "Todz-App-Version: <minimum>" https://api.todz.app/owner/sign-in-method
    curl -sS -D - https://api.todz.app/owner/sign-in-method
    ```

    Expected: a `todz-api-version` line on all three, the same value as the `version` of step 1; `HTTP/2 200` for the second; for the third, which sends no app version, `HTTP/2 426`, `upgrade: todz-app/<minimum>` and `{"error":"app_too_old","minimum_app_version":"<minimum>"}`.
    If it fails: no line while `version-compat` is not merged is the expected answer; write `not deployed`. A missing line after it shipped means the deployed version predates it; deploy again from `main`.

3. **Check the security headers on every host.** Ask each host for its landing or its first answer, and the docs for a link:

    ```bash
    curl -sS -D - -o /dev/null https://todz.app/
    curl -sSL -D - -o /dev/null https://www.todz.app/
    curl -sS -D - -o /dev/null https://api.todz.app/health
    curl -sS -D - -o /dev/null -H "Todz-App-Version: <minimum>" https://api.todz.app/owner
    curl -sS -D - -o /dev/null https://docs.todz.app/
    ```

    Expected: for the first four, `strict-transport-security: max-age=31536000`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer` and a `content-security-policy` that starts with `default-src` and carries `frame-ancestors 'none'` (the `www` probe follows a `301` to `https://todz.app/` with `-L`, so read the headers of the last answer); `api.todz.app/owner` answers `HTTP/2 401` with the header (without it, once `version-compat` is deployed, `HTTP/2 426`). The docs host is Mintlify's: record the headers it sends and that it answers `HTTP/2 200`, and expect no more.
    If it fails: a missing header on a todz host means a response skipped `withSecurityHeaders`; tell the owner, because every host sets them on every answer. A docs host that answers anything but `200` is [mintlify-publish.md](mintlify-publish.md)'s to fix.

4. **Re-check the sign-in link and the Turnstile guard.** Post a link request whose token was never solved, from the committed body:

    ```bash
    curl -sS -D - -X POST -H "Todz-App-Version: <minimum>" -H "Content-Type: application/json" --data-binary @scripts/deploy-bodies/junk-turnstile-link.json https://api.todz.app/owner/sign-in-links
    ```

    Expected: `HTTP/2 429`, `retry-after: 60` and `{"error":"sign_in_refused"}`; no mail leaves.
    If it fails: a `202` means the Worker sent a link without a solved challenge; close sign-in as the Rollback section of [deploy-the-api.md](deploy-the-api.md) says and tell the owner. A `503` means the Turnstile secret or the site key is missing; read step 10 of that runbook. A `426` with `app_too_old` means the version header was lost or `<minimum>` is wrong; run the command as written. The same post without the header answering anything but `426` means the gate is not deployed; step 2 says so.

5. **Re-check the verify limit.** Post wrong session tokens, fourteen in one command, and keep only the statuses:

    ```bash
    curl -sS -D - -X POST -H "Content-Type: application/json" -H "Todz-App-Version: <minimum>" --data-binary @scripts/deploy-bodies/wrong-session.json https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions https://api.todz.app/owner/sessions | grep -oE "HTTP/2 [0-9]+|retry-after: [0-9]+"
    ```

    Expected: the first ten are `HTTP/2 401`, and from the eleventh on `HTTP/2 429` followed by `retry-after: 60`; at least one of the last four is a 429. Wait at least seventy seconds before step 6 and before any real sign-in, because refused requests count against the window.
    If it fails: a `HTTP/2 426` on every answer means the header was lost or `<minimum>` is wrong; run the command as written, with the value of `MINIMUM_APP_VERSION`. No 429 means run it once more; none again means the binding is not enforcing; tell the owner. A 429 on the first request means another client on this address used the quota; wait a minute.

6. **Re-check the waitlist and the admin guards.** Count the probe address, post unsolved tokens to the join and the admin link, and count again:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-waitlist.txt https://todz.app/join
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://todz.app" -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/junk-turnstile-admin.txt https://todz.app/admin/sign-in-links
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    ```

    Expected: both counts `0`; both posts print `429`.
    If it fails: a `200` or a count of `1` means a guard let an unsolved token through; detach `todz.app` as the Rollback section of [deploy-the-api.md](deploy-the-api.md) says and tell the owner. A `503` means a Turnstile key is missing.

    Then, once `waitlist-inline` is deployed, post the in-place join without a token and ask for JSON, and count again:

    ```bash
    curl -sS -D - -X POST -H "Accept: application/json" -H "Content-Type: application/x-www-form-urlencoded" --data-binary @scripts/deploy-bodies/missing-token-waitlist.txt https://todz.app/join
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS waitlist_rows FROM waitlist WHERE address = 'nobody@example.com'"
    ```

    Expected: `HTTP/2 403`, `content-type: application/json`, `cache-control: no-store` and `{"outcome":"check-failed"}`; the count is `0`. Before the deploy the same post answers the HTML page with `429`; write `not deployed`.
    If it fails: a `200` with `{"outcome":"joined"}` and a count of `1` means the join kept an address without a token; detach `todz.app` as the Rollback section of [deploy-the-api.md](deploy-the-api.md) says and tell the owner. A `503` with `{"outcome":"opens-soon"}` means a Turnstile key is missing.

7. **The owner's session: sign in with a real magic link.** In the Release app, sign out, then ask for a link to the owner's address and open the mail it sends:

    Expected: the mail from `noreply@todz.app` arrives within one minute, its link opens the app through the `todz` scheme, and the app shows the owner's workspaces, signed in, with no error. The same link opened a second time is refused.
    If it fails: no mail within five minutes means read the Worker's logs for the send (`scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler tail todz-api --format json`, the fields `outcome` and `logs` only) and the Cloudflare Email Sending state of step 11 of [deploy-the-api.md](deploy-the-api.md); a mail in spam means the sender records are not yet trusted, which the owner records. An app that shows "Update todz" instead of the sign-in means the Release app is older than `MINIMUM_APP_VERSION`; install the current build and run the step again. A link that opens the browser but not the app means the Release app's `todz` scheme is not registered; reinstall the Release app.

8. **The owner's session: add and complete a task in the app.** In the workspace `todz-perf`, add a task titled `smoke-<short> app`, wait for the list to show it, then complete it:

    Expected: the task appears in Today at once and stays after quitting and reopening the app; completing it moves it to Done; a second Mac session, or the History view, shows the same two changes.
    If it fails: a task that vanishes after reopening means the write stayed in the outbox; check Settings for the sync state and the network, then add the task again. Record any error text the app shows.

9. **The owner's session: the menu bar count and the widget follow.** With the Release app running, add two tasks titled `smoke-<short> count`, read the menu bar number, complete one, then read the number and the Today widget on the desktop:

    Expected: the menu bar number rises by two within a second of each add and falls by one on the completion; the interactive Today widget lists the one remaining task and shows no completed one within one reload (the widget refreshes when the app writes its snapshot, so a few seconds). Completing the remaining task from the widget's checkbox empties the widget and the number.
    If it fails: a number that does not move means the Settings toggle "Show pending count in the menu bar" is off; turn it on and repeat. Name in the run log the surface where a task added with no due date landed (Inbox or Today). A widget that stays stale means the App Group snapshot is not written; quit and reopen the app, and remove and add the widget again; record whether it followed.

10. **Add and complete a task through a real MCP client.** The owner's session issues the key in Connect an Agent for the Inbox of `todz-perf`, copies the Claude Code command the app shows once, and runs it in a terminal (the form is `claude mcp add --transport http todz '<server>' --header 'Authorization: Bearer <key>'`, with `<server>` the production MCP address and `<key>` the key). Run the command from a directory outside the repository: the app's command has no `--scope`, so Claude Code registers it at local scope, keyed to the directory it ran in, and keeps the key in `~/.claude.json`, never in a file of the repository. From that same directory, ask for the tools and add and complete a task:

    ```bash
    claude mcp list
    claude -p --allowedTools "mcp__todz" "Using the todz MCP server, add a task titled smoke-<short> mcp, then list my tasks, then mark that task done, then list again."
    ```

    Expected: `claude mcp list` shows `todz` connected; the run calls the todz tools for add, list and done (the answer names each call); the task is named after the add, open in the first list and absent from the open list after the done; the Release app shows both changes within a second. The key is never printed outside the owner's terminal.
    If it fails: a `401` means the key was pasted with a space or was already revoked; issue a new one. A server that does not connect, or a `claude mcp list` that does not show `todz`, usually means the command ran in another directory than this one, or points at another server; remove it with `claude mcp remove todz` from the directory it was added in and run the app's command again. A run that reports the tools as denied means `--allowedTools` was dropped; run it as written. Never retry with a key from another workspace.

11. **Revoke the key and remove the client.** The owner copies the key to the clipboard, revokes it in the app's key screen, then the terminal asks `/mcp` with it from the clipboard, so it never sits on a command line, and removes the server from the directory of step 10:

    ```bash
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $(pbpaste)" --data '{}' https://api.todz.app/mcp
    claude mcp remove todz
    claude mcp list
    ```

    Expected: `401` for the revoked key; `todz` is gone from the list; the key screen no longer lists it. The owner then clears the clipboard.
    If it fails: a `200` or another status than `401` for the key means the revoke did not reach the server; repeat it in the app and ask again before the walk is recorded. A key still listed in the app is the same failure.

12. **The owner's session: join the waitlist for real.** The owner opens `https://todz.app/` in a browser, solves the visible check and joins with a plus address of their own (`<name>+smoke-<short>@<their domain>`), so the confirmation mail arrives; then opens `https://todz.app/admin`, signs in with the admin link (the mail goes to `ADMIN_EMAIL`) and reads the list. Call the plus address `<joined>`:

    Expected: the confirmation mail from `noreply@todz.app` arrives within one minute, once; once `waitlist-inline` is deployed, the check is visible in the form, the button waits for it and then about three seconds after the page loaded, and the confirmation appears in place with no reload; before it, the page reloads onto `/join#hero`. Either way the landing answers with the confirmation, not an error notice; the admin panel lists `<joined>` once with today's date; the CSV export of `/admin/export.csv` contains the row. The probe address `nobody@example.com` is absent; a `waitlist-inline-<commit>@example.com` row is that feature's own production check, not a leftover of this walk.
    If it fails: `429` on the join after a solved challenge means a limiter refused it; wait a minute and retry once. A join the panel does not list means the write failed; read `SELECT COUNT(*) FROM waitlist WHERE address = '<joined>'` through the wrapper as in step 6. No confirmation mail within five minutes is step 7's mail check. An admin link that never arrives is step 7's mail check.

13. **Check the waitlist digest is already confirmed.** Read the run log of [deploy-the-api.md](deploy-the-api.md) for the row that records the digest mail and the Cron Events success after 11:00 UTC:

    Expected: a row of the deploy run log names the digest arriving at `ADMIN_EMAIL` and the cron run as a success. This walk does not wait for another digest; the join of step 12 shows in the next one.
    If it fails: no such row means step 9 of the deploy runbook has not been completed; the owner checks the mail and the Cron Events, and the walk records `digest unconfirmed`.

14. **Re-check the performance budgets.** First complete every `smoke-<short>` task of the walk, because the harness refuses to start when the project holds more than 20 open tasks. Then, unless the table of [performance.md](performance.md) already holds a production run dated today (record those rows in this walk's log instead of running again, since a production run is allowed once a day), run its steps 9 to 13 with a new `todz-perf` key issued from the owner's session, one run only, and add the rows to the table of that runbook:

    Expected: the numbers of the bounded production load and of the change feed pass the budgets of that runbook, and the key is revoked and deleted at its step 13.
    If it fails: follow the `If it fails` line of the step that failed in that runbook; a budget over its limit is a finding for the owner, never a reason to repeat the load more than once a day.

15. **Check the day email (conditional on `day-email`).** Only when the feature is deployed. The owner turns on Email me my day in the Release app's Settings with a time at the next quarter hour, then, after the mail arrives, replies to it with one line:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT day, claimed_at, sent_at, failed_at, failure FROM day_emails ORDER BY claimed_at DESC LIMIT 5"
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "SELECT COUNT(*) AS day_email_replies FROM day_email_replies"
    ```

    Expected: the mail arrives at the owner's chosen time and carries `Auto-Submitted: auto-generated` in its original source; the row shows `sent_at` set and `failed_at` empty; the reply adds one task to the first workspace's Inbox and one `day_email_replies` row; the Workers Logs of the mail and the reply show no `rcptTo`, `mailFrom` or address. The forged reply (a message to the same reply address with `From:` the owner's address, sent from elsewhere) is sent only with the owner's explicit OK, and expects no task and a `day_email_reply` log line with `unauthenticated` or `not_owner`.
    If it fails: a row with `failed_at` set names its `failure`; follow the day email's steps in [deploy-the-api.md](deploy-the-api.md). A forged reply that adds a task is a security finding: turn the setting off, delete the `reply@` rule as the Rollback section says and tell the owner at once.

16. **Clean up.** Complete by hand, in the app, every open task whose title starts with `smoke-<short>` in `todz-perf`; the performance cleanup never touches them. If step 14's report printed `open tasks left` above 0, complete that run's own tasks, which are named `todz-perf <run> #<slot>`, with the `<run>` identifier it printed:

    ```bash
    pnpm perf production --cleanup <run>
    ```

    With the owner's explicit OK, remove the join row of step 12 through the wrapper:

    ```bash
    scripts/todz-cloudflare.sh pnpm --filter @todz/api exec wrangler d1 execute todz-directory --remote --command "DELETE FROM waitlist WHERE address = '<joined>'"
    ```

    Expected: every `smoke-<short>` task is done; `open tasks left: 0` for the performance run; the join row is gone only if the owner said so; no key of the walk is left in the app's key screen or the Keychain.
    If it fails: a task that does not complete from the app is completed by hand; a key left over is revoked in the app. Never complete a task without these prefixes, and never delete a row but the one address of step 12.

17. **Record the run.** Add one row per step above to the run log, with the date, the commit and the actual result, in a pull request on `docs/`.
    Expected: every row names the real answer (status lines, counts, timings), never `ok`, and a skipped conditional step says `not deployed`.
    If it fails: a step with no answer was not run; run it before recording.

## Run log

| Date | Commit | Step | Actual result |
|------|--------|------|---------------|
