import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)

struct WashBand: Sendable {
    let daysOverdue: Int
    let opacity: Double
}

private let bands = [
    WashBand(daysOverdue: 1, opacity: 0.06),
    WashBand(daysOverdue: 2, opacity: 0.09),
    WashBand(daysOverdue: 6, opacity: 0.09),
    WashBand(daysOverdue: 7, opacity: 0.12),
    WashBand(daysOverdue: 30, opacity: 0.12),
]

private func task(dueDate: CalendarDate?, isOverdue: Bool = true, state: TaskState = .open) -> WidgetSnapshotTask {
    WidgetSnapshotTask(
        projectIdentifier: "alpha",
        projectName: "Alpha",
        number: 1,
        title: "A task",
        dueDate: dueDate,
        creatorLabel: nil,
        isOverdue: isOverdue,
        state: state
    )
}

private func opacity(of task: WidgetSnapshotTask, isShown: Bool = true, isContrastIncreased: Bool = false) -> Double {
    OverdueWash.opacity(of: task, on: today, isShown: isShown, isContrastIncreased: isContrastIncreased)
}

@Suite struct OverdueWashTests {
    @Test(arguments: bands)
    func anOpenOverdueTaskWashesByItsDaysOverdue(band: WashBand) {
        let overdue = task(dueDate: today.adding(days: -band.daysOverdue))
        #expect(opacity(of: overdue) == band.opacity)
    }

    @Test func aTaskNotOverdueHasNoWash() {
        #expect(opacity(of: task(dueDate: today, isOverdue: false)) == 0)
        #expect(opacity(of: task(dueDate: nil, isOverdue: false)) == 0)
    }

    @Test func aDoneTaskHasNoWash() {
        #expect(opacity(of: task(dueDate: today.adding(days: -9), state: .done)) == 0)
    }

    @Test func aSwitchedOffSettingHasNoWash() {
        #expect(opacity(of: task(dueDate: today.adding(days: -9)), isShown: false) == 0)
    }

    @Test func increasedContrastHasNoWash() {
        #expect(opacity(of: task(dueDate: today.adding(days: -9)), isContrastIncreased: true) == 0)
    }
}
