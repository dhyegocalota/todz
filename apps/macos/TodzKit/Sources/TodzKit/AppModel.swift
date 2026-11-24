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
    var retry: (@MainActor () async -> Void)?

    @ObservationIgnored var session: String?
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
        workspaces.first { $0.identifier == activeWorkspaceIdentifier }
    }

    public var today: CalendarDate {
        CalendarDate.today(in: timeZone, at: now())
    }

    public var taskViews: TaskViews? {
        guard let activeWorkspace else { return nil }
        return TaskViews(projects: activeWorkspace.projects, board: board, day: today, timeZone: timeZone)
    }

    public var canTryAgain: Bool {
        retry != nil
    }

    public func launch() async {
        let secret: String?
        do {
            secret = try vault.read()
        } catch {
            phase = .signedOut(notice: .sessionUnreadable)
            return
        }
        guard let secret else {
            phase = .signedOut(notice: nil)
            return
        }
        session = secret
        phase = .loading
        await sendTimeZone()
        await loadWorkspaces()
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
        session = issued.sessionToken
        phase = .loading
        keep(secret: issued.sessionToken)
        await loadWorkspaces()
    }

    public func signOut() async {
        guard let session else { return }
        clearSession()
        phase = .signedOut(notice: nil)
        try? vault.erase()
        try? await service.signOut(session: session)
    }

    public func tryAgain() async {
        guard let retry else { return }
        dismissBanner()
        await retry()
    }

    public func dismissBanner() {
        banner = nil
        retry = nil
    }

    func raise(_ banner: AppBanner, retry: (@MainActor () async -> Void)? = nil) {
        self.banner = banner
        self.retry = retry
    }

    func request<Value>(_ operation: (String) async throws -> Value) async throws -> Value {
        guard let session else { throw OwnerAPIError.unauthorized }
        do {
            let value = try await operation(session)
            guard self.session == session else { throw CancellationError() }
            return value
        } catch OwnerAPIError.unauthorized {
            endSession()
            throw OwnerAPIError.unauthorized
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
        workspaces = []
        activeWorkspaceIdentifier = nil
        selectedItem = .inbox
        selectedTask = nil
        board = TaskBoard()
        projectLoads = [:]
        ruleIssues = [:]
        histories = [:]
        dismissBanner()
    }

    private func sendTimeZone() async {
        _ = try? await request { try await service.updateOwner(session: $0, timeZone: timeZone.identifier) }
    }

    private func keep(secret: String) {
        do {
            try vault.write(secret)
        } catch {
            raise(.sessionNotSaved)
        }
    }
}
