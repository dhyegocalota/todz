# Owner settings refresh

**Status:** Building
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 as the loop's call under the owner's 2026-11-24 instruction to decide every call (todz-loop/PROMPT.md), from todz-6f's report in STATE.md's v1.1 list
**ADRs:** none
**Not changing:** the server, the owner API, the Settings layout and copy, how a toggle saves, launch and sign-in

## Problem

The app reads the owner's server-side settings (Let agents mention today's tasks, Email me my day and its time) only when it confirms the owner at launch or sign-in. A change made elsewhere (another Mac, a migration such as 0010 turning the agent nudge on, the day mail's stop link) stays invisible in Settings until the app restarts, and a toggle then saves from a stale value.

## Change

- `AppModel.refreshOwnerSettings()` reads the owner with `GET /owner` (never the time-zone `PATCH`) and takes `agentNudge`, `dayEmail` and `dayEmailMinutes` from the answer.
- It runs when the app becomes active and when the Settings window appears.
- It does nothing while signed out or before the owner is confirmed, and starts no second read while one is in flight.
- A setting that is saving when the read starts, or starts saving while it runs, keeps its own value: a read never overwrites a save.
- A failed read keeps every last known value and shows no `notSaved` notice, and an unreachable read marks the app offline as any request does, while a cancelled read never does; an expired session ends as any other request does.
- An answer that arrives after a sign-out or a session change is dropped.

## Test list

- `AppModelTests+OwnerSettingsRefresh.swift`: a confirmed owner takes all three values from `readOwner`; no `updateOwner` call; signed out or unconfirmed makes no call; a second call while one is held makes one read; a save of the nudge (and of the day email) in flight before or during the read keeps the saved value; an unreachable read keeps the values and no `notSaved` notice; an unauthorized read signs out; a sign-out during the read drops the answer.
- The app: `applicationDidBecomeActive` and `SettingsView` call the refresh (the tester's walk).
