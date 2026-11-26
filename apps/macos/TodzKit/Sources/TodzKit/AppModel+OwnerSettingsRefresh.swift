extension AppModel {
    public func refreshOwnerSettings() async {
        _ = try? await request { try await service.readOwner(session: $0) }
    }
}
