public enum ShortcutAddDestination: Equatable, Sendable {
    case today
    case inbox

    var sidebarItem: SidebarItem {
        switch self {
        case .today: .today
        case .inbox: .inbox
        }
    }
}
