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
    let store = InMemorySyncStore()
    let signals = FakeChangeSignals()
    let pause = HeldPause()
    let keys = KeySequence()
    let session = UUID().uuidString
    let model: AppModel

    init() throws {
        let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        let keys = keys
        let pause = pause
        model = AppModel(
            service: service,
            vault: vault,
            store: store,
            signals: signals,
            timeZone: timeZone,
            now: { fixedInstant },
            pause: { try await pause.pause($0) },
            makeIdempotencyKey: { keys.next() }
        )
    }

    var ownerIdentifier: String {
        service.issuedSession.owner.identifier
    }

    func watchKey(_ projectIdentifier: String) -> WatchKey {
        WatchKey(session: session, projectIdentifier: projectIdentifier)
    }

    func cache(_ workspaces: [Workspace], active: Workspace) {
        cache(workspaces, active: active, ownerIdentifier: ownerIdentifier)
    }

    func cache(_ workspaces: [Workspace], active: Workspace, ownerIdentifier: String) {
        store.owner = OwnerCache(ownerIdentifier: ownerIdentifier, workspaces: workspaces, activeWorkspaceIdentifier: active.identifier)
    }

    func cacheTasks(projectIdentifier: String, count: Int, cursor: Int) {
        let tasks = (1...count).map { MutableTask(number: $0, title: "Cached \($0)").record }
        store.projects[projectIdentifier] = ProjectCache(projectIdentifier: projectIdentifier, cursor: cursor, tasks: tasks)
    }

    func launchedFromCache() async {
        vault.secret = session
        await model.launch()
        service.calls = []
        store.calls = []
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
