# Tester briefing: Mac install

## What changed

- `apps/docs/install-on-mac.mdx` — the page: build, open on another Mac, verify, not notarized.
- `apps/docs/docs.json` — the page in "Get started" after Quickstart.
- `apps/docs/quickstart.mdx` — step 1 links the page.
- `apps/docs/e2e/pages.spec.ts` — the sidebar and menu titles are six.
- `apps/api/src/site/site-shell.ts`, `landing-copy.ts`, `site-urls.ts` — a header link ("Install on Mac", "Install" on narrow) and a footer link to the page.
- `apps/api/src/site/discovery-copy.ts` — the page in the llms index and the WebMCP docs tool.

## How to run

```bash
pnpm --filter @todz/api test:unit
pnpm --filter @todz/docs broken-links
pnpm --filter @todz/docs test:walk
pnpm --filter @todz/api test:e2e
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `apps/api/test/site-pages.test.ts::the landing > with the none notice, the header and footer open the guide and the Mac install page on the docs` (commit 690b584) | `expected [ …(2) ] to deeply equal [ …(4) ]`: the install URL was missing twice | the header and footer carry the link |

## Hypotheses to attack

1. Hypothesis: the landing header with three items does not overflow at 375. Break it by: the landing e2e and a 320 wide walk.
2. Hypothesis: the page's build commands are the repo's. Break it by: compare with `scripts/verify.sh` and the self-host guide, then run them.
3. Hypothesis: the `.app` lands at `apps/macos/build/Build/Products/Release/Todz.app`. Break it by: building and listing the folder.
4. Hypothesis: `ditto -c -k --keepParent` keeps the signature, so `codesign -dv` on the unzipped copy shows `TeamIdentifier=XFWR794VS8`. Break it by: unzipping and running it.
5. Hypothesis: the CSP is unchanged because the style and scripts are untouched. Break it by: the site headers test.

## Known gaps

- The Gatekeeper steps follow the documented macOS path and were not run on a second Mac by the developer.
- A development-signed build may need the second Mac to be known to the signing team; the page does not claim it opens on every Mac.
- The page names no release sum yet: none exists before `mac-distribution`.
