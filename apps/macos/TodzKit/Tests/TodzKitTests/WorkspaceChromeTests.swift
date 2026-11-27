import Testing
@testable import TodzKit

private func listed(count: Int) -> [Workspace] {
    (1...count).map { Workspace(identifier: "workspace-\($0)", name: "Workspace \($0)", createdAt: fixedInstant, projects: []) }
}

@Suite struct WorkspaceChromeTests {
    @Test func aSoleWorkspaceInThePopoverIsAPlainNameWithNoSwitchingChrome() {
        let visible = listed(count: 1)
        let chrome = WorkspaceChrome(visible: visible, selection: .chosen(["workspace-1"]), isMainWindow: false, isSingleSelection: false)
        #expect(chrome.switcher == .plainName)
        #expect(!chrome.showsAllWorkspaces)
        #expect(chrome.rows == [WorkspaceChromeRow(workspace: visible[0], isChecked: true)])
    }

    @Test func aSoleWorkspaceInTheMainWindowKeepsItsMenuWithoutAllWorkspaces() {
        let chrome = WorkspaceChrome(visible: listed(count: 1), selection: .chosen(["workspace-1"]), isMainWindow: true, isSingleSelection: false)
        #expect(chrome.switcher == .menu)
        #expect(!chrome.showsAllWorkspaces)
    }

    @Test(arguments: [false, true]) func severalWorkspacesDrawAMenuWithAllWorkspaces(isMainWindow: Bool) {
        let chrome = WorkspaceChrome(visible: listed(count: 3), selection: .chosen(["workspace-2"]), isMainWindow: isMainWindow, isSingleSelection: false)
        #expect(chrome.switcher == .menu)
        #expect(chrome.showsAllWorkspaces)
        #expect(chrome.rows.map(\.isChecked) == [false, true, false])
    }

    @Test func withTheSwitchOnTheMenuOffersNoAllWorkspaces() {
        let chrome = WorkspaceChrome(visible: listed(count: 3), selection: .chosen(["workspace-2"]), isMainWindow: true, isSingleSelection: true)
        #expect(chrome.switcher == .menu)
        #expect(!chrome.showsAllWorkspaces)
    }

    @Test func theAllSelectionChecksEveryRow() {
        let chrome = WorkspaceChrome(visible: listed(count: 2), selection: .all, isMainWindow: true, isSingleSelection: false)
        #expect(chrome.rows.map(\.isChecked) == [true, true])
    }
}
