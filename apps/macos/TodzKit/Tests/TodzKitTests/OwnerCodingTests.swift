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
private let encodedCreatedAt = #""created_at":1764000000000"#
private let encodedDueDate = #""due_date":"2026-11-24""#
private let idempotencyKey = "key-2"
private let ownerIdentifier = "owner-1"
private let projectIdentifier = "project-1"
private let workspaceIdentifier = "workspace-1"

private func expectRoundTrip<Value: Codable & Equatable>(_ json: String, as type: Value.Type) throws {
    let first = try OwnerFixtures.decoded(type, from: json)
    let second = try OwnerCoding.decoder().decode(type, from: OwnerCoding.encoder().encode(first))
    #expect(second == first)
}

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
        let body = SignInBody(identityToken: identityToken, linkVerifier: nil, timeZone: timeZone)
        #expect(try encodedText(body) == #"{"identity_token":"identity-token","time_zone":"America\/Sao_Paulo"}"#)
    }

    @Test func signInBodyWithAVerifierPinsItsJson() throws {
        let body = SignInBody(identityToken: identityToken, linkVerifier: "verifier", timeZone: timeZone)
        #expect(try encodedText(body) == #"{"identity_token":"identity-token","link_verifier":"verifier","time_zone":"America\/Sao_Paulo"}"#)
    }

    @Test func signInLinkRequestBodyPinsItsJson() throws {
        let body = SignInLinkRequestBody(email: "maria@example.com", linkChallenge: "challenge")
        #expect(try encodedText(body) == #"{"email":"maria@example.com","link_challenge":"challenge"}"#)
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

    @Test func everyFixtureDecodesEncodesAndDecodesEqual() throws {
        let project = OwnerFixtures.projectJSON(identifier: projectIdentifier, name: name, isInbox: false)
        try expectRoundTrip(OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: timeZone), as: Owner.self)
        try expectRoundTrip(project, as: Project.self)
        try expectRoundTrip(
            OwnerFixtures.workspaceJSON(identifier: workspaceIdentifier, name: name, projects: [project]), as: Workspace.self)
        try expectRoundTrip(OwnerFixtures.ownerActorJSON, as: ChangeActor.self)
        try expectRoundTrip(OwnerFixtures.agentActorJSON, as: ChangeActor.self)
        try expectRoundTrip(OwnerFixtures.openTaskJSON(number: 1), as: TaskRecord.self)
        try expectRoundTrip(OwnerFixtures.doneTaskJSON(number: 2, idempotencyKey: idempotencyKey), as: TaskRecord.self)
    }

    @Test func encodedTaskHoldsEpochMillisecondsAndCalendarDate() throws {
        let task = TaskRecord(
            number: 1, title: name, notes: nil, dueDate: CalendarDate(year: 2026, month: 11, day: 24), state: .open,
            orderKey: "a0", idempotencyKey: nil, createdBy: .owner, createdAt: instant, updatedAt: instant, completedAt: nil
        )
        let text = try encodedText(task)
        #expect(text.contains(encodedCreatedAt))
        #expect(text.contains(encodedDueDate))
    }

    @Test func taskWithoutNotesDecodesBackWithoutNotes() throws {
        let task = try OwnerFixtures.decoded(TaskRecord.self, from: OwnerFixtures.openTaskJSON(number: 1))
        let decoded = try OwnerCoding.decoder().decode(TaskRecord.self, from: OwnerCoding.encoder().encode(task))
        #expect(decoded.notes == nil)
    }
}
