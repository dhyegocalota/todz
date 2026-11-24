import Foundation
import Observation

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
    public internal(set) var writesInFlight: Set<WriteTarget> = []
    public internal(set) var ruleIssues: [WriteTarget: RuleIssue] = [:]
    public internal(set) var unsavedNotes: [TaskKey: String] = [:]
    public internal(set) var banner: AppBanner?
    public internal(set) var histories: [TaskKey: HistoryLoad] = [:]
    var retry: (@MainActor () async -> Void)?
    var retryTarget: WriteTarget?
    var outbox = Outbox()
    var refreshesInFlight = 0
    var isOffline = false

    @ObservationIgnored var session: String?
    @ObservationIgnored var ownerIdentifier: String?
    @ObservationIgnored var isWorkspaceListOutdated = false
    @ObservationIgnored var isCacheNotSavedRaised = false
    @ObservationIgnored var watches: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var watchAttempts: [String: Int] = [:]
    @ObservationIgnored var workspaceReload: Task<Void, Never>?
    @ObservationIgnored var sendLoop: Task<Void, Never>?
    @ObservationIgnored var sendingSession: String?
    @ObservationIgnored var sendWait: Task<Void, any Error>?
    @ObservationIgnored var headInFlightSession: String?
    @ObservationIgnored var sendFailures = 0
    @ObservationIgnored var refusalsInFlush = 0
    @ObservationIgnored var selectionsAtAdd: [String: TaskKey?] = [:]
    @ObservationIgnored var projectsToPullFromStart: Set<String> = []
    @ObservationIgnored var pullGates: [String: PullGate] = [:]
    @ObservationIgnored var queuedPulls: Set<String> = []
    @ObservationIgnored let service: any OwnerService
    @ObservationIgnored let vault: any SessionVault
    @ObservationIgnored let store: any SyncStore
    @ObservationIgnored let signals: any ChangeSignals
    @ObservationIgnored public let timeZone: TimeZone
    @ObservationIgnored let now: () -> Date
    @ObservationIgnored let pause: @Sendable (Duration) async throws -> Void
    @ObservationIgnored let makeIdempotencyKey: () -> String

    public init(
        service: any OwnerService,
        vault: any SessionVault,
        store: any SyncStore,
        signals: any ChangeSignals,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        pause: @escaping @Sendable (Duration) async throws -> Void,
        makeIdempotencyKey: @escaping () -> String = TaskDraft.newIdempotencyKey
    ) {
        self.service = service
        self.vault = vault
        self.store = store
        self.signals = signals
        self.timeZone = timeZone
        self.now = now
        self.pause = pause
        self.makeIdempotencyKey = makeIdempotencyKey
    }

    public var waitingChangeCount: Int {
        outbox.count
    }

    public var activeWorkspace: Workspace? {
        workspaces.first { $0.identifier == activeWorkspaceIdentifier }
    }

    public var today: CalendarDate {
        CalendarDate.today(in: timeZone, at: now())
    }

    public var taskViews: TaskViews? {
        guard let activeWorkspace else { return nil }
        return TaskViews(
            projects: activeWorkspace.projects,
            board: board.applying(outbox),
            pendingTasks: outbox.pendingTasks,
            day: today,
            timeZone: timeZone
        )
    }

    public var canTryAgain: Bool {
        retry != nil
    }

    public func launch() async {
        let secret: String?
        do {
            secret = try vault.read()
        } catch {
            loadOutbox()
            phase = .signedOut(notice: .sessionUnreadable)
            return
        }
        guard let secret else {
            loadOutbox()
            phase = .signedOut(notice: nil)
            return
        }
        session = secret
        phase = .loading
        openCache(cachedOwner())
        await sendTimeZone()
        guard session == secret else { return }
        guard phase == .ready else {
            await loadWorkspaces()
            return
        }
        await reloadWorkspacesQuietly()
    }

    public func signIn(identity: String) async {
        lastIdentity = identity
        signInError = nil
        isSigningIn = true
        defer { isSigningIn = false }
        let issued: IssuedSession
        do {
            issued = try await service.signIn(identityToken: identity, timeZone: timeZone.identifier)
        } catch let failure as OwnerAPIError {
            signInError = SignInError(failure)
            return
        } catch {
            signInError = .unexpected
            return
        }
        let cached: OwnerCache?
        do {
            cached = try cacheToOpen(for: issued.owner)
        } catch {
            signInError = .unexpected
            return
        }
        session = issued.sessionToken
        ownerIdentifier = issued.owner.identifier
        phase = .loading
        keep(secret: issued.sessionToken)
        openCache(cached)
        startSending()
        guard phase == .ready else {
            await loadWorkspaces()
            return
        }
        await reloadWorkspacesQuietly()
    }

    public func signOut() async {
        guard let session else { return }
        clearSession()
        phase = .signedOut(notice: nil)
        forgetCache()
        try? vault.erase()
        try? await service.signOut(session: session)
    }

    public func tryAgain() async {
        guard let retry else { return }
        let isRetriedWriteInFlight = writesInFlight.contains { $0 == retryTarget }
        guard !isRetriedWriteInFlight else { return }
        dismissBanner()
        await retry()
    }

    public func dismissBanner() {
        banner = nil
        retry = nil
        retryTarget = nil
    }

    func raise(_ banner: AppBanner, retry: (@MainActor () async -> Void)? = nil, retryTarget: WriteTarget? = nil) {
        self.banner = banner
        self.retry = retry
        self.retryTarget = retryTarget
    }

    func request<Value>(_ operation: (String) async throws -> Value) async throws -> Value {
        guard let session else { throw OwnerAPIError.unauthorized }
        do {
            let value = try await operation(session)
            guard self.session == session else { throw CancellationError() }
            isOffline = false
            return value
        } catch OwnerAPIError.unauthorized {
            guard self.session == session else { throw CancellationError() }
            endSession()
            throw OwnerAPIError.unauthorized
        } catch {
            guard self.session == session else { throw CancellationError() }
            noteConnection(after: error)
            throw error
        }
    }

    func endSession() {
        guard session != nil else { return }
        clearSession()
        try? vault.erase()
        phase = .signedOut(notice: .sessionEnded)
    }

    private func clearSession() {
        session = nil
        ownerIdentifier = nil
        forgetWindow()
    }

    func forgetWindow() {
        stopWatching()
        stopSending()
        stopPulling()
        selectionsAtAdd = [:]
        isWorkspaceListOutdated = false
        isOffline = false
        workspaces = []
        activeWorkspaceIdentifier = nil
        selectedItem = .inbox
        selectedTask = nil
        board = TaskBoard()
        projectLoads = [:]
        ruleIssues = [:]
        unsavedNotes = [:]
        histories = [:]
        dismissBanner()
    }

    private func sendTimeZone() async {
        guard let owner = try? await request({ try await service.updateOwner(session: $0, timeZone: timeZone.identifier) }) else { return }
        let cachedOwnerIdentifier = ownerIdentifier
        ownerIdentifier = owner.identifier
        guard let cachedOwnerIdentifier, cachedOwnerIdentifier != owner.identifier else { return }
        forgetWindow()
        forgetCache()
        phase = .loading
    }

    private func keep(secret: String) {
        do {
            try vault.write(secret)
        } catch {
            raise(.sessionNotSaved)
        }
    }
}
