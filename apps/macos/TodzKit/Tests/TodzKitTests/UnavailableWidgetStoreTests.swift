import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)

private let snapshot = WidgetSnapshot(
    workspaceName: "Acme",
    day: today,
    timeZoneIdentifier: harnessTimeZoneIdentifier,
    open: [],
    pending: [],
    doneToday: []
)

@Suite struct UnavailableWidgetStoreTests {
    let store = UnavailableWidgetStore()

    @Test func itHoldsNoSnapshot() throws {
        #expect(try store.readSnapshot() == nil)
    }

    @Test func itHoldsNoRequests() throws {
        #expect(try store.requests() == [])
    }

    @Test func aSnapshotCannotBeWritten() {
        #expect(throws: WidgetStoreError.unwritable) { try store.writeSnapshot(snapshot) }
    }

    @Test func aRequestCannotBeAdded() {
        let request = WidgetRequest(projectIdentifier: "acme-inbox", number: 1, state: .done, at: fixedInstant)
        #expect(throws: WidgetStoreError.unwritable) { try store.addRequest(request) }
    }

    @Test func erasingSucceedsWithNothingToErase() throws {
        try store.eraseSnapshot()
        try store.removeRequests(["\(UUID().uuidString).json"])
        try store.erase()
    }
}
