import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let workspaceName = "Acme"
private let manyOpenCount = 9

private func task(_ number: Int?, state: TaskState = .open) -> WidgetSnapshotTask {
    WidgetSnapshotTask(
        projectIdentifier: "alpha",
        projectName: "Alpha",
        number: number,
        title: "A task",
        dueDate: today,
        creatorLabel: nil,
        isOverdue: false,
        state: state
    )
}

private func snapshot(open: [WidgetSnapshotTask] = [], pending: [WidgetSnapshotTask] = [], doneToday: [WidgetSnapshotTask] = []) -> WidgetSnapshot {
    WidgetSnapshot(
        workspaceName: workspaceName,
        day: today,
        timeZoneIdentifier: harnessTimeZoneIdentifier,
        open: open,
        pending: pending,
        doneToday: doneToday,
        showsDayTemperature: false
    )
}

private func widgetToday(_ content: WidgetContent) throws -> WidgetToday {
    guard case let .today(widgetToday) = content else {
        Issue.record("expected Today, got \(content)")
        throw CancellationError()
    }
    return widgetToday
}

@Suite struct WidgetContentTests {
    @Test(arguments: WidgetFamilyKind.allCases)
    func noSnapshotIsThePrompt(family: WidgetFamilyKind) {
        #expect(WidgetContent.of(snapshot: nil, family: family, on: today) == .prompt)
    }

    @Test(arguments: WidgetFamilyKind.allCases)
    func aSnapshotOfAnotherDayIsThePrompt(family: WidgetFamilyKind) {
        let content = WidgetContent.of(snapshot: snapshot(open: [task(1)]), family: family, on: tomorrow)
        #expect(content == .prompt)
    }

    @Test(arguments: WidgetFamilyKind.allCases)
    func anEmptyTodayIsTheEmptyStateNamingTheWorkspace(family: WidgetFamilyKind) {
        #expect(WidgetContent.of(snapshot: snapshot(), family: family, on: today) == .empty(workspaceName: workspaceName))
    }

    @Test func theMediumShowsThreeRowsTheLargeSevenAndTheSmallNone() throws {
        let many = snapshot(open: (1...manyOpenCount).map { task($0) })
        let medium = try widgetToday(WidgetContent.of(snapshot: many, family: .medium, on: today))
        let large = try widgetToday(WidgetContent.of(snapshot: many, family: .large, on: today))
        let small = try widgetToday(WidgetContent.of(snapshot: many, family: .small, on: today))
        #expect(medium.rows.map(\.number) == [1, 2, 3])
        #expect(large.rows.map(\.number) == [1, 2, 3, 4, 5, 6, 7])
        #expect(small.rows == [])
        #expect([medium, large, small].map(\.openCount) == [manyOpenCount, manyOpenCount, manyOpenCount])
    }

    @Test func doneRowsFillOnlyTheSlotsTheOpenAndPendingRowsLeave() throws {
        let mixed = snapshot(open: [task(1)], pending: [task(nil)], doneToday: [task(4, state: .done), task(3, state: .done), task(2, state: .done)])
        let medium = try widgetToday(WidgetContent.of(snapshot: mixed, family: .medium, on: today))
        let large = try widgetToday(WidgetContent.of(snapshot: mixed, family: .large, on: today))
        #expect(medium.rows == [task(1), task(nil), task(4, state: .done)])
        #expect(large.rows == [task(1), task(nil), task(4, state: .done), task(3, state: .done), task(2, state: .done)])
    }

    @Test func theRingCountsDoneTodayOfDoneAndOpenLeavingPendingAddsOut() throws {
        let mixed = snapshot(open: [task(1), task(2)], pending: [task(nil)], doneToday: [task(3, state: .done), task(4, state: .done), task(5, state: .done)])
        let ring = try widgetToday(WidgetContent.of(snapshot: mixed, family: .small, on: today))
        #expect(ring.openCount == 2)
        #expect(ring.doneCount == 3)
        #expect(ring.totalCount == 5)
        #expect(ring.progress == 0.6)
    }

    @Test func nextUpIsTheFirstOpenTaskInTodaysOrder() throws {
        let mixed = snapshot(open: [task(2), task(1)], pending: [task(nil)], doneToday: [task(3, state: .done)])
        let nextUp = try widgetToday(WidgetContent.of(snapshot: mixed, family: .small, on: today))
        #expect(nextUp.nextUp == task(2))
        #expect(nextUp.isAllDone == false)
    }

    @Test func nextUpIsThePendingAddWhenNoConfirmedTaskIsOpen() throws {
        let pendingOnly = snapshot(pending: [task(nil)], doneToday: [task(3, state: .done)])
        let nextUp = try widgetToday(WidgetContent.of(snapshot: pendingOnly, family: .small, on: today))
        #expect(nextUp.nextUp == task(nil))
        #expect(nextUp.openCount == 0)
    }

    @Test(arguments: WidgetFamilyKind.allCases)
    func allDoneHasNoNextUpAFullRingAndTheDoneRows(family: WidgetFamilyKind) throws {
        let allDone = snapshot(doneToday: [task(2, state: .done), task(1, state: .done)])
        let content = try widgetToday(WidgetContent.of(snapshot: allDone, family: family, on: today))
        #expect(content.isAllDone)
        #expect(content.nextUp == nil)
        #expect(content.openCount == 0)
        #expect(content.progress == 1)
        #expect(content.rows == Array([task(2, state: .done), task(1, state: .done)].prefix(family.rowCount)))
    }

    @Test func aRowFlippedInPlaceKeepsItsSlotAndTheCountsFollowTheStates() throws {
        let flipped = snapshot(open: [task(1, state: .done), task(2)], doneToday: [task(3, state: .open)])
        let medium = try widgetToday(WidgetContent.of(snapshot: flipped, family: .medium, on: today))
        #expect(medium.rows == [task(1, state: .done), task(2), task(3, state: .open)])
        #expect(medium.openCount == 2)
        #expect(medium.doneCount == 1)
        #expect(medium.nextUp == task(2))
    }
}
