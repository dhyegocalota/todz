import Testing
@testable import TodzKit

private func row(_ number: Int) -> MenuBarFocus {
    .row(TaskKey(projectIdentifier: "inbox", number: number))
}

private let allTargets: [MenuBarFocus] = [.composer, row(1), row(2), .doneToday]

@Suite struct MenuBarNavigationTests {
    @Test func downWalksTheTargetsInOrder() {
        #expect(MenuBarNavigation.next(from: .composer, direction: .down, in: allTargets) == row(1))
        #expect(MenuBarNavigation.next(from: row(1), direction: .down, in: allTargets) == row(2))
        #expect(MenuBarNavigation.next(from: row(2), direction: .down, in: allTargets) == .doneToday)
    }

    @Test func upWalksBackAndReturnsTheComposerFromTheFirstRow() {
        #expect(MenuBarNavigation.next(from: .doneToday, direction: .up, in: allTargets) == row(2))
        #expect(MenuBarNavigation.next(from: row(1), direction: .up, in: allTargets) == .composer)
    }

    @Test func theEndsDoNotWrap() {
        #expect(MenuBarNavigation.next(from: .doneToday, direction: .down, in: allTargets) == .doneToday)
        #expect(MenuBarNavigation.next(from: .composer, direction: .up, in: allTargets) == .composer)
    }

    @Test func closingTheDayHasNoComposerSoTheFirstRowIsTheTop() {
        let rows: [MenuBarFocus] = [row(1), row(2)]
        #expect(MenuBarNavigation.next(from: row(1), direction: .up, in: rows) == row(1))
        #expect(MenuBarNavigation.next(from: row(1), direction: .down, in: rows) == row(2))
    }

    @Test func aVanishedFocusedRowFallsBackToTheComposer() {
        #expect(MenuBarNavigation.next(from: row(9), direction: .down, in: allTargets) == .composer)
        #expect(MenuBarNavigation.next(from: nil, direction: .up, in: allTargets) == .composer)
    }

    @Test func withoutAComposerAVanishedRowFallsBackToTheFirstTarget() {
        #expect(MenuBarNavigation.next(from: row(9), direction: .down, in: [row(1), row(2)]) == row(1))
    }

    @Test func noTargetsMeansNowhereToGo() {
        #expect(MenuBarNavigation.next(from: .composer, direction: .down, in: []) == nil)
    }

    @Test func theTargetsAreTheComposerTheRowsAndDoneTodayWhereTheyExist() {
        let keys = [TaskKey(projectIdentifier: "inbox", number: 1), TaskKey(projectIdentifier: "inbox", number: 2)]
        #expect(MenuBarNavigation.targets(hasComposer: true, rows: keys, hasDoneToday: true, doneRows: []) == allTargets)
        #expect(MenuBarNavigation.targets(hasComposer: false, rows: keys, hasDoneToday: false, doneRows: []) == [row(1), row(2)])
    }

    @Test func expandedDoneTodayRowsFollowTheDisclosureAsTargets() {
        let keys = [TaskKey(projectIdentifier: "inbox", number: 1)]
        let doneKeys = [TaskKey(projectIdentifier: "inbox", number: 7), TaskKey(projectIdentifier: "inbox", number: 8)]
        let targets = MenuBarNavigation.targets(hasComposer: true, rows: keys, hasDoneToday: true, doneRows: doneKeys)
        #expect(targets == [.composer, row(1), .doneToday, row(7), row(8)])
        #expect(MenuBarNavigation.next(from: .doneToday, direction: .down, in: targets) == row(7))
        #expect(MenuBarNavigation.next(from: row(8), direction: .up, in: targets) == row(7))
    }
}
