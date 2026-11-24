import SwiftUI

struct WidgetPrompt<Accessory: View>: View {
    let title: String
    @ViewBuilder let accessory: Accessory

    var body: some View {
        VStack(alignment: .leading) {
            Text(title)
                .font(.headline)
                .unredacted()
            accessory
            Spacer()
            Text(WidgetCopy.noSnapshot)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

extension WidgetPrompt where Accessory == EmptyView {
    init(title: String) {
        self.init(title: title) { EmptyView() }
    }
}
