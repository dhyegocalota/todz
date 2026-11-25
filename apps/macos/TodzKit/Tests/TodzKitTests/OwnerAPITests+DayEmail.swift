import Foundation
import Testing
@testable import TodzKit

private let ownerTimeZone = "America/Sao_Paulo"
private let storedMinutes = 450

extension OwnerAPITests {
    @Test func readOwnerDecodesTheDayEmail() async throws {
        let ownerIdentifier = UUID().uuidString
        let ownerJSON = OwnerFixtures.ownerJSON(identifier: ownerIdentifier, timeZone: ownerTimeZone, dayEmail: true, dayEmailMinutes: storedMinutes)
        let owner = try await api(answering: .response(status: 200, body: "{\"owner\":\(ownerJSON)}")).readOwner(session: session)
        #expect(owner.dayEmail == true)
        #expect(owner.dayEmailMinutes == storedMinutes)
    }

    @Test func readOwnerOfAServerWithoutTheDayEmailLeavesItUnknown() async throws {
        let body = "{\"owner\":{\"id\":\"o\",\"time_zone\":\"UTC\"}}"
        let owner = try await api(answering: .response(status: 200, body: body)).readOwner(session: session)
        #expect(owner.dayEmail == nil)
        #expect(owner.dayEmailMinutes == nil)
    }

    @Test func updateDayEmailPatchesOnlyTheDayEmail() async throws {
        let ownerJSON = OwnerFixtures.ownerJSON(identifier: UUID().uuidString, timeZone: ownerTimeZone, dayEmail: true, dayEmailMinutes: storedMinutes)
        let owner = try await api(answering: .response(status: 200, body: "{\"owner\":\(ownerJSON)}")).updateDayEmail(session: session, isEnabled: true)
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner", session: session, body: ["day_email": true]))
        #expect(owner.dayEmail == true)
    }

    @Test func updateDayEmailMinutesPatchesOnlyTheMinutes() async throws {
        let ownerJSON = OwnerFixtures.ownerJSON(identifier: UUID().uuidString, timeZone: ownerTimeZone, dayEmail: true, dayEmailMinutes: storedMinutes)
        let owner = try await api(answering: .response(status: 200, body: "{\"owner\":\(ownerJSON)}")).updateDayEmailMinutes(session: session, minutes: storedMinutes)
        try expectOnlyRequest(ExpectedRequest(method: "PATCH", path: "/owner", session: session, body: ["day_email_minutes": storedMinutes]))
        #expect(owner.dayEmailMinutes == storedMinutes)
    }
}
