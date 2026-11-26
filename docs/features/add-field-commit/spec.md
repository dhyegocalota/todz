# Add field commit

**Status:** In review
**Tier:** 🟢
**Owner approval:** approved by inheritance from `docs/product/README.md` (approved 2026-11-23) and the owner's 2026-11-24 instruction to decide every call
**ADRs:** [0080](../../adr/0080-the-workspace-picker-selects-several-workspaces-or-all-and-every-surface-shows-their-union-tagged-by-workspace.md)
**Not changing:** the union rules of ADR 0080, where an add lands, the field's look, Return, Escape, ⌘N

## Problem

A late walk of [`multi-workspace`](../multi-workspace/) on 0.2.2 reported two failures:

1. After an add to an empty Inbox, "Acme one" and "Inbox is empty" showed together.
2. With All Workspaces selected, the Inbox showed one Walk C row and nothing from the other workspaces, with no workspace tags.

In both screenshots the text sits inside the Add a task field (no checkbox, no task number), and the walk's server log has no task write at all: the automation filled the field but nothing ever committed it. So both are walk artifacts, to be proven from the server, not the screen. What is real is that the field has one way to commit, the Return key, and nothing an assistive tool or an automation can invoke by name.

## Change

1. The commit rule moves into TodzKit as `AddFieldSubmission`: a blank field is ignored, a title the rules refuse shows its issue and stays, any other title is accepted as typed and clears the field.
2. The field commits through that one rule on Return and through an accessibility action named "Add", so VoiceOver and automation can add without a key press.
3. A live TodzKit suite, run against a local Worker, seeds three workspaces with tasks through the owner API and proves the real client's All Workspaces union from the server: the Inbox and Today rows with their tags, the menu bar count, the workspace shortcuts, an add reaching the primary workspace, the widget snapshot and a tick completing in the task's own workspace, and a relaunch keeping All.

## Findings

- Server evidence: see [test-plan.md → Prove it for real](test-plan.md#prove-it-for-real). The union shows every workspace's rows with their tags when the tasks exist on the server; the walk's log holds one `POST /owner/workspaces` and no `/tasks` request.
- Both defects: ARTIFACT.

## Test list

- `AddFieldSubmissionTests`: blank ignored, typed title accepted as typed, over-long title refused with `titleTooLong`.
- `LiveMultiWorkspaceTests` (enabled by `TODZ_LIVE_API_URL`): five flows against a local Worker.
