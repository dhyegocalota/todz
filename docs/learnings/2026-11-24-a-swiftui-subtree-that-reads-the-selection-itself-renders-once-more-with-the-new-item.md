# A new sidebar row crashes the app in a view that only shows for the other rows

- Date: 2026-11-24
- Inspired by: `connect-an-agent` tester run 1 at 4755ea5 (defect D1), fixes c94fad2 and 4cbd412

## Signal

Clicking a new sidebar row stops the app with `preconditionFailure` or `_assertionFailure` in a property of the old screen (`SidebarItem.emptyTitle.getter` ← `TaskListBody.body`). The main window shows the new screen in its own branch of an `if`, so the reviewer and the developer both read the old screen as never mounted for the new row.

## Cause

When the selection changes, SwiftUI re-evaluates the subtree that is still mounted before the parent swaps branches. A child that reads the selection from the model, instead of taking the item its parent built it for, runs its body once more with the new item. Any `switch` over that item that traps on "can't happen" cases then fires.

## Do

Pass the item down from the branch that renders the subtree (`TaskListView(item:)`, `InspectorView(item:)`), and never read the shared selection inside it. Give every enum case a real value in presentation switches instead of a trap. When the app target has no test target, walk the new row against every other row rapidly before calling it fixed.

## Anchor

`apps/macos/Todz/MainWindow/MainWindow.swift`, `apps/macos/Todz/MainWindow/TaskList/TaskListView.swift`, `apps/macos/Todz/Shared/SidebarItem+Presentation.swift`; `docs/features/connect-an-agent/test-plan.md` (D1, the 120-click switch).
