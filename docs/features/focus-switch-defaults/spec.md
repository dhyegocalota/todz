# One Focus switch and new defaults

**Status:** Approved
**Tier:** 🟡 (an app-local switch and the gate's second input, four app defaults flipped, a server migration with a backfill, two server defaults, a public stop link for the day mail)
**Owner approval:** approved 2026-11-25 by the owner's request to the loop, looking at the Settings window: "ao invés de cada feature flag consultar quiet… o ideal seria uma flag somente para respeitar Focus; daí todas as features se adequam… por padrão quero on: pending count, agents mention, morning glance, day temp, close the day às 18h; focus disabled", and later the same day: "deixa on email my day também"; recorded in `todz-loop/PROMPT.md` "One Focus switch and new defaults". The mechanism is the loop's call in [ADR 0068](../../adr/0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md).
**ADRs:** [0068](../../adr/0068-one-respect-focus-switch-decides-for-every-proactive-surface-and-untouched-settings-follow-the-defaults.md), [0054](../../adr/0054-the-app-learns-focus-through-a-todz-focus-filter-not-the-focus-status-api.md), [0053](../../adr/0053-agents-mention-today-s-tasks-in-next-when-the-owner-turns-it-on.md), [0055](../../adr/0055-the-day-closes-once-a-day-in-the-menu-bar-popover-at-the-owner-s-time.md), [0062](../../adr/0062-the-morning-glance-is-a-non-activating-glass-panel-that-shows-today-on-the-first-wake-or-unlock-of-the-day.md), [0065](../../adr/0065-the-day-temperature-steps-the-menu-bar-count-s-opacity-after-noon-and-washes-overdue-widget-rows-by-age-behind-a-setting.md), ADR 0063 (the day email, on `feat/day-email`)
**Not changing:** what each surface does once admitted, the Focus filter's mechanism (ADR 0054 §1), the agent nudge's text, the day mail's content and schedule, the owner JSON's shape, the server URL setting, the widgets' layout

## Problem

Each proactive surface carries its own Focus story in Settings, and every proactive feature is off by default, so a new owner sees none of them. The owner wants one switch for Focus, off by default, and the proactive features on, without overriding what anyone already chose.

## Goals

1. One "Respect Focus" switch, off by default, decides for every proactive surface through `ProactiveGate`: the day close, the morning glance, the day temperature, the menu bar ribbon when it lands, and any later one. Off: no surface is held and the app never reads the Focus filter. On: the ADR 0054 behaviour.
2. Settings mentions Focus only on that row. "Quiet in a Focus." goes from Day temperature. "Open Focus Settings" shows only while the switch is on, as a short helper line under it.
3. Defaults for a new install or account: on for Show pending count, Let agents mention today's tasks, Close the day at 18:00, Morning glance, Day temperature, Email me my day at 07:00 in the owner's time zone; off for Respect Focus.
4. A setting the owner never touched takes the new default, on existing Macs and accounts too; an explicit choice stays.
5. Every day mail carries a one-click opt-out.
6. The server part is deployed.

## Non-goals

- Gating the agent nudge or the day email by Focus (ADR 0054 §5; the mail is not an app surface).
- A per-surface Focus override.
- Telling an off chosen before migration 0009 from the old default on the server (ADR 0068, Consequences).
- Building the menu bar ribbon; it only has to go through the gate when it lands.
- Rebuilding the owner's Release app (todz-6f does it after the merge).

## Design

Screens and copy: [design.md](design.md).

### Data flow

```
App (per Mac)
  Settings toggles ──@AppStorage writes only on a flip──▶ persistent domain (key present = chosen)
  Preference.isOn: stored Bool if present, else the type's default (true; RespectFocus false)
  RespectFocusPreference ──AppDelegate observes defaults──▶ gate.setRespectsFocus(Bool)
  TodzFocusFilter.perform() ────────────────────────────▶ gate.setQuiet(Bool)          (recorded always)
  launch / switch turned on ── read TodzFocusFilter.current (3 s timeout) ──▶ gate.applyLaunchRead  (only when on)
  gate.isQuiet = respectsFocus && filterQuiet ──▶ day close, morning glance, day temperature, later surfaces

Server (per account)
  sign-in, new owner ── INSERT owners (agent_nudge = AGENT_NUDGE_BY_DEFAULT, day_email = DAY_EMAIL_BY_DEFAULT)
  PATCH /owner {agent_nudge | day_email} ── stores the value and stamps <flag>_chosen_at = now
  migration 0009 ── stamp rows already on, then flag = 1 where <flag>_chosen_at IS NULL
  day mail ── mints a stop secret (digest in day_email_stop_links, 30 days) ── List-Unsubscribe + footer link
  GET  /day-email/stop?token=…  ── a page with one button, nothing stored
  POST /day-email/stop?token=…  ── day_email = 0, day_email_chosen_at = now, reply addresses deleted
```

### Interfaces

- **App, TodzKit:** `RespectFocusPreference` (`isOnStorageKey = "respectsFocus"`, `isOnByDefault = false`, `registerDefaults(in:)`, `isOn`). `DayClosePreference.isOnByDefault`, `MorningGlancePreference.isOnByDefault`, `DayTemperaturePreference.isOnByDefault` become `true`, and each `isOn` reads the stored Bool when present and `isOnByDefault` when absent. `ProactiveGate.setRespectsFocus(_:)` and an `isRespectingFocus` read; `isQuiet` stays the one public answer.
- **App, Todz:** `AppDelegate` reads Respect Focus at launch and on defaults changes (`AppDelegate+FocusSwitch.swift`), reads the filter only when on. `SettingsView` swaps the Focus row for the switch and its helper line. `SettingsCopy`: `respectFocus`, `respectFocusDetail`, `respectFocusHelper`, `openFocusSettings`, `focusQuietNow`; `focusQuiet`, `focusQuietDetail` go; `dayTemperatureDetail` loses its last sentence. `TodzFocusFilter`'s description says it acts while Respect Focus is on.
- **Server:** migration `0009_setting_choices.sql`: `owners.agent_nudge_chosen_at INTEGER`, `owners.day_email_chosen_at INTEGER`, the stamp and the backfill, table `day_email_stop_links (digest TEXT PRIMARY KEY CHECK (length(digest) = 64), owner_id TEXT NOT NULL REFERENCES owners (id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL) STRICT` with indexes on `expires_at` and `owner_id`. `libs/types`: `AGENT_NUDGE_BY_DEFAULT = true`, `DAY_EMAIL_BY_DEFAULT = true`, `DAY_EMAIL_STOP_LINK_LIFETIME_MS = 30 * MILLISECONDS_PER_DAY`. `storeOwnerChanges` takes `now` and stamps the time of each field it is given. `insertOwnerWithIdentity` names both flags. The day mail gains `List-Unsubscribe`, `List-Unsubscribe-Post` and a footer slot `{{stopUrl}}`. A new route module answers `GET` and `POST /day-email/stop` on the API host. The owner JSON is unchanged.

### Failure handling

| Case | Outcome |
|---|---|
| Switch off, a Focus with the todz filter on | every surface shows as if no Focus; `TodzFocusFilter.current` is never read |
| Switch off at launch | launch does not wait for the filter read; the gate is not quiet |
| Switch turned on during a quiet Focus | the filter is read once (3 s timeout); from then on surfaces are held |
| Switch turned off while surfaces are held | each held surface is handed back once, as when a Focus ends |
| The filter read times out after the switch is turned on | the gate is quiet, as at launch today (ADR 0054) |
| A key present with `false` (chosen off) | stays off after the update |
| A key absent | the new default (on) |
| A key present with a non-Bool value | read as absent, so the default applies |
| `PATCH {agent_nudge: false}` on an untouched owner | flag off, `agent_nudge_chosen_at` stamped; the next default change leaves it |
| `PATCH {time_zone}` only | no choice time is stamped |
| `PATCH {day_email: false}` | as today, plus the owner's stop links deleted |
| Stop link `GET` with a live token | a page with one "Stop my day email" button; nothing stored |
| Stop link `POST` with a live token, form body `List-Unsubscribe=One-Click` or empty | `day_email` off, stamped, the owner's reply addresses and stop links deleted; 200 page |
| Stop link with an unknown, expired, reused or malformed token, `GET` or `POST` | 404 page "This link no longer works. Turn the email off in todz Settings."; nothing stored |
| Stop link `POST` with a body over the bound | 413, nothing stored |
| Other methods on the stop path | 405 |
| The migration runs before the Worker deploy | the old Worker reads the backfilled flags; a `PATCH` it serves stores no time |

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is "never touched" told apart? | nullable value; stored-at timestamp; app defaults vs server columns | the loop's call (ADR 0068 §6, §7): an absent key in the app, a null choice time on the server | 2026-11-25 |
| Where does the Respect Focus row sit? | where the Focus row is; last before Server | the loop's call: after the proactive rows, before Server ([design.md](design.md)) | 2026-11-25 |
| Does the day mail need its own opt-out now? | footer text only; one-click link | the loop's call (ADR 0068 §8): one-click, because the mail is on by default | 2026-11-25 |

## Test strategy summary

Red-first, each its own commit: the gate stays open with the switch off whatever the filter says and holds only with both on; turning the switch off releases held surfaces; the launch does not read the filter with the switch off; each preference's default on a fresh domain; untouched versus chosen off for each; the server's new-owner defaults for `agent_nudge` and `day_email`; the choice time stamped by `PATCH` and not by sign-in; migration 0009's stamp and backfill; the stop link's `GET` (no change), `POST` (off and stamped), unknown token and headers. Settings rows checked through computer use with screenshots; the stop link walked in a browser with Playwright MCP against a local stack; production checks after deploy.
