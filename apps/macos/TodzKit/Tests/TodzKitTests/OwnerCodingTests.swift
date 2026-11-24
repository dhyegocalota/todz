import Foundation
import Testing
@testable import TodzKit

private let millisecondsOfInstant: Int64 = 1_764_000_000_000
private let instant = Date(timeIntervalSince1970: 1_764_000_000)
private let identityToken = "identity-token"
private let timeZone = "America/Sao_Paulo"
private let name = "Inbox"
private let draftKey = "key-1"
private let dueDate = CalendarDate(year: 2025, month: 11, day: 24)

private func encodedText(_ value: some Encodable) throws -> String {
    let encoder = OwnerCoding.encoder()
    encoder.outputFormatting = .sortedKeys
    return String(decoding: try encoder.encode(value), as: UTF8.self)
}

@Suite struct OwnerCodingTests {
    @Test func dateEncodesAsEpochMilliseconds() throws {
        #expect(try encodedText(instant) == "\(millisecondsOfInstant)")
    }

    @Test func dateDecodesBackEqual() throws {
        let data = try OwnerCoding.encoder().encode(instant)
        #expect(try OwnerCoding.decoder().decode(Date.self, from: data) == instant)
    }

    @Test func signInBodyPinsItsJson() throws {
        let body = SignInBody(identityToken: identityToken, timeZone: timeZone)
        #expect(try encodedText(body) == #"{"identity_token":"identity-token","time_zone":"America\/Sao_Paulo"}"#)
    }

    @Test func nameBodyPinsItsJson() throws {
        #expect(try encodedText(NameBody(name: name)) == #"{"name":"Inbox"}"#)
    }

    @Test func timeZoneBodyPinsItsJson() throws {
        #expect(try encodedText(TimeZoneBody(timeZone: timeZone)) == #"{"time_zone":"America\/Sao_Paulo"}"#)
    }

    @Test func addTasksBodyPinsItsJson() throws {
        let drafts = [
            TaskDraft(title: "Write", notes: "Body", dueDate: dueDate, idempotencyKey: draftKey),
            TaskDraft(title: "Read", notes: nil, dueDate: nil, idempotencyKey: draftKey),
        ]
        let expected = #"{"tasks":[{"due_date":"2025-11-24","idempotency_key":"key-1","notes":"Body","title":"Write"},"#
            + #"{"idempotency_key":"key-1","title":"Read"}]}"#
        #expect(try encodedText(AddTasksBody(tasks: drafts)) == expected)
    }

    @Test func taskNumbersBodyPinsItsJson() throws {
        #expect(try encodedText(TaskNumbersBody(numbers: [3, 1, 2])) == #"{"numbers":[3,1,2]}"#)
    }

    @Test func everyTaskPatchCasePinsItsJson() throws {
        let expectations: [(patch: TaskPatch, json: String)] = [
            (.title("Write"), #"{"title":"Write"}"#),
            (.notes("Body"), #"{"notes":"Body"}"#),
            (.notes(nil), #"{"notes":null}"#),
            (.dueDate(dueDate), #"{"due_date":"2025-11-24"}"#),
            (.dueDate(nil), #"{"due_date":null}"#),
            (.placement(.first), #"{"placement":{"kind":"first"}}"#),
            (.placement(.after(anchor: 7)), #"{"placement":{"anchor":7,"kind":"after"}}"#),
        ]
        for expectation in expectations {
            #expect(try encodedText(expectation.patch) == expectation.json)
        }
    }
}
