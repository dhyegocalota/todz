# Test plan: Mac install

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `apps/api/test/site-pages.test.ts::the landing > with the none notice, the header and footer open the guide and the Mac install page on the docs` — input: the landing HTML; expected: the nav-link and footer-link hrefs are the self-host guide and `https://docs.todz.app/install-on-mac`, twice
- [ ] Confirmed it fails for the right reason: `expected [ …(2) ] to deeply equal [ …(4) ]`, the install URL missing twice

## Unit

- [ ] `apps/api/test/site-discovery.test.ts` — input: `GET /llms.txt`; expected: the Docs section lists `https://docs.todz.app/install-on-mac` after Quickstart
- [ ] `apps/api/test/webmcp-tools.test.ts` — input: the docs tool's `page` enum; expected: it holds `install-on-mac`

## E2E (Playwright specs)

- [ ] `apps/docs/e2e/pages.spec.ts` — steps: open the docs at desktop and narrow; expected: the sidebar and the menu list Introduction, Quickstart, Install on Mac, Connect an agent, MCP tools, Self-host todz
- [ ] `apps/api/e2e/landing.spec.ts` — steps: open the landing at 1280 and 375; expected: the header and footer links fit without sideways scroll

## Docs

- [ ] `pnpm --filter @todz/docs broken-links` — expected: no broken links
- [ ] The page renders in `mint dev`: title "Install on Mac", the steps, the notes
- [ ] Nav entry: "Get started" lists Install on Mac right after Quickstart
- [ ] Quickstart link: step 1 links `/install-on-mac`, and the link opens the page
- [ ] Landing link visible and correct: header "Install on Mac" (narrow: "Install") and footer link open `https://docs.todz.app/install-on-mac`
- [ ] Command `xcodegen generate --spec apps/macos/project.yml` is the one `scripts/verify.sh` runs
- [ ] Command `xcodebuild build -project apps/macos/Todz.xcodeproj -scheme Todz -configuration Release -derivedDataPath apps/macos/build` is the self-host guide's, and `apps/macos/build/Build/Products/Release/Todz.app` exists after it
- [ ] `codesign -dv --verbose=4` on that app prints `TeamIdentifier=XFWR794VS8`
- [ ] `shasum -a 256` accepts a file on macOS; the page names the file it hashes

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Claim 1: every command on the page runs as written — attack: run each from the repository root; result:
- [ ] Claim 2: the landing keeps its CSP and its narrow header — attack: the site headers test and the 375 walk; result:
- [ ] Claim 3: the page promises nothing the repo does not ship — attack: read it against `mac-distribution`'s status; result:

## Coverage honesty

- The first-open dance under Gatekeeper is not run on a second Mac by the tester; the page repeats the system's documented path.
