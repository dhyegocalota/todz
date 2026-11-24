import Foundation
import Testing
@testable import TodzKit

private let inboxIdentifier = "acme-inbox"
private let firstTask = TaskKey(projectIdentifier: inboxIdentifier, number: 1)
private let notesTarget = WriteTarget.taskField(firstTask, .notes)
private let tooLongNotes = String(repeating: "a", count: TaskLimits.notesMaxLength + 1)

extension AppModelTests {
    @MainActor private func notesHarness() async throws -> AppModelHarness {
        let harness = try AppModelHarness()
        harness.seedWorkspace(name: "acme")
        harness.seedTasks(projectIdentifier: inboxIdentifier, count: 2)
        await harness.signedIn()
        return harness
    }

    @Test func notesOverTheLimitAreKeptForTheirTaskAndNothingIsSent() async throws {
        let harness = try await notesHarness()
        await harness.model.commitNotes(task: firstTask, draft: tooLongNotes)
        #expect(harness.service.calls == [])
        #expect(harness.model.unsavedNotes == [firstTask: tooLongNotes])
        #expect(harness.model.ruleIssues[notesTarget] == .notesTooLong)
    }

    @Test func notesWithinTheLimitAreSentAndForgetTheUnsavedOnes() async throws {
        let harness = try await notesHarness()
        await harness.model.commitNotes(task: firstTask, draft: tooLongNotes)
        await harness.model.commitNotes(task: firstTask, draft: "Short")
        #expect(harness.service.routes() == [.updateTask])
        #expect(harness.model.unsavedNotes == [:])
        #expect(harness.model.ruleIssues[notesTarget] == nil)
        #expect(harness.model.board.task(projectIdentifier: inboxIdentifier, number: 1)?.notes == "Short")
    }

    @Test(arguments: ["", "   "])
    func blankNotesOnATaskWithoutNotesSendNothing(draft: String) async throws {
        let harness = try await notesHarness()
        await harness.model.commitNotes(task: firstTask, draft: draft)
        #expect(harness.service.calls == [])
    }

    @Test func discardingUnsavedNotesForgetsThemAndTheirIssue() async throws {
        let harness = try await notesHarness()
        await harness.model.commitNotes(task: firstTask, draft: tooLongNotes)
        harness.model.discardUnsavedNotes(task: firstTask)
        #expect(harness.model.unsavedNotes == [:])
        #expect(harness.model.ruleIssues[notesTarget] == nil)
    }

    @Test func switchingWorkspaceForgetsUnsavedNotes() async throws {
        let harness = try await notesHarness()
        let side = harness.seedWorkspace(name: "side")
        await harness.model.commitNotes(task: firstTask, draft: tooLongNotes)
        await harness.model.switchWorkspace(identifier: side.identifier)
        #expect(harness.model.unsavedNotes == [:])
    }
}
