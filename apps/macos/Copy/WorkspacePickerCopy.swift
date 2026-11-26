import TodzKit

enum WorkspacePickerCopy {
    static let title = "Choose a workspace"
    static let body = "Pick the workspace to open on this Mac. You can switch later from the Workspace menu."
    static let activeJustNow = "Active just now"
    static let activeYesterday = "Active yesterday"

    static func projectCount(count: Int) -> String {
        InflectedCopy.text("^[\(count) project](inflect: true)")
    }

    static func activity(recency: ActivityRecency) -> String {
        switch recency {
        case .justNow: activeJustNow
        case let .minutes(count): InflectedCopy.text("Active ^[\(count) minute](inflect: true) ago")
        case let .hours(count): InflectedCopy.text("Active ^[\(count) hour](inflect: true) ago")
        case .yesterday: activeYesterday
        case let .days(count): InflectedCopy.text("Active ^[\(count) day](inflect: true) ago")
        }
    }
}
