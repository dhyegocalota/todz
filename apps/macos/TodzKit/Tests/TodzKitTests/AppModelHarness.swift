import Foundation
import Testing
@testable import TodzKit

let harnessTimeZoneIdentifier = "America/Sao_Paulo"
let harnessChallengeToken = "challenge-token"
let harnessLinkTurnstileToken = "link-turnstile-token"
let harnessLinkScheme = AppLinkScheme.debug
let harnessDefaultServer = "http://localhost:8787"
let harnessServerKey = "serverURL"
let harnessPendingLifetime: TimeInterval = 20 * 60

final class KeySequence {
    private(set) var issued: [String] = []

    func next() -> String {
        let key = "key-\(issued.count + 1)"
        issued.append(key)
        return key
    }
}

final class VerifierSequence {
    private(set) var issued: [String] = []

    func next() -> String {
        let verifier = "verifier-\(issued.count + 1)"
        issued.append(verifier)
        return verifier
    }
}

func isSameCallSet(_ calls: [FakeCall], _ expected: [FakeCall]) -> Bool {
    calls.count == expected.count && expected.allSatisfy(calls.contains)
}

final class Captured<Value> {
    var value: Value?
}

final class HarnessClock {
    var now = fixedInstant
}

@MainActor struct AppModelHarness {
    let service = FakeOwnerService()
    let vault = InMemorySessionVault()
    let pendingLinks = InMemoryPendingLinkVault()
    let store = InMemorySyncStore()
    let widgets = InMemoryWidgetStore()
    let signals = FakeChangeSignals()
    let pause = HeldPause()
    let keys = KeySequence()
    let verifiers = VerifierSequence()
    let clock = HarnessClock()
    let session = UUID().uuidString
    let probes = ProbeRecorder()
    let authenticator = FakeAuthenticator()
    let lockPreference: WorkspaceLockPreference
    let servers: FakeServers
    let defaultURL: ServerAddress
    let preference: ServerPreference
    let breadcrumbFolder: URL
    let model: AppModel

    init(
        defaultServer: String = harnessDefaultServer,
        storedServer: String? = nil,
        isLocalDataKept: Bool = false,
        sessionOrigin: String? = harnessDefaultServer,
        isVaultUnerasable: Bool = false,
        cacheScheduler: CacheScheduler = .immediate,
        isWorkspaceLockOn: Bool = false
    ) throws {
        let timeZone = try #require(TimeZone(identifier: harnessTimeZoneIdentifier))
        let defaultURL = try ServerAddress.checked(text: defaultServer).get()
        let defaultsName = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: defaultsName))
        defaults.removePersistentDomain(forName: defaultsName)
        if let storedServer { defaults.set(storedServer, forKey: harnessServerKey) }
        let preference = ServerPreference(defaults: defaults, domainName: defaultsName)
        lockPreference = WorkspaceLockPreference(defaults: defaults, domainName: defaultsName)
        lockPreference.store(isOn: isWorkspaceLockOn)
        let servers = FakeServers(service: service, signals: signals)
        let probes = probes
        let keys = keys
        let verifiers = verifiers
        let pause = pause
        let widgets = widgets
        let clock = clock
        vault.isUnerasable = isVaultUnerasable
        if isLocalDataKept {
            vault.secret = session
            vault.origin = sessionOrigin
            store.owner = OwnerCache(ownerIdentifier: service.issuedSession.owner.identifier, workspaces: [], activeWorkspaceIdentifier: nil)
            store.outbox = Data("outbox".utf8)
            pendingLinks.link = PendingSignInLink(email: "maria@example.com", verifier: "verifier-0", expiresAt: fixedInstant.addingTimeInterval(harnessPendingLifetime))
        }
        let breadcrumbFolder = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: breadcrumbFolder, withIntermediateDirectories: true)
        self.breadcrumbFolder = breadcrumbFolder
        self.defaultURL = defaultURL
        self.preference = preference
        self.servers = servers
        model = AppModel(
            defaultURL: defaultURL,
            preference: preference,
            connect: { servers.connect($0) },
            probe: { await probes.probe($0) },
            appVersion: OwnerFixtures.appVersion,
            linkScheme: harnessLinkScheme,
            vault: vault,
            pendingLinks: pendingLinks,
            store: store,
            breadcrumbs: LaunchBreadcrumbs(folder: breadcrumbFolder, now: { clock.now }, maxByteCount: LaunchBreadcrumbs.standardMaxByteCount),
            cacheScheduler: cacheScheduler,
            workspaceLock: WorkspaceLock(preference: lockPreference, authenticator: authenticator, now: { clock.now }),
            widgetStore: widgets,
            reloadWidgets: { MainActor.assumeIsolated { widgets.recordReload() } },
            timeZone: timeZone,
            now: { clock.now },
            pause: { try await pause.pause($0) },
            makeIdempotencyKey: { keys.next() },
            makeLinkVerifier: { verifiers.next() }
        )
    }

    func askForLink(email: String) async {
        model.acceptChallenge(token: harnessChallengeToken)
        await model.requestSignInLink(email: email)
    }

    var breadcrumbLines: [String] {
        let file = breadcrumbFolder.appending(path: "launch-breadcrumbs.log")
        guard let text = try? String(contentsOf: file, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").map(String.init)
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

    func flushed() async {
        await model.sendLoop?.value
    }

    func versionsRead() async {
        await model.compatibilityRefresh?.value
    }

    func signedOutAtTheOldServer() async {
        await model.serverSignOut?.value
    }

    func published() async {
        await model.widgetPublication?.value
    }

    func pulled(_ projectIdentifier: String) async {
        _ = await model.pullGates[projectIdentifier]?.task.value
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

    func rememberWorkspace(identifier: String) {
        store.owner = OwnerCache(ownerIdentifier: service.issuedSession.owner.identifier, workspaces: [], activeWorkspaceIdentifier: identifier)
    }

    func signedIn() async {
        vault.secret = session
        await model.launch()
        service.calls = []
    }
}
