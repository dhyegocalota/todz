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
                ValidationLine(text: KeyScreenCopy.cursorDidNotOpen, tone: .issue)
            }
        }
        .onChange(of: secret) { didNotOpen = false }
    }

    private func open() {
        guard let secret else { return }
        let link = AgentCommand.cursorLink(serverURL: serverURL, secret: secret)
        guard let handlerApplicationURL = NSWorkspace.shared.urlForApplication(toOpen: link) else {
            didNotOpen = true
            return
        }
        let handlerIdentifier = Bundle(url: handlerApplicationURL)?.bundleIdentifier
        guard AgentCommand.isCursor(bundleIdentifier: handlerIdentifier) else {
            didNotOpen = true
            return
        }
        Task {
            do {
                _ = try await NSWorkspace.shared.open([link], withApplicationAt: handlerApplicationURL, configuration: NSWorkspace.OpenConfiguration())
                didNotOpen = false
            } catch {
                didNotOpen = true
            }
        }
    }
}
