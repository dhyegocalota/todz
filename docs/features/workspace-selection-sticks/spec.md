# Workspace selection sticks

**Status:** Shipped 2026-11-27
**Tier:** 🔴 (a privacy bug on the owner's installed 0.2.8: the window showed a workspace he had left; TodzKit and the Mac app only, no server, no schema, no deploy)
**Owner approval:** the owner's report of 2026-11-27, "selecionei SuperDoc, e tô vendo tudo da Thrifty!!!", treated as lock-level priority. The fix is the loop's call under [ADR 0122](../../adr/0122-the-workspace-lock-switch-on-shows-one-workspace-and-refuses-widening.md).
**Builds on:** [`lock-single-workspace`](../lock-single-workspace/) (PR #135), whose rule this fix enforces in the model
**Not changing:** the relock triggers, the idle timeout, the cache format, the widget extension's code

## Problem

With the workspace lock switch on, picking a workspace in the switcher menu (in the sidebar and in the popover) called the multi-select toggle. The picked workspace joined the shown set, but the workspace already open stayed current. The next relock (five idle minutes, sleep, screen lock) or relaunch then collapsed the selection back to that old workspace. The owner picked SuperDoc and landed back on Thrifty Traveler, with Thrifty's tasks in the window and the widget. The owner's cache matched this: SuperDoc's inbox was written five seconds before `owner.json` named Thrifty alone. PR #135 routed the row through a decision inside the view, which no test covered.

## Goals

- With the switch on, a switcher row switches to its workspace alone, through one model method that the view calls. With the switch off, the row still toggles.
- Every way of selecting another workspace keeps it, locked (after one prompt) or unlocked, through a relock and a relaunch: the switcher row, Switch Workspace… (⌘K, also in the popover), the numbered Workspace menu item and the popover's number keys, the ⌃ number chords, Next, and the Settings row.
- After each of those, the window, the popover, the widget snapshot and the cache all name the chosen workspace.

## Rollback

Revert the PR. No data, server or schema changes.

## Test strategy summary

`AppModelTests+WorkspaceSelectionSticks.swift` drives each selection path, unlocked and locked, then relocks and relaunches from the kept cache. After each step it checks the selection, the active workspace, the shown workspaces, Today, the widget snapshot and the cached active workspace. It also pins that the current workspace's row asks nothing while locked, and that the row still toggles with the switch off.
