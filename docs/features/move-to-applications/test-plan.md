# Test plan: Move to Applications

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

## The failing test first

- [ ] `ApplicationsMoveTests` at the red commit — input: `swift test --package-path apps/macos/TodzKit --filter ApplicationsMoveTests`; expected: fails to find `ApplicationsMove` or fails its `#expect`s, nothing else

## Unit

- [ ] A released bundle at `/Applications/Todz.app` or `~/Applications/Todz.app` — expected: not offered
- [ ] A released bundle in `~/Downloads`, on `/Volumes/Todz` or translocated — expected: offered
- [ ] The current version declined — expected: not offered; a newer version — expected: offered
- [ ] No update feed (Debug) — expected: never offered
- [ ] The destination — expected: `/Applications/Todz.app`
- [ ] The whole TodzKit suite — expected: every test passes

## By hand (tester, one pass)

- [ ] The released 0.2.2 build, quarantined, opened from `~/.todz-release/check/Applications` after Open Anyway — expected: the alert "Move todz to Applications so it can update itself" with Move to Applications and Not now; a screenshot
- [ ] Not now, then relaunch — expected: no alert
- [ ] Move to Applications with no todz running from `/Applications` — expected: todz relaunches from `/Applications/Todz.app`, not translocated (`ps` shows the path), the original is in the Trash, and Check for Updates no longer refuses
