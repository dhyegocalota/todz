import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let nextWeek = CalendarDate(year: 2026, month: 12, day: 1)

enum TaskAction: CaseIterable, Sendable {
    case complete
    case reopen
    case updateTitle
    case updateNotes
    case updateDueDate
    case move

    var target: WriteTarget {
        switch self {
        case .complete, .reopen: .taskField(firstTask, .state)
        case .updateTitle: .taskField(firstTask, .title)
        case .updateNotes: .taskField(firstTask, .notes)
        case .updateDueDate: .taskField(firstTask, .dueDate)
        case .move: .taskField(firstTask, .order)
        }
    }

    var route: FakeRoute {
        switch self {
        case .complete: .completeTasks
        case .reopen: .reopenTasks
        case .updateTitle, .updateNotes, .updateDueDate, .move: .updateTask
        }
    }

    @MainActor func run(on model: AppModel) async {
        switch self {
        case .complete: await model.complete(task: firstTask)
        case .reopen: await model.reopen(task: firstTask)
        case .updateTitle: await model.updateTitle(task: firstTask, title: "Renamed")
        case .updateNotes: await model.updateNotes(task: firstTask, notes: "Two copies")
        case .updateDueDate: await model.updateDueDate(task: firstTask, dueDate: nextWeek)
        case .move: await model.move(task: firstTask, placement: .after(anchor: 2))
        }
    }
}

extension AppModelTests {
    @MainActor private func readyHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        return harness
    }

    @Test func addingATaskWaitsForTheServerThenHoldsAndSelectsIt() async throws {
        let harness = try await readyHarness()
        let inFlight = Captured<Set<WriteTarget>>()
        let boardWhileWaiting = Captured<TaskBoard>()
        harness.service.onCall = { _ in
            inFlight.value = harness.model.writesInFlight
            boardWhileWaiting.value = harness.model.board
        }
        let boardBefore = harness.model.board
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: harness.model.today)
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: harness.model.today, idempotencyKey: "key-1")
        #expect(harness.service.calls == [.addTasks(session: harness.session, projectIdentifier: inboxIdentifier, drafts: [draft])])
        #expect(inFlight.value == [.newTask(projectIdentifier: inboxIdentifier)])
        #expect(boardWhileWaiting.value == boardBefore)
        #expect(harness.model.writesInFlight == [])
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 3)?.title == "Call the bank")
        #expect(harness.model.selectedTask == TaskKey(projectIdentifier: inboxIdentifier, number: 3))
        #expect(harness.model.taskViews?.today.open.map(\.task.number) == [3])
    }

    @Test func tryAgainOnAnAddReusesItsIdempotencyKey() async throws {
        let harness = try await readyHarness()
        harness.service.failures[.addTasks] = .unreachable
        let boardBefore = harness.model.board
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.banner == .network)
        #expect(harness.model.canTryAgain)
        harness.service.failures[.addTasks] = nil
        await harness.model.tryAgain()
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        let add = FakeCall.addTasks(session: harness.session, projectIdentifier: inboxIdentifier, drafts: [draft])
        #expect(harness.service.calls == [add, add])
        #expect(harness.keys.issued == ["key-1"])
        #expect(harness.model.banner == nil)
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 3)?.title == "Call the bank")
    }

    @Test func twoAddsUseTwoIdempotencyKeys() async throws {
        let harness = try await readyHarness()
        await harness.model.addTask(title: "One", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.model.addTask(title: "Two", projectIdentifier: inboxIdentifier, dueDate: nil)
        #expect(harness.keys.issued == ["key-1", "key-2"])
    }

    @Test(arguments: TaskAction.allCases)
    func aTaskWriteMarksItsFieldInFlightAndReplacesTheTaskFromTheAnswer(action: TaskAction) async throws {
        let harness = try await readyHarness()
        let inFlight = Captured<Set<WriteTarget>>()
        let boardWhileWaiting = Captured<TaskBoard>()
        harness.service.onCall = { _ in
            inFlight.value = harness.model.writesInFlight
            boardWhileWaiting.value = harness.model.board
        }
        let boardBefore = harness.model.board
        await action.run(on: harness.model)
        let answered = try #require(harness.service.tasksOfProject[inboxIdentifier]?.first)
        #expect(harness.service.routes() == [action.route])
        #expect(inFlight.value == [action.target])
        #expect(boardWhileWaiting.value == boardBefore)
        #expect(harness.model.writesInFlight == [])
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1) == answered)
    }

    @Test(arguments: TaskAction.allCases)
    func aFailedTaskWriteLeavesTheBoardUnchanged(action: TaskAction) async throws {
        let harness = try await readyHarness()
        harness.service.failures[action.route] = .unexpected(status: 500)
        let boardBefore = harness.model.board
        await action.run(on: harness.model)
        #expect(harness.model.board == boardBefore)
        #expect(harness.model.writesInFlight == [])
        #expect(harness.model.banner == .changeNotSaved)
    }

    @Test func eachTaskWriteSendsItsRequest() async throws {
        let harness = try await readyHarness()
        await harness.model.complete(task: firstTask)
        await harness.model.reopen(task: firstTask)
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
        await harness.model.updateNotes(task: firstTask, notes: nil)
        await harness.model.updateDueDate(task: firstTask, dueDate: nextWeek)
        await harness.model.move(task: firstTask, placement: .first)
        #expect(
            harness.service.calls == [
                .completeTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [1]),
                .reopenTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [1]),
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .title("Renamed")),
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .notes(nil)),
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .dueDate(nextWeek)),
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .placement(.first)),
            ]
        )
    }

    @Test func aRuleViolationIsExposedForTheFieldThatSentIt() async throws {
        let harness = try await readyHarness()
        harness.service.failures[.updateTask] = .ruleViolated(issue: .titleTooLong, index: nil)
        let boardBefore = harness.model.board
        await harness.model.updateTitle(task: firstTask, title: String(repeating: "a", count: 201))
        #expect(harness.model.ruleIssues == [.taskField(firstTask, .title): .titleTooLong])
        #expect(harness.model.board == boardBefore)
        harness.service.failures[.updateTask] = nil
        await harness.model.updateTitle(task: firstTask, title: "Short")
        #expect(harness.model.ruleIssues == [:])
    }

    @Test func loadHistoryHoldsTheEntriesOfTheTask() async throws {
        let harness = try await readyHarness()
        let entry = HistoryEntry(at: fixedInstant, actor: ChangeActor(kind: .owner, clientName: nil), action: .created, fields: [], note: nil)
        harness.service.history = [entry]
        await harness.model.loadHistory(task: firstTask)
        #expect(harness.service.calls == [.readHistory(session: harness.session, projectIdentifier: inboxIdentifier, number: 1)])
        #expect(harness.model.histories[firstTask] == .loaded([entry]))
    }

    @Test func aHistoryThatFailsToLoadSaysSo() async throws {
        let harness = try await readyHarness()
        harness.service.failures[.readHistory] = .unreachable
        await harness.model.loadHistory(task: firstTask)
        #expect(harness.model.histories[firstTask] == .failed)
    }
}
