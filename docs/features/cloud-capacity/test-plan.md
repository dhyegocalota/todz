# Cloud capacity: test plan

## Unit

- [x] With `CLOUD_ACCOUNTS_MAX` unset a new address gets its link.
- [x] At the cap a refused address gets the same 202 as an admitted one, a full mail naming `/cloud-queue` and the self-host guide, and no link row.
- [x] At the cap an active account's link request still succeeds and is mailed a link.
- [x] At the cap the sign-in itself is refused with `cloud_full` for a new address.
- [x] An account idle for 90 days at the cap is refused; under the cap it signs in.
- [x] The owner of `ADMIN_EMAIL` is never full and is never refused a write at 95%.
- [x] An account seen signed in keeps its spot; the stamp writes once a day and only on the cloud.
- [x] Two sign-ins with one spot left end at the cap; concurrent sign-ins admit exactly one.
- [x] The queue stores an address once and answers alike for a repeat.
- [x] Admit marks the row, mails the invite, and the address passes the cap; an unredeemed admission lapses after 7 days and the address waits again.
- [x] Six link requests in a window answer the same sequence for an active, admitted, admin and refused address and for a new address with room.
- [x] With 49 active and one admitted a stranger is refused (gate and insert) and the invitee signs in to the 50th.
- [x] The queue link is signed and expires: a typed address, a forged or expired token and a missing Turnstile token store nothing; a valid token stores once, also with room.
- [x] An analytics failure (non-200, errors, data null, shape, timeout, network) falls back to the estimate, records and mails the reason, shows it on the admin page, and the first-of-month row and the metrics rollup still happen.
- [x] Durable Object duration reaches 80% before the request pool and is named in the owner mail.
- [x] The read throttle holds through `serveOwner` and `serveMcp`; a normal month adds no per-owner statement; agent keys stamp last seen.
- [x] A meter failure leaves a sent mail sent; a single Admit and a clipped Admit next N with no room show "No free spots."
- [x] Admit next N admits the oldest N, at most the free spots, and the next ask finds none left; an admitted address that signed in is not counted twice.
- [x] The digest mails only when the queue grew, stamps only after a successful send, and reports a join after the run time the next night.
- [x] The guard levels: under 80%, at 80%, at 95% per dimension.
- [x] With the analytics token the totals come from Cloudflare (bearer token, the three datasets); a failing answer or a token reaching no account fails the run; without the token Cloudflare is not asked.
- [x] The 80% email goes once a month and is stamped only after it was sent.
- [x] Every mail the cloud sends is metered; a self-hosted server meters nothing; an address with 10 mails in a day gets no link mail.
- [x] At 95% an account above the average is refused writes with 429 `{ error: "limit_reached", limit: "cloud_capacity", message }`, the message and `Retry-After` to the first of next month (also across the year end); one below keeps writing.
- [x] At 95% a heavy account's reads are throttled, a light one's are not, and without the cap nothing is throttled.
- [x] A malformed `CLOUD_ACCOUNTS_MAX` throws.

## Page

- [x] `/cloud-queue` is a form with a Turnstile widget, a strict policy, `noindex`, the limited-spots copy and the self-host link; it is closed without the Turnstile keys.
- [x] A post queues a new address when full, answers alike when it does not, refuses a cross-site post, a missing token, a malformed or a disposable address.

## Edge cases

- [x] A queued address that is already an account is not queued.
- [x] A disposable address is not queued.
