import Foundation
import Testing
@testable import TodzKit

private let launchIdentifier = "launch"
private let inboxIdentifier = "inbox"
private let firstTask = TaskKey(projectIdentifier: launchIdentifier, number: 1)
private let secondTask = TaskKey(projectIdentifier: launchIdentifier, number: 2)
private let inboxTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let dueDate = CalendarDate(year: 2026, month: 11, day: 25)
private let completedAt = fixedInstant
private let reopenedAt = fixedInstant.addingTimeInterval(60)

private func draft(_ title: String, dueDate: CalendarDate? = nil) -> TaskDraft {
    TaskDraft(title: title, notes: nil, dueDate: dueDate, idempotencyKey: "key-\(title)")
}

private func outbox(_ changes: [PendingChange]) -> Outbox {
    changes.reduce(Outbox()) { outbox, change in outbox.appending(change, isHeadSent: false) }
}

@Suite struct OutboxTests {
    @Test func anEmptyOutboxHasNoHead() {
        #expect(Outbox().head == nil)
        #expect(Outbox().count == 0)
        #expect(Outbox().pendingChanges == [])
    }

    @Test func twoTitleEditsOfOneTaskKeepTheSecondTitleAtTheFirstsPlace() {
        let coalesced = outbox([.field(firstTask, .title("Call")), .field(secondTask, .title("Write")), .field(firstTask, .title("Call the bank"))])
        #expect(coalesced.pendingChanges == [.field(firstTask, .title("Call the bank")), .field(secondTask, .title("Write"))])
    }

    @Test func editsOfOtherFieldsOfTheSameTaskAreKeptApart() {
        let changes: [PendingChange] = [.field(firstTask, .title("Call")), .field(firstTask, .notes(nil)), .field(firstTask, .dueDate(dueDate))]
        #expect(outbox(changes).pendingChanges == changes)
    }

    @Test func twoMovesOfOneTaskAreBothKeptInOrder() {
        let changes: [PendingChange] = [.field(firstTask, .placement(.first)), .field(firstTask, .placement(.after(anchor: 2)))]
        #expect(outbox(changes).pendingChanges == changes)
    }

    @Test func completeThenReopenIsOneReopen() {
        let coalesced = outbox([.state(firstTask, .done, at: completedAt), .state(firstTask, .open, at: reopenedAt)])
        #expect(coalesced.pendingChanges == [.state(firstTask, .open, at: reopenedAt)])
    }

    @Test func twoAddsAreBothKept() {
        let changes: [PendingChange] = [.add(projectIdentifier: launchIdentifier, draft: draft("One")), .add(projectIdentifier: launchIdentifier, draft: draft("Two"))]
        #expect(outbox(changes).pendingChanges == changes)
    }

    @Test func anEditOfTheSentHeadsFieldIsAppendedAndAThirdReplacesTheAppendedOne() {
        let sent = outbox([.field(firstTask, .title("Call"))])
        let appended = sent.appending(.field(firstTask, .title("Call the bank")), isHeadSent: true)
        #expect(appended.pendingChanges == [.field(firstTask, .title("Call")), .field(firstTask, .title("Call the bank"))])
        let replaced = appended.appending(.field(firstTask, .title("Call the bank today")), isHeadSent: true)
        #expect(replaced.pendingChanges == [.field(firstTask, .title("Call")), .field(firstTask, .title("Call the bank today"))])
    }

    @Test func aWaitingHeadThatIsNotSentIsReplaced() {
        let replaced = outbox([.field(firstTask, .title("Call"))]).appending(.field(firstTask, .title("Write")), isHeadSent: false)
        #expect(replaced.pendingChanges == [.field(firstTask, .title("Write"))])
    }

    @Test func threeCountedAttemptsReachTheLimitOnTheThird() {
        let (once, isAtLimitOnce) = outbox([.field(firstTask, .title("Call"))]).countingAttemptOnHead()
        let (twice, isAtLimitTwice) = once.countingAttemptOnHead()
        let (_, isAtLimitThrice) = twice.countingAttemptOnHead()
        #expect([isAtLimitOnce, isAtLimitTwice, isAtLimitThrice] == [false, false, true])
    }

    @Test func aReplacementResetsTheAttempts() {
        let (once, _) = outbox([.field(firstTask, .title("Call"))]).countingAttemptOnHead()
        let (twice, _) = once.countingAttemptOnHead()
        let replaced = twice.appending(.field(firstTask, .title("Write")), isHeadSent: false)
        let (_, isAtLimit) = replaced.countingAttemptOnHead()
        #expect(!isAtLimit)
    }

    @Test func removingTheHeadLeavesTheRestInOrder() {
        let changes: [PendingChange] = [.field(firstTask, .title("Call")), .field(secondTask, .title("Write")), .state(inboxTask, .done, at: completedAt)]
        let removed = outbox(changes).removingHead()
        #expect(outbox(changes).head == changes.first)
        #expect(removed.pendingChanges == Array(changes.dropFirst()))
        #expect(removed.head == .field(secondTask, .title("Write")))
        #expect(removed.count == 2)
    }

    @Test func droppingAProjectsChangesKeepsTheOthersInOrderAndCountsTheDropped() {
        let dropped = outbox([
            .field(firstTask, .title("Call")),
            .state(inboxTask, .done, at: completedAt),
            .add(projectIdentifier: launchIdentifier, draft: draft("One")),
            .field(inboxTask, .title("Read")),
        ]).droppingChanges(projectIdentifier: launchIdentifier)
        #expect(dropped.0.pendingChanges == [.state(inboxTask, .done, at: completedAt), .field(inboxTask, .title("Read"))])
        #expect(dropped.dropped == 2)
    }

    @Test func pendingTasksAreTheAddsInOutboxOrder() {
        let pending = outbox([
            .add(projectIdentifier: launchIdentifier, draft: draft("One", dueDate: dueDate)),
            .field(firstTask, .title("Call")),
            .add(projectIdentifier: inboxIdentifier, draft: draft("Two")),
        ]).pendingTasks
        #expect(pending == [
            PendingTask(projectIdentifier: launchIdentifier, idempotencyKey: "key-One", title: "One", dueDate: dueDate),
            PendingTask(projectIdentifier: inboxIdentifier, idempotencyKey: "key-Two", title: "Two", dueDate: nil),
        ])
    }

    @Test func anOutboxEncodesItsChangesWithTheirAttemptsAndDecodesBack() throws {
        let (counted, _) = outbox([.field(firstTask, .title("Call")), .state(inboxTask, .done, at: completedAt)]).countingAttemptOnHead()
        let data = try OwnerCoding.encoder().encode(counted)
        let object = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        let changes = try #require(object["changes"] as? [[String: Any]])
        #expect(changes.map { $0["attempts"] as? Int } == [1, 0])
        #expect(changes.allSatisfy { $0["change"] is [String: Any] })
        #expect(try OwnerCoding.decoder().decode(Outbox.self, from: data) == counted)
    }
}
