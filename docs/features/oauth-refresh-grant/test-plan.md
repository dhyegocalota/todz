# OAuth refresh grant: test plan

## Unit

- [x] A spent refresh token presented again 30 seconds after its spend answers a new pair; both access tokens serve `/mcp` and both refresh tokens refresh.
- [x] Two refreshes of one token at once both answer a pair that serves `/mcp`.
- [x] A token honoured again at 30 seconds and presented at 30 seconds and 1 ms answers `invalid_grant` and the grant is gone.
- [x] A spent refresh token presented by another client within the leeway answers `invalid_grant` and the grant stays.
- [x] A grant holding 1,440 spent refresh tokens, a half-hourly client over 30 days, still refreshes.
- [x] Two workspaces each holding an Inbox render the choices `Thrifty Traveler › Inbox` and `Personal › Inbox` on the consent screen.
- [x] A grant reaching 10,000 refresh tokens is revoked.
- [x] A spent token presented after the leeway, and a stolen token rotated twice, still delete the grant.

## End to end

- [x] `oauth.spec.ts`: register, sign in by link, consent, exchange, tools, refresh, revoke.
