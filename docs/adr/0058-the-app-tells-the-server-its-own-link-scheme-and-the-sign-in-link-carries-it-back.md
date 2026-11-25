# 0058. The app tells the server its own link scheme, and the sign-in link carries it back

- Status: Accepted (the build loop's call, the owner may overturn it); amends [0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) §3 and §4 and [0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §9
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the security sweep in `todz-loop/PROMPT.md` ("Security" → `security-fixes`), whose first item is that the Debug and the Release app both register `todz://`
- Inspired by: the `security-fixes` plan review of 2026-11-25 (finding R1), [ADR 0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) (the link is bound to the Mac that asked and handed to `todz://`), [ADR 0044](0044-the-wrangler-configuration-is-production-on-api-todz-app-and-development-overrides-it.md) §9 (Debug and Release are separate apps), [ADR 0056](0056-the-app-keeps-its-server-url-as-a-setting-and-switching-it-starts-clean.md) (the server is a runtime setting)

## Context

The Debug and the Release app are separate apps (ADR 0044 §9) but both register `todz://`, and macOS hands a `todz://` link to whichever of them LaunchServices prefers. The sign-in page hands every token to the literal `todz://sign-in?token=…` (`APP_LINK_PREFIX` in `apps/api/src/sign-in-page.ts`), and the widgets build their links from the literal `linkScheme = "todz"` in `WidgetLink.swift`, inside the widget extension, whose `Info.plist` has no URL types. A sign-in link can therefore open the app that never asked for it, which cannot redeem it (ADR 0040 §6: it lacks the verifier) and leaves the owner on a dead click.

Giving each build its own scheme fixes the receiving side. The sending side must then know which scheme to hand the token to. Since ADR 0056 the server is a setting of the app, not of the build: a Release app may point at a local `wrangler dev`, a Debug app at production. The Worker's configuration cannot tell which app asked; only the request can.

## Decision

1. **Two schemes, one per build.** `AppLinkScheme` is an enum on both sides: Release `todz`, Debug `todz-dev`. The project-level build setting `TODZ_URL_SCHEME` names it per configuration, beside `TODZ_APP_GROUP`. The app's `Info.plist` registers it in `CFBundleURLSchemes` and carries it under the custom key `TodzLinkScheme`; the widget extension's `Info.plist` carries the same key and registers nothing. Both read the key through one TodzKit function; a missing or unknown value stops the process like `AppConfiguration`'s missing base URL, never falls back to `todz`.
2. **The app names its scheme when it asks.** `POST /owner/sign-in-links` takes `{email, link_challenge, turnstile_token, app_link_scheme}`. The Worker checks `app_link_scheme` against the enum; a missing or unknown value answers the same 400 `invalid_request` as a malformed address or challenge, before Turnstile, the limiters or the database are touched.
3. **The link carries it back in the fragment.** The mail link is `https://<origin>/sign-in#token=<token>&app=<scheme>`. Like the token, the scheme rides in the fragment, which no request carries (ADR 0040 §4), so nothing is stored for it.
4. **The page re-checks it.** The sign-in page's script reads `app` from the fragment, checks it against the enum's values, which sit in the script as one fixed list so its content-security hash stays one fixed source, and hands the token to `<scheme>://sign-in?token=…&turnstile=…`. A missing or unknown `app` shows the page's missing-link state and navigates nowhere.
5. **Each app accepts only its own scheme.** A sign-in or widget link in the other build's scheme is refused by the parser, not handled.
6. **No server variable names a scheme.** `wrangler.jsonc`, the development scripts and the test bindings stay as they are; a self-hoster's Release app keeps `todz` with nothing to configure.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| The app names its scheme in the request, the link carries it back in the fragment (chosen) | right for any app on any server; no stored state; no server variable | the request body gains a required field, so an app built before it is refused until rebuilt | — |
| A Worker variable `APP_LINK_SCHEME` (`todz` in production, `todz-dev` in development) | one line of configuration; the request is unchanged | wrong whenever the app's build and the server disagree, which ADR 0056 makes ordinary: a Release app on a local Worker would get `todz-dev` and its token would land in the Debug app, a Debug app on production would get `todz`; a new variable in `wrangler.jsonc`, four dev scripts, `SITE_VARIABLES` and the test bindings | binds the link to the server, while ADR 0040 binds it to the app that asked |
| One shared scheme (today) | no change | LaunchServices picks the receiving app; a production link can open the Debug app | the problem this record exists to fix |
| A per-build host or path (`/sign-in/debug`, a second hostname) | the page needs no fragment parameter | the server still has to learn which build asked, so the request changes anyway; a second route or host to deploy, guard and test | more surface for the same information |

## Consequences

- An app built before this change sends no `app_link_scheme`, so its link requests answer 400 `invalid_request` until it is rebuilt. The Release app is rebuilt and reinstalled right after the deploy; the human checklist says so.
- A link mailed by the previous Worker carries no `app=` and lands on the missing-link state; links last 15 minutes, so only the deploy's own window is affected, and the owner asks again.
- Whoever holds a mail link can edit its fragment, but only between the two schemes the page accepts; the token is already theirs, and the verifier still binds the redeem to the Mac that asked (ADR 0040 §6). ADR 0040's residual risk of another app claiming a scheme stays as it was.
- A Debug build installed before this change stays registered with LaunchServices under `todz` until it is unregistered or rebuilt; the human checklist removes every non-Release bundle that still claims `todz` before the Debug/Release check.
- `OwnerAPI`, the tests' sign-in client and the runbook's junk link body gain the field.

## Rollback

Roll the Worker back first, through the runbook's rollback: the previous Worker ignores the unknown `app_link_scheme` field (its body schema strips unknown keys) and reads only `token` from the fragment, so a new Release app still signs in through it, while a Debug app (now `todz-dev`) cannot until the Worker is redeployed. Rolling back the app alone is never done: an app without the field is refused by the new Worker. No migration is involved, so neither direction loses data.

## Evidence

The literal `todz` sits in `APP_LINK_PREFIX` (`apps/api/src/sign-in-page.ts`), in `linkScheme` (`apps/macos/TodzKit/Sources/TodzKit/WidgetLink.swift`) and in `CFBundleURLSchemes: [todz]` for both configurations (`apps/macos/project.yml`). `apps/macos/TodzWidgets/Info.plist` has no `CFBundleURLTypes`, and `WidgetLink.url` runs in `TodayListWidget`, `TodayRingWidget`, `WidgetTaskRow` and `NextUpView`. The sign-in page's content-security policy hashes `PAGE_SCRIPT` once at module load (`turnstilePagePolicy`), so a value per request cannot be interpolated into the script. `RequestBodySchema` in `apps/api/src/sign-in-links.ts` is a plain `z.object`, which strips unknown keys.

## Revisit when

The paid Apple Developer membership allows universal links on a verified domain (ADR 0040's revisit), which replace custom schemes; or a third build kind needs its own scheme.
