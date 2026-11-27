# Mac languages test plan

## Unit (TodzKit, `swift test --package-path apps/macos/TodzKit`)

- [ ] The resolver: System takes the Mac's best match among the eight, else English; `zh-Hant` is not Simplified; an override wins.
- [ ] The preference stores in the given defaults, reads System when empty, and refuses a stored value outside the eight.
- [ ] The Appearance mapping: System is nil, Light is aqua, Dark is dark aqua.
- [ ] Every request, the health probe and the socket upgrade carry `Accept-Language` with the effective language.
- [ ] The breadcrumb writes one line per erase path, with a timestamp, the path and the reason, and no task data; the file rotates.
- [ ] The bundle lookup finds a language's folder and refuses a missing one.

## Repository shape (`pnpm --filter @todz/repository-shape test`)

- [ ] Every catalog key has all eight languages with state `translated` (red until phase 2 merges the translations).
- [ ] Every copy key in the Swift sources exists in the catalog.
- [ ] The Swift language list mirrors `libs/types` `Language` (red until the site lane's `Language` enum is on main).

## Rendered proof (in-process renderer, never the app on screen)

- [ ] Settings › General with Language and Appearance, and one surface in `pt-BR` and `ja`.
