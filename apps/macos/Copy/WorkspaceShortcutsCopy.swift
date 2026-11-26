import TodzKit

enum WorkspaceShortcutsCopy {
    static let header = "Workspace shortcuts"
    static let fromAnyApp = "Switch from any app"
    static let fromAnyAppDetail = "Works while another app is in front, on ⌃⌥⌘1–9. Turn it off to leave these keys to other apps."
    static let inUse = "In use by another app"
    static let chordsMenu = "Switch With Control"
    static let previous = "Previous Workspace"
    static let next = "Next Workspace"
    static let record = "Record"
    static let cancel = "Cancel"
    static let recording = "Press the new keys"
    static let needsTwoModifiers = "Hold two of ⌃, ⌥ or ⌘ with the key."
    static let inAppChord = "That is a workspace key inside todz."
    static let notGlobal = "Only the numbered workspaces have a global shortcut."
    static let taken = "Another workspace shortcut already uses those keys."

    static func refusal(_ refusal: RebindRefusal) -> String {
        switch refusal {
        case .needsTwoModifiers: needsTwoModifiers
        case .inAppChord: inAppChord
        case .notGlobal: notGlobal
        case .taken: taken
        }
    }
}
