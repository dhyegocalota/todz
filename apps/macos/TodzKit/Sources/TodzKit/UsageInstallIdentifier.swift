import Foundation

private let secondsPerDay: TimeInterval = 24 * 60 * 60

public struct UsageInstallIdentifier {
    public static let identifierStorageKey = "usageInstallIdentifier"
    public static let issuedAtStorageKey = "usageInstallIdentifierIssuedAt"
    public static let rotationDays = 30

    private let domain: PersistentDomain
    private let makeIdentifier: () -> String

    public init(defaults: UserDefaults, domainName: String, makeIdentifier: @escaping () -> String = { UUID().uuidString.lowercased() }) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
        self.makeIdentifier = makeIdentifier
    }

    public func current(at now: Date) -> String {
        let rotationInterval = TimeInterval(Self.rotationDays) * secondsPerDay
        if let stored = domain.value(forKey: Self.identifierStorageKey) as? String,
           let issuedAt = domain.value(forKey: Self.issuedAtStorageKey) as? Double,
           now.timeIntervalSince1970 - issuedAt < rotationInterval {
            return stored
        }
        let issued = makeIdentifier()
        domain.set(issued, forKey: Self.identifierStorageKey)
        domain.set(now.timeIntervalSince1970, forKey: Self.issuedAtStorageKey)
        return issued
    }
}
