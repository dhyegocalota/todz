# 0117. The site and its mail speak eight languages, with a URL per language and a cookie before Accept-Language

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's v1.2 order of 2026-11-27: "agora mete uma i18n com lang selector + theme switcher (dark/light) igual do zapbip.. todas as langs suportadas")
- Inspired by: the language handling of the zapbip site (read only), [0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md)

The loop's call: the site speaks English, Portuguese (Brazil), Spanish, German, French, Japanese, Korean and Simplified Chinese. A public page has one URL per language (`/`, `/pt-br/`, `/es/`, …, and the same prefixes for `/cloud-queue`), the path decides the language of a prefixed page and a prefixed page never redirects, so a crawler and a shared link always see the same text. Only `/` and `/cloud-queue` negotiate: a `todz_language` cookie naming another language redirects to its prefix, and with no cookie a visitor who is not a crawler and whose `Accept-Language` best matches another language (q-values honoured, `q=0` refused, Traditional Chinese never taken for Simplified) is redirected once and gets the cookie, so the header decides the first visit only. Pages with no public URL (the admin, the OAuth, sign-in and day-email stop pages) use the cookie of their host, then `Accept-Language`, then English. A mail is sent in the language of the app's `Accept-Language`, of the page that asked for it, or of `owners.language`, a column set at sign-in and refreshed when an authenticated request carries another supported language. `llms.txt`, the MCP surface and the fair-use API messages stay English.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Negotiate on every request at one URL | One URL | Crawlers see one language, shared links change with the reader, caches vary on everything | Search engines and links need a stable URL per language |
| A `?lang=` query | No new routes | Duplicate content, no `hreflang` per path, lost on every link | Weaker for search and for sharing |
| A subdomain per language | Clean separation | Eight hosts, eight certificates, cookies per host | A path prefix does the same with one host |
| The cookie alone, no `Accept-Language` | Predictable | First visit is always English | The reader's browser already says the language |

## Consequences

Every copy module carries eight locales and a completeness test; the mail generator renders each template eight times; the Worker answers `Vary: Cookie, Accept-Language` on `/`.

## Revisit when

A ninth language is wanted (the types make it a compile error in every table), or the first visit redirect hurts a measurable share of visits.
