import Foundation

extension AppModel {
    public func loadSignInMethod() async {
        signInMethodError = nil
        let askedServer = serverURL
        do {
            let method = try await service.signInMethod()
            guard serverURL == askedServer else { return }
            signInMethod = method
        } catch let failure as OwnerAPIError {
            guard serverURL == askedServer else { return }
            recordRefusal(of: failure)
            signInMethodError = SignInError(failure)
        } catch {
            guard serverURL == askedServer else { return }
            signInMethodError = .unexpected
        }
    }

    public func acceptChallenge(token: String) {
        signInChallengeToken = ChallengeToken.isWellFormed(token) ? token : nil
    }

    public func requestSignInLink(email: String) async {
        await requestSignInLink(email: email, verifier: verifierToSend(to: email))
    }

    private func requestSignInLink(email: String, verifier: String) async {
        guard let turnstileToken = signInChallengeToken else { return }
        signInChallengeToken = nil
        signInError = nil
        heldSignInLink = nil
        isRequestingLink = true
        defer {
            isRequestingLink = false
            challengeRound += 1
        }
        let askedServer = serverURL
        do {
            try await service.requestSignInLink(email: email, challenge: SignInLinkChallenge.challenge(for: verifier), turnstileToken: turnstileToken, linkScheme: linkScheme)
        } catch let failure as OwnerAPIError {
            guard serverURL == askedServer else { return }
            recordRefusal(of: failure)
            signInError = SignInError(asking: failure)
            return
        } catch {
            guard serverURL == askedServer else { return }
            signInError = .unexpected
            return
        }
        guard serverURL == askedServer else { return }
        keep(PendingSignInLink(email: email, verifier: verifier, expiresAt: now().addingTimeInterval(SignInLinkTiming.keepDuration)))
    }

    public func signIn(code: String) async {
        guard let pendingLink, let turnstileToken = signInChallengeToken, !isSigningIn else { return }
        signInChallengeToken = nil
        isSubmittingCode = true
        defer {
            isSubmittingCode = false
            challengeRound += 1
        }
        let timeZoneIdentifier = timeZone.identifier
        let isOpened = await openSession {
            try await service.signIn(email: pendingLink.email, emailCode: code, linkVerifier: pendingLink.verifier, turnstileToken: turnstileToken, timeZone: timeZoneIdentifier)
        }
        guard !isOpened, signInError == .identityRejected else { return }
        signInError = .codeRejected
        codeFailureCount += 1
    }

    public func resendCode() async {
        guard let pendingLink else { return }
        await requestSignInLink(email: pendingLink.email, verifier: makeLinkVerifier())
    }

    public func redeem(signInLink: SignInLink) async {
        guard isLaunchSettled else {
            heldSignInLink = signInLink
            return
        }
        guard case .signedOut = phase else {
            heldSignInLink = nil
            let isLineFree = phase != .loading && banner == nil
            if isLineFree { raise(.alreadySignedIn) }
            return
        }
        guard !isSigningIn else { return }
        heldSignInLink = nil
        guard signInLink.origin == serverURL.origin else {
            signInError = .linkNotRequested
            return
        }
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
        if signInError == .signInRefused { signInError = .linkRefused }
        if isExpired(pendingLink) { discardPendingLink() }
        let isRetryable = signInError == .unreachable && self.pendingLink != nil
        guard isRetryable else { return }
        heldSignInLink = signInLink
    }

    public var canRedeemAgain: Bool {
        heldSignInLink != nil
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
