# Test plan: Mac install

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [x] `apps/api/test/site-pages.test.ts::the landing > with the none notice, the header and footer open the guide and the Mac install page on the docs` — input: the landing HTML; expected: the nav-link and footer-link hrefs are the self-host guide and `https://docs.todz.app/install-on-mac`, twice — evidence: red commit 690b584 in a throwaway worktree: 4 failed (one per notice, the none notice included), 62 passed
- [x] Confirmed it fails for the right reason: `expected [ …(2) ] to deeply equal [ …(4) ]`, the install URL missing twice — evidence: the run printed exactly that, the install URL missing twice (worktree removed)

## Unit

- [x] `apps/api/test/site-discovery.test.ts` — input: `GET /llms.txt`; expected: the Docs section lists `https://docs.todz.app/install-on-mac` after Quickstart — evidence: head 4650cc92, `pnpm --filter @todz/api test:unit` 76 files, 1919 tests passed; `pnpm typecheck` clean
- [x] `apps/api/test/webmcp-tools.test.ts` — input: the docs tool's `page` enum; expected: it holds `install-on-mac` — evidence: same unit run, 1919 passed

## E2E (Playwright specs)

- [x] `apps/docs/e2e/pages.spec.ts` — steps: open the docs at desktop and narrow; expected: the sidebar and the menu list Introduction, Quickstart, Install on Mac, Connect an agent, MCP tools, Self-host todz — evidence: `pnpm --filter @todz/docs test:walk` 36 passed, 6 skipped by viewport gating (the desktop sidebar test and the narrow menu test both ran)
- [x] `apps/api/e2e/landing.spec.ts` — steps: open the landing at 1280 and 375; expected: the header and footer links fit without sideways scroll — evidence: `pnpm exec playwright test` in apps/api 118 passed, 7 skipped; scripted walk (Playwright MCP browser missing) sideways=0 at 1280, 375 and 320, light and dark

## Docs

- [x] `pnpm --filter @todz/docs broken-links` — expected: no broken links — evidence: `success no broken links found`
- [x] The page renders in `mint dev`: title "Install on Mac", the steps, the notes — evidence: scripted walk: h1 "Install on Mac", 5 code blocks, the Warning and Note callouts, no console errors, desktop and narrow, light and dark; `.pr-media/mac-install-docs/docs-install-{light,dark}-{desktop,narrow}.png`
- [x] Nav entry: "Get started" lists Install on Mac right after Quickstart — evidence: sidebar test, and `.pr-media/mac-install-docs/docs-install-light-desktop.png`
- [x] Quickstart link: step 1 links `/install-on-mac`, and the link opens the page — evidence: scripted walk: the link in the quickstart's content opens `/install-on-mac` with h1 "Install on Mac", desktop and narrow
- [x] Landing link visible and correct: header "Install on Mac" (narrow: "Install") and footer link open `https://docs.todz.app/install-on-mac` — evidence: walk read header "Install on Mac" at 1280 and "Install" at 375, footer "Install on Mac", href `https://docs.todz.app/install-on-mac`, light and dark, no console errors, no 4xx; `.pr-media/mac-install-docs/landing-*.png`
- [x] Command `xcodegen generate --spec apps/macos/project.yml` is the one `scripts/verify.sh` runs — evidence: identical to `scripts/verify.sh` line 160; ran in a throwaway worktree, succeeded
- [x] Command `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Release -derivedDataPath apps/macos/build` is the self-host guide's, and `apps/macos/build/Build/Products/Release/Todz.app` exists after it — evidence: identical to `apps/docs/self-host.mdx` line 100; `BUILD SUCCEEDED`, `Todz.app` listed in that folder
- [x] `codesign -dv --verbose=4` on that app prints `TeamIdentifier=XFWR794VS8` — evidence: the built app and the `ditto -x -k` unzipped copy both print it; zip sha256 6c4872ca…e20c identical after unzip and re-zip
- [x] `shasum -a 256` accepts a file on macOS; the page names the file it hashes — evidence: ran on `Todz.zip`, the file the page names

## Edge cases found during execution

- FAIL: the page's step 3 says of `codesign --verify --deep --strict --verbose=2 /Applications/Todz.app` "No output and no errors means it is". Observed on the unzipped build, exit 0, output: `--prepared:…/Contents/PlugIns/TodzWidgets.appex`, `--validated:…/TodzWidgets.appex`, `…Todz.app: valid on disk`, `…Todz.app: satisfies its Designated Requirement`. Expected per the page: nothing. Without `--verbose=2` the command is silent. Fix the sentence or drop `--verbose=2`; a page-text assertion in the docs shape tests would be the regression test.
- The Playwright MCP browser is not installed (chrome-for-testing missing); the landing and docs walks were scripted throwaway specs with the system Chrome, deleted after the run.
- The lane head moved during the run (7f16ec8c to 4650cc92); the page text was re-read and its commands re-run at 4650cc92's page, unchanged since 7f16ec8c.

## Adversarial review

- [ ] Claim 1: every command on the page runs as written — attack: run each from the repository root; result: REFUTED in part. xcodegen, xcodebuild, ditto, `codesign -dv --verbose=4` and shasum run as written; `codesign --verify --deep --strict --verbose=2` prints four lines where the page promises none (see Edge cases). The page's `/Applications/Todz.app` paths were run against the unzipped copy; `/Applications` was never touched.
- [x] Claim 2: the landing keeps its CSP and its narrow header — attack: the site headers test and the 375 walk; result: holds. Unit run (1919) includes the site headers tests; the 375 and 320 walks show "Install" with no sideways scroll and no console error — evidence: `.pr-media/mac-install-docs/landing-header-light-320.png`, `landing-header-dark-mobile.png`
- [ ] Claim 3: the page promises nothing the repo does not ship — attack: read it against `mac-distribution`'s status; result: not attacked beyond the page text, which says no notarized build or download exists yet; `mac-distribution`'s status was not opened (spec not cited by the test plan)

## Coverage honesty

- The first-open dance under Gatekeeper is not run on a second Mac by the tester; the page repeats the system's documented path.
