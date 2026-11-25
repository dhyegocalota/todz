# Tester briefing: day-email

## App

**Changed (`apps/macos/`):** `Owner.dayEmail` and `Owner.dayEmailMinutes` (decoded when present, `nil` otherwise); `OwnerService.updateDayEmail(session:isEnabled:)` and `updateDayEmailMinutes(session:minutes:)` on `PATCH /owner` through `DayEmailBody`; `AppModel+DayEmail.swift` (both values, saving, not saved, notice, the two setters with revert); `AgentNudgeNotice` renamed `OwnerSettingNotice`; the Settings row `Email me my day` after Morning glance; `SettingsCopy` shares the offline and signed-out lines (`ownerSettingOffline`, `ownerSettingSignedOut`, `ownerSettingSubtitle(notice:detail:)`); `DayCloseSchedule.minutesPerHour` became public for the row's placeholder time while the value is unknown.

**Run:** `swift test --package-path apps/macos/TodzKit`; in `apps/macos`, `xcodegen generate` then `xcodebuild -project Todz.xcodeproj -scheme Todz -configuration Debug build`. The developer never launched the app.

**Red today and green after** (red commit `2a63e27`, green `b490496`; run serially, a stub's `fatalError` ends the run, so only the first one hit prints):

| Test | Red text as printed | Green |
|---|---|---|
| `OwnerAPITests/readOwnerDecodesTheDayEmail` (`2a63e27`) | `Expectation failed: owner.dayEmail == true` and `Expectation failed: owner.dayEmailMinutes == storedMinutes` | the two coding keys |
| `OwnerAPITests/updateDayEmailPatchesOnlyTheDayEmail` (`2a63e27`) | `OwnerAPI.swift:159: Fatal error: OwnerAPI.updateDayEmail is not implemented` | the PATCH with `{"day_email":true}` |
| `OwnerAPITests/updateDayEmailMinutesPatchesOnlyTheMinutes` (`2a63e27`) | `OwnerAPI.swift:163: Fatal error: OwnerAPI.updateDayEmailMinutes is not implemented` | the PATCH with `{"day_email_minutes":450}` |
| `AppModelTests` day email tests (`2a63e27`) | `AppModel+DayEmail.swift:3: Fatal error: AppModel.canChangeDayEmail is not implemented` | the model states of design 1.1 |

Pins (green when they landed): `OwnerAPITests/readOwnerOfAServerWithoutTheDayEmailLeavesItUnknown`; the agent nudge tests after the rename.

Result at `d9b1768`: `swift test` 996 tests in 75 suites passed; Debug `xcodebuild` BUILD SUCCEEDED.

**Hypotheses for the tester:**
- With the owner answer `day_email: false`, the row shows the switch off and the time dimmed; turning it on sends exactly `{"day_email":true}` and enables the time.
- Changing the time while on sends exactly `{"day_email_minutes":N}`, N the minute of the day in the model's time zone; the picker shows that minute back.
- While a save is in flight both controls are disabled; a failed save (network, 5xx, 400) puts both values back and the subtitle reads "Your change wasn't saved." until the next change or the window closes.
- Offline with known values: both controls disabled, last values shown, subtitle "Can't reach todz. You can change this when it's back."; signed out: off, 07:00, disabled, "Sign in to change this."
- A server that answers no `day_email` leaves the row unknown and disabled.
- The Settings window grows by one row; no test pins its height.

**Gaps:** no UI test drives the row (the recorder captures it, ADR 0026); the 07:00 placeholder of the unknown state lives in `SettingsView` and is not read from the server's default; the picker's VoiceOver label is not asserted.

## Server — reply parsers

Lane `in-pure`. Pure modules only; no handler, no storage, no `Env`.

### What changed

- `apps/api/package.json`, `pnpm-lock.yaml`: `postal-mime` 4.2.1 as a runtime dependency.
- `apps/api/src/day-email/`: `reply-recipient.ts`, `reply-automatic.ts`, `reply-authentication.ts`, `reply-sender.ts`, `reply-title.ts`, and the shared `reply-headers.ts`.
- `libs/types/src/constants.ts`: `REPLY_SECRET_LENGTH`, `REPLY_ADDRESS_DOMAIN`, `REPLY_ATTRIBUTION_ADDRESS`, in their own block at the end of the file.
- Tests in `apps/api/test/day-email/reply-*.test.ts`; helpers in `apps/api/test/fixtures/day-email/raw-message.ts` (raw MIME built with CRLF, parsed by `postal-mime`, so every case runs over its real header list).

### How to run

`pnpm --filter @todz/api exec vitest run test/day-email` (all five files run in the `workers` project).

### Red today, green after

Red commit `0cdc4db` (stubs throwing `<name> is not implemented`), 111 failing tests, texts as printed:

| File | Failure text as printed |
|---|---|
| `reply-recipient.test.ts` | `Error: replySecretOf is not implemented` |
| `reply-automatic.test.ts` | `Error: isAutomaticReply is not implemented` |
| `reply-authentication.test.ts` | `Error: authenticationOf is not implemented` |
| `reply-sender.test.ts` | `Error: senderOf is not implemented` |
| `reply-title.test.ts` | `Error: replyTitleOf is not implemented` |

Green commit `f143fcf`: 111 passing. One expectation was corrected after the first green run, without weakening a refusal: `From: not-an-address` is `address_invalid` (the parser reads it as a mailbox that fails address normalization), not `mailbox_not_single`.

### Hypotheses for the tester

- `replySecretOf`: only `reply+<32 hex>@todz.app` in any case yields the secret, lowercased; any other shape, padding or suffix yields none.
- `isAutomaticReply`: `Auto-Submitted` other than `no` (parameters after `;` ignored), `X-Autoreply`, `X-Autorespond`, and `Precedence` of `bulk`, `junk`, `list`, `auto_reply` in any case are automatic; nothing else is.
- `authenticationOf` passes only when the first `Authentication-Results` header of the message is the only one whose authserv-id is exactly `mx.cloudflare.net` (case-insensitive), has exactly one `dmarc` result that is `pass` with exactly one `header.from`, and some `dkim=pass` has `header.d` equal to that domain. The tokenizer drops comments and keeps quoted strings whole, so a result smuggled in either is never read. `ARC-Authentication-Results` is never read. A result whose first token is not `method=result` refuses the header (`malformed_service_header`). The verdict is an enum, never header text.
- `senderOf` refuses anything but exactly one `From` header (name trimmed and lowercased, so `From :` counts; a folded continuation line is not a header) holding exactly one mailbox on domain D; it returns the normalized address, and the caller compares it with the owner's identity.
- `replyTitleOf` takes `text` from `postal-mime`, stops at the first paragraph whose joined lines contain `noreply@todz.app` or at the first quote, signature or Outlook rule line, takes the first non-blank line above it, collapses whitespace and cuts at `TASK_TITLE_MAX_LENGTH` code points; control characters (except tab), U+2028 and U+2029 give `invalid_title`.

### Gaps

- Cloudflare's real header shape is unproven (Step 9 spike not run); fixtures follow the documented `mx.cloudflare.net` form with `header.from` and `header.d`. Production walk confirms.
- `format=flowed` unwrap is done by `postal-mime` itself per `text/plain` part, not by `replyTitleOf` (a second unwrap would corrupt plain text). Pinned by `reply-title.test.ts` over parsed messages.
- Wide-character cut counts code points, so a ZWJ emoji sequence at the cut can lose its tail.
- Header size is bounded only by the handler's `rawSize` cap (1 MiB); the tokenizer is linear in the header length.
