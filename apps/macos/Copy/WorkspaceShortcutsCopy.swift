import TodzKit

enum WorkspaceShortcutsCopy {
    static var header: String { Localized.text("Workspace shortcuts") }
    static var fromAnyApp: String { Localized.text("Switch from any app") }
    static var inUse: String { Localized.text("In use by another app") }
    static var failed: String { Localized.text("todz could not register this shortcut.") }
    static var chordsMenu: String { Localized.text("Switch With Control") }
    static var previous: String { Localized.text("Previous Workspace") }
    static var next: String { Localized.text("Next Workspace") }
    static var record: String { Localized.text("Record") }
    static var cancel: String { Localized.text("Cancel") }
    static var recording: String { Localized.text("Press the new keys") }
    static var recordingHint: String { Localized.text("Press the new shortcut, or Esc to keep the old one.") }
    static var missionControl: String { Localized.text("⌃1–⌃9 can clash with Mission Control's Switch to Desktop keys. If both are on, the system wins.") }
    static var needsTwoModifiers: String { Localized.text("Hold two of ⌃, ⌥ or ⌘ with the key.") }
    static var inAppChord: String { Localized.text("That is a workspace key inside todz.") }
    static var notGlobal: String { Localized.text("Only the numbered workspaces have a global shortcut.") }
    static var taken: String { Localized.text("Another workspace shortcut already uses those keys.") }

    static func fromAnyAppDetail(modifiers: String, numbers: ClosedRange<Int>) -> String {
        Localized.text("Works while another app is in front, on \(modifiers)\(numbers.lowerBound)–\(numbers.upperBound). todz can't see other apps' shortcuts; \(modifiers) avoids the common ones. Turn it off to leave these keys to other apps.")
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
