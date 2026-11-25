import Testing
@testable import TodzKit

private let today = CalendarDate(year: 2026, month: 11, day: 25)
private let yesterday = today.adding(days: -1)
private let tomorrow = today.adding(days: 1)
private let agent = ChangeActor.agent(clientName: "claude-code")

private func record(
    title: String = "Review PR",
    state: TaskState = .open,
    dueDate: CalendarDate?,
    createdBy: ChangeActor = .owner
) -> TaskRecord {
    var task = MutableTask(number: 12, title: title, dueDate: dueDate, state: state, completedAt: state == .done ? fixedInstant : nil)
    task.createdBy = createdBy
    return task.record
}

private func isAgentChange(previous: TaskRecord?, arrived: TaskRecord) -> Bool {
    RibbonTrigger.isAgentChange(previous: previous, arrived: arrived, today: today)
}

@Suite struct RibbonTriggerTests {
    @Test func anOpenAgentTaskDueTodayThatIsNewToTheBoardIsAChange() {
        #expect(isAgentChange(previous: nil, arrived: record(dueDate: today, createdBy: agent)))
    }

    @Test func anOpenTaskTheOwnerCreatedIsNotAChange() {
        #expect(!isAgentChange(previous: nil, arrived: record(dueDate: today, createdBy: .owner)))
    }

    @Test func anAgentTaskWithNoDueDateIsNotAChange() {
        #expect(!isAgentChange(previous: nil, arrived: record(dueDate: nil, createdBy: agent)))
    }

    @Test func anAgentTaskDueTomorrowIsNotAChange() {
        #expect(!isAgentChange(previous: nil, arrived: record(dueDate: tomorrow, createdBy: agent)))
    }

    @Test func anOverdueAgentTaskIsAChange() {
        #expect(isAgentChange(previous: nil, arrived: record(dueDate: yesterday, createdBy: agent)))
    }

    @Test func anAgentTaskThatArrivesDoneAndNewIsNotAChange() {
        #expect(!isAgentChange(previous: nil, arrived: record(state: .done, dueDate: today, createdBy: agent)))
    }

    @Test func aTaskOfTodayThatArrivesDoneIsAChange() {
        #expect(isAgentChange(previous: record(dueDate: today), arrived: record(state: .done, dueDate: today)))
    }

    @Test func aTaskDueTomorrowThatArrivesDoneIsNotAChange() {
        #expect(!isAgentChange(previous: record(dueDate: tomorrow), arrived: record(state: .done, dueDate: tomorrow)))
    }

    @Test func aTaskThatWasAlreadyDoneIsNotAChange() {
        #expect(!isAgentChange(previous: record(state: .done, dueDate: today), arrived: record(state: .done, dueDate: today)))
    }

    @Test func aRetitledOpenTaskOfTodayIsNotAChange() {
        #expect(!isAgentChange(previous: record(dueDate: today), arrived: record(title: "Review the PR", dueDate: today)))
    }

    @Test func aTaskMovedOutOfTodayIsNotAChange() {
        #expect(!isAgentChange(previous: record(dueDate: today), arrived: record(dueDate: tomorrow)))
    }
}
