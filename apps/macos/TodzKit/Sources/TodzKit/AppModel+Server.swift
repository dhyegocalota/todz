extension AppModel {
    static func addressInUse(preference: ServerPreference, defaultURL: ServerAddress) -> ServerAddress {
        guard let stored = preference.storedAddress() else { return defaultURL }
        return stored
    }

    public var isSignedIn: Bool {
        session != nil
    }

    public var isOnDefaultServer: Bool {
        serverURL == defaultURL
    }

    public func probeServer(_ address: ServerAddress) async -> ServerProbeOutcome {
        await probe(address)
    }

    // NB ADR 0056: the erase runs before the rebuild and the store, with no await between them; the old server's sign-out goes last and detached.
    @discardableResult
    public func switchServer(to address: ServerAddress) async -> ServerSwitchResult {
        guard address != serverURL else { return .alreadyInUse }
        let isBusy = isSigningIn || isRequestingLink
        guard !isBusy else { return .busy }
        let leavingSession = session
        let leavingService = service
        do {
            try vault.erase()
            try eraseCache()
            try pendingLinks.erase()
        } catch {
            return .eraseFailed
        }
        eraseLocalData()
        forgetSignInState()
        let connection = connect(address)
        service = connection.service
        signals = connection.signals
        serverURL = address
        remember(address)
        signOut(session: leavingSession, at: leavingService)
        forgetVersions()
        refreshCompatibility()
        return .switched
    }

    func eraseDataOfAnotherServer() {
        let isUnreadableServer = preference.hasUnreadableValue
        guard isUnreadableServer || isStoredSessionOfAnotherServer() else { return }
        do {
            try vault.erase()
            try eraseCache()
            try pendingLinks.erase()
        } catch {
            isLocalDataUnerased = true
            return
        }
        eraseWidgets()
        if isUnreadableServer { preference.clear() }
    }

    private func isStoredSessionOfAnotherServer() -> Bool {
        do {
            guard let stored = try vault.read() else { return false }
            return stored.origin != serverURL.origin
        } catch SessionVaultError.unbound {
            return !didBindSessionOfEarlierBuild()
        } catch {
            return false
        }
    }

    // NB ADR 0056: a session with no server and no stored server is an earlier build's, issued by the default, so it is bound to the default.
    private func didBindSessionOfEarlierBuild() -> Bool {
        guard !preference.hasValue else { return false }
        do {
            try vault.bind(to: defaultURL.origin)
            return true
        } catch {
            return false
        }
    }

    private func forgetSignInState() {
        signInChallengeToken = nil
        signInMethod = nil
        signInMethodError = nil
        signInError = nil
        lastIdentity = nil
        pendingLink = nil
        heldSignInLink = nil
        challengeRound += 1
    }

    private func remember(_ address: ServerAddress) {
        guard address != defaultURL else {
            preference.clear()
            return
        }
        preference.store(address)
    }

    private func signOut(session: String?, at leavingService: any OwnerService) {
        guard let session else { return }
        serverSignOut = Task { try? await leavingService.signOut(session: session) }
    }
}
