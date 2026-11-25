# Day email — tester briefing

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
