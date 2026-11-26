# 0105. The move-to-Applications offer acts only on a click, compares canonical paths and runs behind a protocol tested on scratch copies

- Status: Accepted
- Date: 2026-11-26
- Deciders: Dhyego Calota (owner), who listed these requirements after the first attempt replaced his installed app; Claude (the loop's call under the owner's instruction to decide every call)
- Inspired by: [the learning](../learnings/2026-11-26-a-tester-s-release-build-of-the-mover-replaced-the-owner-s-installed-app.md); it replaces the unmerged ADR 0078 of PR #72

## Decision

A Release build that carries the update feed and is compiled without `DEBUG`, running outside an Applications folder, shows one alert per version, and moves only after the click on its first button. The move refuses, changing nothing, while any other todz runs by bundle identifier or any process runs from the destination, comparing resolved canonical paths (`realpath`), checks every file-system result, trashes a stopped todz at the destination first and puts it back on any later failure, and trashes the original only after the copy satisfies the running bundle's designated requirement and its quarantine is stripped. Every file-system and process effect is behind `ApplicationsMoveSystem` with the destination folder injected, so the sequence is tested against a temporary folder and a fake list of running apps, and the live mover is never run on a Mac that has a real todz installed.
