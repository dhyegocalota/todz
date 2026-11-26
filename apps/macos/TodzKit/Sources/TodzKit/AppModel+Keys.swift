import Foundation

extension AppModel {
    public func showKeys(projectIdentifier: String) {
        let isOnKeyScreen = selectedItem == .connectAgent
        guard isOnKeyScreen, isShown(projectIdentifier: projectIdentifier) else { return }
        forgetKeys()
        keyProjectIdentifier = projectIdentifier
        keyScreenIdentifier = UUID()
        keyLoading = Task { await loadKeys() }
    }

    public func loadKeys() async {
        guard let projectIdentifier = keyProjectIdentifier, let visit = keyScreenIdentifier else { return }
        let isListShown = keys?.isLoaded == true
        let issueAnswersAtStart = keyIssueAnswerCount
        if !isListShown { keys = .loading }
        do {
            let listed = try await request { try await service.listKeys(session: $0, projectIdentifier: projectIdentifier) }
            guard keyScreenIdentifier == visit else { return }
            let isIssueNewerThanList = keyIssueAnswerCount != issueAnswersAtStart
            let withIssuedKey = including(key: isIssueNewerThanList ? issuedKey?.key : nil, in: listed)
            keys = .loaded(withIssuedKey.filter { !revokedKeyIdentifiers.contains($0.identifier) })
            keyReloadFailure = nil
        } catch {
            guard keyScreenIdentifier == visit else { return }
            guard !isGone(projectIdentifier: projectIdentifier, after: error) else {
                showInboxKeys()
                return
            }
            guard isListShown else {
                keys = .failed(KeyFailure(error))
                return
            }
            keyReloadFailure = KeyFailure(error)
        }
    }

    public func issueKey() async {
        guard !isIssuing, let projectIdentifier = keyProjectIdentifier, let visit = keyScreenIdentifier else { return }
        isIssuing = true
        issuedKey = nil
        issueFailure = nil
        do {
            let issued = try await request { try await service.issueKey(session: $0, projectIdentifier: projectIdentifier) }
            guard keyScreenIdentifier == visit else { return }
            isIssuing = false
            issuedKey = issued
            keyIssueAnswerCount += 1
            await list(issued.key)
        } catch {
            guard keyScreenIdentifier == visit else { return }
            isIssuing = false
            guard !isGone(projectIdentifier: projectIdentifier, after: error) else {
                showInboxKeys()
                return
            }
            issueFailure = KeyFailure(error)
            await loadKeys()
        }
    }

    public func revokeKey(_ key: ProjectKey) async {
        let isRevoking = revokingKeyIdentifiers.contains(key.identifier)
        guard !isRevoking, let projectIdentifier = keyProjectIdentifier, let visit = keyScreenIdentifier else { return }
        revokingKeyIdentifiers.insert(key.identifier)
        failedRevokeIdentifiers.remove(key.identifier)
        let isGoneFromServer = await isRevoked(keyIdentifier: key.identifier, projectIdentifier: projectIdentifier)
        guard keyProjectIdentifier == projectIdentifier else { return }
        let isSameVisit = keyScreenIdentifier == visit
        if isSameVisit { revokingKeyIdentifiers.remove(key.identifier) }
        guard isGoneFromServer else {
            if isSameVisit { failedRevokeIdentifiers.insert(key.identifier) }
            return
        }
        forget(key)
    }

    public func hideKey() {
        issuedKey = nil
    }

    public func leaveKeyScreen() {
        keyScreenIdentifier = nil
        isIssuing = false
        issuedKey = nil
    }

    public func reopenKeyScreen() {
        guard keyScreenIdentifier == nil else { return }
        guard let projectIdentifier = keyProjectIdentifier, isShown(projectIdentifier: projectIdentifier) else {
            showInboxKeys()
            return
        }
        showKeys(projectIdentifier: projectIdentifier)
    }

    public func forgetKeys() {
        keyScreenIdentifier = nil
        keyLoading = nil
        keyProjectIdentifier = nil
        keys = nil
        issuedKey = nil
        isIssuing = false
        issueFailure = nil
        keyReloadFailure = nil
        revokingKeyIdentifiers = []
        failedRevokeIdentifiers = []
        revokedKeyIdentifiers = []
    }

    func followKeyScreen(from oldItem: SidebarItem) {
        let isEntering = selectedItem == .connectAgent && oldItem != .connectAgent
        let isLeaving = oldItem == .connectAgent && selectedItem != .connectAgent
        if isLeaving { forgetKeys() }
        guard isEntering else { return }
        selectedTask = nil
        guard case let .project(identifier) = oldItem else {
            showInboxKeys()
            return
        }
        showKeys(projectIdentifier: identifier)
    }

    func showInboxKeys() {
        guard let inbox = activeWorkspace?.projects.first(where: \.isInbox) else { return }
        showKeys(projectIdentifier: inbox.identifier)
    }

    private func isGone(projectIdentifier: String, after error: any Error) -> Bool {
        let isInbox = activeWorkspace?.projects.first(where: \.isInbox)?.identifier == projectIdentifier
        let isNotFound = (error as? OwnerAPIError) == .notFound
        return isNotFound && !isInbox
    }

    private func isRevoked(keyIdentifier: String, projectIdentifier: String) async -> Bool {
        do {
            try await request { try await service.revokeKey(session: $0, projectIdentifier: projectIdentifier, keyIdentifier: keyIdentifier) }
            return true
        } catch OwnerAPIError.notFound {
            return true
        } catch {
            return false
        }
    }

    private func list(_ key: ProjectKey) async {
        guard case let .loaded(listed) = keys else {
            await loadKeys()
            return
        }
        keys = .loaded(including(key: key, in: listed))
    }

    private func including(key: ProjectKey?, in listed: [ProjectKey]) -> [ProjectKey] {
        guard let key else { return listed }
        let isListed = listed.contains { $0.identifier == key.identifier }
        guard !isListed else { return listed }
        return listed + [key]
    }

    private func forget(_ key: ProjectKey) {
        revokedKeyIdentifiers.insert(key.identifier)
        let isShownSecret = issuedKey?.key.identifier == key.identifier
        if isShownSecret { issuedKey = nil }
        guard case let .loaded(listed) = keys else { return }
        keys = .loaded(listed.filter { $0.identifier != key.identifier })
    }
}
