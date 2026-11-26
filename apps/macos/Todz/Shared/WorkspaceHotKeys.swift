import Carbon.HIToolbox
import TodzKit

private let hotKeySignature: OSType = 0x545A_444B

private extension ChordModifiers {
    private static let carbonPairs: [(modifier: ChordModifiers, flag: Int)] = [
        (.control, controlKey), (.option, optionKey), (.shift, shiftKey), (.command, cmdKey),
    ]

    var carbonFlags: UInt32 {
        UInt32(Self.carbonPairs.filter { contains($0.modifier) }.reduce(0) { $0 | $1.flag })
    }
}

private func hotKeyPressed(_: EventHandlerCallRef?, event: EventRef?, userData: UnsafeMutableRawPointer?) -> OSStatus {
    guard let event, let userData else { return OSStatus(eventNotHandledErr) }
    var hotKeyIdentifier = EventHotKeyID()
    let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyIdentifier
    )
    guard status == noErr else { return status }
    let pressedIdentifier = hotKeyIdentifier.id
    let hotKeys = Unmanaged<WorkspaceHotKeys>.fromOpaque(userData).takeUnretainedValue()
    Task { @MainActor in hotKeys.press(identifier: pressedIdentifier) }
    return noErr
}

// NB ADR 0079: global chords go through Carbon RegisterEventHotKey, which needs no Accessibility permission.
@MainActor final class WorkspaceHotKeys {
    private let onAction: (WorkspaceAction) -> Void
    private var registrations: [EventHotKeyRef] = []
    private var handler: EventHandlerRef?

    init(onAction: @escaping (WorkspaceAction) -> Void) {
        self.onAction = onAction
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), hotKeyPressed, 1, &eventType, Unmanaged.passUnretained(self).toOpaque(), &handler)
    }

    func register(_ bindings: WorkspaceBindings) {
        unregister()
        registrations = WorkspaceAction.all.enumerated().compactMap { offset, action in
            guard let chord = bindings.chord(for: action) else { return nil }
            return registration(identifier: offset + 1, chord: chord)
        }
    }

    func unregister() {
        registrations.forEach { UnregisterEventHotKey($0) }
        registrations = []
    }

    func press(identifier: UInt32) {
        let position = Int(identifier) - 1
        guard WorkspaceAction.all.indices.contains(position) else { return }
        onAction(WorkspaceAction.all[position])
    }

    private func registration(identifier: Int, chord: KeyChord) -> EventHotKeyRef? {
        var reference: EventHotKeyRef?
        let hotKeyIdentifier = EventHotKeyID(signature: hotKeySignature, id: UInt32(identifier))
        let status = RegisterEventHotKey(UInt32(chord.keyCode), chord.modifiers.carbonFlags, hotKeyIdentifier, GetApplicationEventTarget(), 0, &reference)
        guard status == noErr else { return nil }
        return reference
    }
}
