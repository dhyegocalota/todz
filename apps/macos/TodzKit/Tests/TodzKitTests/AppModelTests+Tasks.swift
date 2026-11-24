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

    @Test func twoAddsUseTwoIdempotencyKeys() async throws {
        let harness = try await readyHarness()
        await harness.model.addTask(title: "One", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.model.addTask(title: "Two", projectIdentifier: inboxIdentifier, dueDate: nil)
        #expect(harness.keys.issued == ["key-1", "key-2"])
    }

    @Test func anAddResentAfterTheServerWasUnreachableKeepsItsIdempotencyKey() async throws {
        let harness = try await readyHarness()
        harness.service.failures[.addTasks] = .unreachable
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.pause.started()
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: nil, idempotencyKey: "key-1")
        let add = FakeCall.addTasks(session: harness.session, projectIdentifier: inboxIdentifier, drafts: [draft])
        #expect(harness.service.calls.filter { $0.route == .addTasks } == [add, add])
        #expect(harness.keys.issued == ["key-1"])
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 3)?.title == "Call the bank")
    }

    @Test func eachTaskWriteSendsItsRequest() async throws {
        let harness = try await readyHarness()
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        await harness.model.reopen(task: firstTask)
        await harness.flushed()
        await harness.model.updateTitle(task: firstTask, title: "Renamed")
        await harness.flushed()
        await harness.model.updateNotes(task: firstTask, notes: nil)
        await harness.flushed()
        await harness.model.updateDueDate(task: firstTask, dueDate: nextWeek)
        await harness.flushed()
        await harness.model.move(task: firstTask, placement: .first)
        await harness.flushed()
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

    @Test func loadHistoryHoldsTheEntriesOfTheTask() async throws {
        let harness = try await readyHarness()
        let entry = HistoryEntry(at: fixedInstant, actor: .owner, action: .created, fields: [], note: nil)
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
