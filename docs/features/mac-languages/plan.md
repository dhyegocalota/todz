# Mac languages plan

- [ ] Docs: spec, plan, test plan, the features row, ADR 0120 and ADR 0121.
- [ ] Red: the catalog completeness, the language resolver and preference, the Appearance mapping, the `Accept-Language` header, the breadcrumb lines, the Swift list mirroring `libs/types`.
- [ ] Green: `AppLanguage`, `LanguageChoice`, `LanguagePreference`, `LanguageBundle`, `AppearanceChoice`, the header on every request.
- [ ] Green: `Localizable.xcstrings` in English and every copy module resolving through `Localized`.
- [ ] Green: Settings › General Language and Appearance rows; the views follow the choice at once.
- [ ] Green: the erase-at-launch breadcrumb.
- [ ] Fragments for the seven other languages and the merge script (phase 2 merges the translations).
- [ ] Gates: `swift test`, the app build, `pnpm --filter @todz/repository-shape test`, `pnpm typecheck`.

## File map

| File | Change |
|------|--------|
| `apps/macos/Copy/Localizable.xcstrings` | new catalog |
| `apps/macos/Copy/Localized.swift` | new lookup |
| `apps/macos/Copy/*.swift` | strings resolve through `Localized` |
| `apps/macos/TodzKit/Sources/TodzKit/AppLanguage.swift`, `LanguageChoice.swift`, `LanguagePreference.swift`, `LanguageBundle.swift`, `AppearanceChoice.swift` | new |
| `apps/macos/TodzKit/Sources/TodzKit/OwnerRequest.swift`, `OwnerAPI.swift`, `SocketChangeSignals.swift` | `Accept-Language` |
| `apps/macos/TodzKit/Sources/TodzKit/LaunchBreadcrumb.swift` | new |
| `apps/macos/Todz/Settings/SettingsLanguageRows.swift` | new Settings rows |
| `tools/repository-shape/src/swift-copy.ts` | reads the catalog-backed copy form |
| `scripts/merge-mac-strings.ts` | merges translation fragments into the catalog |

## Failure modes

| Failure | Handling |
|---------|----------|
| A stored language outside the eight | refused, logged, the Mac's language is read |
| A language folder missing from the bundle | the lookup refuses instead of showing another language |
| A fragment with a missing key or an empty value | the merge script refuses |
