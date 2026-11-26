import Foundation

public struct WorkspaceShortcutsPreference {
    public static let isGlobalOnStorageKey = "switchesWorkspacesFromAnyApp"
    public static let bindingsStorageKey = "workspaceChords"
    public static let isGlobalOnByDefault = true

    private let domain: PersistentDomain

    public init(defaults: UserDefaults, domainName: String) {
        domain = PersistentDomain(defaults: defaults, name: domainName)
    }

    public static func registerDefaults(in defaults: UserDefaults) {
        defaults.register(defaults: [isGlobalOnStorageKey: isGlobalOnByDefault])
    }

    public var isGlobalOn: Bool {
        false
    }

    public var bindings: WorkspaceBindings {
        WorkspaceBindings()
    }

    public func store(_ bindings: WorkspaceBindings) {}
}
