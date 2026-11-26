import TodzKit

enum WorkspaceShortcutsCopy {
    static let header = "Workspace shortcuts"
    static let fromAnyApp = "Switch from any app"
    static let inUse = "In use by another app"
    static let failed = "todz could not register this shortcut."
    static let chordsMenu = "Switch With Control"
    static let previous = "Previous Workspace"
    static let next = "Next Workspace"
    static let record = "Record"
    static let cancel = "Cancel"
    static let recording = "Press the new keys"
    static let recordingHint = "Press the new shortcut, or Esc to keep the old one."
    static let missionControl = "⌃1–⌃9 can clash with Mission Control's Switch to Desktop keys. If both are on, the system wins."
    static let needsTwoModifiers = "Hold two of ⌃, ⌥ or ⌘ with the key."
    static let inAppChord = "That is a workspace key inside todz."
    static let notGlobal = "Only the numbered workspaces have a global shortcut."
    static let taken = "Another workspace shortcut already uses those keys."

    static func fromAnyAppDetail(modifiers: String, numbers: ClosedRange<Int>) -> String {
        "Works while another app is in front, on \(modifiers)\(numbers.lowerBound)–\(numbers.upperBound). todz can't see other apps' shortcuts; \(modifiers) avoids the common ones. Turn it off to leave these keys to other apps."
    }

    static func unavailable(_ availability: GlobalChordAvailability) -> String? {
        switch availability {
        case .available: nil
        case .inUse: inUse
        case .failed: failed
        }
    }

    static func refusal(_ refusal: RebindRefusal) -> String {
        switch refusal {
        case .needsTwoModifiers: needsTwoModifiers
        case .inAppChord: inAppChord
        case .notGlobal: notGlobal
        case .taken: taken
        }
    }
}
