# Key list after a revoke

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved 2026-11-26 as the loop's call under the owner's 2026-11-24 instruction to decide every call (todz-loop/PROMPT.md), from the production smoke walk's step 11 deviation in STATE.md
**ADRs:** none
**Not changing:** the server, the owner API, the key screen's layout and copy, issuing a key, the revoke confirmation

## Problem

In the production smoke walk (2026-11-26, step 11), the owner revoked a key in the Connect an Agent screen, the server answered `401` for it a second later, and the screen still listed "Key ending in BV8M" until it was reloaded.

`AppModel.revokeKey` drops a revoke the server confirmed whenever the key screen's visit changed while the request was out (the screen disappeared and appeared again, which starts a new visit and a new list). The new visit's list can be read before the server processes the revoke, so it still holds the key, and the dropped answer never removes it.

## Change

- A revoke the server confirms removes the key from the list, and from every later list answer, whenever the key screen still shows the same project, even when the visit changed while the request was out.
- A revoke answer for another project, or after the owner left Connect an Agent, changes nothing.
- A failed revoke still says so, and its spinner still stops, only in the visit that started it: an earlier visit's answer never touches a revoke the current visit started.

## Test list

- `AppModelTests+Keys.swift`: a revoke held while the screen leaves and reappears, with the new visit's list answering first, ends with the key gone and nothing revoking; the same with the new list answering after the revoke; a failed revoke answered in a new visit shows no failure; the existing "project changed" test stays green.
