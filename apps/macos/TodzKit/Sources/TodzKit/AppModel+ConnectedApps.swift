import Foundation

extension AppModel {
    public func loadConnectedApps() async {
        let visit = connectedAppVisit
        let isListShown = connectedApps?.isLoaded == true
        if !isListShown { connectedApps = .loading }
        do {
            let apps = try await request { try await service.listConnectedApps(session: $0) }
            guard connectedAppVisit == visit else { return }
            connectedApps = .loaded(apps.sorted { $0.createdAt > $1.createdAt })
        } catch {
            guard connectedAppVisit == visit, !isListShown else { return }
            connectedApps = .failed(ConnectedAppListFailure(error))
        }
    }

    // NB ADR 0113: a locked session lists only the grants that cover a visible workspace or the account, and names only visible workspaces.
    public var visibleConnectedApps: [ConnectedApp] {
        guard case let .loaded(apps) = connectedApps else { return [] }
        guard workspaceLock.isLocked else { return apps }
        let visibleWorkspaceIdentifiers = Set(visibleWorkspaces.map(\.identifier))
        return apps.compactMap { app in
            let visibleScopes = app.scopes.filter { scope in
                guard let workspaceIdentifier = scope.workspaceIdentifier else { return true }
                return visibleWorkspaceIdentifiers.contains(workspaceIdentifier)
            }
            guard !visibleScopes.isEmpty else { return nil }
            return ConnectedApp(identifier: app.identifier, clientName: app.clientName, redirectHost: app.redirectHost, scopes: visibleScopes, createdAt: app.createdAt, lastUsedAt: app.lastUsedAt)
        }
    }

    public var canNarrowConnectedApps: Bool {
        !workspaceLock.isLocked
    }

    public func narrowConnectedApp(_ app: ConnectedApp, to scopes: [ConnectedScope]) async {
        guard canNarrowConnectedApps, !isChangingConnectedApps, !scopes.isEmpty else { return }
        isChangingConnectedApps = true
        defer { isChangingConnectedApps = false }
        connectedAppFailure = nil
        do {
            _ = try await request { try await service.narrowConnectedApp(session: $0, connectedAppIdentifier: app.identifier, scopes: scopes) }
        } catch {
            connectedAppFailure = .notNarrowed
            return
        }
        await loadConnectedApps()
    }

    public func disconnectConnectedApp(_ app: ConnectedApp) async {
        guard !isChangingConnectedApps else { return }
        isChangingConnectedApps = true
        defer { isChangingConnectedApps = false }
        connectedAppFailure = nil
        do {
            try await request { try await service.disconnectConnectedApp(session: $0, connectedAppIdentifier: app.identifier) }
        } catch OwnerAPIError.notFound {
        } catch {
            connectedAppFailure = .notDisconnected
            return
        }
        await loadConnectedApps()
    }

    public func forgetConnectedApps() {
        connectedAppVisit = UUID()
        connectedApps = nil
        connectedAppFailure = nil
    }
}
