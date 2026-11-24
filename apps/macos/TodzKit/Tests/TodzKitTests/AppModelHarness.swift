import Foundation
import Testing
@testable import TodzKit

let harnessTimeZoneIdentifier = "America/Sao_Paulo"

final class KeySequence {
    private(set) var issued: [String] = []

    func next() -> String {
        let key = "key-\(issued.count + 1)"
        issued.append(key)
        return key
    }
}

func isSameCallSet(_ calls: [FakeCall], _ expected: [FakeCall]) -> Bool {
    calls.count == expected.count && expected.allSatisfy(calls.contains)
}

final class Captured<Value> {
    var value: Value?
}

@MainActor struct AppModelHarness {
    let service = FakeOwnerService()
    let vault = InMemorySessionVault()
    let keys = KeySequence()
    let session = UUID().uuidString
    let model: AppModel

    init() throws {
        let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        let keys = keys
        model = AppModel(service: service, vault: vault, timeZone: timeZone, now: { fixedInstant }, makeIdempotencyKey: { keys.next() })
    }

    @discardableResult
    func seedWorkspace(name: String, projectNames: [String] = []) -> Workspace {
        let createdAt = fixedInstant.addingTimeInterval(TimeInterval(service.workspaces.count))
        let inbox = Project(identifier: "\(name)-inbox", name: "Inbox", isInbox: true, createdAt: createdAt)
        let projects = projectNames.map { Project(identifier: "\(name)-\($0)", name: $0, isInbox: false, createdAt: createdAt) }
        let workspace = Workspace(identifier: name, name: name, createdAt: createdAt, projects: [inbox] + projects)
        service.workspaces.append(workspace)
        return workspace
    }

    func seedTasks(projectIdentifier: String, count: Int) {
        service.tasksOfProject[projectIdentifier] = (1...count).map { MutableTask(number: $0, title: "Task \($0)").record }
    }

    func signedIn() async {
        vault.secret = session
        await model.launch()
        service.calls = []
    }
}
