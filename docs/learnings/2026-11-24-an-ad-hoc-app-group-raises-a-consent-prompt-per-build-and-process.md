# An ad-hoc signed App Group raises "would like to access data from other apps" after every rebuild and for every second process

- Date: 2026-11-24
- Inspired by: [ADR 0032](../adr/0032-widgets-read-a-snapshot-in-an-app-group-that-a-team-prefix-replaces-later.md), the `widgets` plan step 0 spike, [ADR 0033](../adr/0033-without-a-team-the-widgets-share-a-folder-in-application-support-that-an-app-group-replaces-later.md)

## Signal

A sandboxed, ad-hoc signed app or extension that opens a group container (`~/Library/Group Containers/<prefix>.<id>`) hangs at launch while a system alert says "“<name>” would like to access data from other apps". It happens to a rebuilt app whose earlier build created the container, and to any second process with the same group entitlement. A shell that runs `ls` on the container hangs on the same alert. The alert draws on the owner's screen.

## Cause

macOS protects app data containers from every code identity except the one that owns them. Without a team, a binary's identity is its code hash, so each rebuild is a stranger to the container its previous build created, and an app and its extension are always strangers to each other. A team-prefixed group signed with that team is exempt; an ad-hoc signature has no team to match. The first spike missed it because each fresh group was created by the build that then wrote to it.

## Do

Without a team, don't share data through a group container. Give each sandboxed target a `com.apple.security.temporary-exception.files.home-relative-path.read-write` entitlement for one folder in `~/Library/Application Support/`, build the absolute path from `getpwuid`, and treat the folder as untrusted (ADR 0033). Never `ls` a group container from the shell during a walk. When a prompt does appear, find it with Orca (`get-app-state --app com.apple.UserNotificationCenter`) and answer "Don't Allow".

## Anchor

`apps/macos/project.yml` (both entitlements), `apps/macos/TodzKit/Sources/TodzKit/SharedFolder.swift`, ADR 0033 → Evidence.
