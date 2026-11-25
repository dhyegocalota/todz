extension AppModel {
    public var isUpdateNeeded: Bool {
        guard case .updateNeeded = compatibility else { return false }
        return true
    }

    public func refreshCompatibility() {
        compatibilityRefresh?.cancel()
        let askedServer = serverURL
        let askedService = service
        compatibilityRefresh = Task { await readVersions(of: askedService, at: askedServer) }
    }

    func recordRefusal(of failure: any Error) {
        guard let refusal = failure as? OwnerAPIError, case let .appTooOld(minimum) = refusal else { return }
        refusedMinimum = minimum
        recompute()
    }

    func forgetVersions() {
        serverVersions = nil
        refusedMinimum = nil
        compatibility = .serverUnknown(app: appVersion)
    }

    private func readVersions(of askedService: any OwnerService, at askedServer: ServerAddress) async {
        let answer = try? await askedService.health()
        guard !Task.isCancelled, serverURL == askedServer else { return }
        guard case let .todz(_, versions) = answer else {
            serverVersions = nil
            recompute()
            return
        }
        serverVersions = versions
        refusedMinimum = nil
        recompute()
    }

    private func recompute() {
        let wasUpdateNeeded = isUpdateNeeded
        compatibility = .of(app: appVersion, server: serverVersions, refusal: refusedMinimum)
        let isSignedInAndNeedsUpdate = isUpdateNeeded && session != nil
        if isSignedInAndNeedsUpdate { raise(.updateNeeded) }
        let isUpdated = wasUpdateNeeded && !isUpdateNeeded
        if isUpdated { resumeAfterUpdateNeeded() }
    }

    private func resumeAfterUpdateNeeded() {
        if banner == .updateNeeded { dismissBanner() }
        startSending()
    }
}
