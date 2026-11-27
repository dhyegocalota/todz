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
