# 0118. The theme is a cookie the server renders, so there is no boot script and no flash

- Status: Accepted (the loop's call)
- Date: 2026-11-27
- Deciders: Claude (the build loop's call, under the owner's v1.2 order of 2026-11-27 for a dark and light theme switcher)
- Inspired by: the theme of the zapbip site (read only), [0060](0060-the-landing-describes-itself-from-the-copy-modules-and-offers-webmcp-tools-over-its-own-turnstile-form.md)

The loop's call: the theme is System, Light or Dark, kept in a `todz_theme` cookie (absent means System). The server renders `<html data-theme="light|dark">` (nothing for System) and the matching `<meta name="color-scheme">`, so the first paint is already right with no script at all and the Content Security Policy stays as strict as it is. The stylesheet applies its `prefers-color-scheme` rules only under `:root:not([data-theme])`, plus a `light` and a `dark` block with the same tokens. The control is a three-option form posting to `/theme` (same-origin only, 303 back to `return`), which works with no JavaScript; the page's own hashed script enhances it to apply the choice at once and write the same cookie without a reload. The docs keep Mintlify's own toggle.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| A hashed inline boot script reading `localStorage` | Works on a static page | A script before first paint, one more hash in the policy, a flash when it fails | The server already sees the cookie |
| CSS `prefers-color-scheme` only | No state | No way to choose against the system | The owner asked for a switcher |
| `localStorage` and a class on `<html>` | Familiar | The server cannot render it, so the first paint can be wrong | A cookie reaches the server |

## Consequences

Every page that has the site shell varies on `Cookie`; the page script gains a small handler and its hash changes; the theme choice is per host, like the language.

## Revisit when

The pages are cached at the edge by URL alone, which would need the theme in the cache key.
