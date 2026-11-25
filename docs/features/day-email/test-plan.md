# Test plan: Day email

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] Server, the setting (Step 1): the `PATCH /owner` tests — input: `GET /owner` after migration 0008; expected red: the answer lacks `day_email`; failure text as printed: `<record>`
- [ ] Server, `@todz.app` refusal (Step 1): the sign-in link and waitlist tests — input: `x@todz.app`; expected red: a mail is sent; failure text as printed: `<record>`
- [ ] Server, the mail (Step 3): `apps/api/test/day-mail.test.ts` — input: a Today of one task; expected red on the missing `DAY_EMAIL` template; failure text as printed: `<record>`
- [ ] Server, the cron (Step 5): `apps/api/test/day-email-run.test.ts` — input: one due owner at the 10:00 UTC tick; expected red: `runDayEmails is not implemented`; failure text as printed: `<record>`
- [ ] Server, the reply (Steps 10–11): `reply-title`, `reply-authentication`, `reply-sender`, `reply-recipient`, `reply-automatic` and `day-email-reply` tests — expected red: `<name> is not implemented`; failure texts as printed: `<record>`
- [ ] App (Step 17): `OwnerAPITests`, `AppModelTests+DayEmail` — expected red: decode mismatch and `<name> is not implemented`; failure texts as printed: `<record>`
- [ ] Each red commit sits alone before its green commit in `git log` (hashes recorded).

## Spike (Step 9)

- [ ] The first `Authentication-Results` header Cloudflare prepends to a real Gmail reply, shape only: authserv-id, the methods and their results, whether `header.from` and `header.d` are present, recorded in ADR 0064 Evidence.
- [ ] A thrown `email` handler: the Email Routing status (`Error` or other), whether the message was retried (activity log count), and what the sending mailbox received (bounce, delay notice, nothing), recorded in ADR 0064 §7.
- [ ] The temporary rule and the scratch Worker are deleted: the rules listing shows only `hello@`, `support@` and the disabled catch-all; `wrangler deployments list --name todz-spike-email` answers not found.

## Unit

### The setting

- [ ] New owner → `GET /owner` answers `day_email: false`, `day_email_minutes: 420`.
- [ ] `PATCH {day_email: true}` → 200, `day_email: true`; `time_zone`, `agent_nudge`, `day_email_minutes` unchanged.
- [ ] `PATCH {day_email_minutes: 0}` and `{day_email_minutes: 1439}` → 200, stored.
- [ ] `PATCH {day_email_minutes: 1440}`, `-1`, `7.5`, `"07:00"`, `null` → 400 `invalid_request`, nothing stored.
- [ ] `PATCH {day_email: "yes"}`, `1`, `null` → 400 `invalid_request`, nothing stored.
- [ ] `PATCH {}` → 400 `invalid_request`.
- [ ] `PATCH {day_email: false}` → every `day_email_reply_addresses` row of that owner gone; another owner's rows stay.
- [ ] Sign-in of an owner with `day_email` on at 450 → the answer carries `true` and `450`.
- [ ] Owner A's PATCH never changes owner B's row.
- [ ] The columns reject `day_email = 2`, `day_email_minutes = -1` and `1440` at the SQL level.
- [ ] Sign-in link request and waitlist join for `x@todz.app`, `X@TODZ.APP`, `reply+abc@todz.app` → their usual generic answers, no mail sent, no row; `x@todz.app.example` → handled as before.

### The due rule and the run

- [ ] `America/Sao_Paulo`, 07:00: tick 09:45 UTC → no mail, no row; tick 10:00 UTC → one mail, one row with `sent_at`.
- [ ] `America/Sao_Paulo`, 07:10: tick 10:00 UTC → nothing; tick 10:15 UTC → one mail.
- [ ] Catch-up: unclaimed 07:00 owner at tick 12:45 UTC → one mail; at tick 13:00 UTC → none, no row.
- [ ] Chosen 00:00 → one mail at local 00:00; chosen 00:05 → one at the 00:15 tick; the local hour is read as `00`, never `24`.
- [ ] `Asia/Kolkata`, 07:00 → one mail at tick 01:30 UTC.
- [ ] `America/New_York`, 01:30 on 2026-11-01 (the hour repeats) → exactly one mail that local date across all ticks of the day.
- [ ] `America/New_York`, 02:30 on 2027-03-14 (02:00 jumps to 03:00) → one mail at the 03:00 local tick.
- [ ] An owner whose stored zone does not resolve → skipped; other due owners mailed; the run does not reject for it.
- [ ] Chosen 23:00, tick at 01:00 the next local day → nothing for either day.
- [ ] Flag off → nothing; no `email` identity → nothing; two `email` identities → nothing; no workspace → nothing.
- [ ] The same tick run twice in a row → one mail, one row.
- [ ] The same tick run twice concurrently (`Promise.all`) → one mail, one row.
- [ ] Owners are sent one at a time: a fake sender records no two sends in flight together.
- [ ] Sender throws for owner A, B also due → B mailed; A's row `failed_at` set, `failure = 'send_failed'`; the run rejects with `the day email failed for 1 owner`; the message names no id or address.
- [ ] A project read fails → no mail; row `read_failed`; the run rejects.
- [ ] An owner with 101 projects → zero project reads, row `too_many_projects`, the next owner mailed.
- [ ] 51 due owners → 50 mails; the 51st on the next tick.
- [ ] `day_emails` and `day_email_replies` rows older than 30 days and reply addresses past `expires_at` are gone after a tick; newer ones stay.
- [ ] A forged `ScheduledOwner` (an object literal with an owner id) opens no project.
- [ ] No sender configured → nothing claimed; the run rejects naming `email_sender`.
- [ ] The digest cron still sends the digest and no day mail; the `*/15` cron never sends the digest; an unknown cron rejects.
- [ ] The run's summary log line is `{"event":"day_email_run","due":…,"sent":…,"failed":…}` and contains no address or title.

### Today and the mail

- [ ] Open tasks due today and overdue appear; done, upcoming and undated tasks never.
- [ ] Order: workspaces by creation, the Inbox first then projects by creation, tasks in manual order.
- [ ] One workspace → `T-12 Title · Project`; two workspaces → `T-12 Title · Workspace / Project`; overdue → ends ` · overdue`.
- [ ] 21 due → 20 lines then `and 1 more.`; the subject says `Your day: 21 due`.
- [ ] Empty Today → subject `Your day: nothing due`, heading `Nothing due today`, the reply hint, no list.
- [ ] The reply hint reads `Reply from the address you sign in with, in one line, to add it to Today in the Inbox of <workspace>.`
- [ ] Owner B's tasks never appear in owner A's mail.
- [ ] Title `<script>alert(1)</script>` → escaped in the HTML, literal in the text; title `{{link}}` → literal in both.
- [ ] `{{time}}` → `07:00` for 420, `00:00` for 0, `00:05` for 5; `{{workspace}}` → the first workspace's name.
- [ ] The day mail's `replyTo` is `reply+<32 lowercase hex>@todz.app`; its digest is stored with `expires_at` 7 days later; the secret is stored nowhere in D1.
- [ ] The day mail's `headers` are `{"Auto-Submitted":"auto-generated"}`; every other mail (sign-in, welcome, waitlist, admin sign-in, digest) keeps `replyTo: hello@todz.app` and no headers.
- [ ] `pnpm emails:check` passes; the import guard still proves no React reaches `src/`.

### The reply

- [ ] Title extraction: each input of plan Step 10 `reply-title.test.ts` → its expected title, none or `invalid_title`, including the three-line wrapped attribution and the `format=flowed` and `DelSp=yes` cases.
- [ ] Authentication: each header case of plan Step 10 `reply-authentication.test.ts` → pass or refuse as listed, including SPF-only `spf=pass dkim=none dmarc=pass` refused, an unaligned `header.d` refused, a quoted `smtp.mailfrom` and a comment carrying `dmarc=pass` refused, `ARC-Authentication-Results` ignored, `mx.cloudflare.net.evil.test` refused, two dmarc results refused, a missing Cloudflare header refused.
- [ ] Sender: each case of plan Step 10 `reply-sender.test.ts` → the mailbox or refuse, including two From headers in both orders, ` From:`/`From :`, a group, the comment trick and the display-name trick.
- [ ] Recipient: each address of plan Step 10 → the secret or none.
- [ ] Automatic: each header of plan Step 10 `reply-automatic.test.ts` → automatic or not.
- [ ] Happy fixture → one task `Buy milk` in the first workspace's Inbox, due the owner's today, `created_by` owner, one `day_email_replies` row, log `{"event":"day_email_reply","outcome":"added"}`.
- [ ] Each refusal (`unknown_recipient` for shape, unknown and expired secrets; `limited`; `too_large`; `unparseable`; `automatic`; `unauthenticated`; `not_owner` including two `email` identities; `not_a_reply` for another `To` and for two `To` headers; `no_message_id` for none and two; `daily_cap` at the 21st reply in 24 hours; `empty`; `invalid_title`; HTML only; `no_inbox`) → no task, no row, no `setReject`, `forward` or `reply` call, no mail sent, one log line with its outcome (and the verdict enum for `unauthenticated`).
- [ ] Replay: an owner-signed fixture whose `To` is `friend@example.com`, delivered to a valid reply address → `not_a_reply`, no task.
- [ ] 100 stranger messages to random `reply+<hex>@` then the owner's valid reply in the same minute → the owner's task is added.
- [ ] Owner A's reply address with owner B's From and authentication → `not_owner`, nothing in either owner's projects.
- [ ] The same `Message-ID` delivered twice → one task.
- [ ] The project store throws on add → the handler rejects with a message holding no header text; redelivery adds exactly one task.
- [ ] No captured log argument or thrown message contains the sender address, the owner address, the subject, any header's text or the title.

### Shape

- [ ] `triggers.crons` equals `["0 11 * * *", "*/15 * * * *"]` and every `ScheduledCron` value is one of them.
- [ ] `ratelimits` gains exactly one reply limiter, `DAY_EMAIL_REPLY_LIMITER` (8610), with the shared limit and period 60.
- [ ] `observability` equals `{ enabled: true, logs: { invocation_logs: false } }`.
- [ ] `postal-mime` is pinned exactly in `apps/api/package.json`; `pnpm security:audit` prints no high or critical.
- [ ] Budget rows for the cron's reads and the reply's add are in `work-budgets.test.ts` and green, or the box states that `performance` had not landed.

### App

- [ ] `Owner` decodes `day_email`/`day_email_minutes` when present and `nil` when absent.
- [ ] `updateDayEmail(isEnabled: true)` sends exactly `{"day_email":true}`; `updateDayEmailMinutes(minutes: 450)` exactly `{"day_email_minutes":450}`.
- [ ] Every state row of `design.md` § 1.1 has an `AppModel` test with its switch, time and notice.
- [ ] A second change while saving makes no call; a failure reverts both values and sets not saved; signing out mid-save drops the answer.
- [ ] The agent nudge tests pass unchanged with `OwnerSettingNotice`.
- [ ] The row sits after Close the day (and after Morning glance when that row exists); the Settings height test passes.
- [ ] `swift test --package-path apps/macos/TodzKit` green with its count; `xcodebuild` Debug succeeds.

## E2E (Playwright specs)

- [ ] Not applicable: no browser surface changes. The mail previews are checked as rendered HTML files in the walk below.

## Prove it for real

Local stack: `pnpm --filter @todz/api dev:email` (email sign-in, console sender), the Debug app pointed at it (Settings → Server), driven with computer use (ADR 0026). Few, short openings of the app's windows; the popover is not involved.

- [ ] Happy path: sign in by email link; Settings shows "Email me my day" off with 07:00 and the picker dimmed; turn it on → the switch stays on, the picker enables; set 07:15 → `GET /owner` answers `day_email: true`, `day_email_minutes: 435`.
- [ ] Scheduled: `curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*&time=<ms of 07:15 in the Mac's zone>"` → the console prints one `{to, replyTo, text}` line with the Today lines; a second identical call prints nothing.
- [ ] Empty: with no task due, the same call on a new day → the `nothing due` text.
- [ ] Single: one overdue task → one line ending ` · overdue`.
- [ ] Many: 25 due across two workspaces → 20 lines with `Workspace / Project`, then `and 5 more.`
- [ ] Reply: post the happy fixture (Cloudflare's header shaped as the spike recorded) with the printed `replyTo` in its `To` and the signed-in address in its From to `http://localhost:8787/cdn-cgi/handler/email?from=<address>&to=<replyTo>` → the task appears in the app's Today, in the first workspace's Inbox, within the change feed's delay.
- [ ] Rejected input: the same fixture with another From → no task; the dev console shows `not_owner` and no address. With `Auto-Submitted: auto-replied` → `automatic`.
- [ ] Turn the switch off → the reply fixture to the earlier address now logs `unknown_recipient`.
- [ ] Offline: stop the server → the row dims and reads "Can't reach todz. You can change this when it's back."; restart → enabled.
- [ ] Save failed: stop the server mid-change → the switch reverts and the subtitle reads "Your change wasn't saved."
- [ ] Signed out: sign out → the row reads "Sign in to change this.", dimmed.
- [ ] Two sessions: change the time in one, reopen Settings in the other after its owner confirmation → the same time.
- [ ] Local logs: with the production `observability` block, the `wrangler dev` output for one tick and one reply holds no `mailFrom`, `rcptTo`, address or title.
- [ ] Mail previews: `pnpm emails:preview` → `day-email.html` and `day-email-empty.html` in `.pr-media/emails/` look right in light and dark at 600 and 375 px wide (headless Chrome screenshots).
- [ ] Console and network clean: no app error banner; the server log shows no unexpected 4xx or 5xx other than the deliberate ones above.
- [ ] Screenshots at `.pr-media/day-email/` (Settings off, on, offline, failed, signed out, light and dark; both mail previews).

### Production (plan Steps 21–23)

- [ ] Routing: `GET /zones/<zone>/email/routing` answers `support_subaddress: true`; the rules list has `reply@todz.app` → worker `todz-api`, enabled; `hello@` and `support@` unchanged; no spike rule left.
- [ ] The first real send: a `day_emails` row for the owner's date with `sent_at` set and no `failure`; Workers Logs shows the run's summary line; the delivered mail carries `Auto-Submitted: auto-generated` (or the drop is recorded).
- [ ] The first real reply adds exactly one task in the first workspace's Inbox, due today; one `day_email_replies` row.
- [ ] The forged reply (owner's OK) adds nothing and logs `unauthenticated` or `not_owner`.
- [ ] Workers Logs for the run and both replies hold no `rcptTo`, `mailFrom` or address.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

The reviewer and the security reviewer pick the claims most likely to be wrong and try to refute each.

- [ ] Claim 1: only the owner's own mailbox can add a task (a forged From, two From headers, a group, a sender-supplied or ARC `Authentication-Results`, an SPF-only DMARC pass, a leaked reply address, a replayed old signed mail, another owner's address, an auto-reply) — attack: craft each fixture; result: <refuted | held>
- [ ] Claim 2: no owner ever gets two day mails on one local date (overlapping ticks, both DST transitions, a time change after the send) — attack: concurrent runs and a PATCH between ticks; result: <refuted | held>
- [ ] Claim 3: no log line, thrown message or platform log carries an address, a subject, a header's text or a title — attack: grep every `console.*` and `throw` in the diff, run every refusal, read the platform's invocation and Workers Logs with `invocation_logs: false`; result: <refuted | held>
- [ ] Claim 4: the routing extensions never open a project outside the scheduled owner's own listing or the reply owner's first Inbox — attack: read `ScheduledOwner`, `ReplyOwner`, `openReplyInbox` and their callers, forge each brand; result: <refuted | held>
- [ ] Claim 5: strangers cannot make the owner's real reply fail — attack: flood shaped and unshaped addresses, then reply; result: <refuted | held>

## Coverage honesty

- Real Email Routing behaviour (the header Cloudflare actually prepends, subaddressing preserving the detail, delivery to the Worker, a thrown handler's outcome) is proven by the spike and by the owner's one production reply; local runs post fixtures that carry the header themselves.
- Deliverability (spam folders) and how each mail client quotes a reply are not tested beyond the fixtures of English and pt-BR Gmail, `format=flowed` and the Outlook separators.
- Cron timing in production is proven by the first `day_emails` row, not by a test of Cloudflare's scheduler.
- Rate limiting counts per Cloudflare location; the per-owner limit is a local bound and the daily cap the global one.
- The 50-per-tick and 100-projects caps are tested with fakes; real subrequest limits at that scale are not measured.
- The forged-reply production case depends on outbound port 25; when it is blocked, only the display-name variant runs, and that is stated.
