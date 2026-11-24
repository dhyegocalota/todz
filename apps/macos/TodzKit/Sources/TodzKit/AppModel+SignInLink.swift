import Foundation

extension AppModel {
    public func loadSignInMethod() async {
        signInError = nil
        do {
            signInMethod = try await service.signInMethod()
        } catch let failure as OwnerAPIError {
            signInError = SignInError(failure)
        } catch {
            signInError = .unexpected
        }
    }

    public func requestSignInLink(email: String) async {
        signInError = nil
        isRequestingLink = true
        defer { isRequestingLink = false }
        let verifier = verifierToSend(to: email)
        do {
            try await service.requestSignInLink(email: email, challenge: SignInLinkChallenge.challenge(for: verifier))
        } catch let failure as OwnerAPIError {
            signInError = SignInError(failure)
            return
        } catch {
            signInError = .unexpected
            return
        }
        keep(PendingSignInLink(email: email, verifier: verifier, expiresAt: now().addingTimeInterval(SignInLinkTiming.keepDuration)))
    }

    public func redeem(signInLink: SignInLink) async {
        guard isLaunchSettled else {
            heldSignInLink = signInLink
            return
        }
        guard case .signedOut = phase, !isSigningIn else { return }
        guard let pendingLink, !isExpired(pendingLink) else {
            discardPendingLink()
            signInError = .linkNotRequested
            return
        }
        let isOpened = await openSession {
            try await service.signIn(identityToken: signInLink.token, linkVerifier: pendingLink.verifier, timeZone: timeZone.identifier)
        }
        guard !isOpened else {
            discardPendingLink()
            return
        }
        if signInError == .identityRejected { signInError = .linkRejected }
        if isExpired(pendingLink) { discardPendingLink() }
    }

    public var canRedeemAgain: Bool {
        false
    }

    public func useDifferentEmail() {}

    public func discardPendingLink() {
        pendingLink = nil
        try? pendingLinks.erase()
    }

    func restorePendingLink() {
        guard let stored = try? pendingLinks.read() else { return }
        guard !isExpired(stored) else {
            discardPendingLink()
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
        guard let pendingLink, pendingLink.email == email else { return makeLinkVerifier() }
        guard now() < pendingLink.expiresAt.addingTimeInterval(-SignInLinkTiming.margin) else { return makeLinkVerifier() }
        return pendingLink.verifier
    }

    private func keep(_ link: PendingSignInLink) {
        pendingLink = link
        try? pendingLinks.write(link)
    }

    private func isExpired(_ link: PendingSignInLink) -> Bool {
        now() >= link.expiresAt
    }
}
