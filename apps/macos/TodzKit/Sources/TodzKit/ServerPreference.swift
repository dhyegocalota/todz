import Foundation

private let storedKey = "serverURL"

public struct ServerPreference {
    private let defaults: UserDefaults
    private let domainName: String

    public init(defaults: UserDefaults, domainName: String) {
        self.defaults = defaults
        self.domainName = domainName
    }

    private var storedValue: Any? {
        defaults.persistentDomain(forName: domainName)?[storedKey]
    }

    public var hasUnreadableValue: Bool {
        storedValue != nil && storedAddress() == nil
    }

    public func storedAddress() -> ServerAddress? {
        guard let text = storedValue as? String else { return nil }
        return try? ServerAddress.checked(text: text).get()
    }

    public func store(_ address: ServerAddress) {
        defaults.set(address.origin, forKey: storedKey)
    }

    public func clear() {
        defaults.removeObject(forKey: storedKey)
    }
}
