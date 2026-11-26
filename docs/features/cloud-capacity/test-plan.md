# Cloud capacity: test plan

## Unit

- [ ] With `CLOUD_ACCOUNTS_MAX` unset a new address gets its link.
- [ ] At the cap a new address gets `cloud_full` and no link row.
- [ ] At the cap an active account's link request still succeeds.
- [ ] An account idle for 90 days at the cap is refused; under the cap it signs in.
- [ ] The queue stores an address once and answers alike for a repeat.
- [ ] Admit marks the row, mails the invite, and the address passes the cap.
- [ ] Admit next N admits the oldest N.
- [ ] The daily digest mails only when the queue grew and stamps the rows.
- [ ] The guard levels: under 80%, at 80%, at 95% per dimension.
- [ ] The 80% email goes once a month.
- [ ] At 95% an account above the average is refused writes, one below keeps writing, reads work.
- [ ] A malformed `CLOUD_ACCOUNTS_MAX` throws.

## Edge cases

- [ ] A queued address that is already an account is not queued.
- [ ] A disposable address is not queued.
