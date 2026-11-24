import Foundation
import Testing
@testable import TodzKit

private func workspaces(count: Int) -> [Workspace] {
    (0..<count).map { Workspace(identifier: "workspace-\($0 + 1)", name: "Workspace \($0 + 1)", createdAt: fixedInstant, projects: []) }
}

@Suite struct WorkspaceShortcutsTests {
    @Test func theFirstNumberPicksTheFirstWorkspace() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(number: 1, in: listed) == listed[0])
    }

    @Test func theLastNumberPicksTheNinthWorkspace() {
        let listed = workspaces(count: 10)
        #expect(WorkspaceShortcuts.workspace(number: WorkspaceShortcuts.count, in: listed) == listed[8])
    }

    @Test func aNumberPastTheShortcutsPicksNothing() {
        #expect(WorkspaceShortcuts.workspace(number: 10, in: workspaces(count: 10)) == nil)
    }

    @Test func zeroAndNegativeNumbersPickNothing() {
        let listed = workspaces(count: 3)
        #expect(WorkspaceShortcuts.workspace(number: 0, in: listed) == nil)
        #expect(WorkspaceShortcuts.workspace(number: -1, in: listed) == nil)
    }

    @Test func aNumberPastTheListPicksNothing() {
        #expect(WorkspaceShortcuts.workspace(number: 3, in: workspaces(count: 2)) == nil)
    }

    @Test func anEmptyListPicksNothing() {
        #expect(WorkspaceShortcuts.workspace(number: 1, in: []) == nil)
    }

    @Test func theFirstNineWorkspacesAreNumberedFromOne() {
        let listed = workspaces(count: 10)
        let numbered = WorkspaceShortcuts.numbered(listed)
        #expect(numbered.map(\.number) == Array(1...9))
        #expect(numbered.map(\.workspace) == Array(listed.prefix(9)))
    }

    @Test func aShortListIsNumberedWhole() {
        #expect(WorkspaceShortcuts.numbered(workspaces(count: 2)).map(\.number) == [1, 2])
    }

    @Test func theLastNumberIsTheListLengthUpToNine() {
        #expect(WorkspaceShortcuts.lastNumber(of: workspaces(count: 3)) == 3)
        #expect(WorkspaceShortcuts.lastNumber(of: workspaces(count: 10)) == 9)
    }
}
