import Foundation

public struct ServerPreference {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    public var hasUnreadableValue: Bool {
        preconditionFailure("ServerPreference.hasUnreadableValue is not implemented")
    }

    public func storedAddress() -> ServerAddress? {
        preconditionFailure("ServerPreference.storedAddress is not implemented")
    }

    public func store(_ address: ServerAddress) {
        preconditionFailure("ServerPreference.store is not implemented")
    }

    public func clear() {
        preconditionFailure("ServerPreference.clear is not implemented")
    }
}
