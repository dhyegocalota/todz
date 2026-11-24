import Foundation
import Observation

public func newIdempotencyKey() -> String {
    UUID().uuidString.lowercased()
}

@MainActor @Observable public final class AppModel {
    public internal(set) var phase: AppPhase = .loading
    public internal(set) var signInError: SignInError?
    public internal(set) var isSigningIn = false
    public internal(set) var lastIdentity: String?
    public internal(set) var workspaces: [Workspace] = []
    public internal(set) var activeWorkspaceIdentifier: String?
    public var selectedItem: SidebarItem = .inbox
    public var selectedTask: TaskKey?
    public internal(set) var board = TaskBoard()
    public internal(set) var projectLoads: [String: ProjectLoad] = [:]
    public internal(set) var pullsInFlight: Set<String> = []
    public internal(set) var writesInFlight: Set<WriteTarget> = []
    public internal(set) var ruleIssues: [WriteTarget: RuleIssue] = [:]
    public internal(set) var banner: AppBanner?
    public internal(set) var histories: [TaskKey: HistoryLoad] = [:]

    @ObservationIgnored let service: any OwnerService
    @ObservationIgnored let vault: any SessionVault
    @ObservationIgnored public let timeZone: TimeZone
    @ObservationIgnored let now: () -> Date
    @ObservationIgnored let makeIdempotencyKey: () -> String

    public init(
        service: any OwnerService,
        vault: any SessionVault,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        makeIdempotencyKey: @escaping () -> String = newIdempotencyKey
    ) {
        self.service = service
        self.vault = vault
        self.timeZone = timeZone
        self.now = now
        self.makeIdempotencyKey = makeIdempotencyKey
    }

    public var activeWorkspace: Workspace? {
        fatalError("AppModel is not implemented")
    }

    public var today: CalendarDate {
        fatalError("AppModel is not implemented")
    }

    public var taskViews: TaskViews? {
        fatalError("AppModel is not implemented")
    }

    public var canTryAgain: Bool {
        fatalError("AppModel is not implemented")
    }

    public func launch() async {
        fatalError("AppModel is not implemented")
    }

    public func signIn(identity: String) async {
        fatalError("AppModel is not implemented")
    }

    public func signOut() async {
        fatalError("AppModel is not implemented")
    }

    public func createWorkspace(name: String) async {
        fatalError("AppModel is not implemented")
    }

    public func switchWorkspace(identifier: String) async {
        fatalError("AppModel is not implemented")
    }

    public func refresh() async {
        fatalError("AppModel is not implemented")
    }

    public func createProject(name: String) async {
        fatalError("AppModel is not implemented")
    }

    public func renameProject(projectIdentifier: String, name: String) async {
        fatalError("AppModel is not implemented")
    }

    public func addTask(title: String, projectIdentifier: String, dueDate: CalendarDate?) async {
        fatalError("AppModel is not implemented")
    }

    public func complete(task: TaskKey) async {
        fatalError("AppModel is not implemented")
    }

    public func reopen(task: TaskKey) async {
        fatalError("AppModel is not implemented")
    }

    public func updateTitle(task: TaskKey, title: String) async {
        fatalError("AppModel is not implemented")
    }

    public func updateNotes(task: TaskKey, notes: String?) async {
        fatalError("AppModel is not implemented")
    }

    public func updateDueDate(task: TaskKey, dueDate: CalendarDate?) async {
        fatalError("AppModel is not implemented")
    }

    public func move(task: TaskKey, placement: TaskPlacement) async {
        fatalError("AppModel is not implemented")
    }

    public func loadHistory(task: TaskKey) async {
        fatalError("AppModel is not implemented")
    }

    public func tryAgain() async {
        fatalError("AppModel is not implemented")
    }

    public func dismissBanner() {
        fatalError("AppModel is not implemented")
    }
}
