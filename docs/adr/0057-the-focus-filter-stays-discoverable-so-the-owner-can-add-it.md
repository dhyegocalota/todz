# 0057. The Focus filter stays discoverable, so the owner can add it in System Settings

- Status: Accepted (the build loop's call, the owner may overturn it)
- Date: 2026-11-25
- Deciders: Claude (the build loop's call, pending the owner); Dhyego Calota (owner) asked for the security sweep in `todz-loop/PROMPT.md` ("Security" → `security-fixes`), which lists this question
- Inspired by: [ADR 0054](0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md) (the todz Focus filter is the only way the app learns Focus); the Focus filter source in `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift`, which declares `SetFocusFilterIntent` and no `isDiscoverable`

## Context

`TodzFocusFilter` is the one way the app learns that a Focus is on. Apple lists an App Intent in System Settings → Focus → Add Filter only when the intent is discoverable. An AppIntent is discoverable unless it says otherwise, and the filter says nothing, so it is listed today. Nothing in the repository marks it hidden. The security sweep asked whether it should be: a filter the owner cannot find is a filter that never quiets anything.

`ToggleTaskIntent` sets `isDiscoverable = false` on purpose, because it is a widget action and not a user-facing shortcut. That choice does not carry over to the Focus filter.

## Decision

The Focus filter stays discoverable. Its declaration keeps the default, so the owner can add "Quiet todz" in System Settings → Focus → Add Filter, and the decision is pinned by a repository-shape test that fails if the filter's file ever sets `isDiscoverable` to `false`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the default (discoverable) | The owner adds the filter in System Settings; no code change beyond the pin | The filter appears in the list for every Focus, which is the intended place for it | Chosen |
| `static let isDiscoverable = false` | Hides the filter from the list | The owner cannot add it, so no Focus can quiet todz; the proactive surfaces stay loud during every Focus | Rejected: it defeats ADR 0054 |
| Hide it and ask the owner to add it through a Shortcut | Keeps the list short | A second, undocumented path for the same filter | Rejected: more surface, same outcome |

## Consequences

- The Focus filter keeps its place in System Settings. No migration, no user-visible change.
- A future change that hides the filter fails `focus-filter.test.ts` in `tools/repository-shape` and must supersede this ADR first.
- The app cannot read the discoverability at runtime. The pin is the source line, which is the only place the decision lives.

## Evidence

- `apps/macos/Todz/FocusFilter/TodzFocusFilter.swift` declares `SetFocusFilterIntent` with no `isDiscoverable`; `apps/macos/TodzWidgets/ToggleTaskIntent.swift` sets `isDiscoverable = false` and is not a Focus filter.
- The owner has not yet confirmed the filter's row in System Settings on the build that ships this change. That check is a human checklist item in the feature spec, not evidence here.

## Revisit when

- Apple's App Intents change the default for `SetFocusFilterIntent`, or the filter stops appearing in System Settings on macOS.
- The owner wants the filter hidden from the list; supersede this ADR with the new decision and update the pin.
