# Self-host todz

Run your own todz server on Cloudflare and point the macOS app and your agents at it. The server is one Worker with a D1 database and one Durable Object per project ([ADR 0044](adr/0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md)).

## What you need

- A Cloudflare account on **Workers Paid** (the email binding needs it) and a domain in that account. Below, `example.com` stands for it and `api.example.com` for the server.
- Node and pnpm, in the versions of `.nvmrc` and `package.json`, and a Mac with Xcode and XcodeGen for the app.
- Wrangler logged in to your account: `pnpm --filter @todz/api exec wrangler login`.

## 1. Fork, install and check

Fork the repository, then, before renaming anything:

```bash
pnpm install
pnpm verify all
```

The gate also needs gitleaks; its doctor names anything missing. Run it now, because some tests pin todz's own production names, for example `tools/repository-shape/src/api-source.test.ts` and `apps/api/test/email-sender.test.ts`. After step 2 those pins fail until you update them to your names.

## 2. Rename

Edit `apps/api/wrangler.jsonc`:

- `account_id`: your account's id.
- `routes`: replace `api.todz.app`, `todz.app` and `www.todz.app` with `api.example.com`, `example.com` and `www.example.com`, keeping `custom_domain` `true`.
- `vars.PUBLIC_ORIGIN`: `https://api.example.com`.
- `vars.SITE_ORIGIN`: `https://example.com`, where the landing page and this guide are served.
- `send_email[0].allowed_sender_addresses`: your sender, for example `noreply@example.com`.
- `ratelimits`: keep the nine bindings, three each for sign-in, the waitlist and the admin; change each `namespace_id` if your account already uses `8601` to `8609`.

Keep the rest as it is. In particular, `vars.SIGN_IN_PROVIDER` stays `email`, `vars.EMAIL_SENDER` stays `cloudflare`, and `workers_dev` and `preview_urls` stay `false`. Never pass `--var` to `wrangler deploy`, and never set variables in the dashboard: a fake provider, or a sender that only logs the link, opens sign-in to anyone.

In `apps/api/src/email-sender.ts`, set `SENDER_ADDRESS` and `REPLY_TO_ADDRESS` to your own addresses.

## 3. Create the database and apply the migrations

```bash
pnpm --filter @todz/api exec wrangler d1 create todz-directory
```

Put the printed id in `d1_databases[0].database_id`, then:

```bash
pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
```

## 4. Deploy

```bash
pnpm --filter @todz/api server:deploy
```

When the deploy succeeds, the script ends with `todz server ready: https://api.example.com  →  paste it in todz › Settings › Server`: that is the URL step 7 uses. Cloudflare creates the DNS records and the certificates for `api.example.com`, `example.com` and `www.example.com`; none of the three may already have an A, AAAA or CNAME record. Check four things:
- `curl -sS https://api.example.com/owner/sign-in-method` answers `{"method":"link"}`;
- `curl -sS https://api.example.com/health` answers `{"service":"todz","origin":"https://api.example.com"}`;
- the account's `todz-api.<subdomain>.workers.dev` address does not answer;
- until step 6 is done, sending a link answers 503 `sign_in_unavailable`, which is the safe state.

## 5. Email sending

Enable sending for your domain and add the records Cloudflare lists. The zone id is on the domain's Overview page in the dashboard.

```bash
pnpm --filter @todz/api exec wrangler email sending enable example.com --zone-id <your zone id>
pnpm --filter @todz/api exec wrangler email sending dns get example.com --zone-id <your zone id>
```

## 6. Turnstile

Sign-in, the waitlist and the admin stay closed (`sign_in_unavailable`, "The waitlist opens soon." and "The admin is closed right now.") until Turnstile is set up ([ADR 0045](adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)). In the Cloudflare dashboard, create a Turnstile widget for `example.com` in Managed mode. Put its site key in `vars.TURNSTILE_SITE_KEY` in `apps/api/wrangler.jsonc`, deploy again with `pnpm --filter @todz/api server:deploy`, and store its secret:

```bash
pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY
```

Wrangler asks for the value, which keeps it out of your shell history. Never pipe it in, never export it, and never write it into `wrangler.jsonc`.

The admin at `https://example.com/admin`, where you read and export the waitlist, signs in only the address you store the same way; until you do, it stays closed:

```bash
pnpm --filter @todz/api exec wrangler secret put ADMIN_EMAIL
```

The same address gets the waitlist digest every day at 11:00 UTC, from the cron in `triggers` in `apps/api/wrangler.jsonc`; without the secret the cron sends nothing and each run fails in the Worker's Cron Events; set `"crons": []` there to turn the digest off.

## 7. Build the macOS app and point it at your server

In `apps/macos/project.yml`:
- in both targets, replace `DEVELOPMENT_TEAM` with your own team's id (Xcode → Settings → Accounts; the free Personal Team works);
- replace `bundleIdPrefix`, the `TODZ_APP_BUNDLE_IDENTIFIER` and `TODZ_WIDGETS_BUNDLE_IDENTIFIER` values and `TODZ_APP_GROUP` with identifiers of your own.

Then build:

```bash
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Release -derivedDataPath apps/macos/build
```

Your Release app opens sign-in links on `todz`, and the server needs no setting for it, because the app names its scheme when it asks for a link ([ADR 0058](adr/0058-the-app-tells-the-server-its-own-link-scheme-and-the-sign-in-link-carries-it-back.md)).

Then open todz › Settings › Server and paste the URL the deploy printed. The app checks it, signs out of the server it was on and starts clean on yours. Sign in with your email, then open **Connect an agent** in the sidebar.

## 8. Point an MCP client at your server

**Connect an agent** shows a ready command with your server and a new key. For Claude Code it has this shape:

```bash
claude mcp add --transport http todz 'https://api.example.com/mcp' --header 'Authorization: Bearer <key>'
```

A key belongs to one project, and the server reads the project from it ([`docs/product`](product/README.md)). The command puts the key in your shell history. Run it with a leading space if your shell skips those, or use the Cursor form, which keeps the key in its JSON configuration.

## Updating

Pull from upstream. Update the server first, then the app: an app newer than its server cannot check the server's address. Run:

```bash
pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
pnpm --filter @todz/api server:deploy
```

Then build the app again as in step 7; it keeps the server you pasted.

Migrations only move forward. Never roll back to a version from before the sign-in guard, whether with `wrangler rollback` or the dashboard's Deployments page. To close sign-in, delete the secret ([the runbook](runbooks/deploy-the-api.md)):

```bash
pnpm --filter @todz/api exec wrangler secret delete TURNSTILE_SECRET_KEY
```
