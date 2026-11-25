import SwiftUI

struct MenuBarTodayHeading: View {
    let title: String
    let openCount: Int

    var body: some View {
        HStack {
            Text(title)
            Text(MenuBarCopy.left(count: openCount))
                .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .padding(.horizontal)
        .padding(.top)
    }
}
