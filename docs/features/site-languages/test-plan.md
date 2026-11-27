# Test plan: Site languages

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

Evidence key: "unit" is a Vitest file under `apps/api/test/` run in the Workers pool; "e2e" is `apps/api/e2e/site-languages.spec.ts` (desktop and mobile); "walk" is the tester walk of PR #140 (a scripted Playwright walk of the live site, screenshots in the loop scratchpad, `tester-140`); "review" rests on the opus review of the diff, not on a run.

## The failing test first

- [x] `libs/types/src/language.test.ts` and `apps/api/test/site/site-language.test.ts` — input: the suite before any implementation; expected: fails because `Language` and the negotiation do not exist. — evidence: commit `1abdd485` (the tests land before the implementation `654cf00c`; `language.test.ts` is a pin, because `language.ts` already existed in the working tree when it was committed).

## Unit

- [x] `Language` has exactly `en`, `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`, and `LANGUAGE_PROFILES` has one profile per member with the prefix, html lang, docs folder and Open Graph locale of the decisions table. — evidence: unit `libs/types/src/language.test.ts`, 41 passed in `@todz/types`.
- [x] Edge: `Accept-Language: pt-BR,pt;q=0.9,en;q=0.8` — expected: Portuguese (Brazil). — evidence: unit `test/site/site-language.test.ts`.
- [x] Edge: `Accept-Language: de;q=0, fr;q=0.5` — expected: French, because `q=0` refuses German. — evidence: same file.
- [x] Edge: `Accept-Language: zh-TW`, `zh-Hant`, `zh-HK`, `zh-MO` — expected: English, never Simplified Chinese. — evidence: same file; e2e `keeps English for Traditional Chinese`.
- [x] Edge: `Accept-Language: zh-CN` — expected: Chinese; `Accept-Language: it` and no header — expected: English. — evidence: same file.
- [x] Edge: `Accept-Language: en;q=0.5, ja;q=0.9` — expected: Japanese. — evidence: same file.
- [x] `GET /` with no cookie and `Accept-Language: ja` — expected: 302 to `/ja/` and a `todz_language=ja` cookie (host-only, `Path=/`, `SameSite=Lax`, one year). — evidence: unit `test/site-languages.test.ts`; walk item 3 (`ja-JP` first visit, `/` 302 to `/ja/`).
- [x] `GET /` with `todz_language=es` and `Accept-Language: ja` — expected: 302 to `/es/`; the cookie wins and none is set again. — evidence: unit `test/site-languages.test.ts`.
- [x] `GET /` with `todz_language=en` and `Accept-Language: ja` — expected: 200 English, no redirect. — evidence: unit `test/site-languages.test.ts`; walk item 3 (after choosing English `/` stayed English).
- [x] `GET /` with a crawler user agent (`Googlebot`, `GPTBot`, `ClaudeBot`) and `Accept-Language: ja` — expected: 200 English, no cookie. — evidence: unit `test/site-languages.test.ts`; e2e `never redirects a crawler`.
- [x] `GET /` with `Accept: text/markdown` and `Accept-Language: ja` — expected: the English Markdown, no redirect. — evidence: unit `test/site-languages.test.ts`.
- [x] `GET /` with no cookie and `Accept-Language: en` — expected: 200 English and no `Set-Cookie`. — evidence: unit `test/site-languages.test.ts`.
- [x] `GET /pt-br/` with `todz_language=ja` and `Accept-Language: ja` — expected: 200 Portuguese, no redirect. — evidence: unit `test/site-languages.test.ts`.
- [x] `GET /pt-br` — expected: 301 to `/pt-br/`; `GET /cloud-queue?token=x` with `todz_language=de` — expected: 302 to `/de/cloud-queue?token=x`. — evidence: unit `test/site-languages.test.ts`.
- [x] `GET /` and the English `GET /cloud-queue` carry `Vary` naming `Cookie` and `Accept-Language`. — evidence: unit `test/site-languages.test.ts` (the cloud queue case was added after the review).
- [x] `POST /language` from another origin — expected: refused (403) and no cookie. — evidence: unit `test/site-languages.test.ts`.
- [x] `POST /language` with `language=ja&return=/cloud-queue` same-origin — expected: 303 to `/ja/cloud-queue` and the cookie set. — evidence: unit `test/site-languages.test.ts`; e2e selector specs.
- [x] Edge: `return` of `https://evil.example/`, `//evil.example`, `/\evil.example` or an unknown path — expected: 303 to the language home of the same host, never off the host. — evidence: unit `test/site-languages.test.ts` and `test/language-fragment.test.ts`; the tester did not curl these cases, so this rests on the unit run and the review.
- [x] Edge: `language=xx` — expected: 400, no cookie. — evidence: unit `test/site-languages.test.ts`.
- [x] Edge: `return=/ja/#ways` with `language=pt-BR` — expected: 303 to `/pt-br/#ways`; a fragment that is not `#[a-z0-9-]{1,64}` or not an id of the target page is dropped. — evidence: unit `test/language-fragment.test.ts`; e2e `keeps the scroll target when it switches language`.
- [x] Every public page of every language carries `<html lang>` of the profile, a canonical of its own URL, eight `hreflang` links and an `x-default` to the English URL, `og:locale` and seven `og:locale:alternate`, and a JSON-LD `inLanguage` of the profile. — evidence: unit `test/site-languages.test.ts`; e2e `hreflang`; walk item 1 (`<html lang>` en, pt-BR, ja).
- [x] `sitemap.xml` lists the landing in the eight languages (the token-gated cloud queue page is not listed), each with eight `xhtml:link` alternates and an `x-default`. — evidence: unit `test/site-languages.test.ts`.
- [x] `POST /theme` with `theme=dark` same-origin — expected: 303 back to `return`, a `todz_theme=dark` cookie; `theme=system` clears the cookie; another origin — expected: 403. — evidence: unit `test/site-languages.test.ts`.
- [x] A page with `todz_theme=dark` renders `<html data-theme="dark">` and `<meta name="color-scheme" content="dark">`; `light` — `light`; absent — no `data-theme` and `light dark`; the hero dark `<source>` and the `theme-color` metas follow the theme, on the server and in the script. — evidence: unit `test/site-languages.test.ts`; e2e theme specs; walk item 2.
- [x] The CSP of every page has no `unsafe-inline` and no script or style source beyond hashes. — evidence: unit `test/site-languages.test.ts`, `test/private-pages-language.test.ts`; walk item 7 (no CSP violation on any page walked).
- [x] The admin sign-in card, the OAuth sign-in and consent pages and the cloud queue page render in the language of the cookie, then `Accept-Language`, then English, with the selector and theme control; the magic-link pages, the OAuth return, approved, inbox and refusal pages, the app sign-in page, the sign-in challenge page and the day-email stop page take the same language and carry no selector. — evidence: unit `test/private-pages-language.test.ts`, `test/return-targets.test.ts`; walk items 4 and 5.
- [x] Every `return` value the pages render, posted to `/language` and `/theme`, answers 303 to a page of the same host that exists. — evidence: unit `test/return-targets.test.ts`.
- [x] The day-email stop page speaks the owner's stored language, then the cookie, then `Accept-Language`, and the stop token appears nowhere in its HTML. — evidence: unit `test/day-email/day-email-stop.test.ts`.
- [x] The mail language: an app sign-in mail uses the app's `Accept-Language`; an admin or OAuth sign-in mail uses the page's language; the welcome mail uses the language of the new owner's sign-in; the day mail uses `owners.language`. — evidence: unit `test/mail-language.test.ts`, `test/owner-language.test.ts`; walk item 6 (pt-BR admin mail, ja OAuth mail).
- [x] Migration `0019_owner_language.sql` adds `owners.language` with `en` for every existing owner. — evidence: unit `test/migration-0019.test.ts`.
- [x] `owners.language` changes only from a request of an app at version 0.2.9 or later that carries a different supported language; an older app, an app with no version, an absent header and an unsupported header never change it. — evidence: unit `test/owner-language.test.ts`.
- [x] A stored value outside the enum never fails a request, a read of the owner or the day-email batch: that owner's day email is skipped with a logged reason (no address, no title) and the others are sent. — evidence: unit `test/owner-language.test.ts`.
- [x] Copy completeness, per module: every key exists in every locale, every function runs with a proper sample and carries it, no text holds `undefined` or `[object Object]`, the owner's name is whole in every language, every slot survives, every allowlisted path exists and no leaf equals the English one unless it is on its language's allowlist. — evidence: unit `test/copy-completeness.test.ts`; `test/footer-credit.test.ts` for the rendered ja, ko and zh credit.
- [x] `pnpm --filter @todz/api emails:check` — expected: the generated file is current. — evidence: run before the push.

## E2E (Playwright specs)

- [x] The selector without JavaScript: choose Português (Brasil) — expected: the page is at `/pt-br/` in Portuguese and the cookie is set. — evidence: e2e `opens, switches to Português (Brasil) and keeps the choice`.
- [x] The selector with JavaScript — expected: the same, and the scroll target is kept. — evidence: e2e `with JavaScript` group.
- [x] The theme: the first response carries `data-theme` and `color-scheme` for a cookie, and the computed background on first paint matches the theme, with JavaScript off too. — evidence: e2e `the theme` group; walk item 2 (dark cookie on a light OS under 600 ms and 50 KB/s throttling, `theme-throttled-dark-on-light-os.png`).
- [x] The hreflang alternates resolve to pages whose `<html lang>` matches. — evidence: e2e `hreflang`.
- [x] A browser with `Accept-Language: ja` visiting `/` lands on `/ja/`; a bot user agent stays on `/`. — evidence: e2e `the first visit`.

## Prove it for real — Playwright MCP

- [x] Walk the landing in English, `pt-BR` and `ja`: selector, theme control and the cloud queue page; expected: no console error and no failed request. — evidence: walk items 1 and 4 (the only console error is the closed queue's 503 for `/cloud-queue?token=x`, expected).
- [x] Console and network clean: zero console errors, zero failed requests. — evidence: walk item 7.
- [x] Desktop width and narrow width: the selector and the theme control fit the header. — evidence: walk item 1 (375 px header wraps without overflow); e2e mobile project.
- [x] Screenshots at `.pr-media/`; video at `.pr-media/` — evidence: the screenshots are attached to PR #140 through `scripts/pr-media.sh`; no video was recorded.

## Edge cases found during execution

- [x] Switching language from `/ja/#ways` — expected: `/pt-br/#ways` at the same section. Found by the walk: the switch landed at the top. — evidence: unit `test/language-fragment.test.ts`, e2e `keeps the scroll target when it switches language`.
- [x] The language and theme controls on a page that answers a POST or carries a spent token (OAuth return, approved, inbox and refusal pages, the magic-link pages) — expected: absent. Found by the review. — evidence: unit `test/return-targets.test.ts`.
- [x] The terminal demo's mock agent replies stay English in every language — expected: they are the MCP server's real output (ADR 0117), so they stay on the untranslatable list. Found by the walk, decided by the lead. — evidence: unit `test/copy-completeness.test.ts`.

## Adversarial review

- [x] `POST /language` and `POST /theme` cannot be used as an open redirect, and a cross-site form post sets no cookie. — evidence: unit `test/site-languages.test.ts`, `test/language-fragment.test.ts`; review: security CLEAR with reservations, the reservations are the edge cases above.
- [x] A cookie value outside the enum is ignored, never echoed into a page or a header. — evidence: unit `test/site-languages.test.ts`; review.
