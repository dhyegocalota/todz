import Foundation
import Testing
@testable import TodzKit

private func workspaces(count: Int) -> [Workspace] {
    (0..<count).map { Workspace(identifier: "workspace-\($0 + 1)", name: "Workspace \($0 + 1)", createdAt: fixedInstant, projects: []) }
}

@Suite struct WorkspaceStepTests {
    @Test func aNumberActionPicksTheNumberedWorkspace() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .number(2), activeIdentifier: "workspace-1", in: listed) == listed[1])
    }

    @Test func aNumberActionOutOfRangePicksNothing() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .number(4), activeIdentifier: "workspace-1", in: listed) == nil)
        #expect(WorkspaceShortcuts.workspace(action: .number(0), activeIdentifier: "workspace-1", in: listed) == nil)
    }

    @Test func nextGoesToTheFollowingWorkspace() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .next, activeIdentifier: "workspace-1", in: listed) == listed[1])
    }

    @Test func nextWrapsFromTheLastToTheFirst() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .next, activeIdentifier: "workspace-3", in: listed) == listed[0])
    }

    @Test func previousGoesToThePrecedingWorkspace() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .previous, activeIdentifier: "workspace-3", in: listed) == listed[1])
    }

    @Test func previousWrapsFromTheFirstToTheLast() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .previous, activeIdentifier: "workspace-1", in: listed) == listed[2])
    }

    @Test func stepsReachWorkspacesBeyondTheNinth() {
        let listed = workspaces(count: 11)
        #expect(WorkspaceShortcuts.workspace(action: .next, activeIdentifier: "workspace-9", in: listed) == listed[9])
    }

    @Test func withNoActiveWorkspaceNextPicksTheFirstAndPreviousTheLast() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(action: .next, activeIdentifier: nil, in: listed) == listed[0])
        #expect(WorkspaceShortcuts.workspace(action: .previous, activeIdentifier: nil, in: listed) == listed[2])
    }

    @Test func hotKeysRegisterOnlyWhenReadyWithWorkspacesAndTheSwitchOn() {
        #expect(WorkspaceShortcuts.shouldRegister(phase: .ready, workspaceCount: 2, isGlobalOn: true))
        #expect(!WorkspaceShortcuts.shouldRegister(phase: .ready, workspaceCount: 2, isGlobalOn: false))
        #expect(!WorkspaceShortcuts.shouldRegister(phase: .ready, workspaceCount: 0, isGlobalOn: true))
        #expect(!WorkspaceShortcuts.shouldRegister(phase: .signedOut(notice: nil), workspaceCount: 2, isGlobalOn: true))
        #expect(!WorkspaceShortcuts.shouldRegister(phase: .choosing, workspaceCount: 2, isGlobalOn: true))
        #expect(!WorkspaceShortcuts.shouldRegister(phase: .loading, workspaceCount: 2, isGlobalOn: true))
    }

    @Test func anEmptyListStepsNowhere() {
        #expect(WorkspaceShortcuts.workspace(action: .next, activeIdentifier: nil, in: []) == nil)
    }
}
