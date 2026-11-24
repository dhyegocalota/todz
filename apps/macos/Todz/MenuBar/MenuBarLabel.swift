import SwiftUI
import TodzKit

private let statusSymbol = "checkmark.square"

struct MenuBarLabel: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        Image(systemName: statusSymbol)
            .accessibilityLabel(MainWindowCopy.windowTitle)
            .task { await model.launch() }
    }
}
