import SwiftUI

private let placeholderSymbol = "circle"

struct MenuBarSkeleton: View {
    var body: some View {
        VStack(alignment: .leading) {
            ForEach(MenuBarCopy.placeholderTitles, id: \.self) { title in
                HStack {
                    Image(systemName: placeholderSymbol)
                    Text(title)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .redacted(reason: .placeholder)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(MainWindowCopy.loading)
    }
}
