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
            connectedApps = .failed(KeyFailure(error))
        }
    }

    // NB ADR 0113: a locked session lists no grant that names a project of a locked workspace.
    public var visibleConnectedApps: [ConnectedApp] {
        guard case let .loaded(apps) = connectedApps else { return [] }
        return apps.filter { app in
            guard case let .project(projectIdentifier, _) = app.scope else { return true }
            return !isInLockedWorkspace(projectIdentifier: projectIdentifier)
        }
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
