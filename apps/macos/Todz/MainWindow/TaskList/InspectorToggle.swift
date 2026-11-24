import SwiftUI

private let inspectorSymbol = "sidebar.trailing"

struct InspectorToggle: View {
    @Environment(MainWindowState.self) private var windowState

    var body: some View {
        Button {
            windowState.isInspectorPresented.toggle()
        } label: {
            Label(windowState.inspectorToggleTitle, systemImage: inspectorSymbol)
        }
        .help(windowState.inspectorToggleTitle)
    }
}
