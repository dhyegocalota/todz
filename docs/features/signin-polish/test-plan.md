# Sign-in polish test plan

## Unit (API, `pnpm --filter @todz/api exec vitest run --project workers test/workspace-activity.test.ts`)

- [x] Nothing written yet: a write is due. — evidence: `isActivityWriteDue` test; red at 3abfa9ce (`is not implemented`), green at c2599844
- [x] One millisecond inside the interval: not due; at the interval: due. — evidence: the two boundary tests, same commits
- [x] A new workspace lists `last_activity_at: null`. — evidence: `owner-workspaces.test.ts` create case and `workspace-activity.test.ts`; red at 3abfa9ce (undefined)
- [x] A task added in a project stamps its workspace, and the listing carries the stamp. — evidence: `workspace-activity.test.ts`, green at c2599844
- [x] A read (`/changes`) does not stamp. — evidence: same file
- [x] A write after the interval stamps again with the later time. — evidence: same file, fake `Date`

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit --filter "ActivityRecencyTests|OwnerCodingTests|AppModelTests"`)

- [x] Recency classes: just now under a minute and for a future stamp, minutes, hours, yesterday, days, none without a stamp. — evidence: `ActivityRecencyTests`; red at 5d9cb29b, green at f6147f8b
- [x] The workspace decodes a stamp and a `null`. — evidence: `OwnerCodingTests`
- [x] A link while signed in (ready, choosing, held until launch settles) raises `alreadySignedIn`, sends nothing, and drops the held link. — evidence: `AppModelTests+SignInLink`
- [x] An error banner already showing is kept. — evidence: `aLinkWhileSignedInKeepsAnErrorBannerAlreadyShowing`
- [x] A link while signed out raises no banner. — evidence: `aLinkWhileSignedOutRaisesNoBanner` (pin)

## User-visible walk (tester)

- [ ] Picker with two workspaces: rows show name, project count and the activity line; a workspace with no stamp shows no line.
- [ ] Settings workspace list shows the same lines.
- [ ] Open a sign-in link in a signed-in app: the main window comes forward and "You're already signed in." shows with Dismiss; Dismiss removes it.
- [ ] Light and dark.

## Coverage honesty

The offscreen renders in the PR show the real row view and the real copy; the banner render is a layout copy of `ErrorBanner` with the real title, since `ErrorBanner` needs a live `AppModel`.
