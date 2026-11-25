import SwiftUI

struct MenuBarQuitButton: View {
    var body: some View {
        Button(MenuBarCopy.quit) {
            NSApp.terminate(nil)
        }
        .buttonStyle(.borderless)
    }
}
