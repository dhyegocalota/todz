import Foundation

extension AppModel {
    public func loadSignInMethod() async {
        signInMethodError = nil
        do {
            signInMethod = try await service.signInMethod()
        } catch let failure as OwnerAPIError {
            signInMethodError = SignInError(failure)
        } catch {
            signInMethodError = .unexpected
        }
    }

    public func acceptChallenge(token: String) {
        fatalError("AppModel.acceptChallenge(token:) is not implemented")
    }

    public func requestSignInLink(email: String) async {
        fatalError("AppModel.requestSignInLink(email:) is not implemented")
    }

    public func redeem(signInLink: SignInLink) async {
        guard isLaunchSettled else {
            heldSignInLink = signInLink
            return
        }
        guard case .signedOut = phase, !isSigningIn else { return }
        heldSignInLink = nil
        guard let pendingLink, !isExpired(pendingLink) else {
            discardPendingLink()
            signInError = .linkNotRequested
            return
        }
        let isOpened = await openSession {
            try await service.signIn(identityToken: signInLink.token, linkVerifier: pendingLink.verifier, turnstileToken: signInLink.turnstileToken, timeZone: timeZone.identifier)
        }
        guard !isOpened else { return }
        if signInError == .identityRejected { signInError = .linkRejected }
        if isExpired(pendingLink) { discardPendingLink() }
        let isRetryable = signInError == .unreachable && self.pendingLink != nil
        guard isRetryable else { return }
        heldSignInLink = signInLink
    }

    public var canRedeemAgain: Bool {
        heldSignInLink != nil
    }

    public var showsIncomingSignInLink: Bool {
        phase != .naming && phase != .ready
    }

    public func useDifferentEmail() {
        discardPendingLink()
        signInError = nil
    }

    public func discardPendingLink() {
        pendingLink = nil
        heldSignInLink = nil
        try? pendingLinks.erase()
    }

    func restorePendingLink() {
        guard let stored = try? pendingLinks.read() else { return }
        guard !isExpired(stored) else {
            try? pendingLinks.erase()
            return
        }
        pendingLink = stored
    }

    public func redeemHeldSignInLink() async {
        guard let heldSignInLink else { return }
        self.heldSignInLink = nil
        await redeem(signInLink: heldSignInLink)
    }

    private func verifierToSend(to email: String) -> String {
        guard let pendingLink, normalized(pendingLink.email) == normalized(email) else { return makeLinkVerifier() }
        guard now() < pendingLink.expiresAt.addingTimeInterval(-SignInLinkTiming.margin) else { return makeLinkVerifier() }
        return pendingLink.verifier
    }

    private func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func keep(_ link: PendingSignInLink) {
        pendingLink = link
        try? pendingLinks.write(link)
    }

    private func isExpired(_ link: PendingSignInLink) -> Bool {
        now() >= link.expiresAt
    }
}
