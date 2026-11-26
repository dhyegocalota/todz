# Remove waitlist: test plan

## Unit

- [ ] `GET /join` and `POST /join` on the site host answer 404 with an empty body, and the request body is never read.
- [ ] `GET /admin/export.csv` answers 404 with and without a session.
- [ ] `GET /admin` with a session answers 303 to `/admin/metrics` with the admin headers; without a session it answers the sign-in card.
- [ ] `GET /admin/metrics` and `GET /admin/metrics.csv` answer 200 with a session and the page names no waitlist.
- [ ] Migration `0014_drop_waitlist.sql` applied over a database holding one waitlist row leaves no table or index with `waitlist` in its name and keeps `admin_sessions`, `admin_sign_in_links`, `metrics_daily` and `owners`.
- [ ] The cron dispatch names only the day email and the metrics crons; the former digest cron and an unknown one reject.
- [ ] The wrangler configuration lists fifteen limiters, none for the waitlist, with namespaces `8601` to `8615`.
- [ ] No file under the source, scripts, end-to-end specs, the wrangler configuration, the docs app, the shared libraries or the READMEs names the waitlist, and no test reads or writes the dropped table.

## End to end

- [ ] The admin walk: sign in by the mailed link, land on the metrics, download the metrics CSV, sign out, and the CSV path redirects to the sign-in card.
- [ ] The landing has no form and `/join` answers 404 to a post and to a get.

## Edge cases

- [ ] A visitor with an old bookmark of `/admin/export.csv` gets 404, never a CSV.
- [ ] A signed-in owner opening `/admin` lands on the metrics with no waitlist word on the page.

## Production (the loop's deploy)

- [ ] The export step writes a file whose `jq` length equals the count, outside the repository.
- [ ] After the migration the listing says nothing to apply and `POST https://todz.app/join` answers 404.

## Adversarial review

- [ ] Search the repository for the table name in current code: only the migrations name it.
