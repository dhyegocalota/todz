# Tester briefing: Security fixes

Written by the developer sub-agents when their steps are done. The developers do not run `test-plan.md` and do not declare the feature works. Each lane keeps its own section.

## Lane W

### What changed

- Lane W fills this in.

### How to run

Lane W fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane W fills this in. |  |  |

### Hypotheses to attack

1. Lane W fills this in.

### Known gaps

- Lane W fills this in.

## Lane M

### What changed

- Lane M fills this in.

### How to run

Lane M fills this in.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| Lane M fills this in. |  |  |

### Hypotheses to attack

1. Lane M fills this in.

### Known gaps

- Lane M fills this in.

## Lane T

### What changed

- `scripts/todz-cloudflare.sh` (item 2): curl gets `--globoff`; the path allowlist refuses `[`, `]`, `{`, `}`; the zone case is `"/zones/$zone_id/"?*`, so a bare `/zones/<id>/` is refused. Red `c52189e`, green `5ce6fd1`.
- `tools/repository-shape/src/focus-filter.test.ts` (item 8): pin, `23b4a89`.
- `docs/self-host.md` (step 25): one sentence about the Release app's scheme and ADR 0058, `f81fee7`.
- `docs/learnings/2026-11-25-the-macos-gate-failed-once-on-a-busy-machine-and-did-not-reproduce.md` and its index row (item 9, step 22), `a27c492`.
- Item 9: the flake did not reproduce in five runs, so no gate change was made (steps 20 and 21 not taken).
- Item 10: `pnpm audit` (full) and `pnpm security:audit` both print "No known vulnerabilities found"; no dependency change.

### How to run

- `pnpm test:verify` (runs `verify.test.sh`, `pr-media.test.sh`, `todz-cloudflare.test.sh`).
- `pnpm --filter @todz/repository-shape test:unit` (includes `focus-filter.test.ts`, `self-host.test.ts`, `document-indexes.test.ts`).
- `pnpm audit` and `pnpm security:audit` from the repository root.
- Item 9 commands, from a worktree: `swift test --package-path apps/macos/TodzKit`; `xcodegen generate --spec apps/macos/project.yml`; `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Debug -derivedDataPath apps/macos/build`.

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `scripts/todz-cloudflare.test.sh`, 13 checks red at `c52189e` (red against the real script, not stubs of the script; the curl and Keychain binaries are stubs) | `FAIL curl never expands globs: expected '--globoff' in 'security find-generic-password -s todz-cloudflare -w` / `curl -q -sS -X GET -H @- -H Content-Type: application/json https://api.cloudflare.com/client/v4/user/tokens/verify'`; then for each of `/zones/06490974636c535e2cbfd7c5b09925a5/`, `.../[a-b]` and `.../{a,b}`: `FAIL api exits non-zero for '<path>': expected '1', got '0'`, `api never reaches curl ... expected '0', got '1'`, `api never reads the Keychain ... expected '0', got '1'`, `api says why ... expected 'not on the allowlist' in ''`; ended `todz-cloudflare: 13 check(s) failed` | `5ce6fd1`: `--globoff` in the flags, glob characters refused, `"/zones/$zone_id/"?*`; `todz-cloudflare: all checks passed` |
| `tools/repository-shape/src/focus-filter.test.ts` | pin: green on arrival (`23b4a89`), never red; the Focus filter source has no `isDiscoverable = false` today | stays green while the source stays discoverable |

Item 9 has no red test: the cause was not reproduced, so no case in `verify.test.sh` was written.

### Hypotheses to attack

1. `api GET "/zones/<id>/"`, `api GET "/zones/<id>/[a-b]"` and `api GET "/zones/<id>/{a,b}"` are refused with `not on the allowlist` before the Keychain is read and before curl runs; `api GET "/zones/<id>/x"` and every path the runbook uses still go out, with `--globoff` in curl's arguments.
2. A glob character in the query string of an allowed zone path (for example `?name=[a]`) is also refused; that is intended, and no runbook path uses one.
3. The Focus filter pin fails if `isDiscoverable = false` or `isDiscoverable: Bool = false` is added to `TodzFocusFilter.swift`.
4. `pnpm audit` reports no advisory at any severity today.

### Known gaps

- Item 9 not reproduced in five runs. The runs were incremental (runs two to five reused the first run's `.build` and derived data, finishing in seconds) and ran at load averages 6.3, 10.1, 9.7, 9.4 and 9.4 with the sibling macOS lane building in parallel (a `swift-test` process of the sibling was alive when run one began). 828 tests in 57 suites passed each time. Clean-build and parallel-process contention were not exercised. Logs: `/private/tmp/claude-501/-Users-dhyegocalota-Projects-todz-todz/f8e4245f-9e04-4237-be7a-8e7963144fa4/scratchpad/macos-runs/`.
- `pnpm verify --plan` prints class `product` with gates `doctor format secrets typecheck audit unit e2e macos` for this lane, not the word `all`; `verify-gates.tsv` was not changed.
- `pnpm verify` is red at the `unit` gate on a file this lane does not own: `apps/api/test/site/generated-site.test.ts` fails because step 25 changed `docs/self-host.md` and the generated self-host page (`apps/api/src/site/generated/self-host-html.ts`, from `pnpm --filter @todz/api site:generate`) was not regenerated. The lead or Lane W must regenerate it after merging; the `e2e` and `macos` gates were not reached by `pnpm verify`.
- Step 19 left `apps/macos/build` and `.build` in the lane worktree (git-ignored); `xcodegen` produced no diff in tracked files.
