# 0008. Runbooks live in the repository

- Status: Accepted
- Date: 2026-11-23
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the need to follow, step by step, procedures that name resources, routes and secrets which change whenever the configuration changes

## Context

Going live, rotating a secret or recovering a service means following steps in several vendors' consoles and on the owner's machine. The steps name resources and settings that must match the configuration in the repository, so they change whenever that configuration changes. A person or an agent follows them by hand, step by step.

## Decision

1. Runbooks live in `docs/runbooks/`, beside the ADRs and the features. A change to the configuration they describe updates them in the same pull request.
2. They are followed step by step, so they never take the docs lane ([HARNESS section 1](../../.claude/HARNESS.md)). They are reviewed like code.
3. Each runbook opens with one purpose sentence and numbers its steps, and every step ends with an `If it fails:` line.
4. The runbook index lists every runbook, so a missing link fails a test.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `docs/runbooks/` in the repository (chosen) | versioned with the configuration; reviewed in the same pull request; links checked by tests | not visible outside the repository | — |
| A public documentation site | searchable; rendered like product docs | publishes operator steps to every visitor; a second publish step per change | product docs are for people who use the product, not for its operator |
| A wiki or a shared document outside the repository | easy to edit | drifts from the configuration; no review; outside the harness | the drift is the risk this decision removes |

## Consequences

- Every runbook link is a repository-shape test target.
- No runbook exists yet; the first feature that needs one adds it with its index row.

## Evidence

`tools/repository-shape/src/runbooks.test.ts` pins the shape of every runbook and of the index.

## Revisit when

- The product offers self-hosting, so the runbooks have an audience outside the owner.
- A runbook is followed by an agent often enough to deserve a skill instead.
