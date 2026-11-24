import Foundation
@testable import TodzKit

enum OwnerFixtures {
    static let createdAtMilliseconds: Int64 = 1_795_000_000_123
    static let updatedAtMilliseconds: Int64 = 1_795_000_360_456
    static let completedAtMilliseconds: Int64 = 1_795_000_720_789
    static let agentClientName = "Claude Code"
    static let millisecondsPerSecond: Double = 1_000

    static func date(milliseconds: Int64) -> Date {
        Date(timeIntervalSince1970: Double(milliseconds) / millisecondsPerSecond)
    }

    static func ownerJSON(identifier: String, timeZone: String) -> String {
        "{\"id\":\"\(identifier)\",\"time_zone\":\"\(timeZone)\"}"
    }

    static func projectJSON(identifier: String, name: String, isInbox: Bool) -> String {
        "{\"id\":\"\(identifier)\",\"name\":\"\(name)\",\"is_inbox\":\(isInbox),\"created_at\":\(createdAtMilliseconds)}"
    }

    static func workspaceJSON(identifier: String, name: String, projects: [String]) -> String {
        "{\"id\":\"\(identifier)\",\"name\":\"\(name)\",\"created_at\":\(createdAtMilliseconds),\"projects\":[\(projects.joined(separator: ","))]}"
    }

    static let ownerActorJSON = "{\"kind\":\"owner\",\"client_name\":null}"

    static let agentActorJSON = "{\"kind\":\"agent\",\"client_name\":\"\(agentClientName)\"}"

    static func openTaskJSON(number: Int, state: String = "open") -> String {
        """
        {"number":\(number),"title":"Call the bank","notes":null,"due_date":"2026-11-24","state":"\(state)",\
        "order_key":"a0","idempotency_key":null,"created_by":\(ownerActorJSON),\
        "created_at":\(createdAtMilliseconds),"updated_at":\(updatedAtMilliseconds),"completed_at":null}
        """
    }

    static func doneTaskJSON(number: Int, idempotencyKey: String) -> String {
        """
        {"number":\(number),"title":"Send the invoice","notes":"Two copies","due_date":null,"state":"done",\
        "order_key":"a1","idempotency_key":"\(idempotencyKey)","created_by":\(agentActorJSON),\
        "created_at":\(createdAtMilliseconds),"updated_at":\(updatedAtMilliseconds),\
        "completed_at":\(completedAtMilliseconds)}
        """
    }

    static let historyEntryJSON = """
        {"at":\(updatedAtMilliseconds),"actor":\(agentActorJSON),"action":"updated","fields":["title","due_date"],"note":null}
        """

    static let completionEntryJSON = """
        {"at":\(completedAtMilliseconds),"actor":\(ownerActorJSON),"action":"completed","fields":[],"note":"Paid"}
        """

    static func openTask(number: Int) -> TaskRecord {
        TaskRecord(
            number: number,
            title: "Call the bank",
            notes: nil,
            dueDate: CalendarDate(year: 2026, month: 11, day: 24),
            state: .open,
            orderKey: "a0",
            idempotencyKey: nil,
            createdBy: .owner,
            createdAt: date(milliseconds: createdAtMilliseconds),
            updatedAt: date(milliseconds: updatedAtMilliseconds),
            completedAt: nil
        )
    }

    static func doneTask(number: Int, idempotencyKey: String) -> TaskRecord {
        TaskRecord(
            number: number,
            title: "Send the invoice",
            notes: "Two copies",
            dueDate: nil,
            state: .done,
            orderKey: "a1",
            idempotencyKey: idempotencyKey,
            createdBy: .agent(clientName: agentClientName),
            createdAt: date(milliseconds: createdAtMilliseconds),
            updatedAt: date(milliseconds: updatedAtMilliseconds),
            completedAt: date(milliseconds: completedAtMilliseconds)
        )
    }

    static func decoded<Value: Decodable>(_ type: Value.Type, from json: String) throws -> Value {
        try OwnerCoding.decoder().decode(Value.self, from: Data(json.utf8))
    }
}
