# Test plan: The menu bar shows the pending count

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `MenuBarBadgeTests` (`apps/macos/TodzKit/Tests/TodzKitTests/MenuBarBadgeTests.swift`) — input: the red commit; expected: each test, run alone with `--filter`, fails on the stub `MenuBarBadge is not implemented` (a `fatalError` stub stops a whole run at its first test)
- [ ] Confirmed it fails for the right reason: the failure text recorded from the red run

## Unit

- [ ] Off — input: count 5, toggle off; expected: `nil`
- [ ] Zero — input: count 0, toggle on; expected: `nil`
- [ ] One — input: 1, on; expected: "1"
- [ ] Twelve — input: 12, on; expected: "12"
- [ ] Edge: the cap — input: 99, on; expected: "99"
- [ ] Edge: above the cap — input: 100, on; expected: "99+"
- [ ] Edge: a negative count — input: -1, on; expected: `nil`
- [ ] The toggle's default is on: a fresh `UserDefaults` suite after the app's default registration reads `true` for the key, and registering never overwrites a stored `false`
- [ ] The count the item and the popover heading share: every project loaded → the open count; one loaded and one failed → the same count the heading shows; nothing loaded yet → none
- [ ] `swift test --package-path apps/macos/TodzKit`: every suite green, count recorded

## Prove it for real — the app (ADR 0026)

The app is walked with Orca against `wrangler dev` and a seeded fictional workspace; the menu bar is read with Orca's status item state and a screenshot of the item.

- [ ] One open task due today, one overdue from yesterday, one due tomorrow, one done today; expected: the item shows the icon and "2" (today and overdue; tomorrow and done not counted), and the popover's heading reads "2 left"
- [ ] Complete one in the popover; expected: the item reads "1" with the heading "1 left"
- [ ] Complete the last; expected: icon only, accessibility label "todz"
- [ ] Add a task due today from the main window; expected: the item reads "1" again
- [ ] Settings: ⌘, opens the Settings window with the switch "Show pending count in the menu bar" on and its subtitle; expected: as `design.md` § 4
- [ ] Switch off; expected: the item shows the icon only at once, Today still has an open task
- [ ] Quit and relaunch with the switch off; expected: icon only; switch on; expected: the number returns at once
- [ ] Switch workspace with ⌘2 (another workspace with no open task today); expected: icon only; ⌘1 back; expected: the number
- [ ] Signed out; expected: icon only
- [ ] Offline (stop `wrangler dev`) with a cached Today of one open task; expected: "1"
- [ ] Accessibility: the status item's label reads "todz, 1 left today" with one open task (Orca's tree or the Accessibility Inspector); if the label does not reach the status item, FAILED with what was read
- [ ] Dark menu bar: the number tints with the icon (screenshot)
- [ ] One project loaded and one failing (stop serving it through a proxy or remove its access); expected: the item and the popover heading show the same number
- [ ] More than 99 open tasks today (seeded); expected: the item reads "99+", the accessibility label names the real number
- [ ] A task due today added by an agent through MCP while the popover is closed; expected: the item's number rises after the pull, without opening the popover
- [ ] ⌘, with only the popover open and no main window; expected: the Settings window opens
- [ ] The main window and the launch are unchanged: launch from cold opens the menu bar item and the main window as before; expected: the same as before this feature (no second launch, no Settings window at launch)
- [ ] Screenshots: `docs/screenshots/menu-bar-count/01-count.png` (light, fictional workspace, at most 1600 px wide and 1 MB) for the README, and the Settings window in `.pr-media/menu-bar-count/` for the PR

## Edge cases found during execution

## Adversarial review

- [ ] Claim 1: the item and the popover's heading never disagree — attack: a partial load, a pull while the popover is closed, an optimistic write still in the outbox; result: <refuted | held>
- [ ] Claim 2: the switch takes effect without a relaunch — attack: toggle with the popover open, with the main window closed, twice quickly; result: <refuted | held>
- [ ] Claim 3: the item renders the number next to the icon — attack: the built app with 1, 12 and 100 open tasks, light and dark menu bars; result: <refuted | held>

## Coverage honesty

- The label's rendering is proven on this Mac's macOS only; macOS 14 itself is not available to run.
- At midnight the item, like the popover, keeps yesterday's split of today and overdue until the model next changes; shared with the popover, not fixed here.
