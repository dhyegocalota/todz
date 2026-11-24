import Foundation
import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let alpha = "alpha"
private let beta = "beta"

private func task(_ number: Int?, project: String = alpha, state: TaskState = .open) -> WidgetSnapshotTask {
    WidgetSnapshotTask(
        projectIdentifier: project,
        projectName: project,
        number: number,
        title: "A task",
        dueDate: today,
        creatorLabel: nil,
        isOverdue: false,
        state: state
    )
}

private func snapshot(open: [WidgetSnapshotTask], pending: [WidgetSnapshotTask] = [], doneToday: [WidgetSnapshotTask]) -> WidgetSnapshot {
    WidgetSnapshot(
        workspaceName: "Acme",
        day: today,
        timeZoneIdentifier: harnessTimeZoneIdentifier,
        open: open,
        pending: pending,
        doneToday: doneToday
    )
}

private let mixed = snapshot(open: [task(1), task(2)], pending: [task(nil)], doneToday: [task(3, state: .done)])

@Suite struct WidgetToggleTests {
    @Test func completingAnOpenRowSetsItDoneInPlaceAndAsksTheApp() throws {
        let toggled = try #require(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 2, to: .done, at: fixedInstant))
        #expect(toggled.snapshot == snapshot(open: [task(1), task(2, state: .done)], pending: [task(nil)], doneToday: [task(3, state: .done)]))
        #expect(toggled.request == WidgetRequest(projectIdentifier: alpha, number: 2, state: .done, at: fixedInstant))
    }

    @Test func reopeningADoneRowSetsItOpenInPlace() throws {
        let toggled = try #require(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 3, to: .open, at: fixedInstant))
        #expect(toggled.snapshot == snapshot(open: [task(1), task(2)], pending: [task(nil)], doneToday: [task(3)]))
        #expect(toggled.request == WidgetRequest(projectIdentifier: alpha, number: 3, state: .open, at: fixedInstant))
    }

    @Test func aTaskAlreadyInTheTargetStateAsksNothing() {
        #expect(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 1, to: .open, at: fixedInstant) == nil)
        #expect(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 3, to: .done, at: fixedInstant) == nil)
    }

    @Test func aSecondTapOnARedrawnRowNeverInvertsIt() throws {
        let toggled = try #require(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 1, to: .done, at: fixedInstant))
        #expect(WidgetToggle.setting(toggled.snapshot, projectIdentifier: alpha, number: 1, to: .done, at: fixedInstant) == nil)
    }

    @Test func aTaskNotInTheSnapshotAsksNothing() {
        #expect(WidgetToggle.setting(mixed, projectIdentifier: alpha, number: 9, to: .done, at: fixedInstant) == nil)
        #expect(WidgetToggle.setting(mixed, projectIdentifier: beta, number: 1, to: .done, at: fixedInstant) == nil)
    }

    @Test func aPendingAddCannotBeToggled() {
        let pendingOnly = snapshot(open: [], pending: [task(nil, project: beta)], doneToday: [])
        #expect(WidgetToggle.setting(pendingOnly, projectIdentifier: beta, number: 1, to: .done, at: fixedInstant) == nil)
    }
}
