# Test plan: Move to Applications

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: `.

The live mover is never run on a Mac that has a real todz installed (see the learning); there is no tester walk of it. Its effects are proven on scratch copies through the protocol.

## The failing test first

- [x] `ApplicationsMoveRunTests` and the new `ApplicationsMoveTests` before any source — input: `swift test --filter ApplicationsMove`; expected: the build fails on `cannot find type 'RunningTodz'` and the missing `ApplicationsMoveRun` — evidence: red run before the first source file was written

## Unit

- [x] Offer decisions: Applications and `~/Applications` not offered; Downloads, a disk image, a nested folder and a translocated bundle offered; the declined version not offered, the next one offered; no feed never offered; a Debug build never offered, translocated or not — evidence: `ApplicationsMoveTests`
- [x] Refusals, each leaving the source, the previous copy and the destination as they were: another todz running, the destination running, the destination running through a symbolic link, copy fails, signature mismatch, quarantine strip fails, a previous copy that cannot be trashed — evidence: `ApplicationsMoveRunTests`
- [x] A previous copy that cannot be restored after a failure — expected: `rollbackFailed` — evidence: `ApplicationsMoveRunTests`
- [x] Already in place through a symbolic link, and a translocated bundle whose original is the destination — expected: `alreadyInPlace`, nothing touched — evidence: `ApplicationsMoveRunTests`
- [x] This process running from the source — expected: does not block — evidence: `ApplicationsMoveRunTests`
- [x] An original that cannot be trashed or located — expected: `movedLeavingOriginal` — evidence: `ApplicationsMoveRunTests`
- [x] The mover's tests never name `/Applications`; the offer carries the compile-time Debug gate; the only sandbox file exception is the installed bundle — evidence: `applications-mover.test.ts`, `macos-sandbox.test.ts`
- [x] `scripts/verify-macos.sh` — expected: every TodzKit test passes and the Debug app builds — evidence: 1599 tests in 130 suites passed, `BUILD SUCCEEDED`

## Screenshots

- [x] The offer alert in light and dark through an in-process render, no launch of the app — expected: the message, the detail, **Move todz to Applications** and **Not now** — evidence: skipped on purpose; an `NSAlert` window drew only its icon when rendered off-screen in process, and showing it on screen would interrupt the owner, so the copy is checked in `UpdateCopy` and the code only
