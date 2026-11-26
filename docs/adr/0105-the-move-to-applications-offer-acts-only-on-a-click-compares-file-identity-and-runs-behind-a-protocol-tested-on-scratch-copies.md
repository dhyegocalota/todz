# 0105. The move-to-Applications offer acts only on a click, compares file identity and runs behind a protocol tested on scratch copies

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner), who listed these requirements after the first attempt replaced his installed app; Claude (the loop's call under the owner's instruction to decide every call)
- Inspired by: [the learning](../learnings/2026-11-26-a-tester-s-release-build-of-the-mover-replaced-the-owner-s-installed-app.md); it replaces the unmerged ADR 0078 of PR #72

## Decision

A Release build that carries the update feed and is compiled without `DEBUG`, running outside an Applications folder, shows one alert per version whose default button is Not now, and moves only after a click on Move todz to Applications, never taking the foreground at launch. The move never displaces anything: if anything exists at `/Applications/Todz.app`, of any version, running or not, in any user session, it refuses and changes nothing. Otherwise it copies to a staging name in the destination folder, verifies the copy against the running bundle's designated requirement, strips the quarantine (a folder it cannot read is a failure), renames the copy into place and only then trashes the original, best effort. A kill at any point leaves at most a staging bundle, which the next move removes first. "Same app" and "in place" are decided by file identity (device and inode), never by path text, because firmlinked paths such as `/System/Volumes/Data/Applications` differ as strings. A translocated bundle whose original cannot be found is refused, and the move also refuses while any other todz runs. Every file-system and process effect is behind `ApplicationsMoveSystem` with the destination folder injected, so the sequence is tested against a temporary folder and a fake list of running apps, and the live mover is never run on a Mac that has a real todz installed.
