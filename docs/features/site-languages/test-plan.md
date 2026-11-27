# Test plan: Site languages

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `libs/types/src/language.test.ts` and `apps/api/test/site/site-language.test.ts` — input: the suite before any implementation; expected: fails because `Language` and the negotiation do not exist.

## Unit

- [ ] `Language` has exactly `en`, `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`, and `LANGUAGE_PROFILES` has one profile per member with the prefix, html lang, docs folder and Open Graph locale of the decisions table.
- [ ] Edge: `Accept-Language: pt-BR,pt;q=0.9,en;q=0.8` — expected: Portuguese (Brazil).
- [ ] Edge: `Accept-Language: de;q=0, fr;q=0.5` — expected: French, because `q=0` refuses German.
- [ ] Edge: `Accept-Language: zh-TW`, `zh-Hant`, `zh-HK`, `zh-MO` — expected: English, never Simplified Chinese.
- [ ] Edge: `Accept-Language: zh-CN` — expected: Chinese; `Accept-Language: it` and no header — expected: English.
- [ ] Edge: `Accept-Language: en;q=0.5, ja;q=0.9` — expected: Japanese.
- [ ] `GET /` with no cookie and `Accept-Language: ja` — expected: 302 to `/ja/` and a `todz_language=ja` cookie (host-only, `Path=/`, `SameSite=Lax`, one year).
- [ ] `GET /` with `todz_language=es` and `Accept-Language: ja` — expected: 302 to `/es/`; the cookie wins and none is set again.
- [ ] `GET /` with `todz_language=en` and `Accept-Language: ja` — expected: 200 English, no redirect.
- [ ] `GET /` with a crawler user agent (`Googlebot`, `GPTBot`, `ClaudeBot`) and `Accept-Language: ja` — expected: 200 English, no cookie.
- [ ] `GET /` with `Accept: text/markdown` and `Accept-Language: ja` — expected: the English Markdown, no redirect.
- [ ] `GET /` with no cookie and `Accept-Language: en` — expected: 200 English and no `Set-Cookie`.
- [ ] `GET /pt-br/` with `todz_language=ja` and `Accept-Language: ja` — expected: 200 Portuguese, no redirect.
- [ ] `GET /pt-br` — expected: 301 to `/pt-br/`; `GET /cloud-queue?token=x` with `todz_language=de` — expected: 302 to `/de/cloud-queue?token=x`.
- [ ] `GET /` carries `Vary` naming `Cookie` and `Accept-Language`.
- [ ] `POST /language` from another origin — expected: refused (403) and no cookie.
- [ ] `POST /language` with `language=ja&return=/cloud-queue` same-origin — expected: 303 to `/ja/cloud-queue` and the cookie set.
- [ ] Edge: `return` of `https://evil.example/`, `//evil.example`, `/\evil.example` or an unknown path — expected: 303 to the language home of the same host, never off the host.
- [ ] Edge: `language=xx` — expected: 400, no cookie.
- [ ] Every public page of every language carries `<html lang>` of the profile, a canonical of its own URL, eight `hreflang` links and an `x-default` to the English URL, `og:locale` and seven `og:locale:alternate`, and a JSON-LD `inLanguage` of the profile.
- [ ] `sitemap.xml` lists the landing in the eight languages (the token-gated cloud queue page is not listed), each with eight `xhtml:link` alternates and an `x-default`.
- [ ] `POST /theme` with `theme=dark` same-origin — expected: 303 back to `return`, a `todz_theme=dark` cookie; `theme=system` clears the cookie; another origin — expected: 403.
- [ ] A page with `todz_theme=dark` renders `<html data-theme="dark">` and `<meta name="color-scheme" content="dark">`; `light` — `light`; absent — no `data-theme` and `light dark`.
- [ ] The CSP of every page has no `unsafe-inline` and no script or style source beyond hashes.
- [ ] The admin sign-in, the OAuth sign-in, consent and refusal pages, the magic-link page, the cloud queue page and the day-email stop page render in the language of the cookie, then `Accept-Language`, then English, with the selector.
- [ ] The mail language: an app sign-in mail uses the app's `Accept-Language`; an admin or OAuth sign-in mail uses the page's language; the welcome and the day mail use `owners.language`.
- [ ] Migration `0019_owner_language.sql` adds `owners.language` with `en` for every existing owner; an owner whose request carries another supported language is updated once; a value outside the enum is refused on read.
- [ ] Copy completeness, per module: every key exists in every locale, functions return non-empty strings for sample inputs, the owner's name is "Dhyego Calota" in every language, and no leaf equals the English one unless it is on the allowlist of untranslatables.
- [ ] `pnpm --filter @todz/api emails:check` — expected: the generated file is current.

## E2E (Playwright specs)

- [ ] The selector without JavaScript: choose Português (Brasil) — expected: the page is at `/pt-br/` in Portuguese and the cookie is set.
- [ ] The selector with JavaScript — expected: the same.
- [ ] The theme: the first response carries `data-theme` and `color-scheme` for a cookie, and the computed background on first paint matches the theme.
- [ ] The hreflang alternates resolve to pages whose `<html lang>` matches.
- [ ] A browser with `Accept-Language: ja` visiting `/` lands on `/ja/`; a bot user agent stays on `/`.

## Prove it for real — Playwright MCP

- [ ] Walk the landing in English, `pt-BR` and `ja`: selector, theme control and the cloud queue page; expected: no console error and no failed request.
- [ ] Console and network clean: zero console errors, zero failed requests.
- [ ] Desktop width and narrow width: the selector and the theme control fit the header.
- [ ] Screenshots at `.pr-media/`; video at `.pr-media/`

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] `POST /language` and `POST /theme` cannot be used as an open redirect, and a cross-site form post sets no cookie.
- [ ] A cookie value outside the enum is ignored, never echoed into a page or a header.
