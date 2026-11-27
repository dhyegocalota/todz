import Foundation
import Testing
@testable import TodzKit

private let acmeName = "Acme"
private let walkBName = "Walk B"
private let walkCName = "Walk C"

private struct LiveOwner {
    let identity: String
    let session: String
    let acme: Workspace
    let walkB: Workspace
    let walkC: Workspace
}

private func inbox(of workspace: Workspace) throws -> Project {
    try #require(workspace.projects.first { $0.isInbox })
}

private func liveToday() throws -> CalendarDate {
    CalendarDate.today(in: try #require(TimeZone(identifier: liveTimeZone)), at: Date())
}

private func added(api: OwnerAPI, session: String, workspace: Workspace, titles: [(title: String, dueDate: CalendarDate?)]) async throws {
    let drafts = titles.map { TaskDraft(title: $0.title, notes: nil, dueDate: $0.dueDate, idempotencyKey: TaskDraft.newIdempotencyKey()) }
    _ = try await api.addTasks(session: session, projectIdentifier: try inbox(of: workspace).identifier, drafts: drafts)
}

private func seededOwner() async throws -> LiveOwner {
    let api = try liveAPI()
    let identity = "live-\(UUID().uuidString.lowercased())"
    let session = try await api.signIn(identityToken: identity, linkVerifier: nil, turnstileToken: nil, timeZone: liveTimeZone).sessionToken
    let acme = try await api.createWorkspace(session: session, name: acmeName)
    let walkB = try await api.createWorkspace(session: session, name: walkBName)
    let walkC = try await api.createWorkspace(session: session, name: walkCName)
    let today = try liveToday()
    try await added(api: api, session: session, workspace: acme, titles: [(title: "Acme one", dueDate: today)])
    try await added(api: api, session: session, workspace: walkB, titles: [(title: "Walk B one", dueDate: nil)])
    try await added(api: api, session: session, workspace: walkC, titles: [(title: "Walk C one", dueDate: today), (title: "Walk C two", dueDate: nil)])
    return LiveOwner(identity: identity, session: session, acme: acme, walkB: walkB, walkC: walkC)
}

private func serverTasks(of workspace: Workspace, session: String) async throws -> [TaskRecord] {
    try await ProjectFeed(service: try liveAPI()).pull(session: session, projectIdentifier: try inbox(of: workspace).identifier, cursor: 0).tasks
}

@MainActor private struct LiveApp {
    let vault: InMemorySessionVault
    let store: InMemorySyncStore
    let widgets = InMemoryWidgetStore()
    let model: AppModel

    init(vault: InMemorySessionVault = InMemorySessionVault(), store: InMemorySyncStore = InMemorySyncStore()) throws {
        let address = try ServerAddress.checked(text: try liveAddress().absoluteString).get()
        let defaultsName = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: defaultsName))
        let widgets = widgets
        vault.origin = address.origin
        self.vault = vault
        self.store = store
        model = AppModel(
            defaultURL: address,
            preference: ServerPreference(defaults: defaults, domainName: defaultsName),
            connect: { ServerConnection(service: OwnerAPI(baseURL: $0.url, appVersion: OwnerFixtures.appVersion, language: OwnerFixtures.language), signals: SocketChangeSignals(baseURL: $0.url, appVersion: OwnerFixtures.appVersion, language: OwnerFixtures.language)) },
            probe: { _ in .matches },
            appVersion: OwnerFixtures.appVersion,
            linkScheme: harnessLinkScheme,
            vault: vault,
            pendingLinks: InMemoryPendingLinkVault(),
            store: store,
            workspaceLock: WorkspaceLock(preference: WorkspaceLockPreference(defaults: defaults, domainName: defaultsName), authenticator: FakeAuthenticator()),
            widgetStore: widgets,
            reloadWidgets: { MainActor.assumeIsolated { widgets.recordReload() } },
            timeZone: try #require(TimeZone(identifier: liveTimeZone)),
            pause: { try await Task.sleep(for: $0) }
        )
    }

    func signedInOnAll(identity: String) async {
        await model.launch()
        await model.signIn(identity: identity)
        await model.chooseWorkspaces(.all)
    }
}

@Suite(.enabled(if: ProcessInfo.processInfo.environment[liveAddressVariable] != nil), .serialized)
@MainActor struct LiveMultiWorkspaceTests {
    @Test func allShowsEveryInboxAndTodayOnTheServerTaggedByWorkspace() async throws {
        let owner = try await seededOwner()
        let app = try LiveApp()
        await app.signedInOnAll(identity: owner.identity)
        defer { app.model.stopWatching() }
        let views = try #require(app.model.taskViews)
        #expect(app.model.shownWorkspaces.map(\.name) == [acmeName, walkBName, walkCName])
        #expect(views.inbox.map(\.task.title) == ["Acme one", "Walk B one", "Walk C one", "Walk C two"])
        #expect(views.inbox.map(\.workspaceName) == [acmeName, walkBName, walkCName, walkCName])
        #expect(views.today.open.map(\.task.title) == ["Acme one", "Walk C one"])
        #expect(views.today.open.map(\.workspaceName) == [acmeName, walkCName])
        #expect(app.model.todayHeadingCount == 2)
    }

    @Test func theWorkspaceShortcutsMapToTheServersOrder() async throws {
        let owner = try await seededOwner()
        let app = try LiveApp()
        await app.signedInOnAll(identity: owner.identity)
        defer { app.model.stopWatching() }
        await app.model.switchWorkspace(number: 3)
        #expect(app.model.shownWorkspaces.map(\.identifier) == [owner.walkC.identifier])
        #expect(app.model.taskViews?.inbox.map(\.task.title) == ["Walk C one", "Walk C two"])
        #expect(app.model.taskViews?.inbox.map(\.workspaceName) == [nil, nil])
        await app.model.switchWorkspace(number: 2)
        #expect(app.model.taskViews?.inbox.map(\.task.title) == ["Walk B one"])
        #expect(app.model.todayHeadingCount == 0)
    }

    @Test func anAddFromTheInboxOfAllReachesThePrimaryWorkspaceOnTheServer() async throws {
        let owner = try await seededOwner()
        let app = try LiveApp()
        await app.signedInOnAll(identity: owner.identity)
        defer { app.model.stopWatching() }
        let destination = try #require(app.model.addTaskDestination(for: .inbox))
        #expect(destination.projectIdentifier == (try inbox(of: owner.acme).identifier))
        await app.model.addTask(title: "Acme two", projectIdentifier: destination.projectIdentifier, dueDate: destination.dueDate)
        await app.model.sendLoop?.value
        #expect(try await serverTasks(of: owner.acme, session: owner.session).map(\.title) == ["Acme one", "Acme two"])
        #expect(app.model.taskViews?.inbox.map(\.task.title) == ["Acme one", "Acme two", "Walk B one", "Walk C one", "Walk C two"])
    }

    @Test func theWidgetSnapshotCarriesEachWorkspaceAndATickCompletesInItsOwnWorkspaceOnTheServer() async throws {
        let owner = try await seededOwner()
        let app = try LiveApp()
        await app.signedInOnAll(identity: owner.identity)
        defer { app.model.stopWatching() }
        await app.model.widgetPublication?.value
        let snapshot = try #require(app.widgets.snapshot)
        #expect(snapshot.open.map(\.title) == ["Acme one", "Walk C one"])
        #expect(snapshot.open.map(\.workspaceIdentifier) == [owner.acme.identifier, owner.walkC.identifier])
        let walkCTask = try #require(snapshot.open.last)
        let number = try #require(walkCTask.number)
        let request = WidgetRequest(projectIdentifier: walkCTask.projectIdentifier, number: number, state: .done, at: Date(), workspaceIdentifier: walkCTask.workspaceIdentifier)
        app.widgets.storedRequests = [StoredWidgetRequest(name: "\(UUID().uuidString).json", request: request)]
        await app.model.takeWidgetRequests()
        await app.model.sendLoop?.value
        let walkC = try await serverTasks(of: owner.walkC, session: owner.session)
        let acme = try await serverTasks(of: owner.acme, session: owner.session)
        #expect(walkC.first { $0.title == "Walk C one" }?.state == .done)
        #expect(acme.map(\.state) == [.open])
        #expect(app.model.todayHeadingCount == 1)
    }

    @Test func aRelaunchKeepsAllAndShowsTheServersThreeWorkspaces() async throws {
        let owner = try await seededOwner()
        let first = try LiveApp()
        await first.signedInOnAll(identity: owner.identity)
        first.model.stopWatching()
        let relaunched = try LiveApp(vault: first.vault, store: first.store)
        await relaunched.model.launch()
        defer { relaunched.model.stopWatching() }
        #expect(relaunched.model.selection == .all)
        #expect(relaunched.model.shownWorkspaces.map(\.name) == [acmeName, walkBName, walkCName])
        #expect(relaunched.model.taskViews?.inbox.map(\.task.title) == ["Acme one", "Walk B one", "Walk C one", "Walk C two"])
        #expect(relaunched.model.taskViews?.inbox.map(\.workspaceName) == [acmeName, walkBName, walkCName, walkCName])
        #expect(relaunched.model.todayHeadingCount == 2)
    }
}
