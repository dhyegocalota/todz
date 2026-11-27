extension AppModel {
    public func loadConnectedApps() async {
        _ = try? await request { try await service.listConnectedApps(session: $0) }
    }

    public func disconnectConnectedApp(_ app: ConnectedApp) async {}

    public func forgetConnectedApps() {}
}
