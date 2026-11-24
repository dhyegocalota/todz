import TodzKit

private let inboxSymbol = "tray"
private let todaySymbol = "star"
private let upcomingSymbol = "calendar"
private let doneSymbol = "checkmark.circle"
private let projectSymbol = "list.bullet"
private let connectAgentSymbol = "powerplug"

extension SidebarItem {
    static let views: [SidebarItem] = [.inbox, .today, .upcoming, .done]

    var symbol: String {
        switch self {
        case .inbox: inboxSymbol
        case .today: todaySymbol
        case .upcoming: upcomingSymbol
        case .done: doneSymbol
        case .project: projectSymbol
        case .connectAgent: connectAgentSymbol
        }
    }

    var emptyTitle: String {
        switch self {
        case .inbox: MainWindowCopy.inboxEmptyTitle
        case .today: MainWindowCopy.todayEmptyTitle
        case .upcoming: MainWindowCopy.upcomingEmptyTitle
        case .done: MainWindowCopy.doneEmptyTitle
        case .project: MainWindowCopy.projectEmptyTitle
        case .connectAgent: KeyScreenCopy.title
        }
    }

    var emptyBody: String {
        switch self {
        case .inbox: MainWindowCopy.inboxEmptyBody
        case .today: MainWindowCopy.todayEmptyBody
        case .upcoming: MainWindowCopy.upcomingEmptyBody
        case .done: MainWindowCopy.doneEmptyBody
        case .project: MainWindowCopy.projectEmptyBody
        case .connectAgent: KeyScreenCopy.intro
        }
    }

    var isCrossProject: Bool {
        switch self {
        case .today, .upcoming, .done: true
        case .inbox, .project, .connectAgent: false
        }
    }

    var hasManualOrder: Bool {
        !isCrossProject
    }

    func title(in workspace: Workspace) -> String? {
        switch self {
        case .inbox: MainWindowCopy.inbox
        case .today: MainWindowCopy.today
        case .upcoming: MainWindowCopy.upcoming
        case .done: MainWindowCopy.done
        case let .project(identifier): workspace.projects.first { $0.identifier == identifier }?.name
        case .connectAgent: nil
        }
    }
}
