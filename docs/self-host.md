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
- `routes`: `api.example.com`, keeping `custom_domain` `true`.
- `vars.PUBLIC_ORIGIN`: `https://api.example.com`.
- `send_email[0].allowed_sender_addresses`: your sender, for example `noreply@example.com`.
- `ratelimits`: keep the three bindings; change each `namespace_id` if your account already uses `8601` to `8603`.

Keep the rest as it is. In particular, `vars.SIGN_IN_PROVIDER` stays `email`, `vars.EMAIL_SENDER` stays `cloudflare`, and `workers_dev` and `preview_urls` stay `false`. Never pass `--var` to `wrangler deploy`, and never set variables in the dashboard: a fake provider or a console sender opens sign-in to anyone.

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
pnpm --filter @todz/api exec wrangler deploy
```

Cloudflare creates the DNS record and the certificate for `api.example.com`. Check three things:
- `curl -sS https://api.example.com/owner/sign-in-method` answers `{"method":"link"}`;
- the account's `todz-api.<subdomain>.workers.dev` address does not answer;
- until step 6 is done, sending a link answers 503 `sign_in_unavailable`, which is the safe state.

## 5. Email sending

Enable sending for your domain and add the records Cloudflare lists. The zone id is on the domain's Overview page in the dashboard.

```bash
pnpm --filter @todz/api exec wrangler email sending enable example.com --zone-id <your zone id>
pnpm --filter @todz/api exec wrangler email sending dns get example.com --zone-id <your zone id>
```

## 6. Turnstile

Sign-in stays closed (`sign_in_unavailable`) until Turnstile is set up ([ADR 0045](adr/0045-the-public-sign-in-routes-are-limited-three-ways-and-turnstile-guarded-failing-closed.md)). In the Cloudflare dashboard, create a Turnstile widget for `example.com` in Managed mode. Put its site key in `vars.TURNSTILE_SITE_KEY` in `apps/api/wrangler.jsonc`, deploy again, and store its secret:

```bash
pnpm --filter @todz/api exec wrangler secret put TURNSTILE_SECRET_KEY
```

Wrangler asks for the value, which keeps it out of your shell history. Never pipe it in, never export it, and never write it into `wrangler.jsonc`.

## 7. Point the macOS app at your server

In `apps/macos/project.yml`:
- set the `TODZ_API_BASE_URL` build setting for the Release configuration to `https://api.example.com`;
- in both targets, replace `DEVELOPMENT_TEAM` with your own team's id (Xcode → Settings → Accounts; the free Personal Team works);
- replace `bundleIdPrefix`, the `TODZ_APP_BUNDLE_IDENTIFIER` and `TODZ_WIDGETS_BUNDLE_IDENTIFIER` values and `TODZ_APP_GROUP` with identifiers of your own.

Then build:

```bash
xcodegen generate --spec apps/macos/project.yml
xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Release -derivedDataPath apps/macos/build
```

Sign in with your email, then open **Connect an agent** in the sidebar.

## 8. Point an MCP client at your server

**Connect an agent** shows a ready command with your server and a new key. For Claude Code it has this shape:

```bash
claude mcp add --transport http todz 'https://api.example.com/mcp' --header 'Authorization: Bearer <key>'
```

A key belongs to one project, and the server reads the project from it ([`docs/product`](product/README.md)). The command puts the key in your shell history. Run it with a leading space if your shell skips those, or use the Cursor form, which keeps the key in its JSON configuration.

## Updating

Pull from upstream, then run:

```bash
pnpm --filter @todz/api exec wrangler d1 migrations apply todz-directory --remote
pnpm --filter @todz/api exec wrangler deploy
```

Migrations only move forward. Never roll back to a version from before the sign-in guard, whether with `wrangler rollback` or the dashboard's Deployments page. To close sign-in, delete the secret ([the runbook](runbooks/deploy-the-api.md)):

```bash
pnpm --filter @todz/api exec wrangler secret delete TURNSTILE_SECRET_KEY
```
