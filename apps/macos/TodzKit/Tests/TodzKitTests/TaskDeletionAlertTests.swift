import AppKit
import Testing
@testable import TodzKit

private let wording = TaskDeletionAlert.Wording(title: "Delete Task?", message: "“Write the brief” is deleted.", delete: "Delete", cancel: "Cancel")

@MainActor @Suite struct TaskDeletionAlertTests {
    @Test func cancelComesFirstAndTakesReturnSoReturnNeverDeletes() {
        let alert = TaskDeletionAlert.make(wording)
        #expect(alert.buttons.map(\.title) == ["Cancel", "Delete"])
        #expect(alert.buttons.first?.keyEquivalent == "\r")
    }

    @Test func deleteIsSecondDestructiveAndHasNoKeyEquivalent() {
        let alert = TaskDeletionAlert.make(wording)
        let delete = alert.buttons.last
        #expect(delete?.hasDestructiveAction == true)
        #expect(delete?.keyEquivalent == "")
    }

    @Test func theAlertCarriesTheTitleAndTheMessage() {
        let alert = TaskDeletionAlert.make(wording)
        #expect(alert.messageText == "Delete Task?")
        #expect(alert.informativeText == "“Write the brief” is deleted.")
    }

    @Test func onlyTheSecondButtonDeletes() {
        #expect(!TaskDeletionAlert.isDeletion(.alertFirstButtonReturn))
        #expect(TaskDeletionAlert.isDeletion(.alertSecondButtonReturn))
        #expect(!TaskDeletionAlert.isDeletion(.abort))
    }
}
