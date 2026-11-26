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
    guard status == noErr, hotKeyIdentifier.signature == hotKeySignature else { return status }
    let pressedIdentifier = hotKeyIdentifier.id
    let hotKeys = Unmanaged<WorkspaceHotKeys>.fromOpaque(userData).takeUnretainedValue()
    Task { @MainActor in hotKeys.press(identifier: pressedIdentifier) }
    return noErr
}

// NB ADR 0091: global chords go through Carbon RegisterEventHotKey, which needs no Accessibility permission.
@MainActor final class WorkspaceHotKeys {
    private let onAction: (WorkspaceAction) -> Void
    private var registrations: [EventHotKeyRef] = []
    private nonisolated(unsafe) var handler: EventHandlerRef?
    private var isHandling = false

    init(onAction: @escaping (WorkspaceAction) -> Void) {
        self.onAction = onAction
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        let status = InstallEventHandler(GetApplicationEventTarget(), hotKeyPressed, 1, &eventType, Unmanaged.passUnretained(self).toOpaque(), &handler)
        isHandling = status == noErr
    }

    deinit {
        guard let handler else { return }
        RemoveEventHandler(handler)
    }

    @discardableResult func register(_ chords: [WorkspaceAction: KeyChord]) -> [WorkspaceAction: GlobalChordAvailability] {
        unregister()
        guard isHandling else { return chords.mapValues { _ in GlobalChordAvailability.failed } }
        let attempts = WorkspaceAction.all.enumerated().compactMap { offset, action -> (action: WorkspaceAction, availability: GlobalChordAvailability, reference: EventHotKeyRef?)? in
            guard let chord = chords[action] else { return nil }
            let attempt = registration(identifier: offset + 1, chord: chord)
            return (action, GlobalChordAvailability.registering(status: attempt.status), attempt.reference)
        }
        registrations = attempts.filter { $0.availability == .available }.compactMap(\.reference)
        return Dictionary(uniqueKeysWithValues: attempts.map { ($0.action, $0.availability) })
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

    private func registration(identifier: Int, chord: KeyChord) -> (reference: EventHotKeyRef?, status: OSStatus) {
        var reference: EventHotKeyRef?
        let hotKeyIdentifier = EventHotKeyID(signature: hotKeySignature, id: UInt32(identifier))
        let status = RegisterEventHotKey(UInt32(chord.keyCode), chord.modifiers.carbonFlags, hotKeyIdentifier, GetApplicationEventTarget(), OptionBits(kEventHotKeyExclusive), &reference)
        return (status == noErr ? reference : nil, status)
    }
}
