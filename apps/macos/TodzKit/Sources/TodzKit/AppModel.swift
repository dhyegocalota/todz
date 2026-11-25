import Foundation
import Observation

@MainActor @Observable public final class AppModel {
    public internal(set) var phase: AppPhase = .loading
    public internal(set) var signInError: SignInError?
    public internal(set) var isSigningIn = false
    public internal(set) var isRequestingLink = false
    public internal(set) var lastIdentity: String?
    public internal(set) var signInMethod: SignInMethod?
    public internal(set) var signInMethodError: SignInError?
    public internal(set) var pendingLink: PendingSignInLink?
    public internal(set) var signInChallengeToken: String?
    public internal(set) var challengeRound = 0
    public internal(set) var workspaces: [Workspace] = []
    public internal(set) var activeWorkspaceIdentifier: String?
    public var selectedItem: SidebarItem = .inbox {
        didSet {
            waitingLink = nil
            followKeyScreen(from: oldValue)
        }
    }

    public var selectedTask: TaskKey? {
        didSet { waitingLink = nil }
    }

    public internal(set) var board = TaskBoard()
    public internal(set) var projectLoads: [String: ProjectLoad] = [:]
    public internal(set) var writesInFlight: Set<WriteTarget> = []
    public internal(set) var ruleIssues: [WriteTarget: RuleIssue] = [:]
    public internal(set) var unsavedNotes: [TaskKey: String] = [:]
    public internal(set) var banner: AppBanner?
    public internal(set) var histories: [TaskKey: HistoryLoad] = [:]
    public internal(set) var linkRevealCount = 0
    public internal(set) var keyProjectIdentifier: String?
    public internal(set) var keys: KeyList?
    public internal(set) var issuedKey: IssuedKey?
    public internal(set) var isIssuing = false
    public internal(set) var issueFailure: KeyFailure?
    public internal(set) var keyReloadFailure: KeyFailure?
    public internal(set) var revokingKeyIdentifiers: Set<String> = []
    public internal(set) var failedRevokeIdentifiers: Set<String> = []
    var retry: (@MainActor () async -> Void)?
    var retryTarget: WriteTarget?
    var outbox = Outbox()
    var refreshesInFlight = 0
    public internal(set) var isOffline = false
    var isOwnerConfirmed = false
    public internal(set) var agentNudge: Bool?
    var isSavingAgentNudge = false
    var isAgentNudgeNotSaved = false

    @ObservationIgnored var hasLaunched = false
    @ObservationIgnored var isLaunchSettled = false
    var heldSignInLink: SignInLink?
    @ObservationIgnored var session: String?
    @ObservationIgnored var ownerIdentifier: String?
    @ObservationIgnored var isWorkspaceListOutdated = false
    @ObservationIgnored var workspaceListingsInFlight = 0
    @ObservationIgnored var isCacheNotSavedRaised = false
    @ObservationIgnored var watches: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var watchAttempts: [String: Int] = [:]
    @ObservationIgnored var isWatchAnswered: [String: Bool] = [:]
    @ObservationIgnored var workspaceReload: Task<Void, Never>?
    @ObservationIgnored var workspaceReloadIdentifier: UUID?
    @ObservationIgnored var ownerConfirmationRetry: Task<Void, Never>?
    @ObservationIgnored var ownerConfirmationFailures = 0
    @ObservationIgnored var sendLoop: Task<Void, Never>?
    @ObservationIgnored var sendingSession: String?
    @ObservationIgnored var sendWait: Task<Void, any Error>?
    @ObservationIgnored var headInFlightSession: String?
    @ObservationIgnored var sendFailures = 0
    @ObservationIgnored var hasServerAnswered = false
    @ObservationIgnored var refusalsInFlush = 0
    @ObservationIgnored var selectionsAtAdd: [String: TaskKey?] = [:]
    @ObservationIgnored var projectsToPullFromStart: Set<String> = []
    @ObservationIgnored var pullGates: [String: PullGate] = [:]
    @ObservationIgnored var queuedPulls: Set<String> = []
    @ObservationIgnored var widgetPublication: Task<Void, Never>?
    @ObservationIgnored var widgetIntake: Task<Void, Never>?
    @ObservationIgnored var linkFollowing: Task<Void, Never>?
    @ObservationIgnored var waitingLink: WidgetLink?
    @ObservationIgnored var publishedWidgetSnapshot: WidgetSnapshotState?
    @ObservationIgnored var keyScreenIdentifier: UUID?
    @ObservationIgnored var keyIssueAnswerCount = 0
    @ObservationIgnored var revokedKeyIdentifiers: Set<String> = []
    @ObservationIgnored var keyLoading: Task<Void, Never>?
    @ObservationIgnored let service: any OwnerService
    @ObservationIgnored let vault: any SessionVault
    @ObservationIgnored let pendingLinks: any PendingLinkVault
    @ObservationIgnored let store: any SyncStore
    @ObservationIgnored let widgetStore: any WidgetStore
    @ObservationIgnored let reloadWidgets: @Sendable () -> Void
    @ObservationIgnored let signals: any ChangeSignals
    @ObservationIgnored public let timeZone: TimeZone
    @ObservationIgnored let now: () -> Date
    @ObservationIgnored let pause: @Sendable (Duration) async throws -> Void
    @ObservationIgnored let makeIdempotencyKey: () -> String
    @ObservationIgnored let makeLinkVerifier: () -> String

    public init(
        service: any OwnerService,
        vault: any SessionVault,
        pendingLinks: any PendingLinkVault,
        store: any SyncStore,
        widgetStore: any WidgetStore,
        reloadWidgets: @escaping @Sendable () -> Void,
        signals: any ChangeSignals,
        timeZone: TimeZone,
        now: @escaping () -> Date = Date.init,
        pause: @escaping @Sendable (Duration) async throws -> Void,
        makeIdempotencyKey: @escaping () -> String = TaskDraft.newIdempotencyKey,
        makeLinkVerifier: @escaping () -> String = SignInLinkChallenge.newVerifier
    ) {
        self.service = service
        self.vault = vault
        self.pendingLinks = pendingLinks
        self.store = store
        self.widgetStore = widgetStore
        self.reloadWidgets = reloadWidgets
        self.signals = signals
        self.timeZone = timeZone
        self.now = now
        self.pause = pause
        self.makeIdempotencyKey = makeIdempotencyKey
        self.makeLinkVerifier = makeLinkVerifier
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

    // NB ADR 0031: the model launches once per process, whichever surface asks first; every later call returns at once.
    public func launch() async {
        guard !hasLaunched else { return }
        hasLaunched = true
        await openLaunchSession()
        isLaunchSettled = true
        await redeemHeldSignInLink()
    }

    private func openLaunchSession() async {
        observeWidgets()
        restorePendingLink()
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
        await openWorkspaces()
    }

    public func signIn(identity: String) async {
        lastIdentity = identity
        await openSession { try await service.signIn(identityToken: identity, linkVerifier: nil, turnstileToken: nil, timeZone: timeZone.identifier) }
    }

    @discardableResult
    func openSession(issuing: () async throws -> IssuedSession) async -> Bool {
        signInError = nil
        isSigningIn = true
        defer { isSigningIn = false }
        let issued: IssuedSession
        do {
            issued = try await issuing()
        } catch let failure as OwnerAPIError {
            signInError = SignInError(failure)
            return false
        } catch {
            signInError = .unexpected
            return false
        }
        let cached: OwnerCache?
        do {
            cached = try cacheToOpen(for: issued.owner)
        } catch {
            signInError = .unexpected
            try? await service.signOut(session: issued.sessionToken)
            return false
        }
        session = issued.sessionToken
        ownerIdentifier = issued.owner.identifier
        isOwnerConfirmed = true
        agentNudge = issued.owner.agentNudge
        phase = .loading
        keep(secret: issued.sessionToken)
        discardPendingLink()
        openCache(cached)
        startSending()
        await openWorkspaces()
        return true
    }

    public func signOut() async {
        guard let session else { return }
        do {
            try store.erase()
        } catch {
            raise(.signOutFailed)
            return
        }
        eraseWidgets()
        outbox = Outbox()
        clearSession()
        phase = .signedOut(notice: nil)
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
            noteAnswer()
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
        isOwnerConfirmed = false
        forgetAgentNudge()
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
        forgetKeys()
        selectedItem = .inbox
        selectedTask = nil
        board = TaskBoard()
        projectLoads = [:]
        ruleIssues = [:]
        unsavedNotes = [:]
        histories = [:]
        dismissBanner()
    }

    // NB ADR 0027: nothing is sent before this session's owner is confirmed, and another owner's cache is erased first.
    func confirmOwner() async throws {
        guard !isOwnerConfirmed else { return }
        let owner: Owner
        do {
            owner = try await confirmedOwner()
        } catch {
            let isAnotherOwnerPossible = ownerIdentifier != nil
            guard !isAnotherOwnerPossible else { throw error }
            return
        }
        let isAnotherOwnersCache = ownerIdentifier != nil && ownerIdentifier != owner.identifier
        if isAnotherOwnersCache { try forgetCache() }
        isOwnerConfirmed = true
        ownerConfirmationFailures = 0
        ownerIdentifier = owner.identifier
        agentNudge = owner.agentNudge
    }

    private func openWorkspaces() async {
        await takeWidgetRequests()
        await loadOrReloadWorkspaces()
        await takeWidgetRequests()
    }

    private func loadOrReloadWorkspaces() async {
        guard phase == .ready else {
            await loadWorkspaces()
            return
        }
        await reloadWorkspacesQuietly()
    }

    private func confirmedOwner() async throws -> Owner {
        do {
            return try await request { try await service.updateOwner(session: $0, timeZone: timeZone.identifier) }
        } catch OwnerAPIError.timeZoneInvalid {
            return try await request { try await service.readOwner(session: $0) }
        }
    }

    private func keep(secret: String) {
        do {
            try vault.write(secret)
        } catch {
            raise(.sessionNotSaved)
        }
    }
}
