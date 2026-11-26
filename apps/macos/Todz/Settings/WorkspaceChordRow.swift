import SwiftUI
import TodzKit

private let escapeKeyCode = 53

struct WorkspaceChordRow: View {
    let action: WorkspaceAction
    let title: String
    @Binding var refusal: RebindRefusal?
    @Environment(WorkspaceShortcutController.self) private var shortcuts
    @State private var keyMonitor: Any?

    var body: some View {
        LabeledContent(title) {
            HStack {
                chordText
                Button(isRecording ? WorkspaceShortcutsCopy.cancel : WorkspaceShortcutsCopy.record, action: toggleRecording)
            }
        }
        .onDisappear(perform: stopRecording)
    }

    @ViewBuilder private var chordText: some View {
        if isRecording {
            Text(WorkspaceShortcutsCopy.recording)
                .foregroundStyle(.secondary)
        }
        if !isRecording, let chord = shortcuts.globalChords.chord(for: action) {
            Text(chord.label)
                .monospaced()
        }
        if !isRecording, let availability = shortcuts.availability(of: action), let note = WorkspaceShortcutsCopy.unavailable(availability) {
            Text(note)
                .foregroundStyle(.secondary)
        }
    }

    private var isRecording: Bool {
        keyMonitor != nil
    }

    private func toggleRecording() {
        guard !isRecording else { return stopRecording() }
        refusal = nil
        shortcuts.suspendHotKeys()
        keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let isEscape = Int(event.keyCode) == escapeKeyCode
            let chord = KeyChord(event: event)
            MainActor.assumeIsolated { capture(chord: isEscape ? nil : chord) }
            return nil
        }
    }

    private func stopRecording() {
        guard let keyMonitor else { return }
        NSEvent.removeMonitor(keyMonitor)
        self.keyMonitor = nil
        shortcuts.registerHotKeys()
    }

    private func capture(chord: KeyChord?) {
        guard let chord else { return stopRecording() }
        refusal = shortcuts.rebind(action, to: chord)
        stopRecording()
    }
}
