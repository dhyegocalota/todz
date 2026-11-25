# Mac install

**Status:** Building
**Tier:** 🟢 (one docs page, two links on the landing; no schema, no new surface)
**Owner approval:** approved 2026-11-25 by the owner's words in `todz-loop/PROMPT.md`, "Installing the Mac app without the App Store": "deixa claro na docs como fazer isso, pq não temos app na App Store.. ou então tem como gerarmos e deixarmos disponível pra download? de forma segura e verificada é claro"
**ADRs:** none
**Not changing:** the build, the signing, the app, the release of a download (that is `mac-distribution`), the self-host guide's build step

## Problem

There is no app in the App Store and no download yet, and the docs say only "build it from source" with a pointer into the self-host guide. Nothing says how to open a build on a Mac that did not make it, or how to check what you run.

## Change

- A docs page `install-on-mac`, in "Get started" after Quickstart: build from source with the commands the repository's `macos` gate runs; copy the build to another Mac you own and open it the first time with System Settings › Privacy & Security › Open Anyway; verify it with `codesign -dv --verbose=4` (`TeamIdentifier=XFWR794VS8`) and `shasum -a 256` against the sum published with a release once `mac-distribution` ships, and until then against the sum of the build you made.
- The page says plainly that the build is not notarized yet, until `mac-distribution`.
- The Quickstart's "Get the app" step links the page; the landing's header and footer link it on docs.todz.app; the llms index and the WebMCP docs tool list it.

## Test list

- `apps/api/test/site-pages.test.ts`: the header and footer link the install page (red first).
- `apps/api/test/site-discovery.test.ts`: the llms index lists the page.
- `apps/docs/e2e/pages.spec.ts`: the sidebar and the menu list the six titles.
