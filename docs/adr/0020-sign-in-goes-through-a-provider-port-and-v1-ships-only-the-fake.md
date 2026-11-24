# 0020. Sign-in goes through a provider port, and v1 ships only the fake

- Status: Proposed; amended by [0040](0040-the-owner-signs-in-with-an-email-link-bound-to-the-mac-that-asked-for-it.md) (§1 the port's input, §3 a deployed Worker may name `email`)
- Date: 2026-11-23
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) may overturn it
- Inspired by: [the v1 product design](../product/README.md) (Calls made without the owner: Sign in with Apple sits behind the sign-in port until the paid Apple Developer membership exists; Stack: a fake provider in development and tests)

## Context

The app signs the owner in with Sign in with Apple, but verifying an Apple identity token needs a Services ID and a key from a paid Apple Developer membership, which waits for publishing. v1 still needs sign-in, sessions and an owner row so every later feature can run against the local API. A fake provider that believes whatever subject it is sent must never answer on a deployed Worker: anyone could sign in as anyone.

## Decision

1. The Worker verifies an identity token through a `SignInProvider` port: `verify(identityToken)` resolves to the provider's stable subject, or `null` when the token is refused. An owner is found or created by `(provider, subject)` in a new `owner_identities` table, so a second provider later adds rows, never columns.
2. v1 ships one adapter, the fake: the identity token is the subject itself, 1 to 64 characters of `A-Z a-z 0-9 . _ -`.
3. The provider is chosen by the `SIGN_IN_PROVIDER` variable. Only `wrangler dev --var SIGN_IN_PROVIDER:fake` (the `dev` script) and the test configuration set it. `wrangler.jsonc` never names it, so a deployed Worker has no provider and `POST /owner/sessions` answers 503 `sign_in_unavailable`.
4. The Apple adapter (JWKS fetch, `iss`, `aud`, `exp` and nonce checks) arrives with publishing, behind the same port, as its own feature.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A port with only the fake, off unless `wrangler dev` sets it (chosen) | no paid account needed; a deploy fails closed | the real adapter is untested until publishing | — |
| Build the Apple adapter now, test it against a fake JWKS | the real path exists early | cannot be proven against Apple without the membership; a half-tested verifier is worse than none | unprovable in v1 |
| Fake provider set in `wrangler.jsonc` `vars` | one config file | a `wrangler deploy` would ship a sign-in that trusts anyone | fails open |
| A wrangler `env.development` block | standard Wrangler feature | bindings are not inherited, so D1 and the Durable Object would be declared twice | duplication for one variable |
| No sign-in, a fixed owner in development | least code | every later feature would be built against a shape that changes | `owner-api` is where the owner appears |

## Consequences

- `owner_identities (provider, subject)` is the only place a provider's identifier is stored; `owners` stays provider-free.
- A deploy before the Apple adapter exists has no way to sign in, which is the intended state.

## Evidence

The `owner-api` tests run with `SIGN_IN_PROVIDER` set to `fake` through the Miniflare bindings, and one test builds a Worker environment without it and expects 503.

## Revisit when

- The paid Apple Developer membership exists and publishing starts.
- A second platform (iPhone, web) needs another provider.
