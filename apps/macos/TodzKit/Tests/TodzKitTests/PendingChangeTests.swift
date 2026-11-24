import Foundation
import Testing
@testable import TodzKit

private let projectIdentifier = "launch"
private let taskKey = TaskKey(projectIdentifier: projectIdentifier, number: 7)
private let dueDate = CalendarDate(year: 2026, month: 11, day: 24)
private let datedDraft = TaskDraft(title: "Call the bank", notes: "Two copies", dueDate: dueDate, idempotencyKey: "key-1")
private let undatedDraft = TaskDraft(title: "Read", notes: nil, dueDate: nil, idempotencyKey: "key-2")

private func roundTripped<Value: Codable>(_ value: Value) throws -> Value {
    try OwnerCoding.decoder().decode(Value.self, from: try OwnerCoding.encoder().encode(value))
}

private func decoded<Value: Decodable>(_ type: Value.Type, from json: String) throws -> Value {
    try OwnerCoding.decoder().decode(Value.self, from: Data(json.utf8))
}

@Suite struct PendingChangeTests {
    @Test(arguments: [
        PendingChange.add(projectIdentifier: projectIdentifier, draft: datedDraft),
        .add(projectIdentifier: projectIdentifier, draft: undatedDraft),
        .field(taskKey, .title("Call the bank today")),
        .field(taskKey, .notes("Two copies")),
        .field(taskKey, .notes(nil)),
        .field(taskKey, .dueDate(dueDate)),
        .field(taskKey, .dueDate(nil)),
        .field(taskKey, .placement(.first)),
        .field(taskKey, .placement(.after(anchor: 3))),
        .state(taskKey, .done, at: fixedInstant),
        .state(taskKey, .open, at: fixedInstant),
    ])
    func eachChangeRoundTripsThroughTheOwnerCoding(change: PendingChange) throws {
        #expect(try roundTripped(change) == change)
    }

    @Test func aNullNotesOrDueDateDecodesToItsClearingPatch() throws {
        #expect(try decoded(TaskPatch.self, from: #"{"notes":null}"#) == .notes(nil))
        #expect(try decoded(TaskPatch.self, from: #"{"due_date":null}"#) == .dueDate(nil))
    }

    @Test func aPatchWithTwoFieldsFailsDecoding() {
        #expect(throws: DecodingError.self) { try decoded(TaskPatch.self, from: #"{"title":"Write","notes":null}"#) }
    }

    @Test func anUnknownKindFailsDecoding() {
        let json = #"{"kind":"delete","task_key":{"project_identifier":"launch","number":7}}"#
        #expect(throws: DecodingError.self) { try decoded(PendingChange.self, from: json) }
    }

    @Test(arguments: [
        (PendingChange.add(projectIdentifier: projectIdentifier, draft: datedDraft), nil, nil),
        (.field(taskKey, .title("Write")), taskKey, .title),
        (.field(taskKey, .notes(nil)), taskKey, .notes),
        (.field(taskKey, .dueDate(nil)), taskKey, .dueDate),
        (.field(taskKey, .placement(.first)), taskKey, .order),
        (.state(taskKey, .done, at: fixedInstant), taskKey, .state),
    ] as [(PendingChange, TaskKey?, TaskWriteField?)])
    func eachChangeNamesItsProjectTaskAndField(change: PendingChange, taskKey: TaskKey?, writeField: TaskWriteField?) {
        #expect(change.projectIdentifier == projectIdentifier)
        #expect(change.taskKey == taskKey)
        #expect(change.writeField == writeField)
    }
}
