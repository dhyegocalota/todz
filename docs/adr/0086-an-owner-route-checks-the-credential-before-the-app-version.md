# 0086. An owner route checks the credential before the app version

- Status: Accepted
- Date: 2026-11-26
- Deciders: the build loop's call under the owner's 2026-11-24 instruction to decide every call; Dhyego Calota (owner) may override
- Inspired by: [ADR 0069](0069-the-api-states-its-build-version-and-the-oldest-app-it-accepts-and-the-app-shows-one-compatibility-line.md)'s version gate, and `GET /owner` answering 426 with no credential

## Context

The app-version gate ran first on every `/owner` route, so an unauthenticated `GET /owner` or `GET /owner/workspaces` answered 426, and a client holding a revoked key was told to upgrade instead of to sign in again. Sign-in routes have no credential, and an old app's sign-in request must still be refused before it spends limiter budget.

## Decision

Public routes (sign-in, sign-in method, sign-in link request) keep the version gate first. Every other `/owner` route answers 401 when the bearer secret is missing or unknown, then 426 when the app version is missing or old, then the owner rate limit, then the handler. An unknown path still answers 404 first.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Version gate first on every route (before) | one line, no credential work for an old app | 426 hides 401, leaks the gate to anonymous probes | the bug |
| Credential first on every route, public routes included | one order everywhere | an old app's sign-in link request reaches the limiters and the pre-ADR 0058 body gets a 400 | breaks ADR 0069's refusal |
| Version gate after the owner limiter | an old app spends no extra lookup | an old app drains the owner budget of a valid key | the refusal should cost nothing |

## Consequences

An old app with a valid key costs one credential lookup before its 426. An anonymous request learns nothing about versions.

## Evidence

`apps/api/test/app-version-gate.test.ts`.

## Revisit when

A route takes a credential other than the bearer secret.
