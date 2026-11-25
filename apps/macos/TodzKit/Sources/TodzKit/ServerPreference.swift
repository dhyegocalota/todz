import Foundation

private let storedKey = "serverURL"

public struct ServerPreference {
    private let defaults: UserDefaults
    private let domainName: String

    public init(defaults: UserDefaults, domainName: String) {
        self.defaults = defaults
        self.domainName = domainName
    }

    public var hasUnreadableValue: Bool {
        defaults.object(forKey: storedKey) != nil && storedAddress() == nil
    }

    public func storedAddress() -> ServerAddress? {
        guard let text = defaults.string(forKey: storedKey) else { return nil }
        return try? ServerAddress.checked(text: text).get()
    }

    public func store(_ address: ServerAddress) {
        defaults.set(address.origin, forKey: storedKey)
    }

    public func clear() {
        defaults.removeObject(forKey: storedKey)
    }
}
