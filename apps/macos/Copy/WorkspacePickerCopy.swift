import TodzKit

enum WorkspacePickerCopy {
    static var title: String { Localized.text("Choose a workspace") }
    static var body: String { Localized.text("Pick the workspace to open on this Mac. You can switch later from the Workspace menu.") }
    static var activeJustNow: String { Localized.text("Active just now") }
    static var activeYesterday: String { Localized.text("Active yesterday") }

    static func projectCount(count: Int) -> String {
        Localized.text("\(count) projects")
    }

    static func activity(recency: ActivityRecency) -> String {
        switch recency {
        case .justNow: activeJustNow
        case let .minutes(count): Localized.text("Active \(count) minutes ago")
        case let .hours(count): Localized.text("Active \(count) hours ago")
        case .yesterday: activeYesterday
        case let .days(count): Localized.text("Active \(count) days ago")
        }
    }
}
