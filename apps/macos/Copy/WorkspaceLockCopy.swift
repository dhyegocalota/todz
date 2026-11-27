import TodzKit

enum WorkspaceLockCopy {
    static var confirmationFailed: String { Localized.text("Couldn't confirm it's you. Nothing changed.") }
    static var lockNow: String { Localized.text("Lock Now") }
    static var switchWorkspace: String { Localized.text("Switch Workspace…") }
    static var reasonSwitch: String { Localized.text("Switch workspaces") }
    static var reasonCreate: String { Localized.text("Create a workspace") }
    static var reasonRemove: String { Localized.text("Delete a workspace") }
    static var reasonTurnOff: String { Localized.text("Change this setting") }
    static var reasonTimeout: String { Localized.text("Change this setting") }

    static func reason(for action: WorkspaceLockAction) -> String {
        switch action {
        case .switchWorkspaces: reasonSwitch
        case .createWorkspace: reasonCreate
        case .removeWorkspace: reasonRemove
        case .turnOff: reasonTurnOff
        case .changeTimeout: reasonTimeout
        }
    }
}
