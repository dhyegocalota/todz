import Foundation
import Testing
@testable import TodzKit

private func workspace(_ name: String) -> Workspace {
    Workspace(identifier: name, name: name, createdAt: fixedInstant, projects: [])
}

private let acme = workspace("acme")
private let side = workspace("side")
private let garden = workspace("garden")
private let listed = [acme, side, garden]

@Suite struct WorkspaceSelectionTests {
    @Test func aChosenSelectionShowsOnlyItsWorkspacesInListedOrder() {
        let selection = WorkspaceSelection.chosen([garden.identifier, acme.identifier])
        #expect(selection.workspaces(in: listed) == [acme, garden])
    }

    @Test func allShowsEveryListedWorkspaceIncludingOneAddedLater() {
        let later = workspace("later")
        #expect(WorkspaceSelection.all.workspaces(in: listed) == listed)
        #expect(WorkspaceSelection.all.workspaces(in: listed + [later]) == listed + [later])
    }

    @Test func aChosenSelectionDoesNotTakeAWorkspaceAddedLater() {
        let later = workspace("later")
        let selection = WorkspaceSelection.chosen([acme.identifier])
        #expect(selection.workspaces(in: listed + [later]) == [acme])
    }

    @Test func aChosenIdentifierThatIsNoLongerListedShowsNothing() {
        #expect(WorkspaceSelection.chosen(["gone"]).workspaces(in: listed) == [])
    }

    @Test func togglingAnUnchosenWorkspaceAddsIt() {
        let toggled = WorkspaceSelection.chosen([acme.identifier]).toggling(identifier: side.identifier, in: listed)
        #expect(toggled == .chosen([acme.identifier, side.identifier]))
    }

    @Test func togglingAChosenWorkspaceRemovesIt() {
        let toggled = WorkspaceSelection.chosen([acme.identifier, side.identifier]).toggling(identifier: side.identifier, in: listed)
        #expect(toggled == .chosen([acme.identifier]))
    }

    @Test func togglingAWorkspaceOffAllChoosesTheOthers() {
        let toggled = WorkspaceSelection.all.toggling(identifier: side.identifier, in: listed)
        #expect(toggled == .chosen([acme.identifier, garden.identifier]))
    }

    @Test func togglingTheLastChosenWorkspaceKeepsIt() {
        let selection = WorkspaceSelection.chosen([acme.identifier])
        #expect(selection.toggling(identifier: acme.identifier, in: listed) == selection)
    }

    @Test(arguments: [WorkspaceSelection.all, .chosen(["acme", "side"])])
    func aSelectionSurvivesEncodingAndDecoding(selection: WorkspaceSelection) throws {
        let data = try JSONEncoder().encode(selection)
        #expect(try JSONDecoder().decode(WorkspaceSelection.self, from: data) == selection)
    }

    @Test func aCacheWrittenBeforeSelectionsReadsItsActiveWorkspaceAsTheSelection() throws {
        let legacy = Data(#"{"ownerIdentifier":"owner","workspaces":[],"activeWorkspaceIdentifier":"acme"}"#.utf8)
        let cache = try JSONDecoder().decode(OwnerCache.self, from: legacy)
        #expect(cache.selection == .chosen(["acme"]))
    }

    @Test func aLegacyCacheWithNoActiveWorkspaceHasNoSelection() throws {
        let legacy = Data(#"{"ownerIdentifier":"owner","workspaces":[]}"#.utf8)
        let cache = try JSONDecoder().decode(OwnerCache.self, from: legacy)
        #expect(cache.selection == nil)
    }

    @Test func aStoredSelectionWinsOverTheActiveWorkspace() throws {
        let cache = OwnerCache(ownerIdentifier: "owner", workspaces: [], activeWorkspaceIdentifier: "acme", selection: .all)
        let decoded = try JSONDecoder().decode(OwnerCache.self, from: JSONEncoder().encode(cache))
        #expect(decoded.selection == .all)
        #expect(decoded == cache)
    }
}
