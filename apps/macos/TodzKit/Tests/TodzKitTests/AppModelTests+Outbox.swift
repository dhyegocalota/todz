import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let secondTask = TaskKey(projectIdentifier: inboxIdentifier, number: 2)
private let nextWeek = CalendarDate(year: 2026, month: 12, day: 1)
private let tooLongTitle = String(repeating: "a", count: TaskLimits.titleMaxLength + 1)
private let tooLongNotes = String(repeating: "a", count: TaskLimits.notesMaxLength + 1)

private let refusals: [OwnerAPIError] = [
    .ruleViolated(issue: .titleTooLong, index: nil),
    .taskNotFound(number: 1),
    .notFound,
    .invalidRequest,
    .inboxIsFixed,
    .cursorAhead,
    .timeZoneInvalid,
    .identityRejected,
]

private let portalPage = "<html><body>Sign in to the network</body></html>"
private let codedRefusal = "{\"error\":\"rule_violated\",\"issue\":\"title_too_long\",\"index\":null}"

enum TransientFailure: CaseIterable, Sendable {
    case unexpected
    case signInUnavailable
    case undecodable
    case bareBadRequest
    case bareNotFound
    case bareUnavailable
    case networkAuthenticationRequired

    @MainActor func inject(into service: FakeOwnerService, route: FakeRoute) {
        switch self {
        case .unexpected: service.failures[route] = .unexpected(status: 503)
        case .signInUnavailable: service.failures[route] = .signInUnavailable
        case .undecodable: service.undecodableRoutes.insert(route)
        case .bareBadRequest: service.statusFailures[route] = StatusFailure(status: 400, body: "")
        case .bareNotFound: service.statusFailures[route] = StatusFailure(status: 404, body: "")
        case .bareUnavailable: service.statusFailures[route] = StatusFailure(status: 503, body: "")
        case .networkAuthenticationRequired: service.statusFailures[route] = StatusFailure(status: 511, body: portalPage)
        }
    }

    @MainActor func lift(from service: FakeOwnerService, route: FakeRoute) {
        service.failures[route] = nil
        service.undecodableRoutes.remove(route)
        service.statusFailures[route] = nil
    }
}

extension AppModelTests {
    @MainActor private func outboxHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme", projectNames: ["launch"])
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        harness.store.calls = []
        return harness
    }

    @MainActor private func isShownWhileWaiting(_ action: TaskAction, on model: AppModel) -> Bool {
        guard let views = model.taskViews else { return false }
        let first = views.inbox.first { $0.task.number == firstTask.number }?.task
        switch action {
        case .complete: return views.done.map(\.task.number) == [1]
        case .reopen: return views.inbox.map(\.task.number) == [1, 2]
        case .updateTitle: return first?.title == "Renamed"
        case .updateNotes: return first?.notes == "Two copies"
        case .updateDueDate: return views.upcoming.map(\.task.number) == [1]
        case .move: return views.inbox.map(\.task.number) == [2, 1]
        }
    }

    @Test(arguments: TaskAction.allCases)
    func aTaskWriteJoinsTheOutboxAndItsFileBeforeAnyRequestAndShowsAtOnce(action: TaskAction) async throws {
        let harness = try await outboxHarness()
        let isQueuedAtRequest = Captured<Bool>()
        harness.service.onCall = { _ in
            guard isQueuedAtRequest.value == nil else { return }
            isQueuedAtRequest.value = harness.store.routes() == [.writeOutbox]
        }
        harness.service.suspend(action.route)
        await action.run(on: harness.model)
        await harness.service.held(action.route)
        #expect(isQueuedAtRequest.value == true)
        #expect(harness.model.waitingChangeCount == 1)
        #expect(isShownWhileWaiting(action, on: harness.model))
        harness.service.resume(action.route)
        await harness.flushed()
        let answered = try #require(harness.service.tasksOfProject[inboxIdentifier]?.first)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(try harness.store.storedOutbox() == Outbox())
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1) == answered)
        #expect(harness.store.projects[inboxIdentifier]?.tasks.first == answered)
    }

    @Test func anAddShowsAPendingRowThenItsTaskSelectedWhenTheSelectionStayed() async throws {
        let harness = try await outboxHarness()
        harness.model.selectedTask = firstTask
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.service.held(.addTasks)
        #expect(harness.model.taskViews?.pendingTasks(for: .inbox).map(\.title) == ["Call the bank"])
        harness.service.resume(.addTasks)
        await harness.flushed()
        let added = TaskKey(projectIdentifier: inboxIdentifier, number: 3)
        #expect(harness.model.taskViews?.pendingTasks(for: .inbox) == [])
        #expect(harness.model.taskViews?.inbox.map(\.task.number) == [1, 2, 3])
        #expect(harness.model.selectedTask == added)
    }

    @Test func anAddThatKeepsTheSelectionLeavesItWhenTheServerAnswers() async throws {
        let harness = try await outboxHarness()
        harness.model.selectedTask = firstTask
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil, selection: .keepSelection)
        await harness.flushed()
        #expect(harness.model.taskViews?.inbox.map(\.task.number) == [1, 2, 3])
        #expect(harness.model.selectedTask == firstTask)
    }

    @Test func anAddAnsweredAfterTheSelectionMovedLeavesTheSelection() async throws {
        let harness = try await outboxHarness()
        harness.service.suspend(.addTasks)
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.service.held(.addTasks)
        harness.model.selectedTask = secondTask
        harness.service.resume(.addTasks)
        await harness.flushed()
        #expect(harness.model.selectedTask == secondTask)
    }

    @Test func aReplayedAddBecomesANormalTask() async throws {
        let harness = try await outboxHarness()
        harness.service.isReplayingAdds = true
        await harness.model.addTask(title: "Call the bank", projectIdentifier: inboxIdentifier, dueDate: nil)
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.taskViews?.inbox.last?.task.title == "Call the bank")
        #expect(harness.model.selectedTask == TaskKey(projectIdentifier: inboxIdentifier, number: 3))
    }

    @Test func anAddAnsweredAfterARelaunchSelectsNothing() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 1, cursor: 0)
        let draft = TaskDraft(title: "Call the bank", notes: nil, dueDate: nil, idempotencyKey: "key-9")
        try harness.store.keep(Outbox().appending(.add(projectIdentifier: inboxIdentifier, draft: draft), isHeadSent: false))
        await harness.launchedFromCache()
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.taskViews?.inbox.map(\.task.title).contains("Call the bank") == true)
        #expect(harness.model.selectedTask == nil)
    }

    @Test func aTitleOrNotesOverTheLimitAreRefusedInlineAndQueueNothing() async throws {
        let harness = try await outboxHarness()
        await harness.model.updateTitle(task: firstTask, title: tooLongTitle)
        await harness.model.updateNotes(task: firstTask, notes: tooLongNotes)
        await harness.model.addTask(title: tooLongTitle, projectIdentifier: inboxIdentifier, dueDate: nil)
        #expect(harness.model.ruleIssues[.taskField(firstTask, .title)] == .titleTooLong)
        #expect(harness.model.ruleIssues[.taskField(firstTask, .notes)] == .notesTooLong)
        #expect(harness.model.ruleIssues[.newTask(projectIdentifier: inboxIdentifier)] == .titleTooLong)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.store.calls == [])
        #expect(harness.service.calls == [])
    }

    @Test func theOutboxIsSentOneChangeAtATimeOldestFirst() async throws {
        let harness = try await outboxHarness()
        harness.service.suspend(.updateTask)
        await harness.model.updateTitle(task: firstTask, title: "A")
        await harness.model.updateDueDate(task: secondTask, dueDate: nextWeek)
        await harness.model.complete(task: secondTask)
        await harness.service.held(.updateTask)
        #expect(harness.service.routes() == [.updateTask])
        harness.service.resume(.updateTask)
        await harness.service.held(.updateTask, count: 1)
        harness.service.unsuspend(.updateTask)
        harness.service.resume(.updateTask)
        await harness.flushed()
        #expect(
            harness.service.calls == [
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 1, patch: .title("A")),
                .updateTask(session: harness.session, projectIdentifier: inboxIdentifier, number: 2, patch: .dueDate(nextWeek)),
                .completeTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [2]),
            ]
        )
        #expect(harness.model.sendLoop == nil)
        #expect(harness.model.sendingSession == nil)
    }

    @Test func anAnswerAfterASwitchLeavesTheOtherProjectsFileWithAllItsTasks() async throws {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        let side = harness.seedWorkspace(name: "side")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        harness.rememberWorkspace(identifier: "acme")
        await harness.signedIn()
        harness.service.suspend(.completeTasks)
        await harness.model.complete(task: firstTask)
        await harness.service.held(.completeTasks)
        await harness.model.switchWorkspace(identifier: side.identifier)
        harness.service.resume(.completeTasks)
        await harness.flushed()
        let file = try #require(harness.store.projects[inboxIdentifier])
        #expect(harness.model.waitingChangeCount == 0)
        #expect(file.cursor == 2)
        #expect(file.tasks.map(\.number) == [1, 2])
        #expect(file.tasks.first?.state == .done)
        #expect(harness.model.board.tasks(projectIdentifier: inboxIdentifier) == [])
    }

    @Test(arguments: refusals)
    func aRefusedChangeIsDroppedItsProjectPulledFromZeroAndTold(refusal: OwnerAPIError) async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = refusal
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        await harness.pulled(inboxIdentifier)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(try harness.store.storedOutbox() == Outbox())
        #expect(harness.service.calls.contains(.readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 0)))
        #expect(harness.model.taskViews?.inbox.map(\.task.number) == [1, 2])
        #expect(harness.model.banner == .changesRefused(count: 1))
        #expect(harness.pause.durations == [])
    }

    @Test func aFairUseRefusalIsSentOnceDroppedAndShownWithTheServersMessageAndTheRefusedCount() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .fairUseRefused(message: "You have 500 open tasks.")
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        #expect(harness.service.calls.filter { $0 == .completeTasks(session: harness.session, projectIdentifier: inboxIdentifier, numbers: [1]) }.count == 1)
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == .changesFairUseRefused(message: "You have 500 open tasks.", count: 1))
        #expect(harness.pause.durations == [])
    }

    @Test func aPerChangeCapDropsOnlyThatChange() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .fairUseRefused(message: "You have 500 open tasks.")
        await harness.model.complete(task: firstTask)
        await harness.model.updateTitle(task: secondTask, title: "B")
        await harness.flushed()
        #expect(harness.service.routes().contains(.updateTask))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aDailyCapKeepsEveryQueuedChangePausesSendingAndResumesOnTheNextRefresh() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.addTasks] = .fairUsePaused(message: "Changes resume at midnight UTC.")
        for position in 1...30 {
            await harness.model.addTask(title: "Task \(position)", projectIdentifier: inboxIdentifier, dueDate: nil)
        }
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 30)
        #expect(harness.service.routes().filter { $0 == .addTasks }.count == 1)
        #expect(harness.model.banner == .fairUsePaused(message: "Changes resume at midnight UTC."))
        #expect(harness.pause.durations == [])
        harness.service.failures[.addTasks] = nil
        await harness.model.refresh()
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test func aRefusalAsksForItsPullFromZeroWithoutWaitingForIt() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .invalidRequest
        await harness.model.complete(task: firstTask)
        await harness.model.updateTitle(task: secondTask, title: "B")
        await harness.flushed()
        await harness.pulled(inboxIdentifier)
        #expect(harness.service.routes() == [.completeTasks, .updateTask, .readChanges])
        #expect(harness.service.calls.last == .readChanges(session: harness.session, projectIdentifier: inboxIdentifier, cursor: 0))
    }

    @Test func anUnreachableServerKeepsTheChangeAndWaitsWithoutCountingAnAttempt() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: firstTask)
        await harness.pause.started()
        harness.pause.release()
        await harness.pause.started(count: 2)
        harness.pause.release()
        await harness.pause.started(count: 3)
        harness.pause.release()
        await harness.pause.started(count: 4)
        #expect(harness.model.waitingChangeCount == 1)
        #expect(harness.pause.durations == [.seconds(1), .seconds(2), .seconds(4), .seconds(8)])
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == nil)
    }

    @Test func anAnswerBeforeAnUnreachableAttemptCountsNoAttemptForTheNextUncodedFailure() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: firstTask)
        await harness.pause.started()
        harness.service.failures[.completeTasks] = .unexpected(status: 503)
        harness.pause.release()
        await harness.pause.started(count: 2)
        #expect(harness.model.outbox == Outbox().appending(.state(firstTask, .done, at: fixedInstant), isHeadSent: false))
        harness.service.failures = [:]
        harness.pause.release()
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test(arguments: TransientFailure.allCases)
    func aTransientFailureWithNoAnswerBetweenNeverDropsTheChange(failure: TransientFailure) async throws {
        let harness = try await outboxHarness()
        failure.inject(into: harness.service, route: .completeTasks)
        let waitingAtFourthAttempt = Captured<Int>()
        harness.service.onCall = { call in
            let attempts = harness.service.routes().filter { $0 == .completeTasks }.count
            guard call.route == .completeTasks, attempts == 4 else { return }
            waitingAtFourthAttempt.value = harness.model.waitingChangeCount
            failure.lift(from: harness.service, route: .completeTasks)
        }
        let releasing = Task {
            for count in 1...3 {
                await harness.pause.started(count: count)
                harness.pause.release()
            }
        }
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        releasing.cancel()
        #expect(waitingAtFourthAttempt.value == 1)
        #expect(harness.pause.durations == [.seconds(1), .seconds(2), .seconds(4)])
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == nil)
    }

    @Test(arguments: TransientFailure.allCases)
    func aThirdTransientFailureEachAfterAnAnswerDropsTheChangeAsRefused(failure: TransientFailure) async throws {
        let harness = try await outboxHarness()
        failure.inject(into: harness.service, route: .completeTasks)
        let pulling = Task {
            for count in 1...2 {
                await harness.pause.started(count: count)
                await harness.model.pullProject(identifier: inboxIdentifier)
            }
        }
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        pulling.cancel()
        #expect(harness.service.routes().filter { $0 == .completeTasks }.count == 3)
        #expect(harness.pause.durations == [.seconds(1), .seconds(2)])
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == .changesRefused(count: 1))
    }

    @Test func aCodedRefusalDropsTheChangeAtOnce() async throws {
        let harness = try await outboxHarness()
        harness.service.statusFailures[.completeTasks] = StatusFailure(status: 422, body: codedRefusal)
        await harness.model.complete(task: firstTask)
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.model.banner == .changesRefused(count: 1))
        #expect(harness.pause.durations == [])
    }

    @Test func anOpenedSocketCutsTheWaitShortAndSendsAtOnce() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: firstTask)
        await harness.pause.started()
        harness.service.failures = [:]
        harness.signals.send(.opened, to: harness.watchKey(inboxIdentifier))
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.pause.durations == [.seconds(1)])
        #expect(harness.pause.heldCount == 0)
    }

    @Test func aNewWriteCutsTheWaitShort() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.completeTasks] = .unreachable
        await harness.model.complete(task: firstTask)
        await harness.pause.started()
        harness.service.failures = [:]
        await harness.model.updateTitle(task: secondTask, title: "B")
        await harness.flushed()
        #expect(harness.model.waitingChangeCount == 0)
        #expect(harness.service.routes().suffix(2) == [.completeTasks, .updateTask])
    }

    @Test func aSessionEndedMidFlushKeepsTheRestAndStopsSending() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.updateTask] = .unauthorized
        await harness.model.complete(task: firstTask)
        await harness.model.updateTitle(task: secondTask, title: "B")
        await harness.model.updateDueDate(task: secondTask, dueDate: nextWeek)
        await harness.flushed()
        #expect(harness.service.routes() == [.completeTasks, .updateTask])
        #expect(harness.model.phase == .signedOut(notice: .sessionEnded))
        #expect(harness.model.waitingChangeCount == 2)
        #expect(try harness.store.storedOutbox()?.count == 2)
        #expect(harness.model.sendingSession == nil)
        #expect(harness.pause.durations == [])
    }

    @Test func twoRefusalsInOneFlushRaiseOneBannerWithTwo() async throws {
        let harness = try await outboxHarness()
        harness.service.failures[.updateTask] = .invalidRequest
        await harness.model.updateTitle(task: firstTask, title: "A")
        await harness.model.updateDueDate(task: secondTask, dueDate: nextWeek)
        await harness.flushed()
        #expect(harness.model.banner == .changesRefused(count: 2))
        harness.model.dismissBanner()
        await harness.model.updateTitle(task: firstTask, title: "C")
        await harness.flushed()
        #expect(harness.model.banner == .changesRefused(count: 1))
    }

    @Test func aSignInAsTheCachesOwnerSendsTheOutbox() async throws {
        let harness = try AppModelHarness()
        let acme = harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 1)
        harness.cache([acme], active: acme)
        harness.cacheTasks(projectIdentifier: inboxIdentifier, count: 1, cursor: 1)
        try harness.store.keep(Outbox().appending(.field(firstTask, .title("Waiting")), isHeadSent: false))
        harness.service.failures[.listWorkspaces] = .unreachable
        await harness.model.launch()
        await harness.model.signIn(identity: "dhyego")
        await harness.flushed()
        let session = harness.service.issuedSession.sessionToken
        #expect(harness.service.calls.contains(.updateTask(session: session, projectIdentifier: inboxIdentifier, number: 1, patch: .title("Waiting"))))
        #expect(harness.model.waitingChangeCount == 0)
    }

    @Test(arguments: [
        (OwnerAPIError.ruleViolated(issue: .titleEmpty, index: nil), SendOutcome.refused),
        (.taskNotFound(number: 1), .refused),
        (.notFound, .refused),
        (.invalidRequest, .refused),
        (.inboxIsFixed, .refused),
        (.cursorAhead, .refused),
        (.timeZoneInvalid, .refused),
        (.identityRejected, .refused),
        (.fairUseRefused(message: "Full"), .refused),
        (.limitReached, .refused),
        (.fairUsePaused(message: "Tomorrow"), .paused),
        (.unreachable, .unreachable),
        (.unexpected(status: 500), .unexpected),
        (.signInUnavailable, .unexpected),
        (.unauthorized, .sessionGone),
    ])
    func eachSendFailureHasItsOutcome(failure: OwnerAPIError, expected: SendOutcome) {
        #expect(SendOutcome.of(failure) == expected)
    }

    @Test func anAnswerThatDoesNotDecodeIsUnexpectedAndACancelEndsTheSession() {
        #expect(SendOutcome.of(UndecodableAnswer()) == .unexpected)
        #expect(SendOutcome.of(CancellationError()) == .sessionGone)
    }
}
