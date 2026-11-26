import Testing
@testable import TodzKit

private let first = RowIdentity.task(TaskKey(projectIdentifier: "inbox", number: 1))
private let second = RowIdentity.task(TaskKey(projectIdentifier: "inbox", number: 2))
private let third = RowIdentity.task(TaskKey(projectIdentifier: "inbox", number: 3))
private let pending = RowIdentity.attempt("key-1")
private let confirmed = RowIdentity.attempt("key-1")

private func shown(_ identities: Set<RowIdentity>?, in item: SidebarItem = .today) -> ShownRows {
    ShownRows(item: item, identities: identities)
}

@Suite struct AddedRowsTests {
    @Test func theFirstRenderAddsNothing() {
        #expect(AddedRows.added(known: nil, current: shown([first, second])).isEmpty)
    }

    @Test func rowsThatWereAlreadyShownAreNotAdded() {
        #expect(AddedRows.added(known: shown([first, second]), current: shown([first, second])).isEmpty)
    }

    @Test func aRowThatWasNotThereIsAdded() {
        #expect(AddedRows.added(known: shown([first]), current: shown([first, second])) == [second])
    }

    @Test func aRowAddedToAnEmptyListIsAdded() {
        #expect(AddedRows.added(known: shown([]), current: shown([first])) == [first])
    }

    @Test func removedRowsAddNothing() {
        #expect(AddedRows.added(known: shown([first, second]), current: shown([second])).isEmpty)
    }

    @Test func aPendingRowThatIsConfirmedIsNotAddedAgain() {
        #expect(AddedRows.added(known: shown([pending]), current: shown([confirmed])).isEmpty)
    }

    @Test func aListThatFinishedLoadingAddsNothing() {
        #expect(AddedRows.added(known: shown(nil), current: shown([first, second])).isEmpty)
    }

    @Test func aListThatIsLoadingAddsNothing() {
        #expect(AddedRows.added(known: shown([first]), current: shown(nil)).isEmpty)
    }

    @Test func anotherSidebarItemAddsNothing() {
        #expect(AddedRows.added(known: shown([first], in: .today), current: shown([first, second, third], in: .upcoming)).isEmpty)
    }

    @Test func aRowScrolledBackIntoViewIsNotAddedBecauseTheKnownRowsIncludeIt() {
        let known = shown([first, second, third])
        #expect(AddedRows.added(known: known, current: known).isEmpty)
    }
}
