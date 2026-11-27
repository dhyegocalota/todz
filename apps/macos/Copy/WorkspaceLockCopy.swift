import TodzKit

enum WorkspaceLockCopy {
    static let lockedWorkspace = "Locked workspace"
    static let lockedRowHint = "Opens after you confirm it's you."
    static let confirmationFailed = "Couldn't confirm it's you. Nothing changed."
    static let lockNow = "Lock Now"
    static let lockedHelp = "Other workspaces are locked."
    static let lockedState = "Other workspaces locked"
    static let unlockedState = "Other workspaces unlocked"
    static let unlockRefusal = "Unlock todz to use that workspace."
    static let reasonSwitch = "open another workspace"
    static let reasonCreate = "create a workspace"
    static let reasonRemove = "delete a workspace"
    static let reasonTurnOff = "turn off the workspace lock"
    static let reasonTimeout = "change when workspaces lock again"

    static func unlockedHelp(timeout: WorkspaceLockTimeout) -> String {
        "Other workspaces are unlocked. They lock again after \(SettingsCopy.lockTimeoutName(timeout)) without use."
    }

    static func reason(for action: WorkspaceLockAction) -> String {
        switch action {
        case .showWorkspaces: reasonSwitch
        case .createWorkspace: reasonCreate
        case .removeWorkspace: reasonRemove
        case .turnOff: reasonTurnOff
        case .changeTimeout: reasonTimeout
        }
    }
}
