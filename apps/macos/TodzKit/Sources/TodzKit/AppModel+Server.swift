extension AppModel {
    static func addressInUse(preference: ServerPreference, defaultURL: ServerAddress) -> ServerAddress {
        guard let stored = preference.storedAddress() else { return defaultURL }
        return stored
    }

    public func probeServer(_ address: ServerAddress) async -> ServerProbeOutcome {
        await probe(address)
    }

    @discardableResult
    public func switchServer(to address: ServerAddress) async -> Bool {
        fatalError("AppModel.switchServer is not implemented")
    }
}
