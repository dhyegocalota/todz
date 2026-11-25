import Foundation
import Testing
@testable import TodzKit

private let inbox = Project(identifier: "inbox", name: "Inbox", isInbox: true, createdAt: fixedInstant)
private let alpha = Project(identifier: "alpha", name: "Alpha", isInbox: false, createdAt: fixedInstant)
private let acme = Workspace(identifier: "acme", name: "Acme", createdAt: fixedInstant, projects: [inbox, alpha])
private let today = CalendarDate(year: 2026, month: 11, day: 24)
private let yesterday = CalendarDate(year: 2026, month: 11, day: 23)
private let tomorrow = CalendarDate(year: 2026, month: 11, day: 25)
private let lastSecondOfYesterday = Date(timeIntervalSince1970: 1_795_489_199)
private let firstSecondOfToday = Date(timeIntervalSince1970: 1_795_489_200)
private let agentClientName = "Claude Code"

private func open(_ number: Int, dueDate: CalendarDate? = today) -> TaskRecord {
    MutableTask(number: number, title: "Task \(number)", dueDate: dueDate).record
}

private func done(_ number: Int, completedAt: Date) -> TaskRecord {
    MutableTask(number: number, title: "Task \(number)", dueDate: today, state: .done, completedAt: completedAt).record
}

private func pending(_ title: String, dueDate: CalendarDate?) -> PendingTask {
    PendingTask(projectIdentifier: alpha.identifier, idempotencyKey: "key-\(title)", title: title, dueDate: dueDate)
}

private func row(_ number: Int?, project: Project = alpha, title: String, dueDate: CalendarDate? = today, state: TaskState = .open) -> WidgetSnapshotTask {
    WidgetSnapshotTask(
        projectIdentifier: project.identifier,
        projectName: project.name,
        number: number,
        title: title,
        dueDate: dueDate,
        creatorLabel: nil,
        isOverdue: false,
        state: state
    )
}

private func snapshot(_ tasks: [TaskRecord], pendingTasks: [PendingTask] = [], showsDayTemperature: Bool = false) throws -> WidgetSnapshot {
    let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
    var board = TaskBoard()
    board.merge(projectIdentifier: alpha.identifier, tasks: tasks)
    let views = TaskViews(projects: acme.projects, board: board, pendingTasks: pendingTasks, day: today, timeZone: timeZone)
    return WidgetSnapshot.of(views: views, workspace: acme, day: today, timeZone: timeZone, showsDayTemperature: showsDayTemperature)
}

@Suite struct WidgetSnapshotTests {
    @Test func anOpenTaskDueTodayIsAnOpenRowOfTheActiveWorkspaceAndDay() throws {
        let snapshot = try snapshot([open(1)])
        #expect(snapshot.workspaceName == acme.name)
        #expect(snapshot.day == today)
        #expect(snapshot.timeZoneIdentifier == harnessTimeZoneIdentifier)
        #expect(snapshot.open == [row(1, title: "Task 1")])
        #expect(snapshot.pending == [])
        #expect(snapshot.doneToday == [])
    }

    @Test func anOverdueTaskComesFirstAndSaysItIsOverdue() throws {
        let snapshot = try snapshot([open(1), open(2, dueDate: yesterday)])
        #expect(snapshot.open.map(\.number) == [2, 1])
        #expect(snapshot.open.map(\.isOverdue) == [true, false])
    }

    @Test func tasksDoneTodayFollowNewestFirstAndOneDoneYesterdayIsLeftOut() throws {
        let snapshot = try snapshot([
            done(1, completedAt: firstSecondOfToday),
            done(2, completedAt: fixedInstant),
            done(3, completedAt: lastSecondOfYesterday),
        ])
        #expect(snapshot.open == [])
        #expect(snapshot.doneToday == [row(2, title: "Task 2", state: .done), row(1, title: "Task 1", state: .done)])
    }

    @Test func pendingAddsDueByTodayHaveNoNumber() throws {
        let snapshot = try snapshot([], pendingTasks: [pending("Draft", dueDate: today), pending("Later", dueDate: tomorrow), pending("Undated", dueDate: nil)])
        #expect(snapshot.pending == [row(nil, title: "Draft")])
        #expect(snapshot.open == [])
    }

    @Test func anAgentsTaskCarriesItsClientNameAsTheCreatorLabel() throws {
        var task = MutableTask(number: 1, title: "Task 1", dueDate: today)
        task.createdBy = .agent(clientName: agentClientName)
        let snapshot = try snapshot([task.record, open(2)])
        #expect(snapshot.open.map(\.creatorLabel) == [agentClientName, nil])
    }

    @Test func anEmptyTodayHasNoRows() throws {
        let snapshot = try snapshot([open(1, dueDate: nil), open(2, dueDate: tomorrow)])
        #expect(snapshot.open == [])
        #expect(snapshot.pending == [])
        #expect(snapshot.doneToday == [])
    }

    @Test func roundTripsThroughTheOwnerCoding() throws {
        var agentTask = MutableTask(number: 3, title: "Task 3", dueDate: yesterday)
        agentTask.createdBy = .agent(clientName: agentClientName)
        let snapshot = try snapshot(
            [open(1), agentTask.record, done(2, completedAt: fixedInstant)],
            pendingTasks: [pending("Draft", dueDate: today)]
        )
        let data = try OwnerCoding.encoder().encode(snapshot)
        #expect(try OwnerCoding.decoder().decode(WidgetSnapshot.self, from: data) == snapshot)
    }

    @Test(arguments: [true, false])
    func flagRoundTrips(showsDayTemperature: Bool) throws {
        let snapshot = try snapshot([open(1)], showsDayTemperature: showsDayTemperature)
        let data = try OwnerCoding.encoder().encode(snapshot)
        let decoded = try OwnerCoding.decoder().decode(WidgetSnapshot.self, from: data)
        #expect(decoded.showsDayTemperature == showsDayTemperature)
        #expect(decoded == snapshot)
    }

    @Test func anUnknownExtraKeyStillDecodes() throws {
        let data = try OwnerCoding.encoder().encode(try snapshot([open(1)]))
        var object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object["a_future_key"] = true
        let withAnExtraKey = try JSONSerialization.data(withJSONObject: object)
        #expect(try OwnerCoding.decoder().decode(WidgetSnapshot.self, from: withAnExtraKey) == (try snapshot([open(1)])))
    }

    @Test func missingKeyFailsToDecode() throws {
        let data = try OwnerCoding.encoder().encode(try snapshot([open(1)]))
        var object = try #require(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object.removeValue(forKey: "shows_day_temperature")
        let withoutTheKey = try JSONSerialization.data(withJSONObject: object)
        #expect(throws: DecodingError.self) {
            try OwnerCoding.decoder().decode(WidgetSnapshot.self, from: withoutTheKey)
        }
    }

    @Test func aTaskWithACreatorLabelShowsNoProjectTag() throws {
        var agentTask = MutableTask(number: 1, title: "Task 1", dueDate: today)
        agentTask.createdBy = .agent(clientName: agentClientName)
        let snapshot = try snapshot([agentTask.record, open(2)])
        #expect(snapshot.open.map(\.isProjectTagShown) == [false, true])
    }

    @Test func aPendingTaskShowsItsProjectTag() throws {
        let snapshot = try snapshot([], pendingTasks: [pending("Draft", dueDate: today)])
        #expect(snapshot.pending.map(\.isProjectTagShown) == [true])
    }

    @Test func isCurrentOnlyOnItsOwnDay() throws {
        let snapshot = try snapshot([open(1)])
        #expect(snapshot.isCurrent(on: today))
        #expect(snapshot.isCurrent(on: tomorrow) == false)
        #expect(snapshot.isCurrent(on: yesterday) == false)
    }
}
