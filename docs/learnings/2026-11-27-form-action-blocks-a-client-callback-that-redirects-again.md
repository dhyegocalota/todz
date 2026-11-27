# Approve keeps loading and never leaves the consent page when the client's callback redirects again

- Date: 2026-11-27
- Inspired by: the owner's production report on 2026-11-27 (Approve loads forever, a second press shows the email form), [ADR 0116](../adr/0116-an-oauth-decision-answers-a-page-that-returns-to-the-client-and-a-replayed-approval-is-told-so.md)
- Revisited: 2026-11-27 — still true (written the same day)

## Signal

The consent form posts, the server answers 303 to the registered redirect URI, and the browser stays on the consent page with the button busy. The console says `Sending form data to '<origin>/oauth/authorize' violates the following Content Security Policy directive: "form-action 'self' <redirect origin>"`, naming the form's own URL rather than the hop it blocked. Every unit test passes, and an E2E whose callback answers 200 passes too.

## Cause

Chrome checks `form-action` on every redirect of the navigation a form post starts, including redirects issued by another site. Adding the redirect URI's origin to `form-action` lets the first hop through, but a callback that redirects again to any other origin is refused, and nothing on the page says so.

## Do

Never answer a form post with a redirect whose chain you do not own. Answer a page that navigates by script or link, which `form-action` does not govern, and prove it with an E2E whose fake callback itself redirects to a second origin.

## Anchor

`apps/api/src/oauth/oauth-pages.ts` (`returnPageOf`), `apps/api/src/site/admin-page.ts` (`PAGE_SCRIPT`), `apps/api/e2e/oauth.spec.ts` ("approving lands on the client even when its redirect URI redirects again to another origin").
