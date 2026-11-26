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
        guard let stored = domain.value(forKey: Self.isGlobalOnStorageKey) else { return Self.isGlobalOnByDefault }
        return stored as? Bool == true
    }

    public var bindings: WorkspaceBindings {
        guard let data = domain.value(forKey: Self.bindingsStorageKey) as? Data else { return WorkspaceBindings() }
        guard let stored = try? JSONDecoder().decode([String: KeyChord].self, from: data) else { return WorkspaceBindings() }
        return WorkspaceBindings(overrides: Dictionary(uniqueKeysWithValues: stored.compactMap(Self.entry)))
    }

    public func store(_ bindings: WorkspaceBindings) {
        let named = Dictionary(uniqueKeysWithValues: bindings.overrides.map { ($0.key.storageName, $0.value) })
        guard let data = try? JSONEncoder().encode(named) else { return }
        domain.set(data, forKey: Self.bindingsStorageKey)
    }

    private static func entry(name: String, chord: KeyChord) -> (WorkspaceAction, KeyChord)? {
        guard let action = WorkspaceAction(storageName: name) else { return nil }
        return (action, chord)
    }
}
