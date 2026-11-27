import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let hiddenCounts = Array(1...12)

@MainActor private func signedInHarness(hiddenCount: Int, isLockOn: Bool = true) async throws -> AppModelHarness {
    let harness = try AppModelHarness(isWorkspaceLockOn: isLockOn)
    let current = harness.seedWorkspace(name: "acme", projectNames: ["launch"])
    let hidden = (0..<hiddenCount).map { harness.seedWorkspace(name: "hidden\($0)", projectNames: ["garden"]) }
    harness.service.tasksOfProject["acme-inbox"] = (1...2).map { MutableTask(number: $0, title: "Acme \($0)", dueDate: today).record }
    hidden.forEach { workspace in
        harness.service.tasksOfProject["\(workspace.name)-inbox"] = [MutableTask(number: 1, title: "Secret \(workspace.name)", dueDate: today).record]
    }
    harness.store.owner = OwnerCache(
        ownerIdentifier: harness.ownerIdentifier,
        workspaces: [current] + hidden,
        activeWorkspaceIdentifier: current.identifier,
        selection: nil
    )
    await harness.signedIn()
    await harness.published()
    return harness
}

@MainActor private func chrome(of harness: AppModelHarness, isMainWindow: Bool) -> WorkspaceChrome {
    WorkspaceChrome(visible: harness.model.visibleWorkspaces, selection: harness.model.selection, isMainWindow: isMainWindow)
}

@MainActor @Suite struct LockIndistinguishabilityTests {
    @Test(arguments: hiddenCounts) func theChromeOfALockedSessionEqualsTheChromeOfAOneWorkspaceAccount(hiddenCount: Int) async throws {
        let locked = try await signedInHarness(hiddenCount: hiddenCount)
        let alone = try await signedInHarness(hiddenCount: 0, isLockOn: false)
        #expect(chrome(of: locked, isMainWindow: false) == chrome(of: alone, isMainWindow: false))
        #expect(chrome(of: locked, isMainWindow: true) == chrome(of: alone, isMainWindow: true))
    }

    @Test func aLockedModelWithThreeWorkspacesAndAModelWithOnlyTheCurrentOneRenderAlike() async throws {
        let locked = try await signedInHarness(hiddenCount: 2)
        let alone = try await signedInHarness(hiddenCount: 0, isLockOn: false)
        #expect(locked.model.visibleWorkspaces == alone.model.visibleWorkspaces)
        #expect(locked.model.shownWorkspaces == alone.model.shownWorkspaces)
        #expect(locked.model.todayHeadingCount == alone.model.todayHeadingCount)
        #expect(locked.model.taskViews?.today.open.map(\.task.title) == alone.model.taskViews?.today.open.map(\.task.title))
        #expect(locked.model.taskViews?.today.open.map(\.workspaceName) == alone.model.taskViews?.today.open.map(\.workspaceName))
        #expect(locked.widgets.snapshot == alone.widgets.snapshot)
        let lockedRegistration = WorkspaceShortcuts.shouldRegister(phase: locked.model.phase, workspaceCount: locked.model.visibleWorkspaces.count, isGlobalOn: true)
        let aloneRegistration = WorkspaceShortcuts.shouldRegister(phase: alone.model.phase, workspaceCount: alone.model.visibleWorkspaces.count, isGlobalOn: true)
        #expect(lockedRegistration == aloneRegistration)
    }
}
