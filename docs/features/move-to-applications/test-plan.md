# Test plan: Move to Applications

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

The live mover is never run on a Mac that has a real todz installed (see the learning); there is no tester walk of it. Its effects are proven on scratch copies through the protocol.

## The failing test first

- [x] The tests before any source, in both rounds — input: `swift test --filter ApplicationsMove`; expected: the build fails on `cannot find type 'RunningTodz'` (first round) and on `cannot find type 'FileIdentity'` (review round) — evidence: red runs before the sources were written

## Unit

- [x] Offer decisions: Applications and `~/Applications` not offered; Downloads, a disk image, a nested folder and a translocated bundle offered; the declined version not offered, the next one offered; no feed never offered; a Debug build never offered, translocated or not — evidence: `ApplicationsMoveTests`
- [x] The alert's buttons — expected: Not now first and default, move second, an index outside the buttons is no choice — evidence: `ApplicationsMoveChoiceTests`
- [x] Anything at the destination (a bundle, a broken symbolic link) — expected: `destinationOccupied`, the destination, the original and the folder unchanged, no staging bundle — evidence: `ApplicationsMoveRunTests`
- [x] Already in place through a symbolic link, through `/System/Volumes/Data`, and a translocated bundle whose original is the destination — expected: `alreadyInPlace`, nothing touched — evidence: `ApplicationsMoveRunTests`
- [x] A translocated bundle whose original is unknown — expected: `originalUnknown`, nothing created — evidence: `ApplicationsMoveRunTests`
- [x] Another todz running — expected: `otherTodzRunning`, nothing created; this process running from the source does not block — evidence: `ApplicationsMoveRunTests`
- [x] A stale staging bundle — expected: removed, then the move succeeds; not removable: `stagingNotCleared` — evidence: `ApplicationsMoveRunTests`
- [x] Copy fails (leaving a partial staging bundle), signature mismatch, quarantine fails, rename fails — expected: the matching refusal, the staging bundle removed, nothing at the destination, the original in place; cleanup that also fails: `rollbackFailed` — evidence: `ApplicationsMoveRunTests`
- [x] A destination created between the check and the rename — expected: the exclusive rename refuses, `installFailed`, the racer's bundle untouched, the staging bundle removed; a stale staging symbolic link — expected: removed with its target intact, or `destinationOccupied` when the target is the destination — evidence: `ApplicationsMoveRunTests`, `ExclusiveRenameTests`
- [x] The original cannot be trashed — expected: `movedLeavingOriginal`, the copy installed — evidence: `ApplicationsMoveRunTests`
- [x] Quarantine removal — expected: the root and nested items lose the attribute; an unreadable folder or a missing bundle fails — evidence: `QuarantineRemovalTests`
- [x] The mover's tests never name `/Applications` or the destination constant; the offer carries the compile-time Debug gate, no activation and no key equivalent; the only sandbox file exceptions are the installed bundle and its staging bundle — evidence: `applications-mover.test.ts`, `macos-sandbox.test.ts`
- [x] `scripts/verify-macos.sh` — expected: every TodzKit test passes and the Debug app builds — evidence: 1607 tests in 132 suites passed, `BUILD SUCCEEDED`

## Screenshots

- [x] The offer alert in light and dark through an in-process render, no launch of the app — expected: the message, the detail, **Not now** and **Move todz to Applications** — evidence: skipped on purpose; an `NSAlert` window drew only its icon when rendered off-screen in process, and showing it on screen would interrupt the owner, so the copy is checked in `UpdateCopy` and the code only
