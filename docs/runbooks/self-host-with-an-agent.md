# Self-host todz with an agent

A coding agent follows these steps to run a todz server on its owner's Cloudflare account, and stops only to ask for a login, a payment, a secret or the choice of a domain ([ADR 0124](../adr/0124-setup-starts-from-a-one-line-prompt-and-an-agent-readable-runbook-behind-it.md)). The agent never deploys anywhere but that account; the build loop walks this runbook only up to its first login stop. The names and the reasons behind each edit are in the [self-host guide](https://docs.todz.app/self-host.md).

1. **Check the machine.** If you already ran the development setup, skip to step 3. Otherwise run `bash .agents/hooks/doctor.sh` inside a clone of the repository; with no clone, follow [Set up todz for development](set-up-for-development.md) first, through its install step.
   Expected: the doctor ends with `doctor: 0 missing required`, and `gitleaks` reads `ok`.
   If it fails: run the `fix:` command on each missing line after asking the owner, then run the doctor again.

2. **Install and prove the code before renaming.** If you already ran the development setup, skip to step 3. Otherwise run `pnpm install --frozen-lockfile`, then `pnpm verify all`.
   Expected: the gate exits 0. Run it now: after step 5 some tests pin todz's own names and fail until they are updated.
   If it fails: the output names the gate; fix the machine, never skip a gate.

3. **Sign in to Cloudflare.** Run `pnpm --filter @todz/api exec wrangler whoami`.
   Expected: it prints the account's name and its 32-character id.
   If it fails: `You are not authenticated` is a login. Stop and ask the owner to run `! pnpm --filter @todz/api exec wrangler login` in the session and to say when the browser step is done, then repeat this step. With an API token in the environment (`CLOUDFLARE_API_TOKEN`) no login prompt appears and `whoami` prints the account the token belongs to; continue. More than one account listed: stop and ask which one.

4. **Pick the domain.** The server lives on `api.<domain>` and the landing page on `<domain>` and `www.<domain>`, so the domain must be a zone of the account from step 3. List the zones with `curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/zones` (`wrangler` has no command for it). Check a candidate with `curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/<zone id>/dns_records?name=api.<domain>"`, then the same for `<domain>` and `www.<domain>`, reading `result` for a record of type A, AAAA or CNAME.
   Expected: one domain, taken from the owner's message or from the account's only zone, with no A, AAAA or CNAME record on `api`, the bare name or `www`.
   If it fails: with several zones and no choice made, stop and ask the owner which domain. A domain that is not on Cloudflare is not ready; stop and say so.

5. **Rename.** Make the edits of [step 2 of the guide](https://docs.todz.app/self-host.md) in `apps/api/wrangler.jsonc` and set `SENDER_ADDRESS` and `REPLY_TO_ADDRESS` in `apps/api/src/email-sender.ts` to `noreply@<domain>` addresses.
   Expected: `grep -n "todz.app" apps/api/wrangler.jsonc apps/api/src/email-sender.ts` prints nothing, `account_id` holds the id from step 3, and the `TELEMETRY` and `CLOUD_ACCOUNTS_MAX` lines are gone.
   If it fails: a line still naming `todz.app` is a route, an origin or an address left to rename. Never pass `--var` to a deploy and never set a variable in the dashboard.

6. **Create the database.** Run `pnpm --filter @todz/api exec wrangler d1 create todz-directory`, put the printed `database_id` in `d1_databases[0].database_id`, then run `pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote`.
   Expected: the first command prints a UUID and the second lists every migration as applied.
   If it fails: a name already taken means the database exists on the account; read its id with `pnpm --filter @todz/api exec wrangler d1 list` and use it. An error that names a plan or a billing limit is a payment: stop and ask the owner to upgrade the account to Workers Paid, then repeat.

7. **Deploy.** Run `pnpm --filter @todz/api server:deploy` from the git clone.
   Expected: the output ends with `todz server ready: https://api.<domain>`, followed by the server version and the oldest app version it accepts.
   If it fails: a message that names Workers Paid or the email binding is a payment; stop and ask the owner to upgrade, then repeat. A route that conflicts with an existing DNS record means step 4 was wrong; ask the owner to remove that record. Never use a bare `wrangler deploy`.

8. **Check the server.** Run `curl -sS https://api.<domain>/health` and `curl -sS -H "Todz-App-Version: 0.2.4" https://api.<domain>/owner/sign-in-method`.
   Expected: the first answers `{"service":"todz","origin":"https://api.<domain>",...}` with the version step 7 printed; the second answers `{"method":"link"}`. Until step 10, sending a sign-in link answers 503 `sign_in_unavailable`, which is the safe state.
   If it fails: a certificate error right after the deploy settles within minutes, so repeat; any other answer means the deploy did not take the new routes, so read the output of step 7.

9. **Enable email sending.** Run `pnpm --filter @todz/api exec wrangler email sending enable <domain> --zone-id <zone id>` and `pnpm --filter @todz/api exec wrangler email sending dns get <domain> --zone-id <zone id>`, then add the records it lists to the zone.
   Expected: the second command lists the records and each is present on the zone afterwards.
   If it fails: the zone id is on the domain's Overview page of the dashboard. When no tool the agent holds can write DNS records, stop and ask the owner to add the listed records.

10. **Open sign-in.** Sign-in and the admin stay closed until Turnstile is set up. Generate the sign-up key yourself with `openssl rand -hex 32 | pnpm --filter @todz/api exec wrangler secret put SIGN_UP_KEY_SECRET`. Everything else here is the owner's to enter, so stop and ask the owner to create a Turnstile widget for the domain in Managed mode in the dashboard, to give you the site key, and to run `! pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY` and `! pnpm --filter @todz/api exec wrangler secret put ADMIN_EMAIL` themselves, so no secret passes through the conversation. Put the site key in `vars.TURNSTILE_SITE_KEY` of `apps/api/wrangler.jsonc` and run `pnpm --filter @todz/api server:deploy` again.
    Expected: the deploy prints `todz server ready` again and a request for a sign-in link no longer answers `sign_in_unavailable`.
    If it fails: a sign-in that still answers `sign_in_unavailable` names the missing piece, the site key, the Turnstile secret or step 9; fix that one and repeat. Never write a secret into `wrangler.jsonc`, a file or a command line.

11. **Connect an agent and the app.** Run `claude mcp add --transport http todz https://api.<domain>/mcp` for an MCP client, and give the owner the address `https://api.<domain>` to paste in todz › Settings › Server. The Mac app build is [step 7 of the guide](https://docs.todz.app/self-host.md) and needs the owner's Apple team.
    Expected: the owner signs in on the server with their email and an agent lists tools after the browser approval.
    If it fails: an app that says the server is older or newer than it accepts is the version check of `/health`; update the server first, then the app. Report what is left to the owner in one message.
