# Docs in eight languages

**Status:** Shipped 2026-11-27
**Tier:** 🟡 (the public documentation site; no server, no schema, no app code)
**Owner approval:** approved by inheritance from [docs/product/README.md](../../product/README.md) (2026-11-23) and the owner's v1.2 order of 2026-11-27, "agora mete uma i18n com lang selector + theme switcher (dark/light) igual do zapbip.. todas as langs suportadas".
**ADRs:** [0119](../../adr/0119-the-docs-speak-eight-languages-one-folder-per-language-under-mintlify-navigation-languages.md)
**Not changing:** the English pages, the theme, colors, logo and Mintlify's own light and dark toggle, the website, the Worker and the Mac app

## Problem

docs.todz.app speaks English only. The owner wants todz in the eight languages of the v1.2 release, and the docs are the surface people read before they install.

## Goals

- Mintlify `navigation.languages` with eight entries: English at the root, then `pt-BR`, `es`, `de`, `fr`, `ja`, `ko`, `zh`, each in its own folder (`pt-br`, `es`, `de`, `fr`, `ja`, `ko`, `zh`).
- Every English page has a twin in every folder, the same five navigation groups with translated names and the same pages in each.
- Commands, code, URLs and tool names stay untranslated: every fenced code block and inline code span of a twin equals the English one.
- Links between pages stay inside the reader's language folder; images are shared.
- The switcher shows the eight native names, a `pt-BR` and a `ja` page open with their translated title, and a browser locale never moves the English root.

## Non-goals

- Translating `llms.txt`, the MCP tool descriptions or the site; other lanes own the site and the app.
- A language per page or per section: a language is complete or absent.

## Design

- `apps/docs/docs.json` moves `navigation.groups` under `navigation.languages[]`; the language entries are the codes of the `Language` enum in `libs/types`.
- Seven translator folders hold the twins; the shape tests in `tools/repository-shape` read the English language entry as the source of truth and compare every twin to it.
- A Playwright language spec walks the switcher and two translated titles against `mint dev`.

## Failure handling

- A missing twin, a changed code block, a link out of the folder or a missing group fails the shape tests before the PR opens.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which languages | The eight of the Mac app | The owner's order: all supported languages | 2026-11-27 |
| Translate the code samples | Yes, no | The loop's call: no, commands and code stay exact | 2026-11-27 |

## Test strategy summary

See [test-plan.md](test-plan.md). Shape tests over the folders and `docs.json`, plus a Playwright language spec.
