import TodzKit

enum WorkspaceShortcutsCopy {
    static let header = "Workspace shortcuts"
    static let fromAnyApp = "Switch from any app"
    static let fromAnyAppDetail = "Works while another app is in front. Turn it off to leave these keys to other apps."
    static let chordsMenu = "Switch With Control"
    static let previous = "Previous Workspace"
    static let next = "Next Workspace"
    static let record = "Record"
    static let cancel = "Cancel"
    static let recording = "Press the new keys"
    static let missionControl = "⌃1–⌃9 can clash with Mission Control's Switch to Desktop keys. If both are on, the system wins."
    static let needsModifier = "Hold ⌃, ⌥ or ⌘ with the key."
    static let taken = "Another workspace shortcut already uses those keys."

    static func refusal(_ refusal: RebindRefusal) -> String {
        switch refusal {
        case .needsModifier: needsModifier
        case .taken: taken
        }
    }
}
