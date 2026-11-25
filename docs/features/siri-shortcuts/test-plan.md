# Test plan: Siri shortcuts

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Pinned strings (`design.md` § 8 and § 4), with the seeded workspace `acme`: `Nothing left today in acme.` · `1 left today in acme.` · `3 left today in acme: A, B, and C.` · `7 left today in acme. The first three: A, B, and C.` · `todz is offline, so this is the last synced list.` · `Added “<title>” to Today in acme.` · `Added “<title>” to the Inbox in acme.` · `It syncs when todz is back online.` · `Done: “<title>”.` · `“<title>” is already done.` · `That task is no longer in this workspace.` · `Sign in to todz first.` · `Name your first workspace in todz first.` · `todz is still loading Today. Try again in a moment.` · `A task needs a title.` · `Titles can be up to 200 characters.` · asks `What's the task?` and `Which task?`. Shortcuts: `What's Left Today`, `Add a Task`, `Complete a Task`. Phrases: `What's left today in todz`, `What do I have today in todz`, `Add a task to todz`, `New task in todz`, `Complete a task in todz`, `Check off a task in todz`.

## The failing test first

- [ ] `TaskKeyShortcutTests` and `AppModelTests+ShortcutReads` (the sentence tests included) at Step 1's red commit: `swift build --build-tests`, then `swift test --skip-build --no-parallel --filter <Suite>/<test>` for every test of each suite (a `fatalError` aborts the process, so a suite run whole proves only its first test red) — expected: each exits on `Fatal error: <Type>.<member> is not implemented` and stops on a stub's `<Type>.<member> is not implemented` (`TaskKey.shortcutIdentifier`, `TaskKey.init(shortcutIdentifier:)`, `AppModel.shortcutToday`, `AppModel.shortcutSuggestedTasks`, `AppModel.shortcutTasks(matching:)`, `AppModel.shortcutTasks(for:)`), the texts `tester-briefing.md` records
- [ ] `AppModelTests+ShortcutReadiness` and `AppModelTests+ShortcutWrites` at Step 3's red commit, every test run alone as above — expected: each exits on `Fatal error: ` followed by `AppModel.shortcutReadiness() is not implemented`, `AppModel.addFromShortcut(title:isDueToday:) is not implemented` or `AppModel.completeFromShortcut(key:) is not implemented`, as the briefing records
- [ ] The printed texts match the briefing test for test, each test run alone and serially, since a parallel run can hit a different stub first
- [ ] Step 7's `TodayDigest` commit says `pin` and is not counted as red-first

## Unit

### Identifier

- [ ] Round trip — input: `TaskKey(projectIdentifier: "acme-inbox", number: 12)` — expected: `acme-inbox/12`, and `TaskKey(shortcutIdentifier: "acme-inbox/12")` equals the key
- [ ] A UUID project — input: a `crypto.randomUUID()`-shaped project and number 3 — expected: round-trips
- [ ] The last separator — input: `a/b/3` — expected: project `a/b`, number 3
- [ ] Malformed — input: `abc`, `abc/`, `/3`, `abc/0`, `abc/-1`, `abc/x`, `abc/1.5`, `abc/+3`, `abc/03`, `abc/ 3`, `` — expected: nil for each (`+3`, `03` and ` 3` parse to 3 but do not round-trip)

### The spoken sentence

- [ ] None — input: 0 open — expected: `.nothingLeft`, `spokenTitles` empty
- [ ] One — input: 1 open — expected: `.withTitles`, one title
- [ ] Three — input: 3 open — expected: `.withTitles`, three titles
- [ ] Four — input: 4 open — expected: `.withFirstTitles`, three titles
- [ ] Seven — input: 7 open — expected: `.withFirstTitles`, the first three in Today's order

### Today

- [ ] Loading — input: an unlaunched model — expected: `shortcutToday` nil
- [ ] Signed out — input: launched with no session — expected: nil
- [ ] Empty — input: Today known, nothing open — expected: count 0, no rows, `tasks` empty, `workspaceName` `acme`
- [ ] One — input: one open due today — expected: count 1, one row, one task
- [ ] Five — input: five open — expected: five rows, rest 0, five tasks
- [ ] Seven — input: seven open — expected: five rows in Today's order, rest 2, seven tasks in Today's order
- [ ] Overdue — input: an open task due yesterday — expected: its row `isOverdue` true
- [ ] Pending — input: two open and one pending add due today — expected: count 2, equal to `todayHeadingCount`, the pending title nowhere
- [ ] Offline — input: a cache, then an unreachable pull — expected: `isOffline` true and the cached rows; online it is false

### Reads for the entity

- [ ] Suggestions — input: eleven open Today tasks, two done today, one undated Inbox task — expected: the first ten open in Today's order; no done and no undated task
- [ ] Case — input: `review` against `Review PR`, `Code review`, `Write docs` — expected: the first two
- [ ] Diacritics — input: `revisao` against `Revisão do contrato` — expected: found
- [ ] Emoji — input: `ship` against `🚀 Ship it` — expected: found, its title kept with the emoji
- [ ] Today first — input: `invoice` against an undated Inbox `Invoice Ana` and a Today `Invoice Bob` — expected: `Invoice Bob`, then `Invoice Ana`
- [ ] Capped — input: twelve open titles containing `task` — expected: ten
- [ ] Blank — input: `` and three spaces — expected: none
- [ ] Done never matches — input: `dentist` against a done `Book the dentist` — expected: none
- [ ] Pending never matches — input: `dentist` while `Book the dentist` is a pending add (offline, no number) — expected: none
- [ ] Upcoming after Today — input: `call` against a Today `Call Ana` and a `Call Bob` due tomorrow — expected: `Call Ana`, then `Call Bob`
- [ ] Another workspace never matches — input: `beta` while `acme` is active and `Beta launch` lives in workspace `other` — expected: none
- [ ] By identifier — input: the keys of an open task, a done task, an unknown number and a task of `other`, in that order — expected: the open and the done task, in that order; the other two dropped
- [ ] By identifier while signed out — input: a known key after sign-out — expected: none

### Readiness

- [ ] Ready at once — input: a launched model with Today loaded — expected: `.ready`; no 5 s pause among `pause.durations`
- [ ] Launches — input: a model never launched, a session and a cache, the pull answering — expected: `.ready`, `isOffline` false, the rows are the pulled ones (not the cached ones), and `launch()` has run (the phase left `.loading` from the cache)
- [ ] Cold with a cache, the pull held — input: never launched, a cache, the project pull held — expected: the 5 s pause asked for; on its release `.ready` with `shortcutToday.isOffline` true
- [ ] Signed out — expected: `.signedOut`
- [ ] No workspace — input: signed in, the listing returns none — expected: `.noWorkspace`
- [ ] Still loading — input: a model never launched, no cache, the workspace listing held — expected: the 5 s pause is the one released (waited for with `pause.started(count:)`); on its release, `.loading`; the listing is still held (`launch()` is not awaited)
- [ ] Answered in time — input: the listing held, then answered before the pause is released — expected: `.ready`
- [ ] Signed out while waiting — input: the listing held, then a sign-out — expected: `.signedOut`

### Add

- [ ] Today — input: `Book the dentist`, `isDueToday` true — expected: `.added(title: "Book the dentist", destination: .today, workspaceName: "acme", isOffline: false)`; the outbox holds one add to the Inbox with today's date
- [ ] Inbox — input: `isDueToday` false — expected: `.added(…, destination: .inbox, …)`; the add has no date
- [ ] Selection kept — input: task 3 selected in the window — expected: task 3 still selected after the add
- [ ] Blank — input: `` and three spaces — expected: `.refused(.titleEmpty)`; the outbox unchanged
- [ ] Longest — input: 200 characters — expected: added
- [ ] Too long — input: 201 characters — expected: `.refused(.titleTooLong)`; the outbox unchanged
- [ ] Emoji — input: `🚀 Ship it` — expected: added with the emoji
- [ ] Offline — input: the server unreachable — expected: `isOffline` true; the add in the store's outbox (read back from `InMemorySyncStore`)
- [ ] Signed out — expected: `.signedOut`; nothing queued
- [ ] No workspace — expected: `.noWorkspace`; nothing queued
- [ ] After a switch — input: switch from `acme` to `other`, then add — expected: the add targets `other`'s Inbox and names `other`

### Complete

- [ ] Today — input: an open Today task — expected: `.completed(title:isOffline: false)`; one `.state(key, .done, …)` queued
- [ ] Undated — input: an open undated Inbox task — expected: completed
- [ ] Already done — input: a done task — expected: `.alreadyDone(title:)`; nothing queued
- [ ] Twice — input: the same open key completed twice — expected: `.completed`, then `.alreadyDone`; one change queued
- [ ] Unknown — input: a number that does not exist — expected: `.notFound`
- [ ] Another workspace — input: a key of `other` while `acme` is active — expected: `.notFound`; nothing queued
- [ ] Offline — expected: `isOffline` true; kept in the store's outbox
- [ ] Signed out — expected: `.signedOut`

### The whole package

- [ ] `swift test --package-path apps/macos/TodzKit` — expected: every test passes; the count is the briefing's

## Build

- [ ] Debug and Release — `xcodegen generate`, `xcodebuild build` for each — expected: `BUILD SUCCEEDED`, no `error:`, no `warning:` other than the noise the briefing quotes; `CFBundleDisplayName` is `Todz Dev` in the Debug product and `Todz` in the Release product
- [ ] Metadata — read `Todz.app/Contents/Resources/Metadata.appintents/extract.actionsdata` of the Debug product and of the Release product — expected, in both: actions `LeftTodayIntent`, `AddTaskIntent`, `CompleteTaskIntent`, `TodzFocusFilter`; entity `TodzTaskEntity`; three `autoShortcuts` with the six phrases as `${applicationName}` templates and the short titles and symbols of `design.md`
- [ ] Entitlements — `codesign -dv --entitlements -` on the Debug app — expected: `TeamIdentifier=XFWR794VS8` and the keys `app-sandbox`, `application-groups`, `get-task-allow`, `network.client`, nothing else; on the Release product the same without `get-task-allow`
- [ ] No title in the source's logging — `rg -n "Logger|os_log|print\(" apps/macos/Todz/Shortcuts` — expected: no match

## Prove it for real

Orca (ADR 0026) and the `shortcuts` command line, the Debug build against a local `wrangler dev` with a seeded workspace `acme` (and a second workspace `other`), the app folders backed up with `ditto` and `shasum` listings first and restored after. Writes are read back through the local API (an MCP key for `acme`'s Inbox, `list`) and the app's outbox file.

The owner sees the Shortcuts app only once: a single session that registers the helpers and takes the captures, then quits. Everything else runs headless with `shortcuts run <name> [-i <file>] [-o <file>]`. `shortcuts list` shows only the library, never App Shortcuts (checked on this Mac), so the session adds four library shortcuts that call the actions of the Debug bundle: `todz left` (What's Left Today), `todz add` (Add a Task, Title from the shortcut's input), `todz add inbox` (the same with Due Today off), `todz complete` (Complete a Task, Task from the shortcut's input), plus `todz complete fixed` (Complete a Task with `Book the dentist` picked in the editor). The tester builds them as signed `.shortcut` files in the scratchpad (`shortcuts sign`) and opens each, clicking "Add Shortcut" with Orca. That route rests on three unproven steps (hand-built files naming the Debug bundle's actions, `shortcuts sign` with the Mac signed in to iCloud, and a text input becoming a `TodzTaskEntity`), so the Preflight below runs first and a failure is BLOCKED for the lead, who decides before the session; the headless rows are then not attempted. A shortcut file is never committed. The Debug app is named `Todz Dev`, so its tiles and phrases carry that name (ADR 0066 §10); the helpers name the bundle identifier.

### Preflight

- [ ] One shortcut end to end — input: build `todz left` only, `shortcuts sign -m people-who-know-me`, import it with Orca, `shortcuts run "todz left"` against the running Debug app — expected: exit 0 and the titles. If sign or import fails: BLOCKED, the lead decides before the session, and the headless rows are not attempted

### The single Shortcuts session

- [ ] Registration — input: the Debug app launched once hidden (`open -g -j`), then the Shortcuts app opened — expected: under `Todz Dev`, three tiles in this order: `What's Left Today` (checklist), `Add a Task` (plus), `Complete a Task` (checkmark); capture `.pr-media/siri-shortcuts/design/shortcuts-list.png`
- [ ] A run in the app — input: the `What's Left Today` tile run with seven open, one overdue, one longer than the row — expected: the dialog `7 left today in acme.` and the snippet: heading `Today` with `7 left`, the subtitle `acme`, five rows, the overdue one ending `Overdue`, the long one truncated on one line, `+2 more`; capture `.pr-media/siri-shortcuts/design/left-today-result.png`
- [ ] The complete list — input: the `Complete a Task` tile run — expected: `Which task?` with the seven open Today tasks, each with its project as subtitle; the tester cancels, nothing completes
- [ ] Helpers added — expected: `shortcuts list` prints the five helper names; the Shortcuts app quit, the frontmost app restored to the one before the session and recorded

### Headless runs

- [ ] Happy path, what's left — input: seven open, `shortcuts run "todz left" -o left.txt` — expected: exit 0; the output holds the seven titles in Today's order
- [ ] Happy path, add — input: `-i` a file with `Book the dentist` — expected: exit 0; the output `Book the dentist`; within 30 s the MCP `list` shows it in the Inbox due today; the app's Today shows it (Orca read of the popover is not needed: `todz left` now lists eight)
- [ ] Happy path, complete — input: `-i` a file with `dentist` — expected: exit 0; MCP `list` shows `Book the dentist` done; `todz left` lists seven again
- [ ] Cold run (Step 10a's measure, then the proof) — input: the Debug app quit, then `shortcuts run "todz left"` with a frontmost sampler (`lsappinfo front` every 100 ms) and a window sampler running — expected: the answer arrives within 10 s; the frontmost app never changes; no todz window with a title appears and no Dock icon is recorded; the todz process is running afterwards; no crash report under `~/Library/Logs/DiagnosticReports` named `Todz`; the value of `launchIsDefaultLaunchKey` recorded in ADR 0066 Evidence
- [ ] Cold run, glance on and not yet shown today — input: the morning glance on in Settings and not yet shown today, the Debug app quit, then `todz left` — expected: the glance panel does not appear (ADR 0066 §11); then with the day close on and its time passed, another cold run — expected: no popover opens; both come at the next wake, unlock or scheduled check
- [ ] The main window untouched — input: the main window open on Inbox with task 3 selected (one Orca read before and after), then `todz add` — expected: the same window, Inbox still selected, task 3 still selected, todz not frontmost

### Edge cases, one each

- [ ] Signed out — input: the session file moved to the scratchpad, the app relaunched hidden, each helper run, `todz complete` and `todz complete fixed` included (their refusal comes from the query, before `perform()`) — expected: each exits non-zero and prints `Sign in to todz first.`; MCP `list` unchanged; the session file restored after
- [ ] No workspace — input: a fresh development identity signed in with no workspace (only if the sign-in can be driven without typing; else BLOCKED and covered by the unit test) — expected: `Name your first workspace in todz first.` from each helper
- [ ] Still loading — input: the cache folder moved aside, wrangler stopped, the app quit, `todz left` — expected: between 5 and 8 s after the run starts, then non-zero and `todz is still loading Today. Try again in a moment.`; folders restored after
- [ ] Cold and offline — input: wrangler stopped, the app quit, a synced cache, `todz left` — expected: exit 0 with the cached titles within 10 s (the offline sentence is a dialog: the unit test and the Human checklist prove it)
- [ ] Offline, what's left — input: wrangler stopped with the app running from a synced cache — expected: exit 0, the cached titles (the offline sentence is a dialog: the unit test and the Human checklist prove it)
- [ ] Offline add — input: wrangler stopped, `todz add` with `Call the bank` — expected: exit 0; the outbox file in the app container holds one add; wrangler restarted → within 30 s MCP `list` shows `Call the bank` once (no duplicate)
- [ ] Offline complete — input: wrangler stopped, `todz complete` with `bank` — expected: exit 0; wrangler restarted → MCP `list` shows it done
- [ ] Empty Today — input: every Today task done — expected: `todz left` exit 0 with an empty output; `todz complete` with `anything` completes nothing (MCP `list` unchanged) and its exit and printed text are recorded
- [ ] One task — input: one open — expected: `todz left` prints that one title
- [ ] Many tasks — input: twelve open today — expected: `todz left` prints twelve titles in Today's order
- [ ] Ambiguous complete — input: `Review PR` and `Code review` open, `todz complete` with `review` — expected: neither completes (MCP `list` shows both open); the exit status and printed text recorded (the system cannot ask on the command line). If one completes, that refutes the spec's "nothing completes until one is chosen": a finding for the lead, recorded with which task was completed
- [ ] No match — input: `todz complete` with `zzz` — expected: nothing completes; the exit status and printed text recorded
- [ ] A done task by name — input: `Book the dentist` done, `todz complete` with `dentist` — expected: nothing changes (done tasks never match); recorded
- [ ] A done task by identifier — input: `Book the dentist` completed through MCP `done`, then `todz complete fixed` — expected: exit 0; MCP `list` unchanged; the dialog's `already done` is the unit test's (the command line prints no dialog), the history shows one completion only
- [ ] Workspace switch — input: switch to `other` with one Orca click in the main window's workspace switcher, then `todz left` and `todz add` with `Other task` — expected: `other`'s Today titles; the add lands in `other`'s Inbox (MCP key for `other`'s Inbox), never in `acme`; switch back after
- [ ] A saved task after a switch — input: `other` active, `todz complete fixed` (its task is in `acme`) — expected: non-zero, `That task is no longer in this workspace.`; nothing completes in `acme`
- [ ] Long title — input: `todz add` with 200 characters — expected: exit 0, the 200 characters in MCP `list`; `todz left` prints it whole
- [ ] Too long — input: 201 characters — expected: non-zero, `Titles can be up to 200 characters.`; nothing added
- [ ] Blank — input: an empty input file — expected: non-zero, `A task needs a title.` or the system's own prompt failure, recorded; nothing added
- [ ] Emoji — input: `todz add` with `🚀 Ship it`, then `todz complete` with `ship` — expected: added with the emoji intact in MCP `list`, then completed
- [ ] Diacritics — input: `Revisão do contrato` open, `todz complete` with `revisao` — expected: completed
- [ ] Inbox add — input: `todz add inbox` with `Someday idea` — expected: MCP `list` shows it with no due date; `todz left` does not list it
- [ ] Pending not counted — input: wrangler stopped, `todz add` with `Pending one`, then `todz left` — expected: `Pending one` absent from the output (as the menu bar count); after wrangler restarts and the add is saved, present
- [ ] Titles not logged — input: `log stream --predicate 'process == "Todz"' --level debug` during the happy path — expected: none of the three titles appears in the log

## Human checklist (the owner, on his own Mac, not walked by an agent)

- [ ] Siri is on and set to English (System Settings → Apple Intelligence & Siri); the Release app has launched once from `/Applications`; the Debug build's phrases name `Todz Dev`, so Siri's "todz" reaches the Release app
- [ ] If Siri does not match the phrase, record what it heard (it may transcribe "todz" as another word); an `INAlternativeAppNames` entry is the Revisit (ADR 0066)
- [ ] "What's left today in todz" — expected: Siri speaks the count, the workspace and up to three titles, and shows the snippet
- [ ] "Add a task to todz" — expected: "What's the task?"; the dictated title lands in Today; Siri says `Added “…” to Today in <workspace>.`
- [ ] "Complete a task in todz" — expected: "Which task?" with Today's list; saying part of a title completes it; two matches are offered to choose from
- [ ] Spotlight — typing `todz` offers the three actions, and running What's Left Today answers in place
- [ ] Offline — with Wi-Fi off, "What's left today in todz" ends with `todz is offline, so this is the last synced list.`
- [ ] Focus — with a Focus that has the todz filter on, the three phrases answer as usual
- [ ] VoiceOver — on the snippet, one element `Today, <N> left` with the titles as its value
- [ ] Not wanted — the Shortcuts app or Siri's settings can hide todz's shortcuts

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer picks the three claims most likely to be wrong and tries to refute each.

- [ ] Claim 1: no Shortcut write bypasses the outbox — attack: read every path from `Todz/Shortcuts/` to the service and the App Group; result: <refuted | held>
- [ ] Claim 2: an entity identifier can never act on a task outside the active workspace — attack: craft `<other's project>/<number>` and a malformed identifier through `todz complete fixed` and the unit reads; result: <refuted | held>
- [ ] Claim 3: a cold run never brings todz to the front, opens a window, or raises the glance or the day-close popover — attack: the cold-run samplers, also with the main window left open at the last quit and the glance and day close due; result: <refuted | held>

## Coverage honesty

- Siri's voice, whether it hears "todz", its disambiguation, Spotlight, VoiceOver on the snippet and the Focus row — Siri cannot be driven by an agent on this Mac and key events do not reach apps here (morning-glance walk); the owner's Human checklist.
- The choice of sentence and of the titles to speak is unit-tested in G1; the wording is pinned by design § 8 and checked once in the Shortcuts session; the command line prints the returned value and the thrown refusal, not a dialog.
- The intents, the entity and the provider are App Intents glue with no unit test target; their rules are G1's tests, their wiring is the build, the metadata read and the walk.
- Two registered todz apps (Debug and Release) — told apart by name (`Todz Dev`, ADR 0066 §10), checked by the display-name reads in Build; Siri's own choice is not tested.
- Non-English Siri — not supported; ADR 0066 Revisit.
