# Mac languages test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit`)

- [x] The resolver: System takes the Mac's best match among the eight, else English; `zh-Hant` is not Simplified; an override wins. — evidence: `AppLanguageTests`, `LanguagePreferenceTests`; red at 0a146a8d (did not build)
- [x] The preference stores in the given defaults, reads System when empty, and refuses a stored value outside the eight. — evidence: `LanguagePreferenceTests`
- [x] The Appearance mapping: System is nil, Light is aqua, Dark is dark aqua. — evidence: `AppearanceChoiceTests`
- [x] Every request, the health probe and the socket upgrade carry `Accept-Language` with the effective language. — evidence: `OwnerRequestTests`, `OwnerAPIHealthTests`, `OwnerAPITests+Version`
- [x] The breadcrumb writes one line per erase path, with a timestamp, the path and the reason, and no task data; the file rotates. — evidence: `LaunchBreadcrumbsTests`, `AppModelTests+LaunchErases`
- [x] The bundle lookup finds a language's folder and refuses a missing one. — evidence: `LanguageBundleTests`; swift test 1765 tests passed at 419a7987

## Repository shape (`pnpm --filter @todz/repository-shape test`)

- [x] Every catalog key, in both catalogs, has all eight languages with state `translated`. — evidence: `mac-catalog.test.ts` after the merge
- [x] Every copy key in the Swift sources exists in the catalog, and the shortcut phrases keep the application name. — evidence: `mac-catalog.test.ts`
- [ ] The Swift language list mirrors `libs/types` `Language` (red until the site lane's `Language` enum is on main).

## Rendered proof (in-process renderer, never the app on screen)

- [x] Settings › General with Language and Appearance in en; the window and the popover in pt-BR and ja, light and dark. — evidence: `todz-loop/notes/mac-renders`; the main window's sidebar cannot draw offscreen, so the window shots are the task column
