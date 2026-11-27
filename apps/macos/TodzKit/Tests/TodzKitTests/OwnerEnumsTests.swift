import Foundation
import Testing
@testable import TodzKit

private let unknownRawValue = "archived"

private func decoded<Value: Decodable>(_ type: Value.Type, rawValue: String) throws -> Value {
    try JSONDecoder().decode(Value.self, from: Data("\"\(rawValue)\"".utf8))
}

private func decodedRawValues<Value: Decodable & RawRepresentable<String>>(_ type: Value.Type, rawValues: [String]) throws -> [String] {
    try rawValues.map { try decoded(type, rawValue: $0).rawValue }
}

@Suite struct OwnerEnumsTests {
    @Test func taskStateDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = ["open", "done"]
        #expect(try decodedRawValues(TaskState.self, rawValues: rawValues) == rawValues)
        #expect(TaskState.allCases.map(\.rawValue) == rawValues)
    }

    @Test func actorKindDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = ["owner", "agent"]
        #expect(try decodedRawValues(ActorKind.self, rawValues: rawValues) == rawValues)
        #expect(ActorKind.allCases.map(\.rawValue) == rawValues)
    }

    @Test func taskFieldDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = ["title", "notes", "due_date", "order"]
        #expect(try decodedRawValues(TaskField.self, rawValues: rawValues) == rawValues)
        #expect(TaskField.allCases.map(\.rawValue) == rawValues)
    }

    @Test func historyActionDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = ["created", "updated", "completed", "reopened"]
        #expect(try decodedRawValues(HistoryAction.self, rawValues: rawValues) == rawValues)
        #expect(HistoryAction.allCases.map(\.rawValue) == rawValues)
    }

    @Test func placementKindDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = ["first", "last", "before", "after"]
        #expect(try decodedRawValues(PlacementKind.self, rawValues: rawValues) == rawValues)
        #expect(PlacementKind.allCases.map(\.rawValue) == rawValues)
    }

    @Test func ruleIssueDecodesEveryRawValueOfLibsTypes() throws {
        let rawValues = [
            "title_empty", "title_too_long", "notes_too_long", "completion_note_too_long", "due_date_invalid",
            "batch_empty", "batch_too_large", "idempotency_key_invalid", "client_name_invalid", "task_number_invalid",
            "nothing_to_update", "placement_anchor_invalid", "search_text_too_long", "limit_invalid", "name_empty",
            "name_too_long", "title_invalid", "notes_invalid", "completion_note_invalid", "name_invalid",
            "order_key_too_long", "confirmation_mismatch",
        ]
        #expect(try decodedRawValues(RuleIssue.self, rawValues: rawValues) == rawValues)
        #expect(RuleIssue.allCases.map(\.rawValue) == rawValues)
    }

    @Test func anUnknownRawValueFailsDecodingInEveryEnum() {
        #expect(throws: DecodingError.self) { try decoded(TaskState.self, rawValue: unknownRawValue) }
        #expect(throws: DecodingError.self) { try decoded(ActorKind.self, rawValue: unknownRawValue) }
        #expect(throws: DecodingError.self) { try decoded(TaskField.self, rawValue: unknownRawValue) }
        #expect(throws: DecodingError.self) { try decoded(HistoryAction.self, rawValue: unknownRawValue) }
        #expect(throws: DecodingError.self) { try decoded(PlacementKind.self, rawValue: unknownRawValue) }
        #expect(throws: DecodingError.self) { try decoded(RuleIssue.self, rawValue: unknownRawValue) }
    }
}
