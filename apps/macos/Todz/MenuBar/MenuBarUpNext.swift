import SwiftUI
import TodzKit

struct MenuBarUpNext: View {
    let task: BoardTask
    let focus: FocusState<MenuBarFocus?>.Binding
    let navigate: (MenuBarDirection) -> Void

    var body: some View {
        VStack(alignment: .leading) {
            Text(MenuBarCopy.upNext)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
            MenuBarRow(task: task, isUpNext: true, focus: focus, navigate: navigate)
                .id(task.key)
                .transition(.opacity)
        }
        .padding(.bottom)
        .todzAnimation(.settle, value: task.key)
    }
}
