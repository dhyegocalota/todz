# Tester briefing: transactional email

## Steps 1 and 2: the templates and their generator

**What changed.** `apps/api/scripts/emails/` renders the sign-in and welcome templates with React Email into `apps/api/src/emails/generated/email-templates.ts`; `apps/api/src/emails/email-slot.ts` fills the `{{link}}`, `{{email}}` and `{{origin}}` slots in one pass. `vitest.config.mts` has two projects, `workers` and `node`; `tsconfig.scripts.json` types `scripts/` and the Node tests.

**Run it.** From the root: `pnpm emails:generate`, `pnpm emails:check`, `pnpm emails:preview` (writes `.pr-media/emails/sign-in.html` and `welcome.html` with `maria@example.com` and `http://localhost:8787`; the lockup image loads only while a Worker serves `/brand/todz-lockup.png`, which step 4 adds). From `apps/api`: `npx vitest run` and `pnpm typecheck`.

**Red today, green after.** Red commit `38d598b`. The run printed `filledTextOf is not implemented`, `filledHtmlOf is not implemented` and `generatedEmailsSource is not implemented`; the email-templates tests failed on the empty stub strings. Pins that were green on landing: both `runtime-email-imports` tests and the slot-order test in `email-slot.test.ts`.

**Hypotheses.**

- The generated module equals a fresh render, and a template edit without `pnpm emails:generate` fails `generated-emails.test.ts`.
- No file under `apps/api/src` imports React or React Email.
- A value such as `{{link}}@x.io` is written as it is and never expanded; `& < > " '` are escaped in HTML, including in `href`; text is not escaped.
- Both HTML parts declare `color-scheme` and `supported-color-schemes` as `light dark` and carry a `prefers-color-scheme: dark` block; the lockup `img` has `alt="todz"`, `width="240"` and `height="80"`.
- The preview files open in a browser as the todz look in light, and in dark with the browser's dark preference.

**Gaps.** Dark rendering and Outlook are not walked by the developer. The sign-in text holds the link twice (button and fallback line). The workers project excludes `test/brand-asset.test.ts` ahead of step 3.
