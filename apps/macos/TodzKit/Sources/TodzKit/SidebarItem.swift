public enum SidebarItem: Hashable, Sendable {
    case inbox
    case today
    case upcoming
    case done
    case project(identifier: String)
}
