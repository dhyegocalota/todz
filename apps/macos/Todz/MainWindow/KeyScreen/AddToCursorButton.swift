import AppKit
import SwiftUI
import TodzKit

private let addToCursorSymbol = "arrow.up.forward.app"

struct AddToCursorButton: View {
    let serverURL: URL
    let secret: String?
    let disabledReason: String?
    @State private var didNotOpen = false

    var body: some View {
        VStack(alignment: .leading) {
            Button(action: open) {
                Label(KeyScreenCopy.addToCursor, systemImage: addToCursorSymbol)
            }
            .buttonStyle(.bordered)
            .disabled(because: disabledReason)
            if didNotOpen {
                KeyScreenFailureLine(text: KeyScreenCopy.cursorDidNotOpen)
            }
        }
        .onChange(of: secret) { didNotOpen = false }
    }

    private func open() {
        guard let secret else { return }
        didNotOpen = !NSWorkspace.shared.open(AgentCommand.cursorLink(serverURL: serverURL, secret: secret))
    }
}
