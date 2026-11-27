import Testing
@testable import TodzKit

private func listed(count: Int) -> [Workspace] {
    (1...count).map { Workspace(identifier: "workspace-\($0)", name: "Workspace \($0)", createdAt: fixedInstant, projects: []) }
}

@Suite struct WorkspaceChromeTests {
    @Test func aSoleWorkspaceInThePopoverIsAPlainNameWithNoSwitchingChrome() {
        let visible = listed(count: 1)
        let chrome = WorkspaceChrome(visible: visible, selection: .chosen(["workspace-1"]), isMainWindow: false)
        #expect(chrome.switcher == .plainName)
        #expect(!chrome.showsAllWorkspaces)
        #expect(!chrome.showsSwitchHint)
        #expect(!chrome.canStep)
        #expect(chrome.lastShortcutNumber == 1)
        #expect(chrome.rows == [WorkspaceChromeRow(workspace: visible[0], isChecked: true)])
    }

    @Test func aSoleWorkspaceInTheMainWindowKeepsItsMenuWithoutAllWorkspaces() {
        let chrome = WorkspaceChrome(visible: listed(count: 1), selection: .chosen(["workspace-1"]), isMainWindow: true)
        #expect(chrome.switcher == .menu)
        #expect(!chrome.showsAllWorkspaces)
        #expect(!chrome.showsSwitchHint)
        #expect(!chrome.canStep)
    }

    @Test(arguments: [false, true]) func severalWorkspacesDrawAMenuWithAllWorkspacesTheHintAndStepping(isMainWindow: Bool) {
        let chrome = WorkspaceChrome(visible: listed(count: 3), selection: .chosen(["workspace-2"]), isMainWindow: isMainWindow)
        #expect(chrome.switcher == .menu)
        #expect(chrome.showsAllWorkspaces)
        #expect(chrome.showsSwitchHint)
        #expect(chrome.canStep)
        #expect(chrome.lastShortcutNumber == 3)
        #expect(chrome.rows.map(\.isChecked) == [false, true, false])
    }

    @Test func theAllSelectionChecksEveryRow() {
        let chrome = WorkspaceChrome(visible: listed(count: 2), selection: .all, isMainWindow: true)
        #expect(chrome.rows.map(\.isChecked) == [true, true])
    }

    @Test func theLastShortcutNumberStopsAtNine() {
        let chrome = WorkspaceChrome(visible: listed(count: 12), selection: .all, isMainWindow: true)
        #expect(chrome.lastShortcutNumber == 9)
    }
}
