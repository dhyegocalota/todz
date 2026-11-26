extension AppModel {
    func write<Value>(
        target: WriteTarget,
        retry: @escaping @MainActor () async -> Void,
        operation: (String) async throws -> Value
    ) async -> Value? {
        guard !writesInFlight.contains(target) else { return nil }
        writesInFlight.insert(target)
        defer { writesInFlight.remove(target) }
        ruleIssues[target] = nil
        let workspaceIdentifier = activeWorkspaceIdentifier
        do {
            let value = try await request(operation)
            guard isAnswerable(target: target, sentIn: workspaceIdentifier) else { return nil }
            return value
        } catch {
            guard isRecoverable(target: target, sentIn: workspaceIdentifier) else { return nil }
            await recover(from: error, target: target, retry: retry)
            return nil
        }
    }

    private func isAnswerable(target: WriteTarget, sentIn workspaceIdentifier: String?) -> Bool {
        let isSameWorkspace = activeWorkspaceIdentifier == workspaceIdentifier
        return isSameWorkspace || target.keepsItsAnswerAcrossASwitch
    }

    private func isRecoverable(target: WriteTarget, sentIn workspaceIdentifier: String?) -> Bool {
        let isSameWorkspace = activeWorkspaceIdentifier == workspaceIdentifier
        return isSameWorkspace || !target.belongsToTheActiveWorkspace
    }

    func raiseLoadFailure(_ error: any Error, retry: @escaping @MainActor () async -> Void) {
        guard !(error is CancellationError) else { return }
        guard !(error is SyncStoreError) else {
            raise(.cacheNotSaved, retry: retry)
            return
        }
        guard let failure = error as? OwnerAPIError else {
            raise(.server, retry: retry)
            return
        }
        switch failure {
        case .unauthorized, .appTooOld:
            return
        case .unreachable:
            raise(.network, retry: retry)
        case .identityRejected, .signInUnavailable, .signInRefused, .notFound, .taskNotFound, .inboxIsFixed, .cursorAhead,
            .ruleViolated, .timeZoneInvalid, .invalidRequest, .fairUseRefused, .fairUsePaused, .limitReached, .unexpected:
            raise(.server, retry: retry)
        }
    }

    private func recover(from error: any Error, target: WriteTarget, retry: @escaping @MainActor () async -> Void) async {
        guard !(error is CancellationError) else { return }
        guard let failure = error as? OwnerAPIError else {
            raise(.changeNotSaved)
            return
        }
        switch failure {
        case .unauthorized, .appTooOld:
            return
        case let .ruleViolated(issue, _):
            ruleIssues[target] = issue
        case .notFound:
            await reload(raising: target.goneBanner)
        case .taskNotFound:
            await reload(raising: .taskGone)
        case .unreachable:
            raise(.network, retry: retry, retryTarget: target)
        case .inboxIsFixed:
            raise(.inboxIsFixed)
        case let .fairUseRefused(message), let .fairUsePaused(message):
            raise(.fairUseRefused(message: message))
        case .identityRejected, .signInUnavailable, .signInRefused, .cursorAhead, .timeZoneInvalid, .invalidRequest, .limitReached, .unexpected:
            raise(.changeNotSaved)
        }
    }

    private func reload(raising banner: AppBanner) async {
        dismissBanner()
        await loadWorkspaces()
        let isReloadedQuietly = session != nil && self.banner == nil
        guard isReloadedQuietly else { return }
        raise(banner)
    }
}
