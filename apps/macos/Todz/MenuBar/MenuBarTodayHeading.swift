import SwiftUI

struct MenuBarTodayHeading: View {
    let openCount: Int

    var body: some View {
        HStack {
            Text(MainWindowCopy.today)
            Text(MenuBarCopy.left(count: openCount))
                .foregroundStyle(.secondary)
        }
        .font(.headline)
        .accessibilityElement(children: .combine)
        .padding(.horizontal)
        .padding(.top)
    }
}
