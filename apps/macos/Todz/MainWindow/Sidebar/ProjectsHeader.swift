import SwiftUI

private let addSymbol = "plus"
private let shownOpacity: Double = 1
private let hiddenOpacity: Double = 0

struct ProjectsHeader: View {
    @Environment(MainWindowState.self) private var windowState
    @State private var isHovering = false

    var body: some View {
        HStack {
            Text(MainWindowCopy.projects)
            Spacer()
            Button {
                windowState.sheet = .newProject
            } label: {
                Image(systemName: addSymbol)
            }
            .buttonStyle(.borderless)
            .help(MainWindowCopy.newProject)
            .accessibilityLabel(AccessibilityCopy.addProject)
            .opacity(isHovering ? shownOpacity : hiddenOpacity)
        }
        .onHover { isHovering = $0 }
    }
}
