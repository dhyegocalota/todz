# Tester briefing: The v1 walk

## What changed

- `docs/scenarios/v1-walk.md`: 14 tests, one `- Expect:` each, and edge cases to hunt; listed in `docs/scenarios/README.md`.
- `.agents/skills/scenario/SKILL.md`: a scenario whose `## Setup` says `Surface: macOS app` drives the owner with Orca and each agent with an MCP client (ADR 0037).
- ADR 0037 and its index row.

## Red first

- 469b933 (the scenario file without its index row): `scenarios.test.ts` failed with `"v1-walk: not in the index"`. The same run also printed `"v1-walk: no paths"`, because the front matter's paths were not quoted; the next commit quoted them.
- After the index row and the quoted paths: `Tests 3 passed (3)`.

## How to run

`/scenario v1-walk`, following `## Setup` in the scenario file. Run it after `menu-bar-count` is merged into `main` so T7 and T9 can assert the count. Build the app from `main`.

## Hypotheses for the run

1. The agent's adds appear in the app without a refresh (the project's "changed" socket, `mac-sync`).
2. The key reaches only Launch: the Inbox task is never listed, and a guessed id is "not found".
3. The menu bar count follows each add, completion and revoke.
4. The widget snapshot lists Today's open tasks at mode 600 in `~/Library/Group Containers/XFWR794VS8.dev.todz/`.
5. T14 needs a widget placed on the owner's desktop: BLOCKED without his OK.
