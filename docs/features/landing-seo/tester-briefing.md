# Tester briefing: Landing SEO

Written by the developer sub-agents when their steps are done. A developer does not run `test-plan.md` and does not declare the feature works. Each lane writes only its own section.

## Lane H

### What changed

Partial: only steps 2, 4, 6 and 7 are done (the ones disjoint from `security-fixes`' Lane W). Steps 3 and 5 and everything after (8 to 18) are pending the `security-fixes` merge to `main` and the lead's merge of it into `lane/landing-seo-h` (plan → Sequencing 3).

- Step 2 (`43a383a`, red): `apps/api/test/site-head.test.ts`.
- Step 4 (`26fcec2`, red): `apps/api/test/site-json-ld.test.ts`, `libs/types/src/constants.test.ts` (`COMPANY.logo`), and a new `describe` at the end of `apps/api/test/site-pages.test.ts` (hashes, `manifest-src`, `Cache-Control`, no `'unsafe-inline'`, no inline handler).
- Step 6 (`0df5fbf`, red): `tools/repository-shape/src/agent-setup.test.ts` with a stub `apps/api/src/site/agent-setup.ts`.
- Step 7 (`92d1e34`, green): `apps/api/src/site/agent-setup.ts` (`AgentClient`, `agentSetupOf`), and `landing-copy.ts`'s `terminal.command` now comes from it.

### How to run

```bash
pnpm --filter @todz/api exec vitest run test/site-head.test.ts test/site-json-ld.test.ts test/site-pages.test.ts
pnpm --filter @todz/types exec vitest run src/constants.test.ts
pnpm --filter @todz/repository-shape exec vitest run src/agent-setup.test.ts
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-constants.test.ts` (pin) | not red first: the constants have no behaviour to fail; step 1 of G0 | pins every value of `site-urls.ts` and `site-icons.ts` |
| `site-head.test.ts` `canonical link` (both pages) | `AssertionError: expected [] to deeply equal [ { rel: 'canonical', … } ]` | step 3 |
| `site-head.test.ts` `Open Graph and Twitter tags` (both pages) | `AssertionError: expected { 'og:title': [], … } to deeply equal { … }`, every `og:*` array empty | step 3 |
| `site-head.test.ts` `icon links and the manifest link` (both pages) | `AssertionError: expected [] to deeply equal [ { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }, … ]` | step 3 |
| `site-head.test.ts` private pages favicon rows (two) | `AssertionError: expected [] to deeply equal [ '/favicon.ico', '/icon.svg' ]` | step 3 |
| `site-json-ld.test.ts` (eleven rows: parseable block, types, shape table, references, exact values, both pages, plus the organization) | `Error: the page holds exactly one application/ld+json block` (the organization row: `expected …toMatchObject` with no block, the same error) | steps 4 and 5 |
| `site-pages.test.ts` JSON-LD hash (both pages) | `Error: the page has exactly one inline element of that kind` | step 5 |
| `site-pages.test.ts` manifest and cache rows (both pages) | `AssertionError: expected [ 'default-src \'none\'', … ] to include 'manifest-src \'self\''` | step 5 |
| `libs/types/src/constants.test.ts` company row | `AssertionError: expected { tradeName: 'Logic Bit', …(2) } to deeply equal { tradeName: 'Logic Bit', …(3) }` | step 5 (`COMPANY.logo`) |
| `agent-setup.test.ts` three client rows | `Error: agentSetup is not implemented` | `92d1e34` (step 7) |

Pins (green when they landed, never stand in for red-first): `site-head.test.ts` GET/HEAD header parity, title and description, `lang` and the two `theme-color` tags, one `h1` and the four landmarks, `HEAD / carries the headers, not the head`; `site-json-ld.test.ts` the two shape-table self-checks; `site-pages.test.ts` the landing page script hash and the no-`'unsafe-inline'` and no-inline-handler row (admin pages through `/admin` and `/admin/sign-in`); `agent-setup.test.ts` the templates-found row and `LANDING_COPY.terminal.command` equals the Claude Code line.

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. `agentSetupOf` returns, for the three clients, exactly what `AgentCommand.swift` produces for `MCP_URL` and `<key>`; the Codex block is the config followed by a newline and the `export TODZ_API_KEY='<key>'` line; the Cursor JSON is `JSON.stringify` at two spaces.
2. Changing a Swift literal (the server name, the key variable, the Claude Code line) turns `agent-setup.test.ts` red.
3. The landing's terminal line did not change by one character after `landing-copy.ts` took it from `agentSetupOf`.

### Known gaps

- Steps 3, 5 and 8 to 18 are not done: the green for the head, the JSON-LD and the policy waits for `security-fixes` (Sequencing 3). After that merge the red tests above must be rerun and recorded again.
- The plan says eleven Open Graph and Twitter tags; the spec lists ten (nine `og:*` and `twitter:card`). `site-head.test.ts` pins those ten. If the lead wants `twitter:title`, `twitter:description` or `twitter:image`, they are an addition to the spec and to this test.
- The JSON-LD test fixes choices the spec leaves open: the block is `<script type="application/ld+json">` with no other attribute, the offer's `price` is the number `0`, and the `SoftwareApplication` `url` is `https://todz.app/`. The block must contain no `<` at all (every one escaped as `<`).
- The shape table's `required` lists are what the spec's graph carries (Google names no required property for `Organization` and `WebSite`); each row cites schema.org and, where one exists, Google's guide.
- The `no-cache, no-transform` and `manifest-src` rows assert the public pages only; the admin pages keep `no-store`.
- The `site-pages.test.ts` block declares its own constants at the file's end to stay disjoint from Lane W's edits to the imports; a later cleanup may hoist them.

## Lane I

### What changed

- <pending: Lane I>

### How to run

```bash
<pending: Lane I>
```

### Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| <pending: Lane I> |  |  |

### Hypotheses to attack

Every "it works" is a hypothesis the tester tries to break.

1. <pending: Lane I>

### Known gaps

- <pending: Lane I>
