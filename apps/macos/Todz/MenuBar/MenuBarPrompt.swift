import SwiftUI

struct MenuBarPrompt: View {
    let line: String
    @Environment(MenuBarPanel.self) private var panel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack {
            Text(line)
                .multilineTextAlignment(.center)
            Button(MenuBarCopy.openWindow, action: openMainWindow)
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
            MenuBarQuitButton()
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background {
            Button(MenuBarCopy.openWindow, action: openMainWindow)
                .keyboardShortcut(MenuBarShortcut.openWindow)
                .hidden()
        }
    }

    private func openMainWindow() {
        panel.openMainWindow(openWindow)
    }
}
