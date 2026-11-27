# Site languages

**Status:** Shipped 2026-11-27
**Tier:** 🔴
**Owner approval:** approved by inheritance from [docs/product/README.md](../../product/README.md) (approved 2026-11-23) and the owner's v1.2 order of 2026-11-27: "agora mete uma i18n com lang selector + theme switcher (dark/light) igual do zapbip.. todas as langs suportadas"
**ADRs:** [0117](../../adr/0117-the-site-and-its-mail-speak-eight-languages-with-a-url-per-language-and-a-cookie-before-accept-language.md), [0118](../../adr/0118-the-theme-is-a-cookie-the-server-renders-so-there-is-no-boot-script-and-no-flash.md)
**Not changing:** `apps/docs` and `apps/macos` (sibling lanes), `llms.txt`, `llms-full.txt`, the MCP server card, the WebMCP tools and the MCP tool descriptions, which stay English, and the Content Security Policy, which stays as strict.

## Problem

The website, its private pages and the mails exist in English only, and they follow neither the reader's language nor the reader's theme choice.

## Goals

- One `Language` enum in `libs/types` with eight members (`en`, `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`) and `LANGUAGE_PROFILES` (native name, path prefix, html lang, docs folder, Open Graph locale). A ninth language is a type error in every table.
- One URL per language for the public pages: `/`, `/pt-br/`, `/es/`, `/de/`, `/fr/`, `/ja/`, `/ko/`, `/zh/`, and the same prefixes for `/cloud-queue`. The path decides the language of a prefixed page and never redirects; `/pt-br` answers 301 to `/pt-br/`.
- A first visit to `/` or `/cloud-queue` with no cookie is redirected by `Accept-Language` (q-values honoured, `q=0` refused, `zh-Hant`, `zh-TW`, `zh-HK` and `zh-MO` are not Simplified) and sets the cookie; a cookie naming another language redirects; a crawler is never redirected.
- Every public page carries `hreflang` for the eight languages and `x-default` to the English URL, its own canonical, `og:locale` and its alternates, a localized JSON-LD, and the sitemap lists every language URL with alternates.
- A header selector with each language's native name, a no-JS `POST /language` that is same-origin only and answers 303 to the twin page (an unknown `return` goes to the language home, never off the host), the same selector on the admin sign-in card, the OAuth sign-in and consent pages and the cloud queue page, and none on a page that answers a POST or carries a token (the sign-in, challenge, day-email stop, magic-link and OAuth return, approved, inbox and refusal pages). Every private page takes the cookie, then `Accept-Language`, then English; the stop page takes the owner's stored language first.
- A System, Light and Dark theme cookie rendered by the server (`data-theme` and `color-scheme`), a no-JS `POST /theme` and a segmented control next to the selector on every page that shows the selector.
- Every mail is generated per language and sent in the language of the app's `Accept-Language`, of the page that asked, or of `owners.language` (migration `0019_owner_language.sql`), which only an app at version 0.2.9 or later, the first to send its real language, may change.
- Copy per module in `*-copy-<language>.ts` files assembled into `Record<Language, …>`, with completeness tests on every module.

## Non-goals

- The docs in eight languages and the Mac app's string catalog (sibling lanes, ADR 0119 to 0121).
- Translating `llms.txt`, the MCP tools and their output (the mock agent replies of the landing included), the fair-use API messages, and the cloud capacity warning, fallback and digest mails and the queue invite, which are for the admin or carry no stored language. The admin sign-in mail is translated.

## Design

`site-language.ts` negotiates (cookie, `Accept-Language`, English) and maps a path to its language and back; `language-routes.ts` serves `POST /language`, `POST /theme` and the first-visit redirect; the shell takes a `language` and a `theme` and renders the selector, the hreflang set and the attributes of `<html>`. Each copy module keeps its English object as the type source and assembles `Record<Language, Copy>`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which languages? | Eight, as in zapbip's site without Arabic and Hindi | The loop's call: the eight of the v1.2 order | 2026-11-27 |
| Does the theme need a boot script? | A hashed inline script or a server-rendered attribute | The loop's call: server-rendered, no script ([ADR 0118](../../adr/0118-the-theme-is-a-cookie-the-server-renders-so-there-is-no-boot-script-and-no-flash.md)) | 2026-11-27 |

## Test strategy summary

Unit tests per surface (negotiation, redirects, selector, hreflang, sitemap, theme, mail language, migration, copy completeness), then Playwright for the selector, the theme with no flash and the alternates. The test plan lists every edge case.
