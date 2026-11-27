import TodzKit

enum WorkspaceLockCopy {
    static let confirmationFailed = "Couldn't confirm it's you. Nothing changed."
    static let lockNow = "Lock Now"
    static let switchWorkspace = "Switch Workspace…"
    static let reasonSwitch = "switch workspaces"
    static let reasonCreate = "create a workspace"
    static let reasonRemove = "delete a workspace"
    static let reasonTurnOff = "change this setting"
    static let reasonTimeout = "change this setting"

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
