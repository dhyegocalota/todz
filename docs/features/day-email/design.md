# Design: day-email

**Sources:** [the spec](spec.md), [ADR 0063](../../adr/0063-the-day-email-is-claimed-once-a-day-per-owner-from-a-quarter-hour-cron.md), [ADR 0064](../../adr/0064-a-reply-to-the-day-email-adds-one-task-only-from-the-owner-s-own-authenticated-address.md), [the agent nudge design](../agent-nudge/design.md) (§ 1.1 states, § 5 accessibility, O2–O4), [the day close row](../day-close/) (a time and a switch in one `LabeledContent`), and the current code: `SettingsView` (one grouped `Form`: the count switch, the agent nudge switch, Quiet during Focus, Close the day, the server section), `SettingsCopy`, `AgentNudgeNotice`, `AppModel+AgentNudge`, `DayClosePreference.pickerMinutes`, `DayCloseSchedule.instant`/`minutesAfterMidnight`, the mail layout in `apps/api/scripts/emails/` (`EmailLayout`, `email-style.ts`, the digest's `pre-line` list).
**Design system:** unchanged. The Settings row uses system controls; the mail uses the shared layout, its styles and its tokens. No token is added.
**Screenshots:** none taken while designing. The `recorder` captures the built Settings window (computer use, ADR 0026) and the mail previews (`pnpm emails:preview`, light and dark) into `.pr-media/day-email/`.

## 1. Screens and states

Two surfaces: a new Settings row and a new mail. Nothing else in the app changes.

### 1.1 Settings window

```
┌──────────────── todz Settings ──────────────────────┐
│ Show pending count in the menu bar            [●━]  │
│ Let agents mention today's tasks              [━○]  │
│ Quiet during Focus               [Open Focus Settings]│
│ Close the day                       [18:00 ⇅] [━○]  │
│ Email me my day                     [07:00 ⇅] [━○]  │
│ At this time each day, todz mails Today to your     │
│ sign-in address. Reply to add a task.               │
│─────────────────────────────────────────────────────│
│ Server …                                            │
└─────────────────────────────────────────────────────┘
```

- A row in the same section after Close the day, built like it. `morning-glance` inserts its own row after Close the day too; the order is Close the day, Morning glance, Email me my day, and whichever lane merges second keeps that order and updates the Settings height test. The row is `LabeledContent` whose content is an `HStack` of a `.stepperField` `DatePicker` (hour and minute, labels hidden) and a `.switch` `Toggle` (labels hidden); the label is the title and a subtitle `Text` with `lineLimit(subtitleLines, reservesSpace: true)` (option O1).
- Both values are the server's (`Owner.dayEmail`, `Owner.dayEmailMinutes`), held by `AppModel`, never in `@AppStorage`. The picker shows the minutes as a time in the model's time zone, the one the app sends the server, so 07:00 on the picker is 07:00 where the mail is computed.
- The time picker is enabled only when the switch is on and the row can change (option O2).

| State | When | Switch | Time | Subtitle | VoiceOver |
|---|---|---|---|---|---|
| Unknown, signed out | `signedOut` | off, disabled | 07:00, disabled | `ownerSettingSignedOut` | "Email me my day, switch, off, dimmed", then the subtitle |
| Unknown, confirming | signed in, owner not confirmed | off, disabled | 07:00, disabled | `dayEmailDetail` | as above |
| Unknown, offline | offline, no value since launch | off, disabled | 07:00, disabled | `ownerSettingOffline` | as above |
| Offline, known | offline, values seen | last known, disabled | last known, disabled | `ownerSettingOffline` | "…, on, dimmed" |
| Ready, off | confirmed, online, `day_email` false | off, enabled | the stored time, disabled | `dayEmailDetail` | "…, switch, off" |
| Ready, on | confirmed, online, `day_email` true | on, enabled | the stored time, enabled | `dayEmailDetail` | "…, switch, on"; the picker reads "Time to email my day, 07:00" |
| Saving | a `PATCH /owner` with `day_email` or `day_email_minutes` in flight | the new value at once, disabled | the new value at once, disabled | `dayEmailDetail` | no announcement |
| Saved | 200 with the owner | the answer's value | the answer's value | `dayEmailDetail` | nothing extra |
| Save failed | network error, 5xx, 400 (an older server) | the value before the change | the value before the change | `ErrorCopy.changeNotSaved` until the next change or the window closes | the announcement "Your change wasn't saved." |
| Signed out mid-save | the session ends in flight | the answer is dropped; Unknown, signed out | | `ownerSettingSignedOut` | — |

No write is queued offline. A 401 during the save signs out the usual way.

### 1.2 The mail

From `todz <noreply@todz.app>`, reply-to `reply+<secret>@todz.app`, with `Auto-Submitted: auto-generated`, on the shared layout (the lockup on `#0E1020`, the white card, the mint accent), no button.

```
┌──────────────────────── todz ────────────────────────┐
│  3 due today                                          │   heading
│                                                       │
│  T-12 Review the release notes · Inbox · overdue      │   tasks, pre-line
│  T-4 Call the bank · Home                             │
│  T-31 Ship the beta · Work / todz                     │
│  and 2 more.                                          │   muted, only when more
│                                                       │
│  Reply from the address you sign in with, in one      │   reply hint
│  line, to add it to Today in the Inbox of Personal.   │
│ ───────────────────────────────────────────────────── │
│  Sent at 07:00 because Email me my day is on in todz  │   footer
│  Settings. Turn it off there.                         │
└───────────────────────────────────────────────────────┘
```

| Variant | Subject | Heading | Body |
|---|---|---|---|
| With tasks | `Your day: {{count}} due` | `{{count}} due today` | the lines, "and N more." when past 20, the reply hint |
| Empty | `Your day: nothing due` | `Nothing due today` | the reply hint only |

- A line is `T-<n> <title> · <project>`, the project as `<workspace> / <project>` when the owner has more than one workspace, and ` · overdue` at the end of an overdue task. Titles and names are HTML-escaped by the slot filler; the text part carries the same lines.
- `{{workspace}}` is the name of the workspace whose Inbox receives replies (the first by creation); `{{time}}` is the chosen minute as `HH:MM`, 24-hour.

## 2. Components

| Component | Folder | Change |
|---|---|---|
| `SettingsView` | `Todz/Settings` | the row of § 1.1, bound to the model |
| `SettingsCopy` | `Copy` | § 8; the agent nudge's offline and signed-out lines become shared |
| `OwnerSettingNotice` | `TodzKit` | `AgentNudgeNotice` renamed, used by both server-backed rows |
| `AppModel+DayEmail` | `TodzKit` | both values, known, in flight, failed; the two setters with revert |
| `day-email-template.ts`, `day-email-copy.ts` | `apps/api/scripts/emails` | the template of § 1.2 in two variants; copy in § 8 |
| `day-mail.ts` | `apps/api/src/emails` | the values and the message, with the reply-to |

## 3. Tokens

| Use | Token |
|---|---|
| Settings row | the grouped `Form`'s materials; `.primary` title, `.secondary` subtitle; the switch's `Color.accentColor` |
| Mail heading, text, muted line, footer | `HEADING_STYLE`, `PARAGRAPH_STYLE` with `whiteSpace: 'pre-line'` for the tasks (the digest's), `MUTED_STYLE`, the layout's footer |
| Overdue | the word "overdue", never a colour: mail clients drop colours in dark mode and the text part has none |

## 4. Copy

New strings in § 8. Reused: `ErrorCopy.changeNotSaved`. "1 due today" and "3 due today" read alike in singular and plural, so no inflection is needed.

## 5. Interaction and accessibility

- **Keyboard:** Tab reaches the picker and then the switch; a disabled control is skipped; arrows step the picker's field.
- **VoiceOver:** the switch's label is the title and its description the subtitle; the picker's label is `dayEmailTime`. A failed save posts the announcement, as the agent nudge does.
- **Mail:** the heading is an `h1`; the list is text, one task per line, readable by screen readers and in the plain-text part; no image carries meaning; the lockup has its alt text from the layout.
- **Contrast:** the shared layout's, already checked by `email-contrast.test.ts`.

## 6. Options

**O1. Row shape**
- A. Like Close the day: time and switch on one row. Two "at a time" rows read alike.
- B. A switch row plus a separate time row below it. Clearer per control, one more row.
- **Recommendation: A.**

**O2. The time picker while off**
- A. Disabled, showing the stored time. Says what turning it on will do.
- B. Enabled, saved even while off. One more write for nothing visible.
- **Recommendation: A.**

**O3. When a time change is saved**
- A. On every change, the row disabled while the save is in flight. Same model as the switch; a stepper click waits one round trip.
- B. When the Settings window closes. Fewer writes, but a crash or quit loses it and the window has no other deferred save.
- **Recommendation: A.**

**O4. The empty day**
- A. Send "Your day: nothing due" with the reply hint (ADR 0063 §7).
- B. Skip.
- **Recommendation: A.**

## 7. Owner decisions

Empty when written; the lead records each answer here before the plan. The loop takes every recommendation above as its call.

| Option | Answer | Date |
|---|---|---|

## 8. Every new copy string

**SettingsCopy** (`apps/macos/Copy/SettingsCopy.swift`): dayEmail "Email me my day" · dayEmailDetail "At this time each day, todz mails Today to your sign-in address. Reply to add a task." · dayEmailTime "Time to email my day" · ownerSettingOffline "Can't reach todz. You can change this when it's back." (was agentNudgeOffline) · ownerSettingSignedOut "Sign in to change this." (was agentNudgeSignedOut) · `ownerSettingSubtitle(notice:detail:)` replaces `agentNudgeSubtitle(notice:)`.

**DAY_EMAIL_COPY** (`apps/api/scripts/emails/day-email-copy.ts`):

| Key | With tasks | Empty |
|---|---|---|
| subject | `Your day: {{count}} due` | `Your day: nothing due` |
| preview | `{{count}} due today in todz. Reply to add a task.` | `Nothing due today in todz. Reply to add a task.` |
| heading | `{{count}} due today` | `Nothing due today` |
| replyHint | `Reply from the address you sign in with, in one line, to add it to Today in the Inbox of {{workspace}}.` | same |
| footer | `Sent at {{time}} because Email me my day is on in todz Settings. Turn it off there.` | same |

**DAY_MAIL_COPY** (`apps/api/src/emails/day-mail-copy.ts`): moreTasks(count) `and N more.` · overdue ` · overdue` · line separator ` · ` · workspace separator ` / `.
