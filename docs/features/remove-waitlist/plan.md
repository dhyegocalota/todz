# Remove waitlist: plan

- [ ] 1. Red tests: `apps/api/test/waitlist-removed.test.ts`, `tools/repository-shape/src/waitlist-removed.test.ts` and the limiter list in `tools/repository-shape/src/api-source.test.ts`.
- [ ] 2. Delete the join route, the waitlist store, the closed answer, the mails, their templates and copy, the Turnstile action, the limiter bindings, the constants and the email slots; regenerate the email templates.
- [ ] 3. The admin: no list, no export, no failed confirmations; `GET /admin` redirects to the metrics; `AdminNotice` moves to `admin-notice.ts`.
- [ ] 4. Migration `0013_drop_waitlist.sql`.
- [ ] 5. Renumber the limiter namespaces to `8604` to `8615`; the self-host guide and the READMEs.
- [ ] 6. Update the tests and the end-to-end specs that named the waitlist.
- [ ] 7. The deploy runbook (export step before the migration, the join check, the rollback bullets), the smoke walk and the runbooks index.
- [ ] 8. ADR 0097, the status lines of the ADRs it supersedes or amends, the ADR index and the feature index.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 4 | The table is dropped before the export exists | the deploy runbook's step 6 count and `jq` length differ, or the file is missing | restore the Time Travel bookmark of step 5, with the owner's word |
| 5 | The limiter ids shift | the admin limiter counts restart for one minute | none needed |
| 3 | An old admin tab posts to a removed route | 404 | none needed |
