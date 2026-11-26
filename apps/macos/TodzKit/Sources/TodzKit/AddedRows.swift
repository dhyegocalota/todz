public enum RowIdentity: Hashable, Sendable {
    case task(TaskKey)
    case attempt(String)
}

public struct ShownRows: Equatable, Sendable {
    public let item: SidebarItem
    public let identities: Set<RowIdentity>?

    public init(item: SidebarItem, identities: Set<RowIdentity>?) {
        self.item = item
        self.identities = identities
    }
}

public enum AddedRows {
    // NB ADR 0106: a row springs in only when its identity was not in the last render of the same list, so cell reuse on scroll never replays it.
    public static func added(known: ShownRows?, current: ShownRows) -> Set<RowIdentity> {
        guard let known, known.item == current.item, let knownIdentities = known.identities, let identities = current.identities else { return [] }
        return identities.subtracting(knownIdentities)
    }
}
