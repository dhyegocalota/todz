import AppKit
import SwiftUI
import TodzKit

extension ChordModifiers {
    private static let flagPairs: [(modifier: ChordModifiers, flag: NSEvent.ModifierFlags, event: SwiftUI.EventModifiers)] = [
        (.control, .control, .control),
        (.option, .option, .option),
        (.shift, .shift, .shift),
        (.command, .command, .command),
    ]

    init(flags: NSEvent.ModifierFlags) {
        self = Self.flagPairs.filter { flags.contains($0.flag) }.reduce(into: []) { $0.insert($1.modifier) }
    }

    var eventModifiers: SwiftUI.EventModifiers {
        Self.flagPairs.filter { contains($0.modifier) }.reduce(into: []) { $0.insert($1.event) }
    }
}

extension KeyChord {
    init?(event: NSEvent) {
        guard let key = event.charactersIgnoringModifiers, key.count == 1 else { return nil }
        guard key.rangeOfCharacter(from: .controlCharacters) == nil else { return nil }
        self.init(keyCode: Int(event.keyCode), key: key, modifiers: ChordModifiers(flags: event.modifierFlags))
    }

    var keyboardShortcut: KeyboardShortcut? {
        guard let character = key.first else { return nil }
        return KeyboardShortcut(KeyEquivalent(character), modifiers: modifiers.eventModifiers)
    }
}
