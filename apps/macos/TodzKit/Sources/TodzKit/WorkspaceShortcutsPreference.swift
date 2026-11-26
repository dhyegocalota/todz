import Foundation

public struct WorkspaceShortcutsPreference {
    public static let isGlobalOnStorageKey = "switchesWorkspacesFromAnyApp"
    public static let bindingsStorageKey = "workspaceChords"
    public static let isGlobalOnByDefault = false

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

    public var globalChords: GlobalWorkspaceChords {
        guard let data = domain.value(forKey: Self.bindingsStorageKey) as? Data else { return GlobalWorkspaceChords() }
        guard let stored = try? JSONDecoder().decode([String: KeyChord].self, from: data) else { return GlobalWorkspaceChords() }
        return stored.sorted { $0.key < $1.key }.reduce(GlobalWorkspaceChords()) { chords, entry in
            Self.applying(entry, to: chords)
        }
    }

    public func store(_ chords: GlobalWorkspaceChords) {
        let named = Dictionary(uniqueKeysWithValues: chords.overrides.map { ($0.key.storageName, $0.value) })
        guard let data = try? JSONEncoder().encode(named) else { return }
        domain.set(data, forKey: Self.bindingsStorageKey)
    }

    private static func applying(_ entry: (key: String, value: KeyChord), to chords: GlobalWorkspaceChords) -> GlobalWorkspaceChords {
        guard let action = WorkspaceAction(storageName: entry.key) else { return chords }
        switch chords.rebinding(action, to: entry.value) {
        case let .success(rebound): return rebound
        case .failure: return chords
        }
    }
}
